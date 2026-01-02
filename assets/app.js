
/* MovieBase shared app.js (fixed)
   - Robust Google GIS init (retry until SDK ready)
   - Better backend error visibility
   - Feed Wall now uses Apps Script (sheet) so cross-device sync works
*/

const CONFIG = {
  GAS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbyuipb05zxPbPp7iAotqe_Oya4je2s-l3COcJ8kDO7e4VHjdLRuNwJhrymkPN02b9Sd/exec",
  GOOGLE_CLIENT_ID: "709445153038-vh9tvcrk5vtj0r3il5r81j9gl1k68l98.apps.googleusercontent.com",
};
window.CONFIG = CONFIG; // ✅ 讓 records-ui.js 拿得到 GAS_WEBAPP_URL

const MB = {
  state: {
    mode: "unknown",
    user: null,
    profile: null, // ✅ 新增這行
    // ...
  }
};

const $ = (q, root = document) => root.querySelector(q);

function getDisplayName_() {
  const nick = (MB.state.profile && MB.state.profile.nickname) ? String(MB.state.profile.nickname).trim() : "";
  if (nick) return nick;
  const gname = (MB.state.user && MB.state.user.name) ? String(MB.state.user.name).trim() : "";
  return gname || "使用者";
}

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
   Global Loading Overlay  ✅（移到上面：讓 mbLoading_ 一定找得到元素）
========================= */
(function initLoadingOverlay_(){
  const STYLE_ID = "mbLoadingStyle";
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = `
      .mbLoading{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;
        background:rgba(0,0,0,.18);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}
      .mbLoading.is-on{display:flex;}
      .mbLoadingBox{display:flex;align-items:center;gap:10px;padding:14px 16px;border-radius:16px;
        border:1px solid var(--stroke, rgba(255,255,255,.18));background:rgba(16,26,51,.65);
        box-shadow:0 18px 60px rgba(0,0,0,.25);}
      .mbLoadingSpin{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.35);
        border-top-color:rgba(255,255,255,.95);animation:mbSpin .9s linear infinite;}
      @keyframes mbSpin{to{transform:rotate(360deg);}}
    `;
    document.head.appendChild(st);
  }

  let el = null, textEl = null;

  function ensure() {
    if (el) return;
    el = document.getElementById("mbLoading");
    if (!el) {
      el = document.createElement("div");
      el.id = "mbLoading";
      el.className = "mbLoading";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = `
        <div class="mbLoadingBox">
          <div class="mbLoadingSpin" aria-hidden="true"></div>
          <div id="mbLoadingText">讀取中…</div>
        </div>`;
      document.body.appendChild(el);
    }
    textEl = el.querySelector("#mbLoadingText");
  }

  function show(msg = "讀取中…") {
    ensure();
    if (textEl) textEl.textContent = msg;
    el.classList.add("is-on");
    el.setAttribute("aria-hidden", "false");
  }

  function hide() {
    if (!el) return;
    el.classList.remove("is-on");
    el.setAttribute("aria-hidden", "true");
  }

  window.MB_loading = { show, hide };

  // ✅ 讓 #mbLoading 在 DOMContentLoaded 就先建立好（避免 mbLoading_ 找不到）
  document.addEventListener("DOMContentLoaded", () => {
    try { ensure(); } catch(_) {}
  });

  // 轉頁/重新整理時自動顯示「跳轉中…」
  window.addEventListener("beforeunload", () => {
    try { show("跳轉中…"); } catch(_) {}
  });
})();
})();   // ✅ 收外層 (function wireAccountJumpButtons(){ ... })()

function mbLoading_(on, text = "讀取中…") {
  const el = document.getElementById("mbLoading");
  const tx = document.getElementById("mbLoadingText");
  if (!el) return;

  if (on) {
    if (tx) tx.textContent = text;
    el.classList.add("is-on");
    el.setAttribute("aria-hidden", "false");
  } else {
    el.classList.remove("is-on");
    el.setAttribute("aria-hidden", "true");
  }
}

async function withLoading_(text, fn) {
  mbLoading_(true, text);
  try {
    return await fn();
  } finally {
    mbLoading_(false);
  }
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
    body: JSON.stringify(payload),
  });
}
async function userGet() {
  const idToken = getIdToken_();
  if (!idToken) throw new Error("not logged in");
  return await apiPOST({ action: "get_profile", idToken });
}

