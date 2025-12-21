// assets/entry.js
(function () {
  const $ = (s) => document.querySelector(s);

  const SPLASH_DURATION_MS = 4200;
  const TO_APP_URL = "app.html#about";

  function openModalChoose() {
    const m = $("#modal");
    if (!m) return;

    // reset to "choose identity" view
    $("#chooseBox")?.classList.remove("hidden");
    $("#googleBox")?.classList.add("hidden");

    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
  }

  function hideSplash() {
    const splash = $("#splash");
    if (!splash) return;
    splash.classList.add("is-hide");
    setTimeout(() => {
      splash.style.display = "none";
      splash.setAttribute("aria-hidden", "true");
    }, 520);
  }

  function goToAppAbout() {
    hideSplash();
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

    const skipToChoose = (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      if (done) return;
      done = true;
      clearTimeout(timer);

      hideSplash();
      setTimeout(openModalChoose, 260);
    };

    timer = setTimeout(finishToApp, SPLASH_DURATION_MS);
    splash.addEventListener("click", finishToApp);
    $("#btnSkip")?.addEventListener("click", skipToChoose);

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") skipToChoose(e);
    });
  }

  function initChooseHandlers() {
    // Login -> show Google area
    $("#chooseLogin")?.addEventListener("click", () => {
      localStorage.setItem("mode", "user"); // 先標記，真的登入成功後 app.js 會改成 user + 存 user
      $("#chooseBox")?.classList.add("hidden");
      $("#googleBox")?.classList.remove("hidden");
    });

    // Guest -> enter as guest
    $("#chooseGuest")?.addEventListener("click", () => {
      // 走你原本規則：訪客進 hall
      localStorage.setItem("mode", "guest");
      location.href = "hall.html?mode=guest";
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
