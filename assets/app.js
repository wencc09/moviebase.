/* MovieBase shared app.js
   - auth state (guest/user)
   - login modal gates
   - header buttons toggle (login/guest <-> account/logout)
*/

const CONFIG = {
  GAS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbyuipb05zxPbPp7iAotqe_Oya4je2s-l3COcJ8kDO7e4VHjdLRuNwJhrymkPN02b9Sd/exec",
  GOOGLE_CLIENT_ID: "709445153038-vh9tvcrk5vtj0r3il5r81j9gl1k68l98.apps.googleusercontent.com",
};

const MB = {
  state: {
    mode: "unknown", // "guest" | "user"
    user: null,      // {sub,email,name,picture}
  }
};

const $ = (q, root=document) => root.querySelector(q);

function toast(msg){
  const el = $("#toast");
  if(!el) { alert(msg); return; }
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> el.style.display="none", 2200);
}

async function apiPOST(payload){
  const res = await fetch(CONFIG.GAS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

async function verifyMe(){
  const idToken = localStorage.getItem("id_token");
  if(!idToken) return null;
  const data = await apiPOST({ action: "me", idToken });
  if(!data.ok) throw new Error(data.error || "me failed");
  return data.user;
}

/* =========================
   Auth state
========================= */
function dispatchAuthChanged(){
  // 給各頁（包含 index）統一監聽的事件
  window.dispatchEvent(new CustomEvent("mb:auth", { detail: { ...MB.state } }));
}

function setModeGuest(){
  MB.state.mode = "guest";
  MB.state.user = null;
  localStorage.removeItem("id_token");
  localStorage.removeItem("mb_user_name");
  localStorage.setItem("mode", "guest");
  renderAuthUI();
  dispatchAuthChanged();
}

function setModeUser(user){
  MB.state.mode = "user";
  MB.state.user = user || null;
  localStorage.setItem("mode", "user");
  if(user?.name) localStorage.setItem("mb_user_name", user.name);
  renderAuthUI();
  dispatchAuthChanged();
}

/* =========================
   UI render (all pages safe)
========================= */
function renderAuthUI(){
  // (A) 你其他頁面如果有這些 id，就照顧它們
  const badge = $("#authBadge");
  const name  = $("#authName");
  const pic   = $("#authPic");
  const btnLogout = $("#btnLogout");

  if(badge){
    if(MB.state.mode === "user" && MB.state.user){
      badge.textContent = "目前：已登入";
    }else{
      badge.textContent = "目前：訪客";
    }
  }
  if(name){
    if(MB.state.mode === "user" && MB.state.user){
      name.textContent = MB.state.user.name || MB.state.user.email || "";
    }else{
      name.textContent = "Guest";
    }
  }
  if(pic){
    if(MB.state.mode === "user" && MB.state.user?.picture){
      pic.src = MB.state.user.picture;
      pic.style.display = "inline-block";
    }else{
      pic.style.display = "none";
    }
  }
  if(btnLogout){
    btnLogout.style.display = (MB.state.mode === "user") ? "inline-block" : "none";
  }

  // (B) index.html 入口頁右上角：#loginState/#btnLogin/#btnGuest/#btnLogoutTop
  syncEntryHeader();
}

function syncEntryHeader(){
  const loginState = $("#loginState");
  const btnLogin   = $("#btnLogin");
  const btnGuest   = $("#btnGuest");
  const btnLogoutTop = $("#btnLogoutTop");

  const btnLogin2 = $("#btnLogin2"); // 入口右側卡片的那顆
  const btnGuest2 = $("#btnGuest2");

  const isUser = (MB.state.mode === "user" && MB.state.user);

  if(loginState){
    if(isUser){
      const label = MB.state.user.name || MB.state.user.email || "已登入";
      loginState.textContent = `目前：已登入（${label}）`;
    }else{
      loginState.textContent = "目前：未登入";
    }
  }

  // 未登入：顯示登入/訪客、隱藏登出
  if(btnLogin) btnLogin.style.display = isUser ? "none" : "inline-flex";
  if(btnGuest) btnGuest.style.display = isUser ? "none" : "inline-flex";
  if(btnLogoutTop) btnLogoutTop.style.display = isUser ? "inline-flex" : "none";

  // 入口卡片的兩顆（若存在）
  if(btnLogin2) btnLogin2.style.display = isUser ? "none" : "inline-flex";
  if(btnGuest2) btnGuest2.style.display = isUser ? "none" : "inline-flex";
}

function requireLogin(featureName="此功能"){
  if(MB.state.mode !== "user"){
    toast(`${featureName} 需要先登入 Google`);
    openLoginModal();
    return false;
  }
  return true;
}

/* =========================
   Navbar active
========================= */
function setActiveNav(){
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav]").forEach(a=>{
    a.classList.toggle("is-active", a.getAttribute("href") === path);
  });
}