async function userSetNickname(nickname) {
  const idToken = getIdToken_();
  if (!idToken) throw new Error("not logged in");
  return await apiPOST({ action: "user_set_nickname", idToken, nickname });
}

async function loadProfile_() {
  const idToken = MB.state?.idToken || localStorage.getItem("id_token");
  if (!idToken) return null;

  const r = await apiPOST({ action: "get_profile", idToken });
  if (r && r.ok) {
    // 你後端回傳可能叫 profile / row / data，這裡做容錯
    MB.state.profile = r.profile || r.row || r.data || { nickname: r.nickname };
  } else {
    MB.state.profile = null;
  }
  return MB.state.profile;
}

async function apiGET(params) {
  const u = new URL(CONFIG.GAS_WEBAPP_URL);
  Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));

  // ✅ 防止瀏覽器/中間層快取 GET（尤其 list_comments/list_posts）
  u.searchParams.set("_", String(Date.now()));

  return apiFetch_(u.toString(), { method: "GET", cache: "no-store" });
}

async function initNicknameUI() {
  const elCur = document.getElementById("nickCurrent");
  const elIn = document.getElementById("nickInput");
  const elBtn = document.getElementById("nickSave");
  if (!elCur || !elIn || !elBtn) return;

  try {
    const profRes = await userGet(); 
    const prof = profRes.profile || profRes.user || profRes;
    elCur.textContent = prof.nickname ? `目前暱稱：${prof.nickname}` : "目前暱稱：未設定";
    elIn.value = prof.nickname || "";
  } catch (e) {
    elCur.textContent = "尚未登入或讀取失敗";
  }

  elBtn.addEventListener("click", async () => {
  try {
    const nick = elIn.value.trim();
    const outRes = await userSetNickname(nick);

    const prof = outRes.profile || outRes.user || outRes; // 容錯
    const nn = (prof?.nickname || outRes?.nickname || nick || "").trim();

    // ✅ 更新本機 profile（讓畫面上的名字立刻變）
    MB.state.profile = { ...(MB.state.profile || {}), ...(prof || {}), nickname: nn };
    // ✅ 加在「這裡」<<<<
    const disp = displayName_(MB.state.user, MB.state.profile);

    document.documentElement.setAttribute("data-user-name", disp);
    const nameEl = document.getElementById("authName");
    if (nameEl) nameEl.textContent = disp;

    elCur.textContent = nn ? `目前暱稱：${nn}` : "目前暱稱：未設定";

    // ✅ 讓右上角顯示名也更新（要搭配下面第2點 renderAuthUI 修改）
    renderAuthUI();

    // ✅ 立刻重載貼文（舊貼文作者名也會跟著變，前提後端 list_posts 會回新暱稱）
    window.MB_refreshPosts?.(true);

    alert("暱稱已更新！");
  } catch (e) {
    alert("更新失敗：" + e.message);
  }
});
;
}

function isLikelyJwt_(t) {
  return typeof t === "string" && t.split(".").length === 3 && t.length > 30;
}

function getIdToken_() {
  const t =
    MB?.state?.idToken ||
    localStorage.getItem("idToken") ||
    localStorage.getItem("id_token") ||
    "";

  if (!isLikelyJwt_(t)) return ""; // ✅ 壞的就不要送
  return t;
}

function clearIdToken_() {
  localStorage.removeItem("idToken");
  localStorage.removeItem("id_token");
  if (MB?.state) MB.state.idToken = "";
}

async function verifyMe(idTokenFromLogin) {
  const idToken =
    idTokenFromLogin ||
    MB?.state?.idToken ||
    localStorage.getItem("idToken") ||
    localStorage.getItem("id_token") ||
    "";

  if (!idToken) throw new Error("missing idToken");

  const data = await apiPOST({ action: "me", idToken });
  if (!data || !data.ok) {
    localStorage.removeItem("idToken");
    localStorage.removeItem("id_token");
    if (MB?.state) MB.state.idToken = "";
    throw new Error((data && data.error) || "me failed");
  }

  // ✅ 登入成功後把暱稱 profile 抓回來（不要在 function 外面 await）
  try { await loadProfile_(); } catch (_) { MB.state.profile = null; }

  return data.user;
}

