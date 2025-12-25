/* assets/records-ui.js (for app.html#records)
   - 自動把 Records 模板渲染進 #recordsMount
   - 使用 MovieBase 現有 MB 登入狀態（MB.state.mode）
   - 先用 localStorage 暫存（下一步再接 GAS 試算表）
*/

(function(){
  const escapeHtml = (s="") => String(s)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  function notify(msg){
    if(window.toast) return window.toast(msg);
    alert(msg);
  }

  function isLoggedIn(){
    return window.MB && MB.state && MB.state.mode === "user";
  }

  // localStorage 分使用者（避免不同帳號混在一起）
  function storeKey(){
    const p = (window.MB && MB.state && MB.state.profile) ? MB.state.profile : null;
    const email = p?.email || "anon";
    return `mb_records_${email}`;
  }
  function loadRecords(){
    try { return JSON.parse(localStorage.getItem(storeKey()) || "[]"); }
    catch(e){ return []; }
  }
  function saveRecords(list){
    localStorage.setItem(storeKey(), JSON.stringify(list));
  }

  // ----- UI helpers -----
  function openModal(el){ el.style.display = "flex"; }
  function closeModal(el){ el.style.display = "none"; }
  function wireModalClose(modal){
    modal.querySelectorAll("[data-close]").forEach(el=>{
      el.addEventListener("click", ()=> closeModal(modal));
    });
  }

  function mount(container){
    // 1) 先把主 UI 塞進 recordsMount
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

    // 2) 把兩個 modal 塞到 body（避免被 SPA 容器 overflow 擋住）
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

    // 3) 綁定行為
    const $ = (id)=>document.getElementById(id);

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

    const st = { currentType:"movie", currentRating:0, pie:null };

    function renderStars(){
      els.starContainer.innerHTML = "";
      for(let i=1;i<=5;i++){
        const sp = document.createElement("span");
        sp.textContent = "★";
        sp.className = "star" + (i<=st.currentRating ? " active":"");
        sp.addEventListener("click", ()=>{ st.currentRating=i; renderStars(); });
        els.starContainer.appendChild(sp);
      }
    }

    function clearLists(){
      els.watchingList.innerHTML="";
      els.notList.innerHTML="";
      els.doneList.innerHTML="";
    }

    function renderLists(){
      const list = loadRecords().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
      clearLists();
      const map = { watching: els.watchingList, not: els.notList, done: els.doneList };

      list.forEach(r=>{
        const card = document.createElement("div");
        card.className="recCard";
        const icon = (r.type==="series") ? "📺" : "🎬";
        const stars = "★".repeat(Number(r.rating||0));
        card.innerHTML = `
          <div class="recMeta"><span>${escapeHtml(r.watchDate||"")}</span><span>${icon}</span></div>
          <div class="recTitle">${escapeHtml(r.title||"")}</div>
          <div class="recStars">${escapeHtml(stars)}</div>
          ${r.note ? `<div class="recNote">${escapeHtml(r.note)}</div>` : ""}
        `;
        card.addEventListener("click", ()=>{ st.currentType=r.type||"movie"; openForm(r); });
        (map[r.status] || els.notList).appendChild(card);
      });
    }

    function openForm(d=null){
      els.editId.value = d?.id || "";
      els.titleInput.value = d?.title || "";
      els.genreSelect.value = d?.genre || "劇情片";
      els.dateInput.value = d?.watchDate || new Date().toISOString().slice(0,10);
      els.epInput.value = d?.episodes || "";
      els.noteInput.value = d?.note || "";
      els.statusSelect.value = d?.status || "watching";

      st.currentRating = Number(d?.rating||0);
      renderStars();

      els.epArea.style.display = (st.currentType==="series") ? "block" : "none";
      els.delBtn.style.display = els.editId.value ? "inline-flex" : "none";

      closeModal(els.typeModal);
      openModal(els.formModal);
    }

    function saveRecord(){
      const list = loadRecords();
      const data = {
        id: els.editId.value || `id_${Date.now()}`,
        title: els.titleInput.value.trim(),
        genre: els.genreSelect.value,
        watchDate: els.dateInput.value,
        episodes: els.epInput.value,
        rating: st.currentRating,
        note: els.noteInput.value.trim(),
        status: els.statusSelect.value,
        type: st.currentType,
        updatedAt: Date.now(),
      };
      if(!data.title){ notify("請輸入作品名稱"); return; }

      const idx = list.findIndex(x=>x.id===data.id);
      if(idx>=0) list[idx]=data; else list.unshift(data);
      saveRecords(list);

      closeModal(els.formModal);
      renderLists();
      notify("✅ 已儲存（目前先暫存在瀏覽器，下一步接試算表）");
    }

    function deleteRecord(){
      const id = els.editId.value;
      if(!id) return;
      if(!confirm("確定刪除？")) return;
      const list = loadRecords().filter(x=>x.id!==id);
      saveRecords(list);
      closeModal(els.formModal);
      renderLists();
      notify("🗑️ 已刪除");
    }

    function updateAnalysis(){
      const list = loadRecords();
      if(!list.length){
        els.analysisText.textContent = "目前沒有任何紀錄，先新增一筆再看統計～";
        if(st.pie){ st.pie.destroy(); st.pie=null; }
        return;
      }
      const genreMap = {};
      list.forEach(r=>{ const g=r.genre||"其他"; genreMap[g]=(genreMap[g]||0)+1; });
      const labels = Object.keys(genreMap);
      const data = Object.values(genreMap);
      const top = labels.reduce((a,b)=> genreMap[a]>genreMap[b]?a:b);
      els.analysisText.innerHTML = `你最常看的類別是 <b>${escapeHtml(top)}</b>，共 ${list.length} 筆。`;

      if(!window.Chart){ return; }
      if(st.pie){ st.pie.destroy(); st.pie=null; }
      st.pie = new Chart(els.chartCanvas, {
        type:"doughnut",
        data:{ labels, datasets:[{ data }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } }
      });
    }

    function updateRecommend(){
      // 先用「自己的資料」做推薦（下一步才接你的後台/全站）
      const list = loadRecords().filter(r=>Number(r.rating||0)>0);
      if(!list.length){
        els.recommendContent.innerHTML = `<div class="muted">目前沒有足夠資料產生推薦（先新增幾筆並評分）。</div>`;
        return;
      }
      const stats = {};
      list.forEach(r=>{
        const t=(r.title||"").trim(); if(!t) return;
        if(!stats[t]) stats[t]={ title:t, score:0, count:0, genre:r.genre||"其他" };
        stats[t].score += Number(r.rating||0);
        stats[t].count += 1;
      });
      const top = Object.values(stats)
        .map(x=>({ ...x, avg:(x.score/x.count).toFixed(1) }))
        .sort((a,b)=>Number(b.avg)-Number(a.avg))
        .slice(0,4);

      els.recommendContent.innerHTML="";
      top.forEach((it,i)=>{
        const c=document.createElement("div");
        c.className="recCard";
        c.innerHTML = `
          <div class="recMeta"><span>TOP ${i+1}</span><span>${escapeHtml(it.genre)}</span></div>
          <div class="recTitle">${escapeHtml(it.title)}</div>
          <div class="recStars">★ ${escapeHtml(it.avg)}（${it.count}）</div>
        `;
        els.recommendContent.appendChild(c);
      });
    }

    function syncLoginUI(){
      const ok = isLoggedIn();
      els.overlay.style.display = ok ? "none" : "flex";
      els.guardText.textContent = ok
        ? "✅ 已登入：Records 模板已掛載（目前資料先存在瀏覽器）"
        : "🔒 訪客：已阻擋（請先登入）";
    }

    // modal close wiring
    wireModalClose(els.typeModal);
    wireModalClose(els.formModal);

    // actions
    els.loginBtn.addEventListener("click", ()=>{
      // 直接叫你主站的登入按鈕（通常就是 btnOpenLogin）
      const b = document.getElementById("btnOpenLogin");
      if(b) b.click();
      else notify("找不到 btnOpenLogin（請確認 app.html topbar 的登入按鈕 id）");
    });

    els.addBtn.addEventListener("click", ()=>{
      if(!isLoggedIn()){ notify("請先登入"); return; }
      openModal(els.typeModal);
    });

    els.seriesBtn.addEventListener("click", ()=>{ st.currentType="series"; openForm(null); });
    els.movieBtn.addEventListener("click", ()=>{ st.currentType="movie"; openForm(null); });

    els.saveBtn.addEventListener("click", saveRecord);
    els.delBtn.addEventListener("click", deleteRecord);

    els.analysisBtn.addEventListener("click", ()=>{
      els.analysisArea.style.display = (els.analysisArea.style.display==="none"||!els.analysisArea.style.display) ? "block" : "none";
      if(els.analysisArea.style.display!=="none") setTimeout(updateAnalysis, 30);
    });

    els.recommendBtn.addEventListener("click", ()=>{
      els.recommendArea.style.display = (els.recommendArea.style.display==="none"||!els.recommendArea.style.display) ? "block" : "none";
      if(els.recommendArea.style.display!=="none") updateRecommend();
    });

    // init
    renderStars();
    renderLists();
    syncLoginUI();
    setInterval(syncLoginUI, 800); // 跟著 MB 狀態更新
  }

  window.Records = { mount };
})();
