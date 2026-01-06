/* MovieBase shared app.js (CLEAN)
   - Theme toggle
   - Google GIS login
   - Auth UI (guest/user)
   - Feed wall: posts + photos + likes + comments modal
   - Account nickname
   - Account jump buttons (mine/liked/commented)
*/

const CONFIG = {
  GAS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbyuipb05zxPbPp7iAotqe_Oya4je2s-l3COcJ8kDO7e4VHjdLRuNwJhrymkPN02b9Sd/exec",
  GOOGLE_CLIENT_ID: "709445153038-vh9tvcrk5vtj0r3il5r81j9gl1k68l98.apps.googleusercontent.com",
};
window.CONFIG = CONFIG;

const MB = {
  state: {
    mode: "unknown",   // unknown | guest | user
    user: null,        // {name,email,picture,sub...}
    profile: null,     // {nickname,...}
    idToken: "",
  }
};
window.MB = MB;

// ---------- DOM helpers ----------
const qs  = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const byId = (id) => document.getElementById(id);

// ---------- Toast ----------
function toast(msg) {
  const el = byId("toast") || qs("#toast");
  if (!el) return alert(msg);
  el.textContent = String(msg);
  el.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.style.display = "none"), 2400);
}

// ---------- API ----------
async function apiFetch_(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
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
    body: JSON.stringify(payload || {}),
  });
}

async function apiGET(params) {
  const u = new URL(CONFIG.GAS_WEBAPP_URL);
  Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
  u.searchParams.set("_", String(Date.now())); // anti-cache
  return apiFetch_(u.toString(), { method: "GET", cache: "no-store" });
}

// ---------- Token helpers ----------
function isLikelyJwt_(t) {
  return typeof t === "string" && t.split(".").length === 3 && t.length > 30;
}

function getIdToken_() {
  const t =
    MB?.state?.idToken ||
    localStorage.getItem("idToken") ||
    localStorage.getItem("id_token") ||
    "";
  return isLikelyJwt_(t) ? t : "";
}

function clearIdToken_() {
  localStorage.removeItem("idToken");
  localStorage.removeItem("id_token");
  if (MB?.state) MB.state.idToken = "";
}

// ---------- Profile / display name ----------
async function loadProfile_() {
  const idToken = getIdToken_();
  if (!idToken) return null;
  const r = await apiPOST({ action: "get_profile", idToken });
  if (r && r.ok) {
    MB.state.profile = r.profile || r.row || r.data || { nickname: r.nickname };
  } else {
    MB.state.profile = null;
  }
  return MB.state.profile;
}

function displayName_(user = MB.state.user, profile = MB.state.profile) {
  const nick = profile?.nickname && String(profile.nickname).trim();
  return nick || user?.name || user?.email || "User";
}

// ---------- Modal ----------
function getModalEl() {
  return byId("loginModal") || byId("modal") || qs("#loginModal") || qs("#modal");
}