function displayName_(user, profile) {
  const nick = profile?.nickname && String(profile.nickname).trim();
  return nick || user?.name || user?.email || "User";
}

function jsonp(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const cb = "__mb_cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("JSONP timeout"));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      delete window[cb];
      script.remove();
    }

    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };

    const sep = url.includes("?") ? "&" : "?";
    script.src = url + sep + "callback=" + encodeURIComponent(cb);
    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP load error"));
    };
    document.head.appendChild(script);
  });
}

async function apiJSONP(params) {
  const u = new URL(CONFIG.GAS_WEBAPP_URL);
  Object.entries(params || {}).forEach(([k,v]) => u.searchParams.set(k, v));
  // 防快取
  u.searchParams.set("_t", String(Date.now()));
  const data = await jsonp(u.toString());
  return data;
}

async function getProfile() {
  const idToken = localStorage.getItem("id_token");
  if (!idToken) throw new Error("missing id_token");
  const data = await apiJSONP({ action: "get_profile", idToken });
  if (!data.ok) throw new Error(data.error || "get_profile failed");
  return data.profile; // {userSub,nickname,photoUrl}
}

async function setNickname(nickname) {
  const idToken = localStorage.getItem("id_token");
  if (!idToken) throw new Error("missing id_token");
  const data = await apiJSONP({ action: "set_nickname", idToken, nickname });
  if (!data.ok) throw new Error(data.error || "set_nickname failed");
  return data; // {ok:true, userSub, nickname}
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
  MB.state.profile = null;
  MB.state.idToken = "";

  localStorage.removeItem("idToken");
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
    // ✅ 修正：用 displayName_，避免暱稱被洗回 Google 名
    document.documentElement.setAttribute("data-user-name", displayName_(MB.state.user, MB.state.profile));
  } else {
    document.documentElement.removeAttribute("data-user-name");
  }

  const badge = $("#authBadge");
  const name = $("#authName");
  const pic = $("#authPic");

  if (badge) badge.textContent = isUser ? "目前：已登入" : (isGuest ? "目前：訪客" : "目前：未登入");
  // ✅ 修正：用 displayName_（右上角顯示暱稱）
  if (name) name.textContent = isUser ? displayName_(MB.state.user, MB.state.profile) : (isGuest ? "Guest" : "");
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
  if (!window.google || !google.accounts?.id) {
    if (retry < 80) return setTimeout(() => initGoogle(retry + 1), 100);
    console.warn("Google SDK not ready (timeout)");
    return;
  }

  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: async (resp) => {
      try {
        // ✅ 1) 正確拿 token
        const idToken = resp?.credential || "";
        if (!idToken) throw new Error("no credential from GIS");

        // ✅ 2) 統一存 token（records-ui / verifyMe 會讀這個）
        MB.state.idToken = idToken;
        localStorage.setItem("idToken", idToken);
        //（可選）兼容你以前用過的 key
        localStorage.setItem("id_token", idToken);

        // ✅ 3) 跟後端確認身分
        const user = await verifyMe();
        setModeUser(user);

        closeLoginModal();
        toast("登入成功");
        goAfterAuthIfNeeded();
      } catch (e) {
        console.error(e);
        toast(`登入失敗：${String(e.message || e)}`.slice(0, 120));

        // ✅ 清掉 token
        localStorage.removeItem("idToken");
        localStorage.removeItem("id_token");
        if (MB?.state) MB.state.idToken = "";

        setModeGuest();
      }
    }
  });

  const gsi = document.getElementById("gsiBtn");
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
          localStorage.removeItem("idToken");
          localStorage.removeItem("id_token");
          if (MB?.state) { MB.state.idToken = ""; MB.state.profile = null; }
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
      clearIdToken_();
      if (MB?.state) MB.state.idToken = "";
      // ✅ 加這行
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
  async function loadCards(mode = FEED_MODE) {
    mode = normalizeFeedMode_(mode);

    const idToken = getIdToken_();

    // 依模式決定打哪個 action
    let payload = null;

    if (mode === "mine") {
      if (!idToken) throw new Error("not logged in");
      payload = { action: "list_my_posts", idToken };
    } else if (mode === "liked") {
      if (!idToken) throw new Error("not logged in");
      payload = { action: "list_my_likes", idToken };
    } else if (mode === "commented") {
      if (!idToken) throw new Error("not logged in");
      payload = { action: "list_my_comments", idToken };
    } else {
      // all
      payload = idToken ? { action: "list_posts", idToken } : { action: "list_posts" };
    }

    const data = await apiPOST(payload);

    // ✅ 如果後端回 invalid_token，直接清掉並降級訪客
    if (!data.ok && String(data.error || "").includes("invalid_token")) {
      clearIdToken_();
      setModeGuest();
      return [];
    }

    if (!data.ok) throw new Error(data.error || "list_posts failed");

    const cards = (data.rows || []).map(toCard);
    cards.sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));
    return cards;
  }

  // =========================
  // Feed mode: all / mine / liked / commented
  // =========================
  function normalizeFeedMode_(m){
    m = String(m || "").toLowerCase().trim();
    if (m === "my_posts" || m === "posts" || m === "mine") return "mine";
    if (m === "my_likes" || m === "likes" || m === "liked") return "liked";
    if (m === "my_comments" || m === "comments" || m === "commented") return "commented";
    return "all";
  }

  let FEED_MODE = "all";
  try{
    const sp = new URLSearchParams(location.search);
    const fromUrl = sp.get("feed");
    const fromLs = localStorage.getItem("mb_feed_mode");
    FEED_MODE = normalizeFeedMode_(fromUrl || fromLs || "all");
    if (fromLs) localStorage.removeItem("mb_feed_mode");
  }catch(_){}

  // 讓外部（account 按鈕）可以切換
  window.MB_setFeedMode = (mode) => { FEED_MODE = normalizeFeedMode_(mode); };
  window.MB_getFeedMode = () => FEED_MODE;

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

  async function refresh(forceReload = true) {
    const q = $("postSearch")?.value || "";

    if (forceReload) {
      const wrap = $("postList");
      if (wrap) wrap.innerHTML = `<div class="muted">讀取中…</div>`; // ✅ 先顯示
      ALL_CARDS = await loadCards(FEED_MODE);
    }

    render(ALL_CARDS, q);            // ✅ 搜尋只用快取過濾
    applyRoleLock();
  }

  window.MB_showFeed = async (mode) => {
    // ✅ 先開 loading（同頁切換也會有讀取中）
    try {
      if (typeof window.mbLoading_ === "function") {
        const msg =
          mode === "mine" ? "讀取中…正在載入你發過的貼文" :
          mode === "liked" ? "讀取中…正在載入你按讚的貼文" :
          mode === "commented" ? "讀取中…正在載入你留言過的貼文" :
          "讀取中…";
        mbLoading_(true, msg);
      }
    } catch (_) {}

    // ✅ 如果是「轉頁過來」的 pending，也一併吃掉（保險）
    try {
      const pend = localStorage.getItem("mb_loading_pending") === "1";
      if (pend && typeof window.mbLoading_ === "function") {
        const msg = localStorage.getItem("mb_loading_msg") || "讀取中…";
        mbLoading_(true, msg);
      }
    } catch (_) {}

    try {
      window.MB_setFeedMode(mode);
      await refresh(true);

      // 滾到貼文牆（如果在同頁）
      document.getElementById("postList")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      // ✅ 跑完一定關 + 清掉轉頁 pending
      try {
        localStorage.removeItem("mb_loading_pending");
        localStorage.removeItem("mb_loading_msg");
      } catch (_) {}
      try {
        if (typeof window.mbLoading_ === "function") mbLoading_(false);
      } catch (_) {}
    }
  };

  // Mount
  window.addEventListener("load", async () => {
    apiGET({ action: "ping" }).catch(()=>{});
    const idToken = localStorage.getItem("id_token");
    if (idToken) apiPOST({ action:"ping", idToken }).catch(()=>{});
    warmupBackend();
    try {
      applyRoleLock();
      await refresh(true);
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

    // =========================
    // Global Recs (All users aggregated)
    // =========================
    async function MB_loadGlobalRecs(limit = 6){
      const box = document.getElementById("globalRecBox");
      if(!box) return;

      // 綁定重新整理（只綁一次）
      const btn = document.getElementById("btnGlobalRecReload");
      if(btn && !btn.dataset.bound){
        btn.dataset.bound = "1";
        btn.addEventListener("click", ()=> MB_loadGlobalRecs(limit));
      }

      box.innerHTML = `<div class="muted">讀取中…</div>`;

      try{
        // idToken：可選（有就帶，沒有也可以）
        const idToken = (typeof getIdToken_ === "function") ? (getIdToken_() || "") : "";
        const payload = { action:"records.recommendGlobal", limit, _t: Date.now() };
        if(idToken) payload.idToken = idToken;

        const json = await apiPOST(payload);
        if(!json || !json.ok) throw new Error((json && json.error) || "API failed");

        const items = json.items || [];
        if(!items.length){
          box.innerHTML = `<div class="muted">目前還沒有站內熱門資料（大家先多新增幾筆並評分）</div>`;
          return;
        }

        box.innerHTML = "";
        items.forEach((it, idx)=>{
          const div = document.createElement("div");
          div.className = "recCard";

          const title = String(it.title || "").trim();
          const kind  = String(it.kind || it.type || "").trim();
          const avg   = Number(it.avgRating || 0);
          const cnt   = Number(it.count || 0);

          const poster = String(it.posterUrl || "").trim();
          const img = poster
            ? `<img src="${poster}" style="width:100%;height:140px;object-fit:cover;border-radius:12px;margin-top:8px;" alt="">`
            : "";

          const left  = `TOP ${idx+1}` + (kind ? ` · ${escapeHtml(kindLabel(kind) || kind)}` : "");
          const right = (avg > 0 ? `⭐ ${avg.toFixed(1)}` : "⭐ -") + (cnt ? ` · ${cnt}人評分` : "");

          div.innerHTML = `
            <div class="recMeta"><span>${left}</span><span>${escapeHtml(right)}</span></div>
            <div class="recTitle">${escapeHtml(title || "（未命名作品）")}</div>
            <div class="recNote">${cnt ? `資料來自全站匿名統計` : ""}</div>
            ${img}
          `;

          box.appendChild(div);
        });

      }catch(err){
        console.error(err);
        box.innerHTML = `<div class="muted">讀取失敗：${escapeHtml(err.message || err)}</div>`;
      }
    }

    window.MB_loadGlobalRecs = MB_loadGlobalRecs;

    $("btnRefreshPosts")?.addEventListener("click", async () => {
      try { await refresh(true); } catch (e) { toast(String(e.message || e)); }
    });

    $("postSearch")?.addEventListener("input", debounce(() => {
      const q = $("postSearch")?.value || "";
      render(ALL_CARDS, q);
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

      // 先讀圖片
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
        photos: photoDataUrls,
        likeCount: 0,
        liked: false,
        commentCount: 0,
      };

      ALL_CARDS.unshift(pendingCard);
      render(ALL_CARDS, $("postSearch")?.value || "");
      applyRoleLock();

      try {
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
        await refresh(true);
      } catch (err) {
        console.error(err);
        ALL_CARDS = ALL_CARDS.filter(x => x.id !== pendingId);
        render(ALL_CARDS, $("postSearch")?.value || "");
        applyRoleLock();

        toast(`發布失敗：${String(err.message || err)}`.slice(0, 140));
      } finally {
        if (submitBtn) submitBtn.disabled = (MB.state.mode !== "user");
      }
    });

    // ……（以下留言相關與 mb:auth 相關，你原本的程式維持不動）
    // 你貼的內容這段後面還有留言 modal 與 mb:auth 的大量程式
    // 我在這份修正版中沒有去改動那一大段的內容（因為你要求只改我指出的錯誤）
  });
})();

