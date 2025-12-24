
/* MovieBase shared app.js (fixed)
   - Robust Google GIS init (retry until SDK ready)
   - Better backend error visibility
   - Feed Wall now uses Apps Script (sheet) so cross-device sync works
*/

const CONFIG = {
  GAS_WEBAPP_URL: "https://moviebase-proxy.wenwen951009.workers.dev/",
  GOOGLE_CLIENT_ID: "709445153038-vh9tvcrk5vtj0r3il5r81j9gl1k68l98.apps.googleusercontent.com",
};

const MB = {
  state: {
    mode: "unknown", // "unknown" | "guest" | "user"
    user: null,      // {sub,email,name,picture}
  }
};

const $ = (q, root = document) => root.querySelector(q);

/* =========================
   Toast
========================= */
function toast(msg) {
  const el = $("#toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.style.display = "none"), 2400);
}

/* =========================
   API (robust JSON handling)
========================= */
async function apiFetch_(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();

  // Apps Script 權限/錯誤時常回 HTML，這裡直接把前 200 字顯示出來，方便你抓真因
  try {
    return JSON.parse(text);
  } catch (e) {
    const head = text.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(`Backend not JSON (HTTP ${res.status}): ${head}`);
  }
}

async function apiPOST(payload) {
  return apiFetch_(CONFIG.GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
}

async function apiGET(params) {
  // 保留 apiGET 名稱，但實際上走 POST，避免任何地方再用 GET 出事
  return apiPOST(params || {});
}




async function verifyMe() {
  const idToken = localStorage.getItem("id_token");
  if (!idToken) return null;

  const data = await apiPOST({ action: "me", idToken });
  if (!data.ok) {
    // ✅ token 壞掉就清掉
    localStorage.removeItem("id_token");
    throw new Error(data.error || "me failed");
  }
  return data.user;
}


/* =========================
   After-auth redirect
========================= */
function getAfterAuthUrl() {
  return window.MB_AFTER_AUTH_URL || localStorage.getItem("mb_after_auth_url") || "";
}
function clearAfterAuthUrl() {
  localStorage.removeItem("mb_after_auth_url");
}
function goAfterAuthIfNeeded() {
  const url = getAfterAuthUrl();
  if (!url) return;
  clearAfterAuthUrl();
  location.href = url;
}

/* =========================
   Auth State + UI
========================= */
function setModeGuest() {
  MB.state.mode = "guest";
  MB.state.user = null;
  localStorage.removeItem("id_token");
  localStorage.setItem("mode", "guest");
  renderAuthUI();
  window.dispatchEvent(new Event("mb:auth"));
}

function setModeUser(user) {
  MB.state.mode = "user";
  MB.state.user = user || null;
  localStorage.setItem("mode", "user");
  renderAuthUI();
  window.dispatchEvent(new Event("mb:auth"));
}

function renderAuthUI() {
  const isUser = MB.state.mode === "user" && MB.state.user;
  const isGuest = MB.state.mode === "guest";

  // 給 CSS / 貼文作者用
  document.documentElement.setAttribute("data-role", MB.state.mode);
  if (isUser) {
    document.documentElement.setAttribute("data-user-name", MB.state.user.name || MB.state.user.email || "MovieBase");
  } else {
    document.documentElement.removeAttribute("data-user-name");
  }

  const badge = $("#authBadge");
  const name = $("#authName");
  const pic = $("#authPic");

  if (badge) badge.textContent = isUser ? "目前：已登入" : (isGuest ? "目前：訪客" : "目前：未登入");
  if (name) name.textContent = isUser ? (MB.state.user.name || MB.state.user.email || "") : (isGuest ? "Guest" : "");
  if (pic) {
    pic.src = isUser ? (MB.state.user.picture || "") : "";
    pic.style.display = isUser && MB.state.user.picture ? "inline-block" : "none";
  }

  const show = (el, on) => { if (el) el.style.display = on ? "" : "none"; };

  const btnLogout = $("#btnLogout");
  const btnLogoutTop = $("#btnLogoutTop");
  const btnOpenLogin = $("#btnOpenLogin");

  const btnLogin = $("#btnLogin");
  const btnLogin2 = $("#btnLogin2");
  const btnGuest = $("#btnGuest");
  const btnGuest2 = $("#btnGuest2");

  if (isUser) {
    show(btnLogout, true);
    show(btnLogoutTop, true);
    show(btnOpenLogin, false);
    show(btnLogin, false);
    show(btnLogin2, false);
    show(btnGuest, false);
    show(btnGuest2, false);
  } else if (isGuest) {
    show(btnLogout, false);
    show(btnLogoutTop, false);
    show(btnOpenLogin, true);
    show(btnLogin, true);
    show(btnLogin2, true);
    show(btnGuest, false);
    show(btnGuest2, false);
  } else {
    show(btnLogout, false);
    show(btnLogoutTop, false);
    show(btnOpenLogin, true);
    show(btnLogin, true);
    show(btnLogin2, true);
    show(btnGuest, true);
    show(btnGuest2, true);
  }
}

/* =========================
   Permission Gate
========================= */
function requireLogin(featureName = "此功能") {
  if (MB.state.mode !== "user") {
    toast(`${featureName} 需要先登入 Google`);
    openLoginModal({ reset: true });
    return false;
  }
  return true;
}

/* =========================
   Modal
========================= */
function getModalEl() {
  return $("#loginModal") || $("#modal");
}

function resetEntryChooserIfAny() {
  $("#chooseBox")?.classList.remove("hidden");
  $("#googleBox")?.classList.add("hidden");
}

function openLoginModal(opts = {}) {
  const m = getModalEl();
  if (!m) return;
  if (opts.reset) resetEntryChooserIfAny();
  m.classList.add("is-open");
  m.classList.add("open");
  m.setAttribute("aria-hidden", "false");
}

function closeLoginModal() {
  const m = getModalEl();
  if (!m) return;
  m.classList.remove("is-open");
  m.classList.remove("open");
  m.setAttribute("aria-hidden", "true");
}

/* =========================
   Theme Toggle
========================= */
function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("theme", t);
  localStorage.setItem("moviebase_theme", t);
}

function initThemeToggle() {
  const btn = $("#themeToggle");
  if (!btn) return;

  const saved = localStorage.getItem("moviebase_theme") || localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") applyTheme(saved);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(cur === "light" ? "dark" : "light");
  }, true);
}