function resetEntryChooserIfAny() {
  byId("chooseBox")?.classList.remove("hidden");
  byId("googleBox")?.classList.add("hidden");
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

// ---------- Auth state ----------
function setModeGuest() {
  MB.state.mode = "guest";
  MB.state.user = null;
  MB.state.profile = null;
  MB.state.idToken = "";
  clearIdToken_();
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

  document.documentElement.setAttribute("data-role", MB.state.mode);

  if (isUser) {
    const dn = displayName_();
    document.documentElement.setAttribute("data-user-name", dn);
  } else {
    document.documentElement.removeAttribute("data-user-name");
  }

  const badge = byId("authBadge");
  const name = byId("authName");
  const pic = byId("authPic");

  if (badge) badge.textContent = isUser ? "目前：已登入" : (isGuest ? "目前：訪客" : "目前：未登入");
  if (name) name.textContent = isUser ? displayName_() : (isGuest ? "Guest" : "");
  if (pic) {
    pic.src = isUser ? (MB.state.user.picture || "") : "";
    pic.style.display = (isUser && MB.state.user.picture) ? "inline-block" : "none";
  }

  const show = (el, on) => { if (el) el.style.display = on ? "" : "none"; };

  const btnLogout = byId("btnLogout");
  const btnLogoutTop = byId("btnLogoutTop");
  const btnOpenLogin = byId("btnOpenLogin");
  const btnLogin = byId("btnLogin");
  const btnLogin2 = byId("btnLogin2");
  const btnGuest = byId("btnGuest");
  const btnGuest2 = byId("btnGuest2");

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

function requireLogin(featureName = "此功能") {
  if (MB.state.mode !== "user") {
    toast(`${featureName} 需要先登入 Google`);
    openLoginModal({ reset: true });
    return false;
  }
  return true;
}
window.MB_requireLogin = requireLogin;
window.MB_openLoginModal = (opts) => openLoginModal(opts || { reset: true });

// ---------- Theme ----------
function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("moviebase_theme", t);
  localStorage.setItem("theme", t);
}

function initThemeToggle() {
  const btn = byId("themeToggle");
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

// ---------- Google GIS ----------
async function verifyMe(idTokenFromLogin) {
  const idToken = idTokenFromLogin || getIdToken_();
  if (!idToken) throw new Error("missing idToken");

  const data = await apiPOST({ action: "me", idToken });
  if (!data || !data.ok) {
    clearIdToken_();
    throw new Error((data && data.error) || "me failed");
  }

  MB.state.idToken = idToken;
  localStorage.setItem("idToken", idToken);
  localStorage.setItem("id_token", idToken);

  try { await loadProfile_(); } catch (_) { MB.state.profile = null; }

  return data.user;
}

function initGoogle(retry = 0) {
  if (!window.google || !google.accounts?.id) {
    if (retry < 80) return setTimeout(() => initGoogle(retry + 1), 100);
    console.warn("Google SDK not ready (timeout)");
    return;
  }

  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: async (resp) => {
      try {
        const idToken = resp?.credential || "";
        if (!idToken) throw new Error("no credential from GIS");

        const user = await verifyMe(idToken);
        setModeUser(user);

        closeLoginModal();
        toast("登入成功");
        goHomeIfEntry_();
      } catch (e) {
        console.error(e);
        setModeGuest();
        toast(`登入失敗：${String(e.message || e)}`.slice(0, 120));
      }
    }
  });

  const gsi = byId("gsiBtn");
  if (gsi) {
    gsi.innerHTML = "";
    google.accounts.id.renderButton(gsi, { theme: "outline", size: "large" });
  }
}

// ---------- Page jump helper ----------
const APP_HOME_URL = "./app.html";

function isAppPage_() {
  // 兩種判斷都加，避免路徑不一致
  return /(^|\/)app\.html$/i.test(location.pathname) || !!document.getElementById("postList");
}

function goHomeIfEntry_() {
  // 只有在入口頁才跳，避免在 app.html 裡面亂跳造成迴圈
  if (!isAppPage_()) location.href = APP_HOME_URL;
}