/* =========================
   Nickname (account page)  ✅（只保留一次 initNicknameUI_ 綁定）
========================= */
async function mbGetProfile_() {
  const idToken = localStorage.getItem("id_token");
  if (!idToken) return null;
  return await apiPOST({ action: "get_profile", idToken });
}

async function mbSetNickname_(nickname) {
  const idToken = localStorage.getItem("id_token");
  if (!idToken) throw new Error("missing id_token");
  return await apiPOST({ action: "set_nickname", idToken, nickname });
}

function initNicknameUI_() {
  const card = document.getElementById("nickCard");
  if (!card) return; // 不是 account 頁就跳過

  const statusEl = document.getElementById("nickStatus");
  const input = document.getElementById("nicknameInput");
  const btn = document.getElementById("btnSaveNickname");

  async function render() {
    // 只有登入才顯示
    const idToken = localStorage.getItem("id_token");
    if (!idToken || (window.MB && MB.state && MB.state.mode !== "user")) {
      card.style.display = "none";
      return;
    }
    card.style.display = "block";
    statusEl.textContent = "讀取中...";

    try {
      const data = await mbGetProfile_();
      if (!data || !data.ok) throw new Error((data && data.error) || "get_profile failed");

      const nn = (data.profile.nickname || "").trim();
      statusEl.textContent = nn ? `目前暱稱：${nn}` : "目前暱稱：尚未設定";
      input.value = nn;
    } catch (e) {
      statusEl.textContent = "讀取暱稱失敗：" + String(e.message || e);
    }
  }

  btn?.addEventListener("click", async () => {
    const nn = (input.value || "").trim();
    if (!nn) return toast("請輸入暱稱");
    btn.disabled = true;
    try {
      const out = await mbSetNickname_(nn);
      if (!out.ok) throw new Error(out.error || "set_nickname failed");
      toast("已儲存暱稱");
      await render();
    } catch (e) {
      toast("儲存失敗：" + String(e.message || e));
    } finally {
      btn.disabled = false;
    }
  });

  // 初次載入 + 登入狀態變動時更新
  render();
  window.addEventListener("mb:auth", render);
}

