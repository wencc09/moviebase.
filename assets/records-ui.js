/* assets/records-ui.js
   - 使用 MB 登入狀態（MB.state.mode）
   - 清單：雲端 records.list
   - 推薦/統計：改用雲端清單（不再用 localStorage）
   - 提供 Records.init() 讓 records.html 直接呼叫
*/

(function () {
  const escapeHtml = (s = "") =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function notify(msg) {
    if (window.toast) return window.toast(msg);
    alert(msg);
  }

  function getIdToken_() {
    const st = (window.MB && MB.state) ? MB.state : {};
    return (
      st.idToken ||
      localStorage.getItem("idToken") ||
      localStorage.getItem("id_token") ||
      ""
    );
  }

  function isLoggedIn() {
    return (window.MB && MB.state && MB.state.mode === "user" && !!getIdToken_());
  }

  async function api(action, payload = {}) {
    const url =
      (window.CONFIG && window.CONFIG.GAS_WEBAPP_URL) ? window.CONFIG.GAS_WEBAPP_URL :
      (typeof CONFIG !== "undefined" && CONFIG.GAS_WEBAPP_URL) ? CONFIG.GAS_WEBAPP_URL :
      (window.SCRIPT_URL || "");

    if (!url) throw new Error("GAS_WEBAPP_URL not found（請在 app.js 加上 window.CONFIG = CONFIG）");

    const idToken = getIdToken_();
    if (!idToken) throw new Error("missing idToken");

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // ✅ 不觸發 CORS preflight
      body: JSON.stringify({ action, idToken, ...payload, _t: Date.now() }),
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      const head = text.slice(0, 220).replace(/\s+/g, " ");
      throw new Error(`Backend not JSON (HTTP ${res.status}): ${head}`);
    }

    if (!json.ok) throw new Error(json.error || "API failed");
    return json;
  }

  function openModal(el) {
    if (!el) return;
    el.style.display = "flex";
    el.setAttribute("aria-hidden", "false");
  }
  function closeModal(el) {
    if (!el) return;
    el.style.display = "none";
    el.setAttribute("aria-hidden", "true");
  }
  function wireModalClose(modal) {
    if (!modal) return;
    modal.querySelectorAll("[data-close]").forEach(el => {
      el.addEventListener("click", () => closeModal(modal));
    });
  }

  function ensureTemplateIfNeeded(container) {
    // 如果頁面本來就有（records.html 你已經寫好），就不要覆蓋
    if (document.getElementById("recAddBtn")) return;

    // 否則（app.html#records 的 recordsMount）才注入模板
    container.innerHTML = `
      <div class="recordsHead">
        <div class="recordsTitle">
          <div class="recordsEmoji">🎬</div>
          <div>
            <div class="recordsH2">觀影紀錄</div>
            <div class="muted">新增／編輯／刪除、推薦、統計、三清單</div>
          </div>
        </div>

        <div class="recordsActions">
          <button id="recRecommendBtn" class="btn">✨ 推薦</button>
          <button id="recAnalysisBtn" class="btn">📊 統計</button>
          <button id="recAddBtn" class="btn primary">＋ 新增</button>
        </div>
      </div>

      <div class="hr"></div>

      <div id="recLoginOverlay" class="recOverlay" style="display:none;">
        <div class="recOverlayCard">
          <div class="recordsH2">🔒 觀影紀錄需要登入</div>
          <div class="muted" style="margin-top:6px">請先登入 Google 才能使用（訪客不可用）</div>
          <button id="recLoginBtn" class="btn primary" style="margin-top:14px">前往登入</button>
        </div>
      </div>

      <div id="recRecommendArea" class="recordsArea" style="display:none;">
        <div class="areaHead">🔥 推薦</div>
        <div id="recRecommendContent" class="recGrid"></div>
      </div>

      <div id="recAnalysisArea" class="recordsArea" style="display:none;">
        <div class="areaHead">📊 我的類別統計</div>
        <div class="analysisRow">
          <div id="recAnalysisRecText" class="muted"></div>
          <div class="analysisChartWrap"><canvas id="recGenrePieChart"></canvas></div>
        </div>
      </div>

      <div class="listsWrap">
        <div class="listBlock">
          <div class="listHead">👀 觀看中</div>
          <div id="recWatchingList" class="cardsGrid"></div>
        </div>

        <div class="listBlock">
          <div class="listHead">🕒 未觀看</div>
          <div id="recNotList" class="cardsGrid"></div>
        </div>

        <div class="listBlock">
          <div class="listHead">✅ 已觀看</div>
          <div id="recDoneList" class="cardsGrid"></div>
        </div>
      </div>

      <div class="muted" id="recGuardText" style="margin-top:10px;"></div>
    `;

    // 需要的 modal（只在不存在時補）
    if (!document.getElementById("recTypeModal")) {
      const modalsWrap = document.createElement("div");
      modalsWrap.innerHTML = `
        <div id="recTypeModal" class="mbModal" style="display:none;">
          <div class="mbBackdrop" data-close="1"></div>
          <div class="mbPanel">
            <h3 style="margin:0;">新增紀錄</h3>
            <div class="muted" style="margin-top:6px;">請先選擇作品類型</div>
            <div class="twoColBtns">
              <button id="recSeriesBtn" class="btn">📺 影集 / 動漫</button>
              <button id="recMovieBtn" class="btn">🎬 電影</button>
            </div>
            <div class="hr"></div>
            <button class="btn" data-close="1" type="button">取消</button>
          </div>
        </div>

        <div id="recFormModal" class="mbModal" style="display:none;">
          <div class="mbBackdrop" data-close="1"></div>
          <div class="mbPanel mbPanelWide">
            <div class="formTop">
              <h3 style="margin:0;">紀錄表單</h3>
              <button class="btn" data-close="1" type="button">關閉</button>
            </div>

            <input id="recEditId" type="hidden">

            <label class="field">
              <div class="label">作品名稱</div>
              <input id="recTitleInput" class="input" placeholder="例如：進擊的巨人 / Inception">
            </label>

            <label class="field">
              <div class="label">類別</div>
              <select id="recGenreSelect" class="input">
                <option value="劇情片">劇情片</option>
                <option value="喜劇片">喜劇片</option>
                <option value="動作片">動作片</option>
                <option value="科幻片">科幻片</option>
                <option value="恐怖片">恐怖片</option>
                <option value="愛情片">愛情片</option>
                <option value="動畫">動畫</option>
                <option value="紀錄片">紀錄片</option>
                <option value="綜藝">綜藝</option>
                <option value="旅遊">旅遊</option>
                <option value="醫療">醫療</option>
                <option value="律政">律政</option>
                <option value="其他">其他</option>
              </select>
            </label>

            <label class="field">
              <div class="label">觀看日期</div>
              <input id="recDateInput" class="input" type="date">
            </label>

            <label id="recEpArea" class="field">
              <div class="label">集數（影集用）</div>
              <input id="recEpInput" class="input" type="number" min="0" placeholder="例如：12">
            </label>

            <div class="field">
              <div class="label">評分</div>
              <div id="recStarContainer" class="stars"></div>
            </div>

            <label class="field">
              <div class="label">備註</div>
              <textarea id="recNoteInput" class="input" rows="3" placeholder="心得/吐槽/想記的事"></textarea>
            </label>

            <label class="field">
              <div class="label">狀態</div>
              <select id="recStatusSelect" class="input">
                <option value="watching">觀看中</option>
                <option value="not">未觀看</option>
                <option value="done">已觀看</option>
              </select>
            </label>

            <div class="formBtns">
              <button id="recDelBtn" class="btn danger" type="button">刪除</button>
              <button id="recSaveBtn" class="btn primary" type="button">儲存</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalsWrap);
    }
  }

  function mount(container) {
    if (!container) return;
    if (container.dataset.recMounted === "1") return;
    container.dataset.recMounted = "1";

    ensureTemplateIfNeeded(container);

    const $ = (id) => document.getElementById(id);

    const els = {
      overlay: $("recLoginOverlay"),
      loginBtn: $("recLoginBtn"),
      guardText: $("recGuardText"),

      recommendBtn: $("recRecommendBtn"),
      analysisBtn: $("recAnalysisBtn"),
      addBtn: $("recAddBtn"),

      recommendArea: $("recRecommendArea"),
      recommendContent: $("recRecommendContent"),
      analysisArea: $("recAnalysisArea"),
      analysisText: $("recAnalysisRecText"),
      chartCanvas: $("recGenrePieChart"),

      watchingList: $("recWatchingList"),
      notList: $("recNotList"),
      doneList: $("recDoneList"),

      typeModal: $("recTypeModal"),
      seriesBtn: $("recSeriesBtn"),
      movieBtn: $("recMovieBtn"),

      formModal: $("recFormModal"),
      editId: $("recEditId"),
      titleInput: $("recTitleInput"),
      genreSelect: $("recGenreSelect"),
      dateInput: $("recDateInput"),
      epArea: $("recEpArea"),
      epInput: $("recEpInput"),
      starContainer: $("recStarContainer"),
      noteInput: $("recNoteInput"),
      statusSelect: $("recStatusSelect"),
      delBtn: $("recDelBtn"),
      saveBtn: $("recSaveBtn"),
    };

    const st = {
      currentType: "movie",
      currentRating: 0,
      pie: null,
      records: [], // ✅ 雲端清單快取（推薦/統計都用它）
    };

    function renderStars() {
      els.starContainer.innerHTML = "";
      for (let i = 1; i <= 5; i++) {
        const sp = document.createElement("span");
        sp.textContent = "★";
        sp.className = "star" + (i <= st.currentRating ? " active" : "");
        sp.addEventListener("click", () => {
          st.currentRating = i;
          renderStars();
        });
        els.starContainer.appendChild(sp);
      }
    }

    function clearLists() {
      els.watchingList.innerHTML = "";
      els.notList.innerHTML = "";
      els.doneList.innerHTML = "";
    }

    async function ensureRecordsFresh_() {
      if (!isLoggedIn()) return [];
      if (st.records && st.records.length) return st.records;

      const data = await api("records.list");
      st.records = data.items || [];
      return st.records;
    }

    async function renderLists() {
      clearLists();

      if (!isLoggedIn()) {
        st.records = [];
        return;
      }

      try {
        const data = await api("records.list");
        const list = (data.items || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        saveRecords(list); // ✅ 關鍵：把雲端清單同步回 localStorage，統計/推薦就會有資料

        const map = { watching: els.watchingList, not: els.notList, done: els.doneList };

        list.forEach(r => {
          const card = document.createElement("div");
          card.className = "recCard";
          const icon = (r.type === "series") ? "📺" : "🎬";
          const stars = "★".repeat(Number(r.rating || 0));

          card.innerHTML = `
            <div class="recMeta"><span>${escapeHtml(r.watchDate || "")}</span><span>${icon}</span></div>
            <div class="recTitle">${escapeHtml(r.title || "")}</div>
            <div class="recStars">${escapeHtml(stars)}</div>
            ${r.note ? `<div class="recNote">${escapeHtml(r.note)}</div>` : ""}
          `;

          card.addEventListener("click", () => {
            st.currentType = r.type || "movie";
            openForm(r);
          });

          (map[r.status] || els.notList).appendChild(card);
        });
      } catch (err) {
        console.error(err);
        notify("讀取雲端紀錄失敗：" + (err?.message || err));
      }
    }

    function openForm(d = null) {
      els.editId.value = d?.entryId || "";
      els.titleInput.value = d?.title || "";
      els.genreSelect.value = d?.genre || "劇情片";
      els.dateInput.value = d?.watchDate || new Date().toISOString().slice(0, 10);
      els.epInput.value = d?.episodes || "";
      els.noteInput.value = d?.note || "";
      els.statusSelect.value = d?.status || "watching";

      st.currentRating = Number(d?.rating || 0);
      renderStars();

      els.epArea.style.display = (st.currentType === "series") ? "block" : "none";
      els.delBtn.style.display = els.editId.value ? "inline-flex" : "none";

      closeModal(els.typeModal);
      openModal(els.formModal);
    }

    async function saveRecord() {
      if (!isLoggedIn()) { notify("請先登入"); return; }

      const record = {
        entryId: els.editId.value || "",
        title: els.titleInput.value.trim(),
        genre: els.genreSelect.value,
        watchDate: els.dateInput.value,
        episodes: els.epInput.value,
        rating: st.currentRating,
        note: els.noteInput.value.trim(),
        status: els.statusSelect.value,
        type: st.currentType
      };

      if (!record.title) { notify("請輸入作品名稱"); return; }

      try {
        const res = await api("records.upsert", { record });
        els.editId.value = res.entryId || els.editId.value;

        closeModal(els.formModal);

        // ✅ 刷新雲端清單 + 推薦/統計快取
        st.records = [];
        await renderLists();

        notify("✅ 已儲存到雲端（試算表）");
      } catch (err) {
        console.error(err);
        notify("儲存失敗：" + (err?.message || err));
      }
    }

    async function deleteRecord() {
      if (!isLoggedIn()) { notify("請先登入"); return; }

      const entryId = els.editId.value;
      if (!entryId) return;
      if (!confirm("確定刪除？")) return;

      try {
        await api("records.delete", { entryId });
        closeModal(els.formModal);

        st.records = [];
        await renderLists();

        notify("🗑️ 已從雲端刪除");
      } catch (err) {
        console.error(err);
        notify("刪除失敗：" + (err?.message || err));
      }
    }

    async function updateAnalysis() {
      let list = st.records || [];
      if (!list.length && isLoggedIn()) {
        try { list = await ensureRecordsFresh_(); } catch (_) {}
      }

      if (!list.length) {
        els.analysisText.textContent = "目前沒有任何紀錄，先新增一筆再看統計～";
        if (st.pie) { st.pie.destroy(); st.pie = null; }
        return;
      }

      const genreMap = {};
      list.forEach(r => {
        const g = r.genre || "其他";
        genreMap[g] = (genreMap[g] || 0) + 1;
      });

      const labels = Object.keys(genreMap);
      const data = Object.values(genreMap);
      const top = labels.reduce((a, b) => (genreMap[a] > genreMap[b] ? a : b));

      els.analysisText.innerHTML = `你最常看的類別是 <b>${escapeHtml(top)}</b>，共 ${list.length} 筆。`;

      if (!window.Chart) return;
      if (st.pie) { st.pie.destroy(); st.pie = null; }

      st.pie = new Chart(els.chartCanvas, {
        type: "doughnut",
        data: { labels, datasets: [{ data }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }

    async function updateRecommend() {
      let list = st.records || [];
      if (!list.length && isLoggedIn()) {
        try { list = await ensureRecordsFresh_(); } catch (_) {}
      }

      const rated = (list || []).filter(r => Number(r.rating || 0) > 0);
      if (!rated.length) {
        els.recommendContent.innerHTML = `<div class="muted">目前沒有足夠資料產生推薦（先新增幾筆並評分）。</div>`;
        return;
      }

      // 以「同作品」聚合：title + type
      const stats = {};
      rated.forEach(r => {
        const t = (r.title || "").trim();
        if (!t) return;
        const key = `${t}__${r.type || "movie"}`;
        if (!stats[key]) stats[key] = { title: t, type: r.type || "movie", score: 0, count: 0, genre: r.genre || "其他" };
        stats[key].score += Number(r.rating || 0);
        stats[key].count += 1;
      });

      const top = Object.values(stats)
        .map(x => ({ ...x, avg: (x.score / x.count) }))
        .sort((a, b) => (b.avg - a.avg) || (b.count - a.count))
        .slice(0, 4);

      els.recommendContent.innerHTML = "";
      top.forEach((it, i) => {
        const c = document.createElement("div");
        c.className = "recCard";
        const icon = (it.type === "series") ? "📺" : "🎬";
        c.innerHTML = `
          <div class="recMeta"><span>TOP ${i + 1}</span><span>${escapeHtml(it.genre)} ${icon}</span></div>
          <div class="recTitle">${escapeHtml(it.title)}</div>
          <div class="recStars">★ ${escapeHtml(it.avg.toFixed(1))}（${it.count}）</div>
        `;
        els.recommendContent.appendChild(c);
      });
    }

    function syncLoginUI() {
      const ok = isLoggedIn();
      if (els.overlay) els.overlay.style.display = ok ? "none" : "flex";
      if (els.guardText) {
        els.guardText.textContent = ok ? "✅ 已登入" : "🔒 訪客：已阻擋（請先登入）";
      }
    }

    // 初始：強制關 modal（避免初始化卡住）
    closeModal(els.typeModal);
    closeModal(els.formModal);

    wireModalClose(els.typeModal);
    wireModalClose(els.formModal);

    // actions
    els.loginBtn?.addEventListener("click", () => {
      const b = document.getElementById("btnOpenLogin");
      if (b) b.click();
      else notify("找不到 btnOpenLogin（請確認 topbar 登入按鈕 id）");
    });

    els.addBtn?.addEventListener("click", () => {
      if (!isLoggedIn()) { notify("請先登入"); return; }
      openModal(els.typeModal);
    });

    els.seriesBtn?.addEventListener("click", () => { st.currentType = "series"; openForm(null); });
    els.movieBtn?.addEventListener("click", () => { st.currentType = "movie"; openForm(null); });

    els.saveBtn?.addEventListener("click", saveRecord);
    els.delBtn?.addEventListener("click", deleteRecord);

    els.analysisBtn?.addEventListener("click", () => {
      const open = (els.analysisArea.style.display === "none" || !els.analysisArea.style.display);
      els.analysisArea.style.display = open ? "block" : "none";
      if (open) setTimeout(() => updateAnalysis(), 30);
    });

    els.recommendBtn?.addEventListener("click", () => {
      const open = (els.recommendArea.style.display === "none" || !els.recommendArea.style.display);
      els.recommendArea.style.display = open ? "block" : "none";
      if (open) updateRecommend();
    });

    // init
    renderStars();
    renderLists();
    syncLoginUI();

    // 跟著 MB 狀態更新
    window.addEventListener("mb:auth", async () => {
      syncLoginUI();
      st.records = [];
      await renderLists();
    });

    setInterval(syncLoginUI, 800);
  }

  function init() {
    const root =
      document.getElementById("recordsMount") ||
      document.querySelector(".recordsShell") ||
      document.querySelector("#records") ||
      null;

    if (!root) return;
    mount(root);
  }

  window.Records = { mount, init };
})();