// ---------- Boot ----------
async function boot() {
  initThemeToggle();

  byId("modalClose")?.addEventListener("click", closeLoginModal);
  const m = getModalEl();
  m?.addEventListener("click", (e) => { if (e.target === m) closeLoginModal(); });

  const openLogin = () => openLoginModal({ reset: true });
  byId("btnOpenLogin")?.addEventListener("click", openLogin);
  byId("btnLogin")?.addEventListener("click", openLogin);
  byId("btnLogin2")?.addEventListener("click", openLogin);

  const guestHandler = () => {
     setModeGuest();
     closeLoginModal();
     toast("已用訪客模式進入（禁止紀錄與互動）");
   
     // ✅ 訪客也要進主頁
     goHomeIfEntry_();
   };

  byId("btnGuest")?.addEventListener("click", guestHandler);
  byId("btnGuest2")?.addEventListener("click", guestHandler);

  const logoutHandler = () => {
    try { google.accounts?.id?.disableAutoSelect?.(); } catch (_) {}
    setModeGuest();
    toast("已登出");
  };
  byId("btnLogout")?.addEventListener("click", logoutHandler);
  byId("btnLogoutTop")?.addEventListener("click", logoutHandler);

  // restore mode
  // restore mode
   const savedMode = localStorage.getItem("mode");
   
   if (savedMode === "guest") {
     setModeGuest();
     goHomeIfEntry_(); // ✅ 如果上次就是訪客，直接進主頁
   } else {
     const hasToken = !!getIdToken_();
   
     if (hasToken) {
       try {
         const user = await verifyMe();
         setModeUser(user);
         goHomeIfEntry_(); // ✅ 如果已登入，直接進主頁
       } catch (e) {
         console.warn(e);
         setModeGuest();
         openLoginModal({ reset: true });
       }
     } else {
       // ✅ 第一次進來（沒選過訪客、也沒 token），留在入口頁讓他選
       MB.state.mode = "unknown";
       renderAuthUI();
       openLoginModal({ reset: true });
     }
   }
   }

  initGoogle();
}
window.addEventListener("load", boot);

// ---------- Account: nickname UI ----------
async function mbGetProfile_() {
  const idToken = getIdToken_();
  if (!idToken) return null;
  return await apiPOST({ action: "get_profile", idToken });
}
async function mbSetNickname_(nickname) {
  const idToken = getIdToken_();
  if (!idToken) throw new Error("not logged in");
  return await apiPOST({ action: "set_nickname", idToken, nickname });
}

function initNicknameUI_() {
  const card = byId("nickCard");
  if (!card) return;

  const statusEl = byId("nickStatus");
  const input = byId("nicknameInput");
  const btn = byId("btnSaveNickname");

  async function render() {
    const idToken = getIdToken_();
    if (!idToken || MB.state.mode !== "user") {
      card.style.display = "none";
      return;
    }
    card.style.display = "block";
    if (statusEl) statusEl.textContent = "讀取中...";

    try {
      const data = await mbGetProfile_();
      if (!data || !data.ok) throw new Error((data && data.error) || "get_profile failed");
      const nn = (data.profile?.nickname || "").trim();
      if (statusEl) statusEl.textContent = nn ? `目前暱稱：${nn}` : "目前暱稱：尚未設定";
      if (input) input.value = nn;
      MB.state.profile = data.profile || MB.state.profile;
      renderAuthUI(); // 右上角名字跟著換
    } catch (e) {
      if (statusEl) statusEl.textContent = "讀取暱稱失敗：" + String(e.message || e);
    }
  }

  btn?.addEventListener("click", async () => {
    const nn = (input?.value || "").trim();
    if (!nn) return toast("請輸入暱稱");
    btn.disabled = true;
    try {
      const out = await mbSetNickname_(nn);
      if (!out || !out.ok) throw new Error(out.error || "set_nickname failed");
      toast("已儲存暱稱");
      await loadProfile_();
      renderAuthUI();
      await render();
      window.MB_refreshPosts?.(true);
    } catch (e) {
      toast("儲存失敗：" + String(e.message || e));
    } finally {
      btn.disabled = false;
    }
  });

  render();
  window.addEventListener("mb:auth", render);
}
document.addEventListener("DOMContentLoaded", initNicknameUI_);