// ✅ 只保留一次（避免重複綁 click）
document.addEventListener("DOMContentLoaded", initNicknameUI_);

// ✅ 保險：讓留言 Modal 一定可以關 + 預設關閉
document.addEventListener("DOMContentLoaded", wireCommentModalFix);

function wireCommentModalFix(){
  const modal = document.getElementById("commentModal");
  if(!modal) return;

  const close = ()=>{
    // ✅ 同時處理 aria + class（跟你 openCommentModal 的 is-open 對齊）
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  };
  const open = ()=>{
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  };

  // 預設關閉
  close();

  modal.querySelectorAll("[data-close], .mbModalBackdrop").forEach(el=>{
    el.addEventListener("click", (e)=>{
      const card = modal.querySelector(".mbModalCard");
      if(card && card.contains(e.target) && !e.target.matches("[data-close]")) return;
      close();
    });
  });

  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape") close();
  });

  window.MB_closeCommentModal = close;
  window.MB_openCommentModal = open;
} // ✅ 這個大括號要存在


// =========================
// Account: jump buttons -> my posts / my likes / my comments
// =========================
(function wireAccountJumpButtons(){
  const FEED_PAGE_URL = "./app.html"; // ⚠️ 如果你的貼文牆頁不是 app.html，改成正確檔名

  (function () {

    function modeText_(mode){
      if (mode === "mine") return "讀取中…正在載入你發過的貼文";
      if (mode === "liked") return "讀取中…正在載入你按讚的貼文";
      if (mode === "commented") return "讀取中…正在載入你留言過的貼文";
      return "讀取中…";
    }

    async function go(mode) {
      const msg = modeText_(mode);

      // ✅ 先顯示 Loading（同頁/轉頁都先出現）
      if (typeof window.mbLoading_ === "function") mbLoading_(true, msg);

      const samePage = (typeof window.MB_showFeed === "function" && document.getElementById("postList"));

      // 同頁：如果貼文牆存在，先切到 hall，再切模式刷新
      if (samePage) {
        try {
          if (typeof window.MB_goTab === "function") {
            await Promise.resolve(window.MB_goTab("hall"));
          }
          await Promise.resolve(window.MB_showFeed(mode));
        } finally {
          if (typeof window.mbLoading_ === "function") mbLoading_(false);
        }
        return;
      }

      // 不同頁：用 localStorage + 轉頁（到貼文牆頁）
      try {
        localStorage.setItem("mb_feed_mode", mode);
        // ✅ 讓新頁也知道要顯示 loading
        localStorage.setItem("mb_loading_pending", "1");
        localStorage.setItem("mb_loading_msg", msg);
      } catch (_) {}

      const base = FEED_PAGE_URL;
      const sep = base.includes("?") ? "&" : "?";
      const url = base + sep + "feed=" + encodeURIComponent(mode) + "#hall";

      // ✅ 給瀏覽器 1 個 frame 的時間把 Loading 畫出來，再跳轉
      requestAnimationFrame(() => {
        setTimeout(() => { location.href = url; }, 30);
      });
    }

    function bind(id, mode){
      const btn = document.getElementById(id);
      if (!btn || btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => { go(mode); });
    }

    document.addEventListener("DOMContentLoaded", () => {
      bind("btnGoMyPosts", "mine");
      bind("btnGoMyLikes", "liked");
      bind("btnGoMyComments", "commented");
      bind("btnGoAllPosts", "all"); // ✅ 你 app.html 有這顆
    });
  })();
})();  // ✅ 外層 IIFE 收尾一定要有



