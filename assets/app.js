/* MovieBase shared app.js
   - auth state (guest/user)
   - login modal (supports #loginModal and #modal)
   - permission gates (front-end)
   - theme toggle (dark/light) + persistence (one source of truth)
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

async function verifyMe() {
  const idToken = localStorage.getItem("id_token");
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

  if (badge) badge.textContent = isUser ? "目前：已登入" : "目前：訪客";
  if (name) name.textContent = isUser ? (MB.state.user.name || MB.state.user.email || "") : "Guest";
  if (pic) {
    pic.src = isUser ? (MB.state.user.picture || "") : "";
    pic.style.display = isUser && MB.state.user.picture ? "inline-block" : "none";
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
      loginState.textContent = "目前：未登入";
    }
  }

  const show = (el, on) => { if (el) el.style.display = on ? "" : "none"; };

  // buttons (shared ids)
  const btnLogout = $("#btnLogout");
  const btnLogoutTop = $("#btnLogoutTop"); // index topbar logout
  const btnOpenLogin = $("#btnOpenLogin");
  const btnGuest = $("#btnGuest");

  // index buttons
  const btnLogin = $("#btnLogin");
  const btnLogin2 = $("#btnLogin2");
  const btnGuest2 = $("#btnGuest2");

  // 規則：一旦確認為「已登入」或「訪客」 → 登入/訪客按鈕都要消失，只留登出
  const decided = (MB.state.mode === "guest") || isUser;

  show(btnLogout, decided);
  show(btnLogoutTop, decided);

  show(btnOpenLogin, !decided);
  show(btnGuest, !decided);

  show(btnLogin, !decided);
  show(btnLogin2, !decided);
  show(btnGuest2, !decided);

  const btnLoginGuest = $("#btnLoginGuest");
  show(btnLoginGuest, !decided);
}

/* =========================
   Permission Gate
========================= */
function requireLogin(featureName = "此功能") {
  if (MB.state.mode !== "user") {
    toast(`${featureName} 需要先登入 Google`);
    openLoginModal();
    return false;
  }
  return true;
}

/* =========================
   Modal (support index + app variants)
========================= */
function getModalEl() {
  return $("#loginModal") || $("#modal");
}

function openLoginModal() {
  const m = getModalEl();
  if (!m) return;
  m.classList.add("is-open");
  m.classList.add("open");     // index uses .open
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
   Theme Toggle (one source of truth)
========================= */
function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);

  // unify + keep backward compatibility
  localStorage.setItem("theme", t);
  localStorage.setItem("moviebase_theme", t);
}

function initThemeToggle() {
  const btn = $("#themeToggle");
  if (!btn) return;

  // restore: try new key -> old key
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
   Google Login
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

  // modal close buttons (support index ids)
  $("#modalClose")?.addEventListener("click", closeLoginModal);

  // click backdrop to close
  const m = getModalEl();
  m?.addEventListener("click", (e) => {
    if (e.target === m) closeLoginModal();
  });

  // open modal buttons
  $("#btnOpenLogin")?.addEventListener("click", openLoginModal);
  $("#btnLogin")?.addEventListener("click", openLoginModal);
  $("#btnLogin2")?.addEventListener("click", openLoginModal);

  // guest buttons
  const guestHandler = () => {
    setModeGuest();
    closeLoginModal();
    toast("已用訪客模式進入（禁止紀錄與發文）");
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

  // restore mode / user
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
      setModeGuest();
    }
  }

  initGoogle();
}

// expose for page scripts
window.MB = MB;
window.MB.me = async (idToken) => {
  const tok = idToken || localStorage.getItem("id_token");
  if (!tok) return null;
  const data = await apiPOST({ action: "me", idToken: tok });
  if (!data.ok) throw new Error(data.error || "me failed");
  return data.user;
};
window.MB_requireLogin = requireLogin;
window.MB_openLoginModal = openLoginModal;

window.addEventListener("load", boot);
