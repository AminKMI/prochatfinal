// کوکی‌خوان
function getCookie(n){const m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;}
const username = getCookie("username");
if(!username) location.replace("/login.html");

const socket = io({ query: { username } });
let currentRoom = null, selectedMsg=null, selectedChat=null;

function hashColor(name){
  let h=0;for(let c of name) h=c.charCodeAt(0)+((h<<5)-h);
  return "#"+(h&0x00FFFFFF).toString(16).padStart(6,"0");
}

// منوها
const msgMenu = document.getElementById("msgMenu");
const chatMenu = document.getElementById("chatMenu");
document.addEventListener("click", ()=>{ msgMenu.style.display="none"; chatMenu.style.display="none"; });

// بارگذاری/ذخیره لیست چت‌ها
function loadChats(){ return JSON.parse(localStorage.getItem(`chatList_${username}`)||"[]"); }
function saveChats(a){ localStorage.setItem(`chatList_${username}`, JSON.stringify(a)); }

// رندر سایدبار
function renderChatList(){
  const list = document.getElementById("chatList");
  list.innerHTML = "";
  loadChats().forEach(c=>{
    const div = document.createElement("div");
    div.className = "chat-item";
    div.dataset.id = c.id;
    div.innerHTML = `<span>${c.name}</span>
                     <div class="avatar" style="background:${hashColor(c.name)}"></div>`;
    div.onclick = ()=> openRoom(c.id, c.name);
    div.oncontextmenu = e => {
      e.preventDefault();
      selectedChat = c.id;
      chatMenu.style.top = e.pageY + "px";
      chatMenu.style.left = e.pageX + "px";
      chatMenu.style.display = "flex";
    };
    list.appendChild(div);
  });
}

// ایجاد/ویرایش/حذف چت
function addChat(){
  const name = prompt("نام چت؟"); if(!name) return;
  const chats = loadChats();
  const id = Date.now().toString(36);
  chats.push({id, name});
  saveChats(chats);
  renderChatList();
  openRoom(id, name);
}
function editChat(){
  const chats = loadChats(), c = chats.find(x=>x.id===selectedChat);
  const n = prompt("نام جدید:", c.name);
  if(n){ c.name = n; saveChats(chats); renderChatList(); }
  chatMenu.style.display="none";
}
function deleteChat(){
  if(confirm("حذف شود؟")){
    saveChats(loadChats().filter(x=>x.id!==selectedChat));
    renderChatList();
  }
  chatMenu.style.display="none";
}

// باز کردن اتاق و دریافت تاریخچه
function openRoom(id, name){
  currentRoom = id;
  document.getElementById("chatHeader").textContent = `${name} (ID: ${id})`;
  document.getElementById("chatBox").innerHTML = "";
  socket.emit("joinRoom", id);
  socket.emit("getHistory", id);
}

// چت خصوصی (تاریخچه جدا ندارد)
function openPrivate(to){
  currentRoom = null;
  document.getElementById("chatHeader").textContent = `🔒 با ${to}`;
  const pr = [username,to].sort().join(":");
  document.getElementById("chatBox").innerHTML = "";
  socket.emit("joinRoom", pr);
}

// دریافت تاریخچه و رندر
socket.on("history", arr => {
  const box = document.getElementById("chatBox");
  arr.forEach(({from,text}) => {
    renderMsg(from, text);
  });
  box.scrollTop = box.scrollHeight;
});

// دریافت پیام جدید
socket.on("message", ({from,text}) => {
  renderMsg(from, text);
  document.getElementById("chatBox").scrollTop = document.getElementById("chatBox").scrollHeight;
});

