// assets/entry.js
(function () {
  const $ = (s) => document.querySelector(s);

  const SPLASH_DURATION_MS = 4200; // 小動畫時間（可調）
  const TO_APP_URL = "app.html#about"; // 動畫結束自動到網站介紹

  function openModal() {
    const m = $("#modal");
    if (!m) return;
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
  }

  function hideSplash() {
    const splash = $("#splash");
    if (!splash) return;
    splash.classList.add("is-hide");
    // 讓淡出動畫跑完再真的隱藏（避免點擊穿透）
    setTimeout(() => {
      splash.style.display = "none";
      splash.setAttribute("aria-hidden", "true");
    }, 520);
  }

  function goToAppAbout() {
    hideSplash();
    // 給淡出一點時間再跳，視覺更順
    setTimeout(() => {
      location.href = TO_APP_URL;
    }, 260);
  }

  function initSplashFlow() {
    const splash = $("#splash");
    if (!splash) return;

    let done = false;
    let timer = null;

    const finishToApp = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      goToAppAbout();
    };

    const skipToLogin = (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      // 依你規格：按 skip 不看動畫，直接彈登入/訪客（你的 modal 目前是登入視窗）
      // 如果你之後要「登入/訪客選擇」我也能把 modal 改成兩顆按鈕
      hideSplash();
      setTimeout(openModal, 260);
    };

    // 1) 時間到自動進網站介紹
    timer = setTimeout(finishToApp, SPLASH_DURATION_MS);

    // 2) 點一下畫面 -> 直接進網站介紹
    splash.addEventListener("click", finishToApp);

    // 3) SKIP -> 直接彈登入
    $("#btnSkip")?.addEventListener("click", skipToLogin);

    // 4) ESC -> 也算 skip（可要可不要）
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") skipToLogin(e);
    });
  }

  function init() {
    initSplashFlow();
  }

  window.addEventListener("load", init);
})();
