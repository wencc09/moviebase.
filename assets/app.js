/* MovieBase shared app.js
   - navbar
   - auth state (guest/user)
   - login modal
   - basic permission gates (front-end)
*/

const CONFIG = {
  // ✅ 你之後要改成你的 Apps Script /exec
  GAS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbyuipb05zxPbPp7iAotqe_Oya4je2s-l3COcJ8kDO7e4VHjdLRuNwJhrymkPN02b9Sd/exec",
  // ✅ 你現在成功登入用的 Client ID（貼你的）
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
  if(!el) return alert(msg);
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

function setModeGuest(){
  MB.state.mode = "guest";
  MB.state.user = null;
  localStorage.removeItem("id_token");
  localStorage.setItem("mode", "guest");
  renderAuthUI();
}

function setModeUser(user){
  MB.state.mode = "user";
  MB.state.user = user;
  localStorage.setItem("mode", "user");
  renderAuthUI();
}

function renderAuthUI(){
  const badge = $("#authBadge");
  const name = $("#authName");
  const pic = $("#authPic");
  const btnLogout = $("#btnLogout");

  if(MB.state.mode === "user" && MB.state.user){
    badge.textContent = "目前：已登入";
    name.textContent = MB.state.user.name || MB.state.user.email || "";
    pic.src = MB.state.user.picture || "";
    pic.style.display = MB.state.user.picture ? "inline-block" : "none";
    btnLogout.style.display = "inline-block";
  }else{
    badge.textContent = "目前：訪客";
    name.textContent = "Guest";
    pic.style.display = "none";
    btnLogout.style.display = "none";
  }
}

function requireLogin(featureName="此功能"){
  if(MB.state.mode !== "user"){
    toast(`🔒 ${featureName} 需要先登入 Google`);
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
  $("#loginModal")?.classList.add("is-open");
}
function closeLoginModal(){
  $("#loginModal")?.classList.remove("is-open");
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
        toast("登入成功 ✅");
      }catch(e){
        console.error(e);
        toast("登入驗證失敗，請確認後端 me");
        localStorage.removeItem("id_token");
      }
    }
  });

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

  $("#btnOpenLogin")?.addEventListener("click", openLoginModal);
  $("#btnGuest")?.addEventListener("click", ()=>{
    setModeGuest();
    closeLoginModal();
    toast("已用訪客模式進入（禁止紀錄/發文/互動）");
  });
  $("#btnLogout")?.addEventListener("click", ()=>{
    if(window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
    setModeGuest();
    toast("已登出");
  });

  // restore
  const savedMode = localStorage.getItem("mode");
  if(savedMode === "guest"){
    setModeGuest();
  }else{
    // try id_token
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
}

// expose for page scripts
window.MB = MB;
window.MB_requireLogin = requireLogin;
window.MB_openLoginModal = openLoginModal;
window.addEventListener("load", boot);
