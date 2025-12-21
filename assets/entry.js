// assets/entry.js
(function () {
  const $ = (s) => document.querySelector(s);

  const state = {
    step: 0,
    steps: [
      {
        k: "定位",
        t: "把觀影進度、心情與票根收進同一個宇宙",
        d: "用卡片式紀錄你的影集、電影與動畫；一眼看懂最近看了什麼、喜歡什麼。"
      },
      {
        k: "互動",
        t: "貼文牆分享心得，但訪客只能看",
        d: "登入後才能發文與紀錄；訪客模式只提供瀏覽，避免亂寫入資料。"
      },
      {
        k: "資料",
        t: "前端 GitHub Pages，後端 Apps Script + Sheet",
        d: "照片可存雲端，資料結構固定，之後好擴充留言、按讚、追蹤。"
      }
    ]
  };

  function setStep(i) {
    state.step = (i + state.steps.length) % state.steps.length;
    const s = state.steps[state.step];
    $("#stepK").textContent = s.k;
    $("#stepT").textContent = s.t;
    $("#stepD").textContent = s.d;

    // progress
    const p = ((state.step + 1) / state.steps.length) * 100;
    $("#bar").style.width = `${p}%`;

    // dots
    document.querySelectorAll("[data-dot]").forEach((el, idx) => {
      el.classList.toggle("is-on", idx === state.step);
    });
  }

  function openModal() {
    $("#modal").classList.add("open");
    $("#modal").setAttribute("aria-hidden", "false");
  }
  function closeModal() {
    $("#modal").classList.remove("open");
    $("#modal").setAttribute("aria-hidden", "true");
  }

  function setRole(role) {
    localStorage.setItem("mb_role", role); // guest | user
  }

  function goNext() {
    setStep(state.step + 1);
  }
  function goPrev() {
    setStep(state.step - 1);
  }

  // Guest -> 只設定 guest 標記，導向 hall.html（主入口）
  function enterGuest() {
    setRole("guest");
    location.href = "hall.html?mode=guest";
  }

  // Login -> 打開 modal，讓使用者自己按 Google 按鈕（不自動彈）
  function enterLogin() {
    setRole("user");
    openModal();
  }

  // Intro 不要太快彈登入：只做「淡入」，不做「自動彈窗」
  function introAutoPlay() {
    let timer = null;
    const start = () => {
      stop();
      timer = setInterval(() => setStep(state.step + 1), 5200);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const box = $("#introBox");
    box.addEventListener("mouseenter", stop);
    box.addEventListener("mouseleave", start);
    start();
  }

  function init() {
    setStep(0);
    introAutoPlay();

    $("#btnNext").addEventListener("click", goNext);
    $("#btnPrev").addEventListener("click", goPrev);

    $("#btnGuest").addEventListener("click", enterGuest);
    $("#btnLogin").addEventListener("click", enterLogin);

    $("#modalClose").addEventListener("click", closeModal);
    $("#modal").addEventListener("click", (e) => {
      if (e.target.id === "modal") closeModal();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    // 導向介紹區
    $("#btnAbout").addEventListener("click", () => {
      document.getElementById("sectionAbout").scrollIntoView({ behavior: "smooth" });
    });

    // 如果已登入（你之前已成功登入），入口直接顯示狀態，但不自動跳走
    const name = localStorage.getItem("mb_user_name");
    if (name) {
      $("#loginState").textContent = `目前：已登入（${name}）`;
    } else {
      $("#loginState").textContent = "目前：未登入";
    }
  }

  window.addEventListener("load", init);
})();