// ---------- Feed Wall (only if page has postList + postForm) ----------
(function feedWall(){
  if (!byId("postList") || !byId("postForm")) return;

  const MAX_PHOTOS = 4;
  const MAX_EACH_BYTES = 1.5 * 1024 * 1024;

  const debounce = (fn, ms = 200) => {
    let t = 0;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  function kindLabel(k) {
    if (k === "series") return "影集";
    if (k === "anime") return "動畫";
    if (k === "other") return "其他";
    return "電影";
  }
  function moodStars(n) {
    const m = Math.min(5, Math.max(1, Number(n || 3)));
    return "★".repeat(m);
  }
  function splitTags(s) {
    return (s || "")
      .split(/[\s,]+/)
      .map(x => x.trim())
      .filter(Boolean)
      .map(t => (t.startsWith("#") ? t : `#${t}`))
      .slice(0, 12);
  }

  function pickPhotoArrayFromRow(row) {
    let photos = row.photos || row.photoUrls || row.images || row.imageUrls || null;

    if (!photos && typeof row.photosJson === "string") {
      try { photos = JSON.parse(row.photosJson); } catch (_) {}
    }
    if (!photos && typeof row.photos === "string") {
      const s = row.photos.trim();
      if (s.startsWith("[") || s.startsWith("{")) {
        try { photos = JSON.parse(s); } catch (_) {}
      }
    }
    if (!photos) return [];

    if (Array.isArray(photos)) {
      return photos
        .map(p => (typeof p === "string" ? p : (p?.url || p?.src || "")))
        .filter(Boolean)
        .slice(0, MAX_PHOTOS);
    }
    return [];
  }

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
      photos: pickPhotoArrayFromRow(row),
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
    const wrap = byId("postList");
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
    const hint = byId("composerHint");
    if (hint) hint.textContent = isGuest ? "（登入後可發文 / 按讚 / 留言）" : "（已登入，可發文）";

    const form = byId("postForm");
    if (form) {
      form.querySelectorAll("input, textarea, select, button").forEach(el => {
        if (el.id === "btnPostSubmit") return;
        el.disabled = isGuest;
      });
    }
    const submit = byId("btnPostSubmit");
    if (submit) submit.disabled = isGuest;

    qsa("#postList .heartBtn").forEach(btn => {
      btn.disabled = isGuest;
      btn.title = isGuest ? "登入後才能按愛心" : "按愛心";
    });
  }

  function normalizeFeedMode_(m) {
    m = String(m || "").toLowerCase().trim();
    if (m === "my_posts" || m === "posts" || m === "mine") return "mine";
    if (m === "my_likes" || m === "likes" || m === "liked") return "liked";
    if (m === "my_comments" || m === "comments" || m === "commented") return "commented";
    return "all";
  }

  let FEED_MODE = "all";
  try {
    const sp = new URLSearchParams(location.search);
    const fromUrl = sp.get("feed");
    const fromLs = localStorage.getItem("mb_feed_mode");
    FEED_MODE = normalizeFeedMode_(fromUrl || fromLs || "all");
    if (fromLs) localStorage.removeItem("mb_feed_mode");
  } catch (_) {}

  window.MB_setFeedMode = (mode) => { FEED_MODE = normalizeFeedMode_(mode); };
  window.MB_getFeedMode = () => FEED_MODE;

  let ALL_CARDS = [];

  async function loadCards(mode = FEED_MODE) {
    mode = normalizeFeedMode_(mode);
    const idToken = getIdToken_();

    let payload;
    if (mode === "mine") {
      if (!idToken) throw new Error("not logged in");
      payload = { action: "list_my_posts", idToken };
      } else if (mode === "liked") {
      // 你的後端沒有 list_my_likes，所以改用 list_posts 再用 liked 欄位篩選
      if (!idToken) throw new Error("not logged in");
      payload = { action: "list_posts", idToken, __clientFilter: "liked" };
      } else if (mode === "commented") {
      if (!idToken) throw new Error("not logged in");
      payload = { action: "list_my_comments", idToken };
    } else {
      payload = idToken ? { action: "list_posts", idToken } : { action: "list_posts" };
    }

    const data = await apiPOST(payload);

    if (!data.ok && String(data.error || "").includes("invalid_token")) {
      clearIdToken_();
      setModeGuest();
      return [];
    }
    if (!data.ok) throw new Error(data.error || "list_posts failed");

    let rows = data.rows || [];
    if (payload.__clientFilter === "liked") {
      rows = rows.filter(r => !!r.liked);
    }
    const cards = rows.map(toCard);

    cards.sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));
    return cards;
  }

  async function refresh(forceReload = true) {
    const q = byId("postSearch")?.value || "";
    if (forceReload) ALL_CARDS = await loadCards(FEED_MODE);
    render(ALL_CARDS, q);
    applyRoleLock();
  }

  window.MB_refreshPosts = (force = true) => refresh(force);
  window.MB_showFeed = async (mode) => {
    window.MB_setFeedMode(mode);
    await refresh(true);
    byId("postList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // --- photos preview ---
  let __pvObjectUrls = [];

  function renderPhotoPreview(urls) {
    const wrap = byId("photoPreview");
    if (!wrap) return;
    if (!urls || !urls.length) { wrap.innerHTML = ""; return; }

    const BOX = window.innerWidth <= 480 ? 72 : 96;
    wrap.style.display = "flex";
    wrap.style.flexWrap = "wrap";
    wrap.style.gap = "10px";
    wrap.style.marginTop = "10px";

    wrap.innerHTML = urls.map(u => `
      <div class="pv" style="width:${BOX}px;height:${BOX}px;border-radius:14px;overflow:hidden;flex:0 0 auto;">
        <img src="${escapeHtml(u)}" alt="preview" style="width:100%;height:100%;object-fit:cover;display:block;" />
      </div>
    `).join("");
  }

  function readPreviewUrlsFromInput() {
    const input = byId("postPhotos");
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
        toast("圖片太大了！建議每張 1.5MB 內（可先壓縮）");
        input.value = "";
        renderPhotoPreview([]);
        return [];
      }
    }

    __pvObjectUrls.forEach(u => URL.revokeObjectURL(u));
    __pvObjectUrls = files.map(f => URL.createObjectURL(f)).slice(0, MAX_PHOTOS);
    return __pvObjectUrls;
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
    const input = byId("postPhotos");
    if (!input || !input.files) return [];
    const files = Array.from(input.files || []);
    if (!files.length) return [];

    if (files.length > MAX_PHOTOS) return [];

    const dataUrls = [];
    for (const f of files) {
      dataUrls.push(await fileToDataUrl(f));
    }
    return dataUrls.slice(0, MAX_PHOTOS);
  }

  // --- Likes ---
  byId("postList")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".heartBtn");
    if (!btn) return;
    if (!requireLogin("按愛心")) return;

    const postId = btn.dataset.likeId;
    const countEl = btn.querySelector(".heartCount");

    const wasLiked = btn.classList.contains("is-liked");
    const oldCount = Number(countEl?.textContent || "0");

    const nowLiked = !wasLiked;
    const nowCount = Math.max(0, oldCount + (nowLiked ? 1 : -1));
    btn.classList.toggle("is-liked", nowLiked);
    if (countEl) countEl.textContent = String(nowCount);

    btn.disabled = true;

    try {
      const idToken = getIdToken_();
      const data = await apiPOST({ action: "toggle_like", idToken, postId });
      if (!data.ok) throw new Error(data.error || "toggle_like failed");
      btn.classList.toggle("is-liked", !!data.liked);
      if (countEl) countEl.textContent = String(data.likeCount || 0);
    } catch (err) {
      btn.classList.toggle("is-liked", wasLiked);
      if (countEl) countEl.textContent = String(oldCount);
      console.error(err);
      toast(`愛心失敗：${String(err.message || err)}`.slice(0, 120));
    } finally {
      btn.disabled = (MB.state.mode !== "user");
    }
  });

  // --- Comments modal ---
  let currentCommentPostId = "";
  let currentCommentBtn = null;
  const COMMENT_CACHE = new Map(); // postId -> {at, rows}
  const CACHE_TTL_MS = 30 * 1000;

  function applyCommentRoleLock() {
    const isGuest = MB.state.mode !== "user";
    const hint = byId("commentHint");
    const input = byId("commentInput");
    const send = byId("commentSend");
    if (hint) hint.textContent = isGuest ? "（登入後才能留言）" : "（已登入，可留言）";
    if (input) input.disabled = isGuest;
    if (send) send.disabled = isGuest;
  }

  function renderComments(list) {
    const wrap = byId("commentList");
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

  async function refreshComments(force = false) {
    if (!currentCommentPostId) return;
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
  }

function openCommentModal(postId, title, btnEl) {
  const m = byId("commentModal");
  if (!m) return;

  // ✅ 重要：第一次打開留言時才綁事件（因為這時候 DOM 一定已經存在）
  if (m.dataset.bound !== "1") {
    m.dataset.bound = "1";

    byId("commentModalClose")?.addEventListener("click", closeCommentModal);
    qs("#commentModal .mbModalBackdrop")?.addEventListener("click", closeCommentModal);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCommentModal(); });

    byId("commentForm")?.addEventListener("submit", onCommentSubmit_);
  }

  currentCommentPostId = String(postId || "");
  currentCommentBtn = btnEl || null;

  const t = byId("commentModalTitle");
  if (t) t.textContent = title ? `留言｜${title}` : "留言";

  m.classList.add("is-open");
  m.setAttribute("aria-hidden", "false");
  applyCommentRoleLock();

  const wrap = byId("commentList");
  const cached = COMMENT_CACHE.get(currentCommentPostId);
  const fresh = cached && (Date.now() - cached.at < CACHE_TTL_MS);

  if (cached?.rows?.length) renderComments(cached.rows);
  else if (wrap) wrap.innerHTML = `<div class="muted">載入留言中…</div>`;

  requestAnimationFrame(() => {
    refreshComments(!fresh).catch(() => {
      if (wrap) wrap.innerHTML = `<div class="muted">留言載入失敗</div>`;
    });
  });
}

  function closeCommentModal() {
    const m = byId("commentModal");
    if (!m) return;
    m.classList.remove("is-open");
    m.setAttribute("aria-hidden", "true");
    currentCommentPostId = "";
    currentCommentBtn = null;
  }

  byId("postList")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".commentBtn");
    if (!btn) return;
    openCommentModal(btn.dataset.commentId, btn.dataset.commentTitle || "", btn);
  });

  // --- Comment modal events (bind after DOM ready) ---
