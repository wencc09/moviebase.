/* MovieBase shared app.js (fixed)
   - Robust Google GIS init (retry until SDK ready)
   - Better backend error visibility
   - Feed Wall now uses Apps Script (sheet) so cross-device sync works
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
  const u = new URL(CONFIG.GAS_WEBAPP_URL);
  Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
  return apiFetch_(u.toString(), { method: "GET" });
}

async function verifyMe() {
  const idToken = localStorage.getItem("id_token");
  if (!idToken) return null;
  const data = await apiPOST({ action: "me", idToken });
  if (!data.ok) throw new Error(data.error || "me failed");
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

        ${c.tags?.length ? `
          <div class="feedTags">
            ${c.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
          </div>
        ` : ""}
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
  }

  async function loadCards() {
    const data = await apiGET({ action: "list_posts" });
    if (!data.ok) throw new Error(data.error || "list_posts failed");

    const cards = (data.rows || []).map(toCard);

    // ts 已是 ISO 字串的話，後端有排序；這裡再保險
    cards.sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));
    return cards;
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

    const idToken = localStorage.getItem("id_token");
    const payload = {
      action: "create_post",
      idToken,
      title,
      category: kind,
      rating: Math.min(5, Math.max(1, mood)),
      review: content,
      hashtags: tags,
    };

    const data = await apiPOST(payload);
    if (!data.ok) throw new Error(data.error || "create_post failed");
    return data.id;
  }

  async function refresh() {
    const q = $("postSearch")?.value || "";
    const cards = await loadCards();
    render(cards, q);
  }

  // Mount
  window.addEventListener("load", async () => {
    try {
      applyRoleLock();
      await refresh();
    } catch (e) {
      console.error(e);
      toast(`貼文讀取失敗：${String(e.message || e)}`.slice(0, 120));
    }

    $("btnRefreshPosts")?.addEventListener("click", async () => {
      try { await refresh(); } catch (e) { toast(String(e.message || e)); }
    });

    $("postSearch")?.addEventListener("input", async () => {
      try { await refresh(); } catch (_) {}
    });

    $("postForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!requireLogin("發布貼文")) return;

      try {
        await createCardFromForm();

        // reset
        if ($("postTitle")) $("postTitle").value = "";
        if ($("postContent")) $("postContent").value = "";
        if ($("postTags")) $("postTags").value = "";

        toast("✅ 已發布（已寫入試算表）");
        await refresh();
      } catch (err) {
        console.error(err);
        toast(`發布失敗：${String(err.message || err)}`.slice(0, 140));
      }
    });

    window.addEventListener("mb:auth", async () => {
      applyRoleLock();
      try { await refresh(); } catch (_) {}
    });
  });
})();
