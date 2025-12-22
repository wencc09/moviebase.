/* MovieBase shared app.js (v3 stable)
   - single source of truth for auth + theme + modal
   - fixes: double Google init, SDK race, guest UI, modal reset
*/

const CONFIG = {
  GAS_WEBAPP_URL:
    "https://script.google.com/macros/s/AKfycbyuipb05zxPbPp7iAotqe_Oya4je2s-l3COcJ8kDO7e4VHjdLRuNwJhrymkPN02b9Sd/exec",
  GOOGLE_CLIENT_ID:
    "709445153038-vh9tvcrk5vtj0r3il5r81j9gl1k68l98.apps.googleusercontent.com",
};

// Allow override from html if you want later:
// window.MB_CONFIG = { GAS_WEBAPP_URL: "...", GOOGLE_CLIENT_ID: "..." }
if (window.MB_CONFIG) {
  Object.assign(CONFIG, window.MB_CONFIG);
}

const MB = {
  state: {
    mode: "unknown", // "guest" | "user"
    user: null,      // {sub,email,name,picture}
  },
};

const $ = (q, root = document) => root.querySelector(q);

function show(el, on) {
  if (!el) return;
  el.style.display = on ? "" : "none";
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
  toast._t = setTimeout(() => (el.style.display = "none"), 2200);
}

/* =========================
   API
========================= */
async function apiPOST(payload) {
  const res = await fetch(CONFIG.GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

async function verifyMe(idTokenOverride) {
  const idToken = idTokenOverride || localStorage.getItem("id_token");
  if (!idToken) return null;
  const data = await apiPOST({ action: "me", idToken });
  if (!data.ok) throw new Error(data.error || "me failed");
  return data.user;
}

/* =========================
   Auth State
========================= */
function setModeGuest() {
  MB.state.mode = "guest";
  MB.state.user = null;
  localStorage.removeItem("id_token");
  localStorage.setItem("mode", "guest");
  renderAuthUI();
}

function setModeUser(user) {
  MB.state.mode = "user";
  MB.state.user = user || null;
  localStorage.setItem("mode", "user");
  renderAuthUI();
}

function renderAuthUI() {
  const isUser = MB.state.mode === "user" && MB.state.user;

  // common header widgets (may not exist on all pages)
  const badge = $("#authBadge");
  const name = $("#authName");
  const pic = $("#authPic");

  if (badge) badge.textContent = isUser ? "目前：已登入" : (MB.state.mode === "guest" ? "目前：訪客" : "目前：讀取中…");
  if (name) name.textContent = isUser ? (MB.state.user.name || MB.state.user.email || "") : "Guest";
  if (pic) {
    pic.src = isUser ? (MB.state.user.picture || "") : "";
    show(pic, !!(isUser && MB.state.user.picture));
  }

  // index header state
  const loginState = $("#loginState");
  if (loginState) {
    if (isUser) {
      const nm = MB.state.user.name || MB.state.user.email || "";
      loginState.textContent = nm ? `目前：已登入（${nm}）` : "目前：已登入";
    } else if (MB.state.mode === "guest") {
      loginState.textContent = "目前：訪客";
    } else {
      loginState.textContent = "目前：讀取中…";
    }
  }

  // Buttons (shared ids)
  const btnLogout = $("#btnLogout");
  const btnLogoutTop = $("#btnLogoutTop"); // index topbar logout
  const btnOpenLogin = $("#btnOpenLogin");

  const btnLogin = $("#btnLogin");
  const btnLogin2 = $("#btnLogin2");
  const btnGuest = $("#btnGuest");
  const btnGuest2 = $("#btnGuest2");

  // ✅ 重要修正：只有「已登入」才隱藏登入/訪客，訪客仍要看得到登入入口（才能升級）
  show(btnLogout, isUser);
  show(btnLogoutTop, isUser);

  show(btnOpenLogin, !isUser);
  show(btnLogin, !isUser);
  show(btnLogin2, !isUser);
  show(btnGuest, !isUser);
  show(btnGuest2, !isUser);
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

function resetIndexChooseUIIfAny() {
  // only index has these
  $("#chooseBox")?.classList.remove("hidden");
  $("#googleBox")?.classList.add("hidden");
}

function openLoginModal(opts = {}) {
  const m = getModalEl();
  if (!m) return;

  if (opts.reset) resetIndexChooseUIIfAny();

  m.classList.add("is-open");
  m.classList.add("open"); // support index style
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
   Google SDK wait (fix race)
========================= */
async function waitForGoogleSDK(timeoutMs = 9000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.google && google.accounts && google.accounts.id) return true;
    await new Promise(r => setTimeout(r, 90));
  }
  return false;
}

function initGoogleOnce() {
  if (!window.google || !google.accounts?.id) return false;

  // initialize
  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: async (resp) => {
      try {
        localStorage.setItem("id_token", resp.credential);
        const user = await verifyMe(resp.credential);
        setModeUser(user);
        closeLoginModal();
        toast("登入成功");

        // ✅ 可選：在 index 登入成功後，自動進主站（避免停在入口頁）
        const isIndex = /(^|\/)index\.html$/.test(location.pathname) || location.pathname === "/" || location.pathname.endsWith("/index");
        if (isIndex) {
          setTimeout(() => (location.href = "app.html#about"), 250);
        }
      } catch (e) {
        console.error(e);
        toast("登入驗證失敗（請確認 Apps Script 的 me）");
        localStorage.removeItem("id_token");
        setModeGuest();
      }
    },
  });

  // render button if container exists
  const gsi = $("#gsiBtn");
  if (gsi) {
    gsi.innerHTML = "";
    google.accounts.id.renderButton(gsi, { theme: "outline", size: "large", width: 280 });
  }

  return true;
}