/* =========================
   Modal
========================= */
function openLoginModal(){
  // 若已登入就不要再開
  if(MB.state.mode === "user") return;
  $("#loginModal")?.classList.add("is-open");
  $("#modal")?.classList.add("open"); // index.html 用的是 #modal
}
function closeLoginModal(){
  $("#loginModal")?.classList.remove("is-open");
  $("#modal")?.classList.remove("open");
}

/* =========================
   Logout
========================= */
function doLogout(){
  if(window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
  setModeGuest();
  toast("已登出");
}

/* =========================
   Google Login
========================= */
function initGoogle(){
  if(!window.google || !google.accounts?.id){
    console.warn("Google SDK not ready");
    return;
  }

  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: async (resp)=>{
      try{
        localStorage.setItem("id_token", resp.credential);
        const user = await verifyMe();
        setModeUser(user);
        closeLoginModal();
        toast("登入成功");
      }catch(e){
        console.error(e);
        toast("登入驗證失敗，請確認後端 me");
        localStorage.removeItem("id_token");
      }
    }
  });

  // 你的各頁可能用不同的 gsi 容器 id
  const gsi = $("#gsiBtn");
  if(gsi){
    gsi.innerHTML = "";
    google.accounts.id.renderButton(gsi, { theme:"outline", size:"large" });
  }
}

/* =========================
   Boot
========================= */
async function boot(){
  setActiveNav();

  // close modal by backdrop click
  $("#loginModal")?.addEventListener("click", (e)=>{
    if(e.target.id === "loginModal") closeLoginModal();
  });
  $("#modal")?.addEventListener("click", (e)=>{
    if(e.target.id === "modal") closeLoginModal();
  });

  // Open login (不同頁面可能用不同按鈕 id)
  $("#btnOpenLogin")?.addEventListener("click", openLoginModal);
  $("#btnLogin")?.addEventListener("click", openLoginModal);
  $("#btnLogin2")?.addEventListener("click", openLoginModal);

  // Guest buttons
  $("#btnGuest")?.addEventListener("click", ()=>{
    setModeGuest();
    closeLoginModal();
    toast("已用訪客模式進入（禁止紀錄與發文）");
  });
  $("#btnGuest2")?.addEventListener("click", ()=>{
    setModeGuest();
    closeLoginModal();
    toast("已用訪客模式進入（禁止紀錄與發文）");
  });

  // Logout buttons (多個頁面都可能用得到)
  $("#btnLogout")?.addEventListener("click", doLogout);
  $("#btnLogoutTop")?.addEventListener("click", doLogout);

  // restore
  const savedMode = localStorage.getItem("mode");
  if(savedMode === "guest"){
    setModeGuest();
  }else{
    try{
      const user = await verifyMe();
      if(user) setModeUser(user);
      else setModeGuest();
    }catch(e){
      console.error(e);
      setModeGuest();
    }
  }

  initGoogle();
  syncEntryHeader();
}

// expose for page scripts
window.MB = MB;
window.MB_requireLogin = requireLogin;
window.MB_openLoginModal = openLoginModal;
window.MB_logout = doLogout;
window.addEventListener("load", boot);