function bindCommentModalEventsOnce_() {
  const modal = byId("commentModal");
  if (!modal) return;
  if (modal.dataset.bound === "1") return; // 防止重複綁
  modal.dataset.bound = "1";

  // 關閉：叉叉 / 背景
  byId("commentModalClose")?.addEventListener("click", closeCommentModal);
  qs("#commentModal .mbModalBackdrop")?.addEventListener("click", closeCommentModal);

  // Esc 關閉（這個綁在 document 沒差，但也一起放這裡，邏輯集中）
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCommentModal();
  });

  // 送出留言
  byId("commentForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!requireLogin("留言")) return;

    const input = byId("commentInput");
    const text = (input?.value || "").trim();
    if (!text) return toast("留言不能空白喔！");

    const send = byId("commentSend");
    if (send) send.disabled = true;

    const postId = String(currentCommentPostId || "");
    const idToken = getIdToken_();

    const myName = displayName_() || "User";
    const optimisticRow = { authorName: myName, ts: new Date().toISOString(), content: text };

    const cached = COMMENT_CACHE.get(postId);

    // ⚠️ 這裡如果你原本是 .(cached?.rows...) 那是錯的，必須是 ...(展開運算子)
    const rowsNow = [optimisticRow, ...(cached?.rows || [])].slice(0, 50);

    COMMENT_CACHE.set(postId, { at: Date.now(), rows: rowsNow });
    renderComments(rowsNow);
    if (input) input.value = "";

    try {
      const data = await apiPOST({ action: "add_comment", idToken, postId, content: text });
      if (!data.ok) throw new Error(data.error || "add_comment failed");

      if (currentCommentBtn) {
        const el = currentCommentBtn.querySelector(".commentCount");
        if (el) el.textContent = String(Number(el.textContent || "0") + 1);
      }

      toast("✅ 已留言");
      COMMENT_CACHE.delete(postId);
      await refreshComments(true);
    } catch (err) {
      console.error(err);
      toast(`留言失敗：${String(err.message || err)}`.slice(0, 140));

      const cur = COMMENT_CACHE.get(postId);
      if (cur?.rows?.length) {
        const reverted = cur.rows.filter(r => !(r.ts === optimisticRow.ts && r.content === optimisticRow.content));
        COMMENT_CACHE.set(postId, { at: Date.now(), rows: reverted });
        renderComments(reverted);
      }
    } finally {
      applyCommentRoleLock();
      if (send) send.disabled = (MB.state.mode !== "user");
    }
  });
}

