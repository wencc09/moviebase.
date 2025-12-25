/* assets/records-ui.js
   目標：先把「Records 模板/框架」塞進 MovieBase records.html
   - 使用你現有 MB 登入狀態（MB.state.mode）
   - UI：推薦/統計/三清單/新增/編輯/刪除/彈窗
   - 資料：先用 localStorage 暫存（下一步再接 GAS 試算表）
*/

(function(){
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

    userInfo: $("recUserInfo"),
    userImg: $("recUserImg"),
    logoutBtn: $("recLogoutBtn"),

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

  const state = {
    currentType: "movie",
    currentRating: 0,
    pie: null,
  };

  function notify(msg){
    if(window.toast) return window.toast(msg);
    alert(msg);
  }

  function isLoggedIn(){
    return window.MB && MB.state && MB.state.mode === "user";
  }

  function requireLogin(reason){
    if(window.MB_requireLogin) return MB_requireLogin(reason);
    // fallback: 只檢查
    if(!isLoggedIn()){
      notify("請先登入");
      return false;
    }
    return true;
  }

  function escapeHtml(s=""){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // localStorage key（先用 email 當分流，避免不同使用者混在一起）
  function storeKey(){
    const u = (window.MB && MB.state && MB.state.profile) ? MB.state.profile : null;
    const email = u?.email || "anon";
    return `mb_records_${email}`;
  }
  function loadRecords(){
    try{
      return JSON.parse(localStorage.getItem(storeKey()) || "[]");
    }catch(e){
      return [];
    }
  }
  function saveRecords(list){
    localStorage.setItem(storeKey(), JSON.stringify(list));
  }

  // modal helpers
  function openModal(el){ el.style.display = "flex"; }
  function closeModal(el){ el.style.display = "none"; }
  function wireModalClose(el){
    el.querySelectorAll("[data-close]").forEach(b=>{
      b.addEventListener("click", ()=>closeModal(el));
    });
  }

  // stars
  function renderStars(){
    els.starContainer.innerHTML = "";
    for(let i=1;i<=5;i++){
      const sp = document.createElement("span");
      sp.textContent = "★";
      sp.className = "star" + (i<=state.currentRating ? " active":"");
      sp.addEventListener("click", ()=>{
        state.currentRating = i;
        renderStars();
      });
      els.starContainer.appendChild(sp);
    }
  }

  function clearLists(){
    els.watchingList.innerHTML = "";
    els.notList.innerHTML = "";
    els.doneList.innerHTML = "";
  }

  function renderLists(){
    const list = loadRecords();
    clearLists();

    const map = { watching: els.watchingList, not: els.notList, done: els.doneList };

    // 讓最新的在前面
    list.sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0));

    for(const r of list){
      const card = document.createElement("div");
      card.className = "recCard";
      const icon = (r.type === "series") ? "📺" : "🎬";
      const stars = "★".repeat(Number(r.rating||0));
      card.innerHTML = `
        <div class="recMeta"><span>${escapeHtml(r.watchDate||"")}</span><span>${icon}</span></div>
        <div class="recTitle">${escapeHtml(r.title||"")}</div>
        <div class="recStars">${escapeHtml(stars)}</div>
        ${r.note ? `<div class="recNote">${escapeHtml(r.note)}</div>` : ""}
      `;
      card.addEventListener("click", ()=>{
        state.currentType = r.type || "movie";
        openForm(r);
      });
      (map[r.status] || els.notList).appendChild(card);
    }
  }

  function openForm(d=null){
    els.editId.value = d?.id || "";
    els.titleInput.value = d?.title || "";
    els.genreSelect.value = d?.genre || "劇情片";
    els.dateInput.value = d?.watchDate || new Date().toISOString().slice(0,10);
    els.epInput.value = d?.episodes || "";
    els.noteInput.value = d?.note || "";
    els.statusSelect.value = d?.status || "watching";

    state.currentRating = Number(d?.rating||0);
    renderStars();

    // 影集才顯示集數
    els.epArea.style.display = (state.currentType==="series") ? "block" : "none";
    // 刪除鍵：只有編輯才顯示
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
      rating: state.currentRating,
      note: els.noteInput.value.trim(),
      status: els.statusSelect.value,
      type: state.currentType,
      updatedAt: Date.now(),
    };

    if(!data.title){
      notify("請輸入作品名稱");
      return;
    }

    const idx = list.findIndex(x=>x.id===data.id);
    if(idx>=0) list[idx]=data;
    else list.unshift(data);

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

  function toggle(el){
    el.style.display = (el.style.display==="none" || !el.style.display) ? "block" : "none";
  }

  function updateAnalysis(){
    const list = loadRecords();
    if(!list.length){
      els.analysisText.textContent = "目前沒有任何紀錄，先新增一筆再看統計～";
      if(state.pie){ state.pie.destroy(); state.pie=null; }
      return;
    }

    const genreMap = {};
    list.forEach(r=>{
      const g = r.genre || "其他";
      genreMap[g] = (genreMap[g]||0)+1;
    });

    const labels = Object.keys(genreMap);
    const data = Object.values(genreMap);
    const topGenre = labels.reduce((a,b)=> genreMap[a]>genreMap[b] ? a : b);

    els.analysisText.innerHTML = `你最常看的類別是 <b>${escapeHtml(topGenre)}</b>，共 ${list.length} 筆。`;

    if(!window.Chart){
      els.analysisText.textContent += "（Chart.js 尚未載入）";
      return;
    }

    if(state.pie){ state.pie.destroy(); state.pie=null; }
    state.pie = new Chart(els.chartCanvas, {
      type: "doughnut",
      data: { labels, datasets: [{ data }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }

  function updateRecommend(){
    // 目前先用「本機資料」做 TOP 推薦（下一步可換成後台推播/全站）
    const list = loadRecords().filter(r=>r.rating>0);
    if(!list.length){
      els.recommendContent.innerHTML = `<div class="muted">目前沒有足夠資料產生推薦（先新增幾筆並評分）。</div>`;
      return;
    }

    const stats = {};
    list.forEach(r=>{
      const t = (r.title||"").trim();
      if(!t) return;
      if(!stats[t]) stats[t]={ title:t, score:0, count:0, genre:r.genre||"其他" };
      stats[t].score += Number(r.rating||0);
      stats[t].count += 1;
    });

    const top = Object.values(stats)
      .map(x=>({ ...x, avg: (x.score/x.count).toFixed(1) }))
      .sort((a,b)=> Number(b.avg)-Number(a.avg))
      .slice(0,4);

    els.recommendContent.innerHTML = "";
    top.forEach((item,i)=>{
      const c = document.createElement("div");
      c.className = "recCard";
      c.innerHTML = `
        <div class="recMeta"><span>TOP ${i+1}</span><span>${escapeHtml(item.genre)}</span></div>
        <div class="recTitle">${escapeHtml(item.title)}</div>
        <div class="recStars">★ ${escapeHtml(item.avg)}（${item.count}）</div>
      `;
      els.recommendContent.appendChild(c);
    });
  }

  function syncLoginUI(){
    const ok = isLoggedIn();

    // overlay
    els.overlay.style.display = ok ? "none" : "flex";

    // 右上角顯示頭像 + 登出（直接用你本頁 btnLogout）
    if(ok){
      const p = (MB.state && MB.state.profile) ? MB.state.profile : null;
      els.userInfo.style.display = "flex";
      els.userImg.src = p?.picture || "";
    }else{
      els.userInfo.style.display = "none";
      els.userImg.src = "";
    }

    // guard text
    if(els.guardText){
      els.guardText.textContent = ok
        ? "✅ 已登入：Records 模板已載入（目前資料先存在瀏覽器，下一步接試算表）"
        : "🔒 訪客模式：已阻擋（點上方登入後即可使用）";
    }
  }

  function bindEvents(){
    wireModalClose(els.typeModal);
    wireModalClose(els.formModal);

    els.loginBtn?.addEventListener("click", ()=>{
      // 直接呼叫你原本的「登入 / 訪客」按鈕
      const b = document.getElementById("btnOpenLogin");
      if(b) b.click();
      else notify("找不到登入按鈕 btnOpenLogin");
    });

    els.logoutBtn?.addEventListener("click", ()=>{
      // 用你原本右上角登出（btnLogout）
      const b = document.getElementById("btnLogout");
      if(b) b.click();
      else notify("找不到登出按鈕 btnLogout");
    });

    els.addBtn?.addEventListener("click", ()=>{
      if(!requireLogin("新增紀錄")) return;
      openModal(els.typeModal);
    });

    els.seriesBtn?.addEventListener("click", ()=>{
      state.currentType = "series";
      openForm(null);
    });
    els.movieBtn?.addEventListener("click", ()=>{
      state.currentType = "movie";
      openForm(null);
    });

    els.saveBtn?.addEventListener("click", ()=>saveRecord());
    els.delBtn?.addEventListener("click", ()=>deleteRecord());

    els.analysisBtn?.addEventListener("click", ()=>{
      toggle(els.analysisArea);
      if(els.analysisArea.style.display !== "none"){
        setTimeout(updateAnalysis, 30);
      }
    });

    els.recommendBtn?.addEventListener("click", ()=>{
      toggle(els.recommendArea);
      if(els.recommendArea.style.display !== "none"){
        updateRecommend();
      }
    });
  }

  function init(){
    // 第一次：先同步登入 UI + 渲染清單
    syncLoginUI();
    renderLists();
    renderStars();
    bindEvents();

    // 監看 MB 狀態（用輪詢最穩，避免你 app.js 邏輯不同步）
    setInterval(syncLoginUI, 800);
  }

  window.Records = { init };
})();

