/* MovieBase shared app.js
   - theme toggle (dark/light)
   - auth state (guest/user)
   - login modal (supports both: #modal / #loginModal)
   - basic permission gates (front-end)
*/

const CONFIG = {
  GAS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbyuipb05zxPbPp7iAotqe_Oya4je2s-l3COcJ8kDO7e4VHjdLRuNwJhrymkPN02b9Sd/exec",
  GOOGLE_CLIENT_ID: "709445153038-vh9tvcrk5vtj0r3il5r81j9gl1k68l98.apps.googleusercontent.com",
};

const MB = {
  state: {
    mode: "unknown", // "guest" | "user"
    user: null,      // {sub,email,name,picture}
  }
};

const $ = (q, root = document) => root.querySelector(q);

/* =========================
   Theme (apply ASAP)
========================= */
(function initThemeEarly() {
  const KEY = "moviebase_theme"; // dark | light
  const saved = localStorage.getItem(KEY) || "dark";
  document.documentElement.setAttribute("data-theme", saved);
})();

function bindThemeToggle() {
  const KEY = "moviebase_theme";
  const btn =
    document.getElementById("btnTheme") ||
    document.getElementById("themeToggle");

  if (!btn) return;

  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(KEY, next);
  });
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

async function meFromToken(idToken) {
  if (!idToken) return null;
  const data = await apiPOST({ action: "me", idToken });
  if (!data.ok) throw new Error(data.error || "me failed");
  return data.user;
}

async function verifyMe() {
  const idToken = localStorage.getItem("id_token");
  if (!idToken) return null;
  return await meFromToken(idToken);
}

/* =========================
   Mode / Auth UI
========================= */
function setModeGuest() {
  MB.state.mode = "guest";
  MB.state.user = null;

  localStorage.removeItem("id_token");

  // unify keys for all pages
  localStorage.setItem("mode", "guest");
  localStorage.setItem("mb_role", "guest");

  renderAuthUI();
}

function setModeUser(user) {
  MB.state.mode = "user";
  MB.state.user = user;

  localStorage.setItem("mode", "user");
  localStorage.setItem("mb_role", "user");

  // store name for index display
  if (user?.name) localStorage.setItem("mb_user_name", user.name);

  renderAuthUI();
}

function renderAuthUI() {
  // For pages using authBadge/authName/authPic
  const badge = $("#authBadge");
  const name = $("#authName");
  const pic = $("#authPic");
  const btnLogout = $("#btnLogout");

  if (MB.state.mode === "user" && MB.state.user) {
    if (badge) badge.textContent = "目前：已登入";
    if (name) name.textContent = MB.state.user.name || MB.state.user.email || "";
    if (pic) {
      pic.src = MB.state.user.picture || "";
      pic.style.display = MB.state.user.picture ? "inline-block" : "none";
    }
    if (btnLogout) btnLogout.style.display = "inline-block";
  } else {
    if (badge) badge.textContent = "目前：訪客";
    if (name) name.textContent = "Guest";
    if (pic) pic.style.display = "none";
    if (btnLogout) btnLogout.style.display = "none";
  }

  // For index page using loginState
  const loginState = document.getElementById("loginState");
  if (loginState) {
    if (MB.state.mode === "user" && MB.state.user) {
      const nm = MB.state.user.name || MB.state.user.email || "";
      loginState.textContent = nm ? `目前：已登入（${nm}）` : "目前：已登入";
    } else {
      loginState.textContent = "目前：訪客";
    }
  }
}

function requireLogin(featureName = "此功能") {
  if (MB.state.mode !== "user") {
    toast(`${featureName} 需要先登入 Google`);
    openLoginModal();
    return false;
  }
  return true;
}

/* =========================
   Navbar active
========================= */
function setActiveNav() {
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.classList.toggle("is-active", a.getAttribute("href") === path);
  });
}

/* =========================
   Modal (supports #loginModal and #modal)
========================= */
function openLoginModal() {
  const m1 = document.getElementById("loginModal");
  const m2 = document.getElementById("modal");
  if (m1) m1.classList.add("is-open");
  if (m2) m2.classList.add("open");
  if (m2) m2.setAttribute("aria-hidden", "false");
}
function closeLoginModal() {
  const m1 = document.getElementById("loginModal");
  const m2 = document.getElementById("modal");
  if (m1) m1.classList.remove("is-open");
  if (m2) m2.classList.remove("open");
  if (m2) m2.setAttribute("aria-hidden", "true");
}

/* =========================
   Google Login
========================= */
function initGoogle() {
  if (!window.google || !google.accounts?.id) {
    console.warn("Google SDK not ready");
    return;
  }

  // expose client id for other inline scripts if needed
  window.MB_CLIENT_ID = CONFIG.GOOGLE_CLIENT_ID;
  window.GOOGLE_CLIENT_ID = CONFIG.GOOGLE_CLIENT_ID;

  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: async (resp) => {
      try {
        localStorage.setItem("id_token", resp.credential);
        const user = await verifyMe();
        setModeUser(user);
        closeLoginModal();
        toast("登入成功");
      } catch (e) {
        console.error(e);
        toast("登入驗證失敗，請確認後端 me");
        localStorage.removeItem("id_token");
        setModeGuest();
      }
    },
  });

  // render button if exists
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
  bindThemeToggle();
  setActiveNav();

  // close modal by backdrop click
  document.getElementById("loginModal")?.addEventListener("click", (e) => {
    if (e.target.id === "loginModal") closeLoginModal();
  });
  document.getElementById("modal")?.addEventListener("click", (e) => {
    if (e.target.id === "modal") closeLoginModal();
  });

  // Buttons (support both old/new ids)
  document.getElementById("btnOpenLogin")?.addEventListener("click", openLoginModal);
  document.getElementById("btnLogin")?.addEventListener("click", openLoginModal);
  document.getElementById("modalClose")?.addEventListener("click", closeLoginModal);

  document.getElementById("btnGuest")?.addEventListener("click", () => {
    setModeGuest();
    closeLoginModal();
    toast("已用訪客模式進入（禁止紀錄/發文/互動）");
  });

  document.getElementById("btnLogout")?.addEventListener("click", () => {
    if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
    setModeGuest();
    toast("已登出");
  });

  // Restore mode (support both keys)
  const savedMode = localStorage.getItem("mb_role") || localStorage.getItem("mode");

  if (savedMode === "guest") {
    setModeGuest();
  } else {
    try {
      const user = await verifyMe();
      if (user) setModeUser(user);
      else setModeGuest();
    } catch (e) {
      console.error(e);
      setModeGuest();
    }
  }

  initGoogle();
}

/* Expose for other page scripts */
window.MB = MB;
window.MB.me = meFromToken; // allow index to call MB.me(token) if needed
window.MB_requireLogin = requireLogin;
window.MB_openLoginModal = openLoginModal;

window.addEventListener("load", boot);