// DOM 還沒載完就等 DOMContentLoaded，載完就立刻綁
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindCommentModalEventsOnce_, { once: true });
} else {
  bindCommentModalEventsOnce_();
}

  // --- Post form ---
  byId("postPhotos")?.addEventListener("change", () => {
    try {
      const urls = readPreviewUrlsFromInput();
      renderPhotoPreview(urls);
    } catch (e) {
      console.error(e);
      toast("讀取圖片失敗");
      byId("postPhotos").value = "";
      renderPhotoPreview([]);
    }
  });

  byId("postSearch")?.addEventListener("input", debounce(() => {
    render(ALL_CARDS, byId("postSearch")?.value || "");
    applyRoleLock();
  }, 180));

  byId("btnRefreshPosts")?.addEventListener("click", async () => {
    try { await refresh(true); } catch (e) { toast(String(e.message || e)); }
  });

  byId("postForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!requireLogin("發布貼文")) return;

    const submitBtn = byId("btnPostSubmit");
    if (submitBtn) submitBtn.disabled = true;

    const title = (byId("postTitle")?.value || "").trim();
    const kind = (byId("postKind")?.value || "movie").trim();
    const content = (byId("postContent")?.value || "").trim();
    const tags = (byId("postTags")?.value || "").trim();
    const mood = Number(byId("postMood")?.value || 3);

    if (!content) {
      toast("內容不能空白喔！");
      if (submitBtn) submitBtn.disabled = (MB.state.mode !== "user");
      return;
    }

    let photoDataUrls = [];
    try { photoDataUrls = await readPhotosFromInput(); } catch (_) {}

    const pendingId = "pending_" + Date.now();
    const pendingCard = {
      id: pendingId,
      author: displayName_(),
      title,
      kind,
      mood,
      content: "（發佈中…）\n" + content,
      tags: splitTags(tags),
      ts: new Date().toISOString(),
      photos: photoDataUrls,
      likeCount: 0,
      liked: false,
      commentCount: 0,
    };

    ALL_CARDS.unshift(pendingCard);
    render(ALL_CARDS, byId("postSearch")?.value || "");
    applyRoleLock();

    try {
      const idToken = getIdToken_();
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

      if (byId("postTitle")) byId("postTitle").value = "";
      if (byId("postContent")) byId("postContent").value = "";
      if (byId("postTags")) byId("postTags").value = "";
      if (byId("postPhotos")) byId("postPhotos").value = "";
      renderPhotoPreview([]);

      toast("✅ 已發布（同步中…）");
      await refresh(true);
    } catch (err) {
      console.error(err);
      ALL_CARDS = ALL_CARDS.filter(x => x.id !== pendingId);
      render(ALL_CARDS, byId("postSearch")?.value || "");
      applyRoleLock();
      toast(`發布失敗：${String(err.message || err)}`.slice(0, 140));
    } finally {
      if (submitBtn) submitBtn.disabled = (MB.state.mode !== "user");
    }
  });

  // mount
  window.addEventListener("load", async () => {
    try {
      applyRoleLock();
      await refresh(true);
    } catch (e) {
      console.error(e);
      toast(`貼文讀取失敗：${String(e.message || e)}`.slice(0, 120));
    }
  });

  window.addEventListener("mb:auth", () => {
    applyRoleLock();
    refresh(true).catch(() => {});
  });
})();