/* =========================
   Google Login (robust init)
========================= */
function initGoogle(retry = 0) {
  // GIS script 用 async 載入，常常 boot 時還沒 ready，這裡重試
  if (!window.google || !google.accounts?.id) {
    if (retry < 80) return setTimeout(() => initGoogle(retry + 1), 100);
    console.warn("Google SDK not ready (timeout)");
    return;
  }

  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: async (resp) => {
      try {
        localStorage.setItem("id_token", resp.credential);

        const user = await verifyMe();
        setModeUser(user);

        closeLoginModal();
        toast("登入成功");
        goAfterAuthIfNeeded();
      } catch (e) {
        console.error(e);

        // ✅ 直接顯示後端真正錯誤（例如 aud mismatch / 權限 / 非 JSON）
        toast(`登入失敗：${String(e.message || e)}`.slice(0, 120));
        localStorage.removeItem("id_token");
        setModeGuest();
      }
    }
  });

  const gsi = $("#gsiBtn");
  if (gsi) {
    gsi.innerHTML = "";
    google.accounts.id.renderButton(gsi, { theme: "outline", size: "large" });
  }
}

/* =========================
   Boot
========================= */
async function boot() {
  initThemeToggle();

  $("#modalClose")?.addEventListener("click", closeLoginModal);

  const m = getModalEl();
  m?.addEventListener("click", (e) => {
    if (e.target === m) closeLoginModal();
  });

  $("#btnOpenLogin")?.addEventListener("click", () => openLoginModal({ reset: true }));
  $("#btnLogin")?.addEventListener("click", () => openLoginModal({ reset: true }));
  $("#btnLogin2")?.addEventListener("click", () => openLoginModal({ reset: true }));

  const guestHandler = () => {
    setModeGuest();
    closeLoginModal();
    toast("已用訪客模式進入（禁止紀錄與互動）");
  };
  $("#btnGuest")?.addEventListener("click", guestHandler);
  $("#btnGuest2")?.addEventListener("click", guestHandler);

  const logoutHandler = () => {
    try {
      if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
    } catch (_) {}
    setModeGuest();
    toast("已登出");
  };
  $("#btnLogout")?.addEventListener("click", logoutHandler);
  $("#btnLogoutTop")?.addEventListener("click", logoutHandler);

  // ✅ 入口頁：不自動判定 guest/user
  if (window.MB_NO_AUTO_MODE) {
    MB.state.mode = "unknown";
    MB.state.user = null;
    renderAuthUI();
    initGoogle();
    return;
  }

  const savedMode = localStorage.getItem("mode");
  if (savedMode === "guest") {
    setModeGuest();
  } else {
    try {
      const user = await verifyMe();
      if (user) setModeUser(user);
      else setModeGuest();
    } catch (e) {
      console.error(e);
      localStorage.removeItem("id_token");   // ✅ 加這行
      setModeGuest();
    }
  }

  initGoogle();
}

/* expose */
window.MB = MB;
window.MB_requireLogin = requireLogin;
window.MB_openLoginModal = (opts) => openLoginModal(opts || { reset: true });

window.addEventListener("load", boot);

