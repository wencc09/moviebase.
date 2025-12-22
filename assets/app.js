/* MovieBase shared app.js
   - auth state (guest/user/unknown)
   - login modal (supports #loginModal and #modal)
   - permission gates (front-end)
   - theme toggle (dark/light) + persistence
   - ✅ supports "entry page no-auto-mode" + "redirect after auth"
*/

const CONFIG = {
  GAS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbyuipb05zxPbPp7iAotqe_Oya4je2s-l3COcJ8kDO7e4VHjdLRuNwJhrymkPN02b9Sd/exec",
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
   Helpers: redirect after auth
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
  const isGuest = MB.state.mode === "guest";

  // common header widgets (may not exist on all pages)
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

  // shared ids
  const btnLogout = $("#btnLogout");
  const btnLogoutTop = $("#btnLogoutTop");
  const btnOpenLogin = $("#btnOpenLogin");
  const btnGuest = $("#btnGuest");

  // index style ids
  const btnLogin = $("#btnLogin");
  const btnLogin2 = $("#btnLogin2");
  const btnGuest2 = $("#btnGuest2");

  // ✅ 規則（修正版）：
  // - 已登入：只顯示登出（隱藏登入/訪客）
  // - 訪客：仍保留「登入」按鈕（可升級 Google），但不顯示「訪客按鈕」
  // - unknown：可顯示登入/訪客（用在某些頁面第一次進來）
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
  } else { // unknown
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
   Modal (support index + pages)
========================= */
function getModalEl() {
  return $("#loginModal") || $("#modal");
}

function resetEntryChooserIfAny() {
  // index 的 modal 會有 chooseBox/googleBox
  $("#chooseBox")?.classList.remove("hidden");
  $("#googleBox")?.classList.add("hidden");
}

function openLoginModal(opts = {}) {
  const m = getModalEl();
  if (!m) return;

  if (opts.reset) resetEntryChooserIfAny();

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

        // ✅ 若入口頁設定了「登入後要去哪」→ 直接跳主站 app.html
        goAfterAuthIfNeeded();
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

  // modal close buttons
  $("#modalClose")?.addEventListener("click", closeLoginModal);

  // click backdrop to close
  const m = getModalEl();
  m?.addEventListener("click", (e) => {
    if (e.target === m) closeLoginModal();
  });

  // open modal buttons
  $("#btnOpenLogin")?.addEventListener("click", () => openLoginModal({ reset: true }));
  $("#btnLogin")?.addEventListener("click", () => openLoginModal({ reset: true }));
  $("#btnLogin2")?.addEventListener("click", () => openLoginModal({ reset: true }));

  // guest buttons (簡版 loginModal 用)
  const guestHandler = () => {
    setModeGuest();
    closeLoginModal();
    toast("已用訪客模式進入（禁止紀錄與互動）");
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

  // ✅ 入口頁：不自動判定 guest/user（你要求圖三不出現身分）
  if (window.MB_NO_AUTO_MODE) {
    MB.state.mode = "unknown";
    MB.state.user = null;
    renderAuthUI();
    initGoogle();
    return;
  }

  // other pages：照常恢復身分
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
window.MB_openLoginModal = (opts) => openLoginModal(opts || { reset: true });

window.addEventListener("load", boot);

/* =========================
   Feed Wall (Local Demo)
   之後接 Apps Script 也可以：只要把 API 改成你的 endpoint
   ========================= */
(function () {
  const LS_KEY = "moviebase_feed_posts_v1";

  function $(id) { return document.getElementById(id); }
  function nowISO() { return new Date().toISOString(); }

  function loadPosts() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function savePosts(posts) {
    localStorage.setItem(LS_KEY, JSON.stringify(posts));
  }

  function formatTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return "";
    }
  }

  function initials(name) {
    const s = (name || "MB").trim();
    return (s.length <= 2) ? s : s.slice(0, 2);
  }

  function normalizeTags(tagsStr) {
    return (tagsStr || "")
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => t.startsWith("#") ? t : `#${t}`)
      .slice(0, 8);
  }

  function render() {
    const list = $("feedList");
    const empty = $("feedEmpty");
    if (!list || !empty) return;

    const posts = loadPosts();
    list.innerHTML = "";

    if (!posts.length) {
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    for (const p of posts) {
      const card = document.createElement("article");
      card.className = "feedCard";
      card.innerHTML = `
        <div class="feedTop">
          <div class="feedMeta">
            <div class="avatar">${initials(p.author)}</div>
            <div class="metaText">
              <div class="name">${escapeHtml(p.author)}</div>
              <div class="time">${escapeHtml(formatTime(p.createdAt))}</div>
            </div>
          </div>
          <div class="badges">
            <span class="badge">${p.typeLabel}</span>
            <span class="badge">心情 ${"★".repeat(p.mood)}</span>
          </div>
        </div>

        ${p.title ? `<div class="feedTitle">${escapeHtml(p.title)}</div>` : ""}
        <div class="feedContent">${escapeHtml(p.content)}</div>

        ${p.tags?.length ? `
          <div class="feedTags">
            ${p.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
          </div>
        ` : ""}

        <div class="feedActions">
          <button class="pill" type="button" disabled>♡ 按讚（下一步）</button>
          <button class="pill" type="button" disabled>💬 留言（下一步）</button>
        </div>
      `;
      list.appendChild(card);
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function mountFeed() {
    const refreshBtn = $("btnFeedRefresh");
    const openBtn = $("btnOpenComposer");
    const details = $("composerDetails");
    const closeBtn = $("btnCloseComposer");
    const form = $("postForm");

    if (refreshBtn) refreshBtn.addEventListener("click", render);

    if (openBtn && details) {
      openBtn.addEventListener("click", () => {
        details.open = true;
        details.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }

    if (closeBtn && details) {
      closeBtn.addEventListener("click", () => { details.open = false; });
    }

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();

        const fd = new FormData(form);
        const title = (fd.get("title") || "").toString().trim();
        const type = (fd.get("type") || "movie").toString();
        const content = (fd.get("content") || "").toString().trim();
        const tags = normalizeTags((fd.get("tags") || "").toString());
        const mood = Number(fd.get("mood") || 3);

        if (!content) {
          alert("內容不能空白喔！");
          return;
        }

        // 這裡之後可接你登入狀態：author 用你 Google 使用者名稱
        const author = (document.documentElement.dataset.userName || "MovieBase");

        const typeLabelMap = { movie: "電影", series: "影集", anime: "動畫", other: "其他" };
        const post = {
          id: crypto?.randomUUID?.() || `${Date.now()}_${Math.random()}`,
          author,
          title,
          type,
          typeLabel: typeLabelMap[type] || "其他",
          content,
          tags,
          mood: Math.min(5, Math.max(1, mood)),
          createdAt: nowISO(),
        };

        const posts = loadPosts();
        posts.unshift(post);
        savePosts(posts);

        form.reset();
        if (details) details.open = false;
        render();
      });
    }

    render();
  }

  // 讓 hash 切到 #feed/#wall 時也會顯示（若你有用 hash tab）
  function onHashChange() {
    const h = (location.hash || "").replace("#", "");
    if (h === "feed" || h === "wall" || h === "post" || h === "floating") {
      // 只要有該 panel，就 mount（不會重複綁事件）
      if (!$("__feed_mounted__")) {
        const marker = document.createElement("div");
        marker.id = "__feed_mounted__";
        marker.style.display = "none";
        document.body.appendChild(marker);
        mountFeed();
      }
    }
  }

  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("DOMContentLoaded", () => {
    // 預設先 mount（安全：抓不到元素就不做事）
    mountFeed();
    onHashChange();
  });
})();

