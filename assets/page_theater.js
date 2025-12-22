// assets/page_theater.js
(() => {
  // ===== helpers =====
  const $ = (sel, root = document) => root.querySelector(sel);

  function escapeHTML(str = "") {
    return str
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(msg) {
    // 若你已有全站 toast 元件，會自動用你的；沒有就 fallback alert
    if (window.MovieBase?.toast) return window.MovieBase.toast(msg);
    alert(msg);
  }

  function openAuthModal() {
    // 若你已有全站 AuthModal，會自動打開；沒有就提示
    if (window.MovieBase?.openAuthModal) return window.MovieBase.openAuthModal();
    toast("請先登入！");
  }

  function getSession() {
    // 盡量接你現有的 session；沒有就用 localStorage fallback
    if (window.MovieBase?.session) return window.MovieBase.session;
    try {
      return JSON.parse(localStorage.getItem("mb.session") || "{}");
    } catch {
      return {};
    }
  }

  function isUserSession(s) {
    return !!(s && s.role === "user" && s.idToken);
  }

  function parseHashtags(text = "") {
    const tags = new Set();
    const matches = text.match(/#[\p{L}\p{N}_-]+/gu) || [];
    for (const t of matches) tags.add(t);
    return [...tags];
  }

  function normalizeTags(raw = "") {
    const parts = raw
      .split(/[,\s]+/g)
      .map(s => s.trim())
      .filter(Boolean);

    const tags = new Set();
    for (let t of parts) {
      if (!t.startsWith("#")) t = "#" + t;
      if (t.length > 1) tags.add(t);
    }
    return [...tags];
  }

  function formatTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString();
  }

  // ===== API =====
  function getApiBase() {
    // 你可以在 app.js 設 window.MovieBase.apiBase = "你的 Apps Script WebApp URL"
    return window.MovieBase?.apiBase || window.APP_SCRIPT_URL || "";
  }

  async function apiGet(action, params = {}) {
    const base = getApiBase();
    if (!base) throw new Error("Missing apiBase");
    const url = new URL(base);
    url.searchParams.set("action", action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { method: "GET" });
    const data = await res.json();
    return data;
  }

  async function apiPost(payload) {
    const base = getApiBase();
    if (!base) throw new Error("Missing apiBase");
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  }

  // ===== render =====
  function renderPostCard(post, session) {
    const isUser = isUserSession(session);
    const authorName = escapeHTML(post.authorName || "Unknown");
    const content = escapeHTML(post.content || "");
    const createdAt = formatTime(post.createdAt);
    const tags = (post.hashtags || []).map(escapeHTML);

    const likeDisabled = !isUser ? "disabled" : "";
    const commentDisabled = !isUser ? "disabled" : "";

    const tagsHtml = tags
      .map(t => `<button class="tagBadge" type="button" data-tag="${t}">${t}</button>`)
      .join("");

    const photoHtml = post.photoUrl
      ? `<div class="postPhoto"><img src="${escapeHTML(post.photoUrl)}" alt="post photo" loading="lazy"/></div>`
      : "";

    return `
      <article class="postCard">
        <header class="postHead">
          <div class="avatar">
            ${post.authorPic ? `<img src="${escapeHTML(post.authorPic)}" alt="avatar" />` : `<span>MB</span>`}
          </div>
          <div class="meta">
            <div class="name">${authorName}</div>
            <div class="time">${escapeHTML(createdAt)}</div>
          </div>

          <div class="postActions">
            <button class="btn tiny ghost" type="button" ${likeDisabled} data-action="like" title="${isUser ? "按讚" : "登入後才能按讚"}">❤</button>
            <button class="btn tiny ghost" type="button" ${commentDisabled} data-action="comment" title="${isUser ? "留言" : "登入後才能留言"}">💬</button>
          </div>
        </header>

        <div class="postBody">
          <div class="postText">${content.replaceAll("\n", "<br/>")}</div>
          ${photoHtml}
          <div class="tagRow">${tagsHtml}</div>
        </div>
      </article>
    `;
  }

  function setComposerCollapsed(collapsed) {
    const drawer = $("#theaterComposer");
    if (!drawer) return;
    drawer.classList.toggle("is-collapsed", collapsed);
    drawer.setAttribute("aria-hidden", collapsed ? "true" : "false");
  }

  function applyRoleUI(session) {
    const hint = $("#theaterComposerHint");
    const loginBtn = $("#theaterHintLoginBtn");
    const form = $("#theaterPostForm");
    const isUser = isUserSession(session);

    if (hint) hint.style.display = isUser ? "none" : "flex";
    if (loginBtn) loginBtn.onclick = () => openAuthModal();

    if (form) {
      // 訪客：整個表單鎖住（但仍可看 UI）
      [...form.querySelectorAll("textarea,input,button")].forEach(el => {
        if (el.id === "theaterHintLoginBtn") return;
        if (el.type === "button") return; // 模式切換按鈕可留著看
      });
      $("#theaterPostContent").disabled = !isUser;
      $("#theaterPostTags").disabled = !isUser;
      $("#theaterPostPhoto").disabled = !isUser;
      $("#theaterPostSubmit").disabled = !isUser;
    }
  }

  // ===== main =====
  async function loadPosts({ q = "" } = {}) {
    const feed = $("#theaterFeed");
    const empty = $("#theaterEmpty");
    const session = getSession();

    if (!feed) return;

    feed.innerHTML = `<div class="loadingLine">載入貼文中…</div>`;
    if (empty) empty.hidden = true;

    // MVP：先做到「能看 + 能搜尋」
    // 你規格有 postList / postSearch，訪客可 GET。:contentReference[oaicite:8]{index=8}
    let posts = [];
    try {
      if (q && getApiBase()) {
        const data = await apiGet("postSearch", { q });
        posts = data.data || data.posts || data || [];
      } else if (getApiBase()) {
        const data = await apiGet("postList");
        posts = data.data || data.posts || data || [];
      } else {
        // 沒接後端時的假資料，讓 UI 先完成
        posts = [
          {
            id: "demo1",
            authorName: "MovieBase",
            authorPic: "",
            content: "歡迎來到漂浮影廳！先用 #hashtag 找同好～\n例如：#進擊的巨人 #咒術迴戰",
            hashtags: ["#MovieBase", "#漂浮影廳"],
            createdAt: Date.now(),
          },
        ];
      }
    } catch (err) {
      console.error(err);
      toast("貼文載入失敗（檢查 apiBase 或 Apps Script action）");
      posts = [];
    }

    if (!posts || posts.length === 0) {
      feed.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }

    // 若你的後端回來 hashtags 是字串，這裡做兼容
    posts = posts.map(p => {
      let hashtags = p.hashtags;
      if (typeof hashtags === "string") hashtags = hashtags.split(/[,\s]+/).filter(Boolean);
      if (!Array.isArray(hashtags)) hashtags = [];
      return { ...p, hashtags };
    });

    feed.innerHTML = posts.map(p => renderPostCard(p, session)).join("");

    // tag 點擊 → 直接搜尋
    feed.querySelectorAll("[data-tag]").forEach(btn => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-tag");
        $("#theaterSearchInput").value = tag;
        loadPosts({ q: tag });
      });
    });

    // like/comment：訪客點了就提示登入
    feed.querySelectorAll('[data-action="like"],[data-action="comment"]').forEach(btn => {
      btn.addEventListener("click", () => {
        const s = getSession();
        if (!isUserSession(s)) {
          openAuthModal();
          return;
        }
        toast("互動功能（按讚/留言）下一步接後端 likeToggle/commentCreate。");
      });
    });
  }

  function wireEvents() {
    const session = getSession();
    applyRoleUI(session);

    $("#theaterComposeToggle")?.addEventListener("click", () => {
      const drawer = $("#theaterComposer");
      const collapsed = drawer?.classList.contains("is-collapsed");
      setComposerCollapsed(!collapsed);
    });

    $("#theaterComposerClose")?.addEventListener("click", () => setComposerCollapsed(true));

    $("#theaterRefreshBtn")?.addEventListener("click", () => loadPosts({ q: "" }));

    $("#theaterSearchBtn")?.addEventListener("click", () => {
      const q = ($("#theaterSearchInput")?.value || "").trim();
      loadPosts({ q });
    });

    $("#theaterSearchInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const q = e.target.value.trim();
        loadPosts({ q });
      }
    });

    // 新增貼文（MVP：先做到 UI + 權限 + 發佈呼叫；圖片 Drive 下一步）
    $("#theaterPostForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const s = getSession();
      if (!isUserSession(s)) {
        openAuthModal();
        return;
      }

      const content = ($("#theaterPostContent")?.value || "").trim();
      const inputTags = ($("#theaterPostTags")?.value || "").trim();
      if (!content) {
        toast("請先輸入貼文內容");
        return;
      }

      const tagsFromInput = normalizeTags(inputTags);
      const tagsFromContent = parseHashtags(content);
      const hashtags = [...new Set([...tagsFromInput, ...tagsFromContent])];

      // 後端規格：POST {action:"postCreate", idToken, post}:contentReference[oaicite:9]{index=9}
      try {
        if (!getApiBase()) {
          toast("目前尚未設定 apiBase（先把 UI 做好，下一步再接 Apps Script）");
          return;
        }

        const payload = {
          action: "postCreate",
          idToken: s.idToken,
          post: { content, hashtags },
        };

        const resp = await apiPost(payload);
        if (resp.ok === false) throw new Error(resp.message || "postCreate failed");

        toast("發佈成功！");
        $("#theaterPostContent").value = "";
        $("#theaterPostTags").value = "";
        setComposerCollapsed(true);
        loadPosts({ q: "" });
      } catch (err) {
        console.error(err);
        toast("發佈失敗：請檢查 Apps Script 的 postCreate action");
      }
    });

    // 通知鈴鐺：先佔位（你文件也說最後做）:contentReference[oaicite:10]{index=10}
    $("#theaterNotiBtn")?.addEventListener("click", () => {
      toast("通知鈴鐺建議最後做：等 likes/comments 完成再接 notifications。");
    });

    // 模式（我的紀錄 / 新的分享）先做 UI，之後再接「我的紀錄複製成貼文」:contentReference[oaicite:11]{index=11}
    $("#theaterModeFromRecords")?.addEventListener("click", () => {
      toast("下一步會把「我的紀錄」列表拉進來，選一筆直接複製成貼文。");
      $("#theaterModeFromRecords").classList.add("active");
      $("#theaterModeNewShare").classList.remove("active");
    });

    $("#theaterModeNewShare")?.addEventListener("click", () => {
      $("#theaterModeNewShare").classList.add("active");
      $("#theaterModeFromRecords").classList.remove("active");
    });
  }

  // 讓 app router 載入 partial 後可以呼叫：MovieBaseTheater.mount()
  window.MovieBaseTheater = {
    mount() {
      wireEvents();
      loadPosts({ q: "" });
    },
    refresh() {
      loadPosts({ q: "" });
    },
  };
})();