// تابع رندر یک پیام
function renderMsg(from, text){
  const box = document.getElementById("chatBox");
  const div = document.createElement("div");
  div.className = "message";
  const txt = document.createElement("div");
  txt.className = "text";
  txt.innerHTML = text; // متن می‌تواند HTML (برای تصویر) باشد
  const av = document.createElement("div");
  av.className = "avatar";
  av.style.background = hashColor(from);
  av.onclick = ()=> openPrivate(from);
  div.appendChild(txt);
  div.appendChild(av);
  div.oncontextmenu = e => {
    e.preventDefault();
    selectedMsg = div;
    msgMenu.style.top = e.pageY + "px";
    msgMenu.style.left = e.pageX + "px";
    msgMenu.style.display = "flex";
  };
  box.appendChild(div);
}

// ارسال پیام
function sendMessage(){
  const inp = document.getElementById("text-input");
  const t = inp.value.trim();
  if(!t) return;
  socket.emit("message", { roomId: currentRoom, text: t });
  inp.value = "";
}

// ارسال فایل (تصویر)
function sendFile(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=> socket.emit("message", { roomId: currentRoom, text: `<img src="${reader.result}" style="max-width:200px">` });
  reader.readAsDataURL(file);
}

// ایموجی
function toggleEmojiList(){
  const el = document.getElementById("emojiList");
  if(!el.innerHTML){
    ["😊","😂","😍","😢","😡","👍","🙏","🔥","💔","🎉"].forEach(ic => {
      const b = document.createElement("button");
      b.textContent = ic;
      b.onclick = ()=>{ document.getElementById("text-input").value += ic; el.classList.remove("open"); };
      el.appendChild(b);
    });
  }
  el.classList.toggle("open");
}

// عملیات منوی پیام
function replyMessage(){
  document.getElementById("text-input").value = "⤵️ " + selectedMsg.querySelector(".text").textContent;
  msgMenu.style.display = "none";
}
function editMessage(){
  const old = selectedMsg.querySelector(".text").textContent;
  const nw = prompt("متن جدید:", old);
  if(nw != null){
    selectedMsg.querySelector(".text").textContent = nw;
    // سرور را آپدیت نمی‌کنیم چون تاریخچه موقت است
  }
  msgMenu.style.display = "none";
}
function deleteMessage(){
  selectedMsg.remove();
  msgMenu.style.display = "none";
}

function handleKey(e){
  if(e.key === "Enter"){ e.preventDefault(); sendMessage(); }
}
function toggleDarkMode(){ document.body.classList.toggle("dark"); }
function changeUsername(){
  const n = prompt("نام جدید؟", username);
  if(n){ document.cookie = "username=" + encodeURIComponent(n); location.reload(); }
}

renderChatList();
// public/script.js (فقط بخش تابع joinChat و renderChatList)
function loadChats(){ return JSON.parse(localStorage.getItem(`chatList_${username}`)||"[]"); }
function saveChats(a){ localStorage.setItem(`chatList_${username}`, JSON.stringify(a)); }

function renderChatList(){
  const list = document.getElementById("chatList");
  list.innerHTML = "";
  loadChats().forEach(c=>{
    const div = document.createElement("div");
    div.className = "chat-item";
    div.dataset.id = c.id;
    div.innerHTML = `<span>${c.name}</span>
                     <div class="avatar" style="background:${hashColor(c.name)}"></div>`;
    div.onclick = ()=> openRoom(c.id, c.name);
    div.oncontextmenu = e => {
      e.preventDefault();
      selectedChat = c.id;
      chatMenu.style.top = e.pageY + "px";
      chatMenu.style.left = e.pageX + "px";
      chatMenu.style.display = "flex";
    };
    list.appendChild(div);
  });
}

function joinChat(){
  const id = document.getElementById("joinId").value.trim();
  if(!id) return alert("لطفاً یک آیدی وارد کن");
  let chats = loadChats();
  let existing = chats.find(c=>c.id===id);
  if(!existing){
    // اگر آیدی جدید بود، خودکار اضافه کن (نام اتاق برابر آیدی)
    existing = { id, name: id };
    chats.push(existing);
    saveChats(chats);
    renderChatList();
  }
  openRoom(existing.id, existing.name);
}