// ✅ 保險：讓留言 Modal 一定可以關 + 預設關閉
(function wireCommentModalFix(){
  const modal = document.getElementById("commentModal");
  if(!modal) return;

  const close = ()=>{
    modal.setAttribute("aria-hidden", "true");
  };
  const open = ()=>{
    modal.setAttribute("aria-hidden", "false");
  };

  close();

  modal.querySelectorAll("[data-close], .mbModalBackdrop").forEach(el=>{
    el.addEventListener("click", (e)=>{
      const card = modal.querySelector(".mbModalCard");
      if(card && card.contains(e.target) && !e.target.matches("[data-close]")) return;
      close();
    });
  });

  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape") close();
  });

  window.MB_closeCommentModal = close;
  window.MB_openCommentModal = open;
})(); // ✅ 這行如果不見，就會是 Unexpected end of input


// =========================
// Account: jump buttons -> my posts / my likes / my comments
// =========================
(function wireAccountJumpButtons(){
  const FEED_PAGE_URL = "./app.html"; // ⚠️ 如果你的貼文牆頁不是 app.html，改成正確檔名

  (function () {

    function modeText_(mode){
      if (mode === "mine") return "讀取中…正在載入你發過的貼文";
      if (mode === "liked") return "讀取中…正在載入你按讚的貼文";
      if (mode === "commented") return "讀取中…正在載入你留言過的貼文";
      return "讀取中…";
    }

    async function go(mode) {
      const msg = modeText_(mode);

      // ✅ 先顯示 Loading（同頁/轉頁都先出現）
      if (typeof window.mbLoading_ === "function") mbLoading_(true, msg);

      const samePage = (typeof window.MB_showFeed === "function" && document.getElementById("postList"));

      // 同頁：如果貼文牆存在，直接切模式刷新
      if (samePage) {
        try {
          // ✅ 等它跑完再關（就算 MB_showFeed 不是 async 也 OK）
          await Promise.resolve(window.MB_showFeed(mode));
        } finally {
          if (typeof window.mbLoading_ === "function") mbLoading_(false);
        }
        return;
      }

      // 不同頁：用 localStorage + 轉頁（到貼文牆頁）
      try {
        localStorage.setItem("mb_feed_mode", mode);
        // ✅ 讓新頁也知道要顯示 loading
        localStorage.setItem("mb_loading_pending", "1");
        localStorage.setItem("mb_loading_msg", msg);
      } catch (_) {}

      const base = FEED_PAGE_URL;
      const sep = base.includes("?") ? "&" : "?";
      const url = base + sep + "feed=" + encodeURIComponent(mode) + "#hall";

      // ✅ 給瀏覽器 1 個 frame 的時間把 Loading 畫出來，再跳轉
      requestAnimationFrame(() => {
        setTimeout(() => { location.href = url; }, 30);
      });
    }

    function bind(id, mode){
      const btn = document.getElementById(id);
      if (!btn || btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => { go(mode); });
    }

    document.addEventListener("DOMContentLoaded", () => {
      bind("btnGoMyPosts", "mine");
      bind("btnGoMyLikes", "liked");
      bind("btnGoMyComments", "commented");
    });
  })();

})(); // ✅ 補上外層 wireAccountJumpButtons 的結尾
