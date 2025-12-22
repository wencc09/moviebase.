/* assets/page_theater.js
 * 漂浮影廳：電影螢幕貼文牆（先 localStorage，後續可接 Apps Script）
 */
(function () {
  const LS_KEY = "mb_posts_v1";

  function $(id) { return document.getElementById(id); }

  function getRole() {
    // 盡量不綁死你的 app.js：多種方式嘗試判斷
    const root = document.documentElement;
    const ds = root.dataset && (root.dataset.role || root.dataset.userRole);
    const ls = localStorage.getItem("mb_role") || localStorage.getItem("role");
    const badge = $("authBadge")?.textContent || "";
    if (ds) return ds;
    if (ls) return ls;
    if (/訪客|Guest/i.test(badge)) return "guest";
    if (/登入|User|已登入/i.test(badge)) return "user";
    return "guest";
  }

  function safeParse(json, fallback) {
    try { return JSON.parse(json); } catch { return fallback; }
  }

  function loadPosts() {
    const arr = safeParse(localStorage.getItem(LS_KEY), null);
    if (Array.isArray(arr) && arr.length) return arr;

    // 預設示例（你現在畫面上那些測試貼文）
    const seed = [
      {
        id: crypto.randomUUID(),
        authorName: "昭文",
        authorPic: "",
        title: "進擊的巨人",
        content: "很好看！",
        tags: ["#進擊的巨人"],
        kind: "anime",
        mood: 5,
        createdAt: Date.now() - 1000 * 60 * 20
      },
      {
        id: crypto.randomUUID(),
        authorName: "絲絲",
        authorPic: "",
        title: "動物方程市",
        content: "我原本沒有給這部電影太高的期待。畢竟前作太優秀，往例的續作要嘛跌倒、要嘛更用力地跌倒，這幾年我們也看過不少例子。但《動物方城市2》卻在我不設防的時候，端出一份意外細膩的故事。首集處理的是偏向社會層面的對立與偏見，而這次的續作則更往「更美好的烏托邦」、「個體群體」、「關係處理」的深處挖掘。動物們不只是在大城市裡各自努力，而是真正與自己的脆弱、恐懼、秘密做對話。而角色之間的關係，也從合作夥伴、同僚，慢慢走向一種更難以命名的連結。茱蒂尼克的情誼，不像單純的友情，也還不到典型的愛情；更像你以為自己跟某人保持著界線，但某一天才驚覺，那條界線早被不知不覺磨到淡化透明。這種情感，比起分類，更像是一種陪伴狀態：「不是誰擁有誰，而是誰願意為誰留一個位置」在這部分，《動物方城市2》意外的成熟。",
        tags: [],
        kind: "movie",
        mood: 5,
        createdAt: Date.now() - 1000 * 60 * 55
      }
    ];
    localStorage.setItem(LS_KEY, JSON.stringify(seed));
    return seed;
  }

  function savePosts(posts) {
    localStorage.setItem(LS_KEY, JSON.stringify(posts));
  }

  function normalizeTags(s) {
    if (!s) return [];
    // 允許使用者輸入「#tag #tag2」或直接在內容中帶 #tag
    const raw = s.split(/\s+/).map(x => x.trim()).filter(Boolean);
    const tags = raw.map(t => (t.startsWith("#") ? t : ("#" + t)));
    // 去重
    return [...new Set(tags)];
  }

  function extractTagsFromContent(content) {
    const found = (content || "").match(/#[^\s#]+/g) || [];
    return [...new Set(found)];
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${hh}:${mm}`;
  }

  function esc(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderPostCard(p) {
    const tags = (p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("");
    const moodStars = "★★★★★".slice(0, Math.max(1, Math.min(5, Number(p.mood || 5))));
    const kindText = p.kind === "series" ? "影集" : p.kind === "anime" ? "動畫" : p.kind === "other" ? "其他" : "電影";

    return `
      <article class="postCard" data-id="${esc(p.id)}">
        <div class="postTop">
          <div class="author">
            <div class="avatarSm">${esc((p.authorName || "?").slice(0,1))}</div>
            <div class="meta">
              <div class="name">${esc(p.authorName || "匿名")}</div>
              <div class="time">${esc(fmtTime(p.createdAt))}</div>
            </div>
          </div>

          <div class="badges">
            <span class="pillSm">${esc(kindText)}</span>
            <span class="pillSm">心情 ${esc(moodStars)}</span>
          </div>
        </div>

        ${p.title ? `<div class="postTitle">${esc(p.title)}</div>` : ""}
        <div class="postContent">${esc(p.content)}</div>
        ${tags ? `<div class="tagRow">${tags}</div>` : ""}

        <div class="postActions">
          <button class="btn tiny" data-act="like" type="button">♡ 按讚</button>
          <button class="btn tiny" data-act="comment" type="button">💬 留言</button>
        </div>
      </article>
    `;
  }

  function applyRoleLock(role) {
    const hint = $("composerHint");
    const form = $("postForm");
    const submit = $("btnPostSubmit");
    const composer = $("composerBox");

    const isGuest = role !== "user";

    if (hint) hint.textContent = isGuest ? "（訪客只能瀏覽）" : "（已登入，可發文）";

    // 訪客：不能互動（符合你的規則）:contentReference[oaicite:8]{index=8}
    if (form) {
      form.querySelectorAll("input, textarea, select, button").forEach(el => {
        if (el.id === "btnPostSubmit") return;
        el.disabled = isGuest;
      });
    }
    if (submit) submit.disabled = isGuest;

    if (composer) {
      composer.open = !isGuest; // 你也可以改成 false，讓訪客預設收起
    }
  }

  function filterPosts(posts, q) {
    const s = (q || "").trim();
    if (!s) return posts;

    // 支援 #hashtag 或一般文字
    const lower = s.toLowerCase();
    return posts.filter(p => {
      const hay = [
        p.title || "",
        p.content || "",
        (p.tags || []).join(" ")
      ].join(" ").toLowerCase();
      return hay.includes(lower);
    });
  }

  function mount() {
    const listEl = $("postList");
    const searchEl = $("postSearch");
    const refreshBtn = $("btnRefreshPosts");
    const form = $("postForm");

    if (!listEl) return; // 不是 hall 分頁就不做事

    let posts = loadPosts().sort((a, b) => b.createdAt - a.createdAt);

    function render() {
      const q = searchEl?.value || "";
      const filtered = filterPosts(posts, q);
      listEl.innerHTML = filtered.map(renderPostCard).join("") || `<div class="muted">目前沒有貼文</div>`;
    }

    // 互動（先做出 UI；訪客會被鎖住）
    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;

      const role = getRole();
      if (role !== "user") {
        alert("訪客只能瀏覽，請先登入再互動。");
        return;
      }
      // 先做 UI 提示；之後接後端 like/comment
      alert("下一步會接：按讚/留言 API");
    });

    if (searchEl) searchEl.addEventListener("input", render);
    if (refreshBtn) refreshBtn.addEventListener("click", () => {
      posts = loadPosts().sort((a, b) => b.createdAt - a.createdAt);
      render();
      applyRoleLock(getRole());
    });

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const role = getRole();
        if (role !== "user") {
          alert("訪客不能發文，請先登入。");
          return;
        }

        const title = $("postTitle")?.value.trim() || "";
        const content = $("postContent")?.value.trim() || "";
        const kind = $("postKind")?.value || "movie";
        const mood = Number($("postMood")?.value || 5);
        const tagsInput = $("postTags")?.value || "";

        if (!content) {
          alert("請輸入貼文內容");
          return;
        }

        // tags：輸入 + 內容內的 #tag 都算
        const tags = [...new Set([
          ...normalizeTags(tagsInput),
          ...extractTagsFromContent(content)
        ])];

        const authorName = $("authName")?.textContent?.trim() || "User";

        const newPost = {
          id: crypto.randomUUID(),
          authorName,
          authorPic: "",
          title,
          content,
          tags,
          kind,
          mood,
          createdAt: Date.now()
        };

        posts = [newPost, ...posts];
        savePosts(posts);

        // reset
        $("postTitle") && ($("postTitle").value = "");
        $("postContent") && ($("postContent").value = "");
        $("postTags") && ($("postTags").value = "");

        render();
      });
    }

    // 初次渲染 + 套用權限鎖
    render();
    applyRoleLock(getRole());

    // 若你 app.js 之後有發出自訂事件（可選），這裡能即時更新狀態
    window.addEventListener("mb:auth", (ev) => {
      const role = ev?.detail?.role || getRole();
      applyRoleLock(role);
    });
  }

  // DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