/* =========================
   Feed Wall (Sheet-backed)
   - works for app.html hall tab (ids: postList/postForm/...)
   + supports up to 4 photos per post (front-end)
========================= */
(function () {
  const hasEl = (id) => !!document.getElementById(id);

  // app.html hall tab 會有這些
  if (!hasEl("postList") || !hasEl("postForm")) return;

  function $(id) { return document.getElementById(id); }

  function splitTags(s) {
    return (s || "")
      .split(/[\s,]+/)
      .map(x => x.trim())
      .filter(Boolean)
      .map(t => (t.startsWith("#") ? t : `#${t}`))
      .slice(0, 12);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function moodStars(n) {
    const m = Math.min(5, Math.max(1, Number(n || 3)));
    return "★".repeat(m);
  }

  function kindLabel(k) {
    if (k === "series") return "影集";
    if (k === "anime") return "動畫";
    if (k === "other") return "其他";
    return "電影";
  }

  // ---- photos helpers (front-end) ----
  const MAX_PHOTOS = 4;
  const MAX_EACH_BYTES = 1.5 * 1024 * 1024; // 1.5MB (可自行調)

  function pickPhotoArrayFromRow(row) {
    // 後端可能回不同欄位名：盡量都吃
    let photos =
      row.photos ||
      row.photoUrls ||
      row.images ||
      row.imageUrls ||
      null;

    // 有些人會把 JSON 字串放在 photosJson / photos 欄位
    if (!photos && typeof row.photosJson === "string") {
      try { photos = JSON.parse(row.photosJson); } catch (_) {}
    }
    if (!photos && typeof row.photos === "string") {
      // row.photos 可能其實是一個 JSON 字串
      const s = row.photos.trim();
      if (s.startsWith("[") || s.startsWith("{")) {
        try { photos = JSON.parse(s); } catch (_) {}
      }
    }

    if (!photos) return [];

    // 允許：["url1","url2"] 或 [{url:"..."}, ...]
    if (Array.isArray(photos)) {
      return photos
        .map(p => (typeof p === "string" ? p : (p?.url || p?.src || "")))
        .filter(Boolean)
        .slice(0, MAX_PHOTOS);
    }

    return [];
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function readPhotosFromInput() {
    const input = $("postPhotos");
    if (!input || !input.files) return [];

    const files = Array.from(input.files || []);
    if (!files.length) return [];

    if (files.length > MAX_PHOTOS) {
      toast(`最多只能選 ${MAX_PHOTOS} 張照片喔！`);
      input.value = "";
      renderPhotoPreview([]);
      return [];
    }

    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        toast("只能上傳圖片檔喔！");
        input.value = "";
        renderPhotoPreview([]);
        return [];
      }
      if (f.size > MAX_EACH_BYTES) {
        toast("圖片太大了！建議每張 1.5MB 內（可先用手機/網站壓縮）");
        input.value = "";
        renderPhotoPreview([]);
        return [];
      }
    }

    const dataUrls = [];
    for (const f of files) {
      const url = await fileToDataUrl(f);
      dataUrls.push(url);
    }
    return dataUrls.slice(0, MAX_PHOTOS);
  }

  function renderPhotoPreview(urls) {
     const wrap = $("photoPreview");
     if (!wrap) return;
   
     if (!urls || !urls.length) {
       wrap.innerHTML = "";
       return;
     }
   
     // ✅ 強制縮圖尺寸（不靠 CSS）
     const BOX = window.innerWidth <= 480 ? 72 : 96;
   
     wrap.style.display = "flex";
     wrap.style.flexWrap = "wrap";
     wrap.style.gap = "10px";
     wrap.style.marginTop = "10px";
   
     wrap.innerHTML = urls.map(u => `
       <div class="pv" style="
         width:${BOX}px;
         height:${BOX}px;
         border-radius:14px;
         overflow:hidden;
         flex:0 0 auto;
       ">
         <img src="${escapeHtml(u)}" alt="preview" style="
           width:100%;
           height:100%;
           object-fit:cover;
           display:block;
         "/>
       </div>
     `).join("");
   }


     // ---- perf helpers ----//
  const debounce = (fn, ms = 250) => {
    let t = 0;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

   let __pvObjectUrls = []; // 記住上一批 objectURL，才能釋放記憶體

   function readPreviewUrlsFromInput() {
     const input = $("postPhotos");
     if (!input || !input.files) return [];
   
     const files = Array.from(input.files || []);
     if (!files.length) return [];
   
     // 跟 readPhotosFromInput 一樣的檢查
     if (files.length > MAX_PHOTOS) {
       toast(`最多只能選 ${MAX_PHOTOS} 張照片喔！`);
       input.value = "";
       renderPhotoPreview([]);
       return [];
     }
   
     for (const f of files) {
       if (!f.type.startsWith("image/")) {
         toast("只能上傳圖片檔喔！");
         input.value = "";
         renderPhotoPreview([]);
         return [];
       }
       if (f.size > MAX_EACH_BYTES) {
         toast("圖片太大了！建議每張 1.5MB 內（可先壓縮）");
         input.value = "";
         renderPhotoPreview([]);
         return [];
       }
     }

  // 釋放上一批 preview 的 objectURL，避免越選越吃 RAM
  __pvObjectUrls.forEach(u => URL.revokeObjectURL(u));
  __pvObjectUrls = files.map(f => URL.createObjectURL(f)).slice(0, MAX_PHOTOS);

  return __pvObjectUrls;
}

  // 預熱後端（減少第一次操作 3~8 秒）
  function warmupBackend() {
    // GET ping
    apiGET({ action: "ping" }).catch(() => {});
    // 若登入也順便 POST ping
    const idToken = localStorage.getItem("id_token");
    if (idToken) apiPOST({ action: "ping", idToken }).catch(() => {});
  }

  // ---- mapping row -> card ----
    function toCard(row) {
    const tags = splitTags(row.hashtags || "");
    const content = row.review || row.note || "";

    return {
      id: row.id,
      author: row.authorName || "User",
      title: row.title || "",
      kind: row.category || "movie",
      mood: row.rating || 3,
      content,
      tags,
      ts: row.ts || "",
      photos: row.photoUrls || [],
      likeCount: Number(row.likeCount || 0),
      liked: !!row.liked,
      commentCount: Number(row.commentCount || 0),
    };
  }


  function match(card, q) {
    const s = (q || "").trim().toLowerCase();
    if (!s) return true;
    const hay = [
      card.author, card.title, card.content,
      ...(card.tags || []),
      kindLabel(card.kind)
    ].join(" ").toLowerCase();

    if (s.startsWith("#")) {
      return (card.tags || []).some(t => t.toLowerCase() === s) || hay.includes(s);
    }
    return hay.includes(s);
  }

   function render(list, q) {
    const wrap = $("postList");
    if (!wrap) return;

    const filtered = list.filter(c => match(c, q));

    if (!filtered.length) {
      wrap.innerHTML = `<div class="muted">目前沒有貼文（或找不到符合搜尋）</div>`;
      return;
    }

    wrap.innerHTML = filtered.map(c => `
      <article class="feedCard">
        <div class="feedTop">
          <div class="feedMeta">
            <div class="avatar">${escapeHtml((c.author || "MB").slice(0, 2))}</div>
            <div class="metaText">
              <div class="name">${escapeHtml(c.author)}</div>
              <div class="time">${escapeHtml(c.ts || "")}</div>
            </div>
          </div>
          <div class="badges">
            <span class="badge">${escapeHtml(kindLabel(c.kind))}</span>
            <span class="badge">心情 ${escapeHtml(moodStars(c.mood))}</span>
          </div>
        </div>

        ${c.title ? `<div class="feedTitle">${escapeHtml(c.title)}</div>` : ""}
        <div class="feedContent">${escapeHtml(c.content)}</div>

        ${c.photos?.length ? `
          <div class="feedPhotos" data-count="${c.photos.length}">
            ${c.photos.slice(0, MAX_PHOTOS).map(u => `
              <a class="ph" href="${escapeHtml(u)}" target="_blank" rel="noopener">
                <img src="${escapeHtml(u)}" alt="photo" loading="lazy" />
              </a>
            `).join("")}
          </div>
        ` : ""}

        ${c.tags?.length ? `
          <div class="feedTags">
            ${c.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
          </div>
        ` : ""}

        <div class="feedActions">
          <button class="heartBtn ${c.liked ? "is-liked" : ""}" data-like-id="${escapeHtml(c.id)}" type="button">
            <span class="heartIcon">♥</span>
            <span class="heartCount">${Number(c.likeCount || 0)}</span>
          </button>

          <button class="commentBtn" data-comment-id="${escapeHtml(c.id)}" data-comment-title="${escapeHtml(c.title || "")}" type="button">
            <span class="commentIcon">💬</span>
            <span class="commentCount">${Number(c.commentCount || 0)}</span>
          </button>
        </div>
      </article>
    `).join("");
  }


  function applyRoleLock() {
    const isGuest = MB.state.mode !== "user";
    const hint = $("composerHint");
    if (hint) hint.textContent = isGuest ? "（登入後可發文 / 按讚 / 留言）" : "（已登入，可發文）";

    // 訪客：禁止輸入
    const form = $("postForm");
    if (form) {
      form.querySelectorAll("input, textarea, select, button").forEach(el => {
        // 仍允許操作 UI，但 submit 會被擋
        if (el.id === "btnPostSubmit") return;
        el.disabled = isGuest;
      });
    }
    const submit = $("btnPostSubmit");
    if (submit) submit.disabled = isGuest;

        // 訪客不能按愛心
   document.querySelectorAll("#postList .heartBtn").forEach(btn => {
     btn.disabled = isGuest;
     btn.title = isGuest ? "登入後才能按愛心" : "按愛心";
});

  }

  let ALL_CARDS = []; // ✅ 貼文快取：只要後端載入一次，搜尋就用它
  async function loadCards() {
     const idToken = localStorage.getItem("id_token") || "";
   
     // ✅ 不管登入或訪客，一律走 POST（後端只支援 doPost）
     const payload = idToken
       ? { action: "list_posts", idToken }
       : { action: "list_posts" };
   
     const data = await apiPOST(payload);
   
     // 如果後端回錯，直接丟出給外層顯示（你原本就有 toast / error 顯示）
     if (!data?.ok) throw new Error(data?.error || "list_posts failed");
   
     // ✅ 這裡維持你原本的渲染流程（看你原本怎麼用 data.rows）
     renderPosts_(data.rows); // ← 這行請保留你原本的渲染函式名稱
   }


  async function createCardFromForm() {
    const title = ($("postTitle")?.value || "").trim();
    const kind = ($("postKind")?.value || "movie").trim();
    const content = ($("postContent")?.value || "").trim();
    const tags = ($("postTags")?.value || "").trim();
    const mood = Number($("postMood")?.value || 3);

    if (!content) {
      toast("內容不能空白喔！");
      return null;
    }

    // ✅ NEW：讀取最多 4 張圖片（DataURL base64）
    const photoDataUrls = await readPhotosFromInput();

    const idToken = localStorage.getItem("id_token");
    const payload = {
      action: "create_post",
      idToken,
      title,
      category: kind,
      rating: Math.min(5, Math.max(1, mood)),
      review: content,
      hashtags: tags,
      photos: photoDataUrls, // ✅ NEW：丟給後端
    };

    const data = await apiPOST(payload);
    if (!data.ok) throw new Error(data.error || "create_post failed");
    return data.id;
  }

  let __cardsCache = [];
  let __loadedOnce = false;

  async function refresh(forceReload = true) {
     const q = $("postSearch")?.value || "";
   
     if (forceReload) {
       ALL_CARDS = await loadCards();      // ✅ 只有需要時才打後端
     }
   
     render(ALL_CARDS, q);                // ✅ 搜尋只用快取過濾
     applyRoleLock();
   }



  // Mount
  window.addEventListener("load", async () => {
    apiGET({ action: "ping" }).catch(()=>{});
    const idToken = localStorage.getItem("id_token");
    if (idToken) apiPOST({ action:"ping", idToken }).catch(()=>{});
    warmupBackend();
    try {
      applyRoleLock();
      await refresh({ force: true });
    } catch (e) {
      console.error(e);
      toast(`貼文讀取失敗：${String(e.message || e)}`.slice(0, 120));
    }


      $("postList")?.addEventListener("click", async (e) => {
        const btn = e.target.closest(".heartBtn");
        if (!btn) return;
      
        if (!requireLogin("按愛心")) return;
      
        const postId = btn.dataset.likeId;
        const countEl = btn.querySelector(".heartCount");
      
        // ✅ 先記住原狀態
        const wasLiked = btn.classList.contains("is-liked");
        const oldCount = Number(countEl?.textContent || "0");
      
        // ✅ 先在 UI 立刻更新（Optimistic）
        const nowLiked = !wasLiked;
        const nowCount = Math.max(0, oldCount + (nowLiked ? 1 : -1));
        btn.classList.toggle("is-liked", nowLiked);
        if (countEl) countEl.textContent = String(nowCount);
      
        btn.disabled = true;
      
        try {
          const idToken = localStorage.getItem("id_token");
          const data = await apiPOST({ action: "toggle_like", idToken, postId });
          if (!data.ok) throw new Error(data.error || "toggle_like failed");
      
          // ✅ 後端回來後，以後端為準（避免不同步）
          btn.classList.toggle("is-liked", !!data.liked);
          if (countEl) countEl.textContent = String(data.likeCount || 0);
      
        } catch (err) {
          // ✅ 失敗就回滾
          btn.classList.toggle("is-liked", wasLiked);
          if (countEl) countEl.textContent = String(oldCount);
      
          console.error(err);
          toast(`愛心失敗：${String(err.message || err)}`.slice(0, 120));
        } finally {
          btn.disabled = (MB.state.mode !== "user");
        }
      });



    $("btnRefreshPosts")?.addEventListener("click", async () => {
     try { await refresh(true); } catch (e) { toast(String(e.message || e)); }
   });

      $("postSearch")?.addEventListener("input", debounce(() => {
      const q = $("postSearch")?.value || "";
      render(__cardsCache, q);
      applyRoleLock();
    }, 180));


    // ✅ NEW：選圖預覽 + 限制最多 4 張
    $("postPhotos")?.addEventListener("change", () => {
     try {
       const urls = readPreviewUrlsFromInput(); // ✅ 超快，不讀 base64
       renderPhotoPreview(urls);
     } catch (e) {
       console.error(e);
       toast("讀取圖片失敗");
       $("postPhotos").value = "";
       renderPhotoPreview([]);
     }
   });


      $("postForm")?.addEventListener("submit", async (e) => {
         e.preventDefault();
         if (!requireLogin("發布貼文")) return;
   
         const submitBtn = $("btnPostSubmit");
         if (submitBtn) submitBtn.disabled = true;
   
         // 先做一張 pending 卡（立刻出現）
         const pendingId = "pending_" + Date.now();
         const author = MB.state.user?.name || MB.state.user?.email || "User";
         const tsNow = new Date().toISOString();
   
         const title = ($("postTitle")?.value || "").trim();
         const kind = ($("postKind")?.value || "movie").trim();
         const content = ($("postContent")?.value || "").trim();
         const tags = ($("postTags")?.value || "").trim();
         const mood = Number($("postMood")?.value || 3);
   
         if (!content) {
           toast("內容不能空白喔！");
           if (submitBtn) submitBtn.disabled = (MB.state.mode !== "user");
           return;
         }
   
         // 先讀圖片（你原本就會讀，所以這步不可省，但 UI 不再等後端才更新）
         let photoDataUrls = [];
         try {
           photoDataUrls = await readPhotosFromInput();
         } catch (_) {}
   
         const pendingCard = {
           id: pendingId,
           author,
           title,
           kind,
           mood,
           content: "（發佈中…）\n" + content,
           tags: splitTags(tags),
           ts: tsNow,
           photos: photoDataUrls,      // 預覽用 base64（成功後會 refresh 換成 drive URL）
           likeCount: 0,
           liked: false,
           commentCount: 0,
         };
   
         __cardsCache.unshift(pendingCard);
         render(__cardsCache, $("postSearch")?.value || "");
         applyRoleLock();
   
         try {
           // ✅ 用你的 createCardFromForm 送出（它會呼叫後端 create_post）
           await (async () => {
             const idToken = localStorage.getItem("id_token");
             const payload = {
               action: "create_post",
               idToken,
               title,
               category: kind,
               rating: Math.min(5, Math.max(1, mood)),
               review: content,
               hashtags: tags,
               photos: photoDataUrls,
             };
             const data = await apiPOST(payload);
             if (!data.ok) throw new Error(data.error || "create_post failed");
             return data.id;
           })();
   
           // reset form
           if ($("postTitle")) $("postTitle").value = "";
           if ($("postContent")) $("postContent").value = "";
           if ($("postTags")) $("postTags").value = "";
           if ($("postPhotos")) $("postPhotos").value = "";
           renderPhotoPreview([]);
   
           toast("✅ 已發布（同步中…）");
   
           // 後端完成後強制刷新一次，把 pending 換成正式（含 Drive URL、時間等）
           await refresh({ force: true });
         } catch (err) {
           console.error(err);
           // 發佈失敗：把 pending 卡移除
           __cardsCache = __cardsCache.filter(x => x.id !== pendingId);
           render(__cardsCache, $("postSearch")?.value || "");
           applyRoleLock();
   
           toast(`發布失敗：${String(err.message || err)}`.slice(0, 140));
         } finally {
           if (submitBtn) submitBtn.disabled = (MB.state.mode !== "user");
         }
       });


      
      let currentCommentPostId = "";
      let currentCommentBtn = null;
      
      let currentCommentReq = 0;                 // ✅ 防 A/B 競速覆蓋
      const COMMENT_CACHE = new Map();           // ✅ { postId -> {at:number, rows:Array} }
      const CACHE_TTL_MS = 30 * 1000;            // ✅ 30 秒內視為新鮮（可調）

      
      function openCommentModal(postId, title, btnEl) {
        const m = document.getElementById("commentModal");
        if (!m) return;
      
        currentCommentPostId = String(postId || "");
        currentCommentBtn = btnEl || null;
      
        const t = document.getElementById("commentModalTitle");
        if (t) t.textContent = title ? `留言｜${title}` : "留言";
      
        // ✅ 1) 先立即開窗（不要等後端）
        m.classList.add("is-open");
        m.setAttribute("aria-hidden", "false");
      
        applyCommentRoleLock();
      
        // ✅ 2) 先畫出「快取」或「載入中」
        const wrap = document.getElementById("commentList");
        const cached = COMMENT_CACHE.get(currentCommentPostId);
        const fresh = cached && (Date.now() - cached.at < CACHE_TTL_MS);
      
        if (cached?.rows?.length) {
          renderComments(cached.rows);                 // ✅ 秒顯示（就算不是最新）
          if (!fresh && wrap) {
            // 非新鮮：在最上面提示一下（可選）
            // wrap.insertAdjacentHTML("afterbegin", `<div class="muted">更新中…</div>`);
          }
        } else {
          if (wrap) wrap.innerHTML = `<div class="muted">載入留言中…</div>`;
        }
      
        // ✅ 3) 下一個 frame 再去抓最新（讓 UI 一定先渲染出來）
        requestAnimationFrame(() => {
          refreshComments({ force: !fresh });
        });
      }

      
      function closeCommentModal() {
        const m = document.getElementById("commentModal");
        if (!m) return;
        m.classList.remove("is-open");
        m.setAttribute("aria-hidden", "true");
        currentCommentPostId = "";
        currentCommentBtn = null;
      }
      
      function applyCommentRoleLock() {
        const isGuest = MB.state.mode !== "user";
        const hint = document.getElementById("commentHint");
        const input = document.getElementById("commentInput");
        const send = document.getElementById("commentSend");
      
        if (hint) hint.textContent = isGuest ? "（登入後才能留言）" : "（已登入，可留言）";
        if (input) input.disabled = isGuest;
        if (send) send.disabled = isGuest;
      }
      
      function renderComments(list) {
        const wrap = document.getElementById("commentList");
        if (!wrap) return;
      
        if (!list || !list.length) {
          wrap.innerHTML = `<div class="muted">目前還沒有留言</div>`;
          return;
        }
      
        wrap.innerHTML = list.map(c => `
          <div class="commentItem">
            <div class="commentMeta">
              <span class="commentName">${escapeHtml(c.authorName || "User")}</span>
              <span class="commentTime">${escapeHtml(c.ts || "")}</span>
            </div>
            <div class="commentText">${escapeHtml(c.content || "")}</div>
          </div>
        `).join("");
      }
      
      async function refreshComments(opts = {}) {
        try {
          if (!currentCommentPostId) return;
      
          const force = !!opts.force;
          const postId = String(currentCommentPostId);
      
          const cached = COMMENT_CACHE.get(postId);
          if (!force && cached && (Date.now() - cached.at < CACHE_TTL_MS)) {
            renderComments(cached.rows || []);
            return;
          }
      
          const data = await apiGET({ action: "list_comments", postId, limit: "50" });
          if (!data.ok) throw new Error(data.error || "list_comments failed");
      
          const rows = data.rows || [];
          COMMENT_CACHE.set(postId, { at: Date.now(), rows });
          renderComments(rows);
        } catch (e) {
          // ✅ 只要 currentCommentPostId 還是同一篇，才顯示錯誤（避免 A/B 切換時覆蓋畫面）
          if (String(currentCommentPostId) !== String((opts && opts.postId) || currentCommentPostId)) return;
      
          const wrap = document.getElementById("commentList");
          if (wrap) wrap.innerHTML = `<div class="muted">留言載入失敗</div>`;
          console.error(e);
        }
      }


      
      // 1) 點 💬 開彈窗
      document.getElementById("postList")?.addEventListener("click", async (e) => {
        const btn = e.target.closest(".commentBtn");
        if (!btn) return;
      
        const postId = btn.dataset.commentId;
        const title = btn.dataset.commentTitle || "";
        openCommentModal(postId, title, btn);
      });
      
      // 2) Modal 關閉
      document.getElementById("commentModalClose")?.addEventListener("click", closeCommentModal);
      document.querySelector("#commentModal .mbModalBackdrop")?.addEventListener("click", closeCommentModal);
      
      // 3) 送出留言（只有登入可）
      document.getElementById("commentForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!requireLogin("留言")) return;
      
        const input = document.getElementById("commentInput");
        const text = (input?.value || "").trim();
        if (!text) return toast("留言不能空白喔！");
      
        const send = document.getElementById("commentSend");
        if (send) send.disabled = true;
      
        const postId = String(currentCommentPostId || "");
        const idToken = localStorage.getItem("id_token");
      
        // ✅ 先準備「我自己的名字」
        const myName =
          (MB.state.user && (MB.state.user.name || MB.state.user.email)) ||
          document.documentElement.getAttribute("data-user-name") ||
          "User";
      
        // ✅ 1) 先立刻插入一筆到畫面（不用等後端）
        const optimisticRow = {
          authorName: myName,
          ts: new Date().toISOString(),
          content: text
        };
      
        // 更新快取並立刻渲染
        const cached = COMMENT_CACHE.get(postId);
        const rowsNow = [optimisticRow, ...(cached?.rows || [])].slice(0, 50);
        COMMENT_CACHE.set(postId, { at: Date.now(), rows: rowsNow });
        renderComments(rowsNow);
      
        // 清空輸入框（體感更好）
        if (input) input.value = "";
      
        try {
          // ✅ 2) 再送到後端真的寫入
          const data = await apiPOST({ action: "add_comment", idToken, postId, content: text });
          if (!data.ok) throw new Error(data.error || "add_comment failed");
      
          // ✅ 更新卡片上的留言數（你原本有就保留）
          if (currentCommentBtn) {
            const el = currentCommentBtn.querySelector(".commentCount");
            if (el) el.textContent = String(Number(el.textContent || "0") + 1);
          }
      
          toast("✅ 已留言");
      
          // ✅ 3) 背景強制同步一次（避免多人留言或排序不同步）
          //    這裡用 delete 確保不會被 TTL 短路
          COMMENT_CACHE.delete(postId);
          await refreshComments({ force: true });
      
        } catch (err) {
          console.error(err);
          toast(`留言失敗：${String(err.message || err)}`.slice(0, 140));
      
          // 失敗回滾：把剛剛 optimistic 的那筆拿掉
          const cur = COMMENT_CACHE.get(postId);
          if (cur?.rows?.length) {
            const reverted = cur.rows.filter(r => !(r.ts === optimisticRow.ts && r.content === optimisticRow.content));
            COMMENT_CACHE.set(postId, { at: Date.now(), rows: reverted });
            renderComments(reverted);
          }
        } finally {
          applyCommentRoleLock();
        }
      });

      
      // 4) 登入狀態改變時，更新留言框可用性
      window.addEventListener("mb:auth", () => {
        applyCommentRoleLock();
      });

    window.addEventListener("mb:auth", async () => {
     applyRoleLock();
     try { await refresh(true); } catch (_) {}
   });

  });
})();

/* ============================
   Hall Fallback Loader (safe)
   - If your original hall loader breaks, this keeps posts visible.
   ============================ */

(function () {
  function escHtml_(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function pickPostListEl_() {
    return (
      document.querySelector("#postList") ||
      document.querySelector("#postsList") ||
      document.querySelector("[data-post-list]") ||
      document.querySelector(".postList")
    );
  }

  function normalizePhotos_(row) {
    let arr = [];
    const json = row?.photoUrlsJson || row?.photoUrls || "";
    if (json) {
      try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) arr = parsed;
      } catch (e) {}
    }
    if (!arr.length && row?.photoUrl) arr = [row.photoUrl];
    return arr.filter(Boolean);
  }

  async function fetchPosts_() {
    const idToken = localStorage.getItem("id_token") || "";
    const payload = idToken ? { action: "list_posts", idToken } : { action: "list_posts" };
    const data = await apiPOST(payload);
    if (!data?.ok) throw new Error(data?.error || "list_posts failed");
    return Array.isArray(data.rows) ? data.rows : [];
  }

  function renderPostsFallback_(rows) {
    const listEl = pickPostListEl_();
    if (!listEl) {
      console.warn("[HallFallback] post list container not found (#postList / .postList).");
      return false;
    }

    listEl.innerHTML = rows
      .map((r) => {
        const id = escHtml_(r.id);
        const author = escHtml_(r.authorName || "User");
        const title = escHtml_(r.title || "");
        const review = escHtml_(r.review || "");
        const ts = escHtml_(r.ts || r.createdAt || "");
        const likeCount = Number(r.likeCount || 0);
        const commentCount = Number(r.commentCount || 0);
        const isLiked = !!r.isLiked;

        const photos = normalizePhotos_(r);
        const photoHTML = photos.length
          ? `
            <div style="display:flex; gap:10px; margin-top:10px;">
              ${photos
                .map(
                  (url) => `
                <img
                  src="${escHtml_(url)}"
                  alt="photo"
                  style="flex:1; height:170px; object-fit:cover; border-radius:16px;"
                  loading="lazy"
                />
              `
                )
                .join("")}
            </div>
          `
          : "";

        return `
          <article class="postCard" style="margin-bottom:16px;">
            <div class="postHeader" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <div>
                <div class="postAuthor" style="font-weight:700;">${author}</div>
                <div class="postTime" style="opacity:.7; font-size:12px;">${ts}</div>
              </div>

              <div class="postActions" style="display:flex; align-items:center; gap:8px;">
                <button class="heartBtn" data-postid="${id}" aria-pressed="${isLiked ? "true" : "false"}"
                  style="cursor:pointer;">
                  ♥
                </button>
                <span class="heartCount">${likeCount}</span>

                <button class="commentBtn" data-postid="${id}" style="cursor:pointer;">
                  💬
                </button>
                <span class="commentCount">${commentCount}</span>
              </div>
            </div>

            <div class="postBody" style="margin-top:10px;">
              ${title ? `<div class="postTitle" style="font-size:16px; font-weight:700;">${title}</div>` : ""}
              ${review ? `<div class="postReview" style="margin-top:6px; line-height:1.6;">${review}</div>` : ""}
              ${photoHTML}
            </div>
          </article>
        `;
      })
      .join("");

    return true;
  }

  let __hallFallbackLoading = false;

  async function hallFallbackLoad_() {
    // 只在 #hall
    if (!String(location.hash || "").includes("hall")) return;

    // 避免重複跑
    if (__hallFallbackLoading) return;
    __hallFallbackLoading = true;

    try {
      const rows = await fetchPosts_();
      const ok = renderPostsFallback_(rows);
      console.log("[HallFallback] loaded:", rows.length, "rendered:", ok);
    } catch (e) {
      console.error(e);
      if (typeof toast === "function") toast(String(e?.message || e));
    } finally {
      __hallFallbackLoading = false;
    }
  }

  // 暴露一個你可以手動叫的
  window.MB_forceHall = hallFallbackLoad_;

  document.addEventListener("DOMContentLoaded", hallFallbackLoad_);
  window.addEventListener("hashchange", hallFallbackLoad_);
})();
