/* MovieBase shared app.js
   - auth state (guest/user)
   - login modal (optional per page)
   - permission gates (front-end)
   - global navbar sync (hide "登入 / 訪客" when logged in)
   - theme toggle (optional if #themeToggle exists)
*/

const CONFIG = {
  GAS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbyuipb05zxPbPp7iAotqe_Oya4je2s-l3COcJ8kDO7e4VHjdLRuNwJhrymkPN02b9Sd/exec",
  GOOGLE_CLIENT_ID: "709445153038-vh9tvcrk5vtj0r3il5r81j9gl1k68l98.apps.googleusercontent.com",
};

const MB = {
  state: {
    mode: "unknown", // "guest" | "user"
    user: null,      // {sub,email,name,picture}
  },
};

const $ = (q, root = document) => root.querySelector(q);

function toast(msg) {
  const el = $("#toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.style.display = "none"), 2200);
}

async function apiPOST(payload) {
  const res = await fetch(CONFIG.GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

async function verifyMe() {
  const idToken = localStorage.getItem("id_token");
  if (!idToken) return null;
  const data = await apiPOST({ action: "me", idToken });
  if (!data.ok) throw new Error(data.error || "me failed");
  return data.user;
}

/* =========================
   Mode setters
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
  MB.state.user = user;
  localStorage.setItem("mode", "user");
  renderAuthUI();
}

/* =========================
   UI sync (shared)
========================= */
function renderAuthUI() {
  // (A) Page auth badge block (if exists)
  const badge = $("#authBadge");
  const name = $("#authName");
  const pic = $("#authPic");
  const btnLogout = $("#btnLogout");

  const isUser = MB.state.mode === "user" && MB.state.user;

  if (badge) badge.textContent = isUser ? "目前：已登入" : "目前：訪客";
  if (name) name.textContent = isUser ? (MB.state.user.name || MB.state.user.email || "") : "Guest";
  if (pic) {
    pic.src = isUser ? (MB.state.user.picture || "") : "";
    pic.style.display = isUser && MB.state.user.picture ? "inline-block" : "none";
  }
  if (btnLogout) btnLogout.style.display = isUser ? "inline-flex" : "none";

  // (B) index header (if exists)
  syncEntryHeader();

  // (C) global topbar buttons on every page
  syncGlobalAuthButtons();
}

/* Entrance page header sync (index.html) */
function syncEntryHeader() {
  const isUser = MB.state.mode === "user" && MB.state.user;

  // 入口右上狀態
  const loginState = $("#loginState");
  if (loginState) {
    if (isUser) {
      const n = MB.state.user.name || MB.state.user.email || "已登入";
      loginState.textContent = `目前：已登入（${n}）`;
    } else {
      loginState.textContent = "目前：未登入";
    }
  }

  // 入口按鈕：已登入時隱藏 登入/訪客，顯示 登出（若有）
  const btnLogin = $("#btnLogin");
  const btnGuest = $("#btnGuest");
  const btnLogin2 = $("#btnLogin2");
  const btnGuest2 = $("#btnGuest2");
  const btnLogoutTop = $("#btnLogoutTop"); // 若你入口頁有放登出鍵，可用這個 id

  [btnLogin, btnLogin2, btnGuest, btnGuest2].forEach((el) => {
    if (el) el.style.display = isUser ? "none" : "";
  });
  if (btnLogoutTop) btnLogoutTop.style.display = isUser ? "inline-flex" : "none";
}

/* Global nav: hide the "登入 / 訪客" button when logged in */
function syncGlobalAuthButtons() {
  const isUser = MB.state.mode === "user" && MB.state.user;

  // 1) 用文字抓「登入 / 訪客」(你的截圖那顆)
  const loginGuestCandidates = [];
  document.querySelectorAll("a,button").forEach((el) => {
    const t = (el.textContent || "").trim().replace(/\s+/g, " ");
    if (t === "登入 / 訪客" || t === "登入/訪客" || t === "登入 ／ 訪客") {
      loginGuestCandidates.push(el);
    }
  });

  loginGuestCandidates.forEach((el) => {
    el.style.display = isUser ? "none" : "";
  });

  // 2) 顯示/隱藏登出鍵（你頁面若有這些 id 就會自動套用）
  ["#btnLogout", "#btnLogoutTop"].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.style.display = isUser ? "inline-flex" : "none";
  });

  // 3) 若你有上方顯示名字的膠囊（可自行加 id="authNameTop"）
  const nameTop = document.querySelector("#authNameTop");
  if (nameTop) {
    nameTop.textContent = isUser
      ? (MB.state.user.name || MB.state.user.email || "已登入")
      : "Guest";
  }
}

/* Permission gate */
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
   Modal
========================= */
function openLoginModal() {
  const m = $("#loginModal");
  if (m) m.classList.add("is-open");
}
function closeLoginModal() {
  const m = $("#loginModal");
  if (m) m.classList.remove("is-open");
}

/* =========================
   Theme toggle (optional)
   - requires a button with id="themeToggle"
   - uses :root[data-theme="light"] in theme.css
========================= */
function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("theme", t);
}

function initThemeToggle() {
  const btn = $("#themeToggle");
  if (!btn) return;

  // restore
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") applyTheme(saved);

  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(cur === "light" ? "dark" : "light");
  });
}

/* =========================
   Google Login (GIS)
========================= */
function initGoogle() {
  if (!window.google || !google.accounts?.id) {
    console.warn("Google SDK not ready");
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
      } catch (e) {
        console.error(e);
        toast("登入驗證失敗，請確認後端 me");
        localStorage.removeItem("id_token");
        setModeGuest();
      }
    },
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
  setActiveNav();
  initThemeToggle();

  // close modal by backdrop click
  $("#loginModal")?.addEventListener("click", (e) => {
    if (e.target.id === "loginModal") closeLoginModal();
  });

  $("#btnOpenLogin")?.addEventListener("click", openLoginModal);

  // 入口頁也可能有 btnLogin（你 index.html 有）
  $("#btnLogin")?.addEventListener("click", openLoginModal);

  // 全站訪客按鈕（若頁面上有）
  $("#btnGuest")?.addEventListener("click", () => {
    setModeGuest();
    closeLoginModal();
    toast("已用訪客模式進入（禁止紀錄與發文）");
  });

  // 登出按鈕（若頁面上有）
  $("#btnLogout")?.addEventListener("click", () => {
    try {
      if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
    } catch (e) {}
    setModeGuest();
    toast("已登出");
  });

  // 若入口頁也有 btnLogoutTop
  $("#btnLogoutTop")?.addEventListener("click", () => {
    try {
      if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
    } catch (e) {}
    setModeGuest();
    toast("已登出");
  });

  // restore
  const savedMode = localStorage.getItem("mode");
  if (savedMode === "guest") {
    setModeGuest();
  } else {
    // try id_token
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

// expose for page scripts
window.MB = MB;
window.MB_requireLogin = requireLogin;
window.MB_openLoginModal = openLoginModal;
window.addEventListener("load", boot);
