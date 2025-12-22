// assets/entry.js (v2 stable)
// - After splash ends OR user clicks: open identity modal (NOT navigate) to avoid flash screen
(function () {
  const $ = (s) => document.querySelector(s);

  const SPLASH_DURATION_MS = 4200;

  function hideSplash() {
    const splash = $("#splash");
    if (!splash) return;
    splash.classList.add("is-hide");
    setTimeout(() => {
      splash.style.display = "none";
      splash.setAttribute("aria-hidden", "true");
    }, 520);
  }

  function openChooseModal() {
    // Prefer unified modal function from app.js
    if (window.MB_openLoginModal) {
      window.MB_openLoginModal({ reset: true });
      return;
    }

    // fallback
    const m = $("#modal");
    if (!m) return;
    $("#chooseBox")?.classList.remove("hidden");
    $("#googleBox")?.classList.add("hidden");
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
  }

  function finishToChoose() {
    hideSplash();
    setTimeout(openChooseModal, 260);
  }

  function initSplashFlow() {
    const splash = $("#splash");
    if (!splash) return;

    let done = false;
    let timer = null;

    const finish = (e) => {
      if (done) return;
      done = true;
      e?.preventDefault?.();
      e?.stopPropagation?.();
      clearTimeout(timer);
      finishToChoose();
    };

    timer = setTimeout(finish, SPLASH_DURATION_MS);

    splash.addEventListener("click", finish);
    $("#btnSkip")?.addEventListener("click", finish);

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") finish(e);
    });
  }

  function initChooseHandlers() {
    // Login -> show Google area (do NOT set mode user here!)
    $("#chooseLogin")?.addEventListener("click", () => {
      $("#chooseBox")?.classList.add("hidden");
      $("#googleBox")?.classList.remove("hidden");
    });

    // Guest -> enter hall as guest
    $("#chooseGuest")?.addEventListener("click", () => {
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