// ---------- Account jump buttons (mine/liked/commented) ----------
(function wireAccountJumpButtons(){
  const FEED_PAGE_URL = "./app.html";

  function bind(id, mode){
    const btn = byId(id);
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      try { localStorage.setItem("mb_feed_mode", mode); } catch (_) {}
      const sep = FEED_PAGE_URL.includes("?") ? "&" : "?";
      location.href = FEED_PAGE_URL + sep + "feed=" + encodeURIComponent(mode) + "#hall";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bind("btnGoMyPosts", "mine");
    bind("btnGoMyLikes", "liked");
    bind("btnGoMyComments", "commented");
    bind("btnGoAllPosts", "all");
  });
})();


/* =========================
   Lobby: 站內熱門推薦
   需要：#btnGlobalRecReload、#globalRecBox、apiPOST()
========================= */
(function () {
  // 防止重複注入造成 redeclare
  if (window.__MB_GLOBAL_RECS_INITED__) return;
  window.__MB_GLOBAL_RECS_INITED__ = true;

  function esc_(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function renderGlobalRec_(it) {
    const title = esc_(it?.title || it?.name || "未命名");
    const kind = esc_(it?.kind || "");
    const poster = it?.posterUrl || it?.poster || it?.coverUrl || "";
    const avg = (it?.avgRating != null) ? `⭐ ${it.avgRating}` : "";
    const count = (it?.count != null) ? `（${it.count}）` : "";

    return `
      <div class="card" style="padding:12px; display:flex; gap:12px; align-items:center;">
        ${poster
          ? `<img src="${poster}" alt="" style="width:54px;height:76px;object-fit:cover;border-radius:10px;">`
          : `<div style="width:54px;height:76px;border-radius:10px;opacity:.25;border:1px solid rgba(255,255,255,.25)"></div>`
        }
        <div style="min-width:0">
          <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</div>
          <div style="opacity:.75; font-size:13px;">${kind} ${avg} ${count}</div>
        </div>
      </div>`;
  }

  async function MB_loadGlobalRecs(limit = 6) {
    const box = document.getElementById("globalRecBox");
    if (!box) return;

    box.innerHTML = `<div style="opacity:.7; padding:8px 0;">讀取中...</div>`;

    const payload = { action: "records.recommendGlobal", limit, _t: Date.now() };
    const idToken = localStorage.getItem("id_token");
    if (idToken) payload.idToken = idToken;

    const res = await apiPOST(payload);
    if (!res || !res.ok) throw new Error(res?.error || "recommendGlobal failed");

    const items = Array.isArray(res.items) ? res.items : [];
    if (!items.length) {
      box.innerHTML = `<div style="opacity:.7; padding:8px 0;">目前沒有推薦</div>`;
      return;
    }
    box.innerHTML = items.map(renderGlobalRec_).join("");
  }

  // 掛到全域方便你在 Console 直接測
  window.MB_loadGlobalRecs = MB_loadGlobalRecs;

  function initGlobalRecs_() {
    const btn = document.getElementById("btnGlobalRecReload");
    if (btn && !btn.dataset.bound) {
      btn.addEventListener("click", () => MB_loadGlobalRecs(6).catch(console.error));
      btn.dataset.bound = "1";
    }
    // 頁面一進來先載一次
    MB_loadGlobalRecs(6).catch(console.error);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGlobalRecs_, { once: true });
  } else {
    initGlobalRecs_();
  }
})();