/* =========================
   Boot
========================= */
async function boot() {
  initThemeToggle();

  // close buttons
  $("#modalClose")?.addEventListener("click", closeLoginModal);

  // click backdrop close
  const m = getModalEl();
  m?.addEventListener("click", (e) => {
    if (e.target === m) closeLoginModal();
  });

  // ESC close
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLoginModal();
  });

  // open modal buttons
  $("#btnOpenLogin")?.addEventListener("click", () => openLoginModal({ reset: true }));
  $("#btnLogin")?.addEventListener("click", () => openLoginModal({ reset: true }));
  $("#btnLogin2")?.addEventListener("click", () => openLoginModal({ reset: true }));

  // guest buttons
  const guestHandler = () => {
    setModeGuest();
    closeLoginModal();
    toast("已用訪客模式瀏覽（禁止紀錄與互動）");
  };
  $("#btnGuest")?.addEventListener("click", guestHandler);
  $("#btnGuest2")?.addEventListener("click", guestHandler);

  // logout buttons
  const logoutHandler = () => {
    try {
      if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
    } catch (_) {}
    setModeGuest();
    toast("已登出");
  };
  $("#btnLogout")?.addEventListener("click", logoutHandler);
  $("#btnLogoutTop")?.addEventListener("click", logoutHandler);

  // restore auth (single truth: id_token)
  MB.state.mode = "unknown";
  renderAuthUI();

  try {
    const user = await verifyMe();
    if (user) setModeUser(user);
    else setModeGuest();
  } catch (e) {
    console.error(e);
    setModeGuest();
  }

  // google init (wait for SDK to be ready)
  const ok = await waitForGoogleSDK();
  if (!ok) {
    console.warn("Google SDK not ready (timeout)");
    // still usable as guest
    return;
  }
  initGoogleOnce();
}

// expose for page scripts
window.MB = MB;
window.MB_requireLogin = requireLogin;
window.MB_openLoginModal = (opts) => openLoginModal(opts || { reset: true });
window.MB_closeLoginModal = closeLoginModal;
window.MB_me = verifyMe;

window.addEventListener("load", boot);
