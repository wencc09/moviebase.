// assets/entry.js
(function () {
  const $ = (s) => document.querySelector(s);

  const SPLASH_DURATION_MS = 4200;
  const TO_MAIN_URL = "app.html#lobby";

  function hideSplash() {
    const splash = $("#splash");
    if (!splash) return;
    splash.classList.add("is-hide");
    setTimeout(() => {
      splash.style.display = "none";
      splash.setAttribute("aria-hidden", "true");
    }, 520);
  }

  function initSplashFlow() {
    const splash = $("#splash");
    if (!splash) return;

    let done = false;
    let timer = null;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      hideSplash(); // ✅ 只關 Splash，不跳頁、不開 modal
    };

    timer = setTimeout(finish, SPLASH_DURATION_MS);
    splash.addEventListener("click", finish);
    $("#btnSkip")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      finish();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") finish();
    });
  }

  function initChooseHandlers() {
    // Google -> show Google area
    $("#chooseLogin")?.addEventListener("click", () => {
      // 讓 app.js 登入成功後知道要跳哪
      localStorage.setItem("mb_after_auth_url", TO_MAIN_URL);

      $("#chooseBox")?.classList.add("hidden");
      $("#googleBox")?.classList.remove("hidden");
    });

    // Guest -> enter as guest (直接進圖四)
    $("#chooseGuest")?.addEventListener("click", () => {
      localStorage.removeItem("id_token");
      localStorage.setItem("mode", "guest");
      localStorage.setItem("mb_after_auth_url", TO_MAIN_URL);
      location.href = TO_MAIN_URL;
    });

    // Back button
    $("#backToChoose")?.addEventListener("click", () => {
      $("#googleBox")?.classList.add("hidden");
      $("#chooseBox")?.classList.remove("hidden");
    });
  }

  function init() {
    initSplashFlow();
    initChooseHandlers();
  }

  window.addEventListener("load", init);
})();
