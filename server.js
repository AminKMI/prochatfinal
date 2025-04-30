const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const RedisStore = require("connect-redis")(session); // افزودن RedisStore
const redis = require("redis"); // وارد کردن کلاینت Redis

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// تنظیمات اتصال به Redis
const redisClient = redis.createClient(); // اتصال به Redis، می‌توانید پیکربندی‌های اضافی را هم اعمال کنید

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  store: new RedisStore({ client: redisClient }), // استفاده از RedisStore
  secret: "رمز_سری_شما",
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// ذخیره کاربران
app.locals.users = {};
// ذخیره پیام‌ها: { roomId: [ { from, text } , ... ] }
app.locals.history = {};

app.use(express.static(path.join(__dirname, "public")));

app.get("/auth", (req, res) => res.redirect("/login.html"));
app.post("/auth", (req, res) => {
  const { type, username, password } = req.body;
  const users = app.locals.users;
  if (type === "register") {
    if (users[username]) return res.redirect("/login.html?error=exists");
    users[username] = password;
  } else {
    if (!users[username] || users[username] !== password)
      return res.redirect("/login.html?error=bad");
  }
  req.session.username = username;
  res.cookie("username", username);
  return res.redirect("/chat.html");
});

app.get("/chat.html", (req, res, next) => {
  if (req.session.username) return next();
  res.redirect("/login.html");
});

io.on("connection", socket => {
  const user = socket.handshake.query.username;
  
  // کاربر درخواست تاریخچه می‌دهد
  socket.on("getHistory", roomId => {
    const hist = app.locals.history[roomId] || [];
    socket.emit("history", hist);
  });

  // وقتی وارد اتاق می‌شود
  socket.on("joinRoom", roomId => {
    socket.join(roomId);
  });

  // دریافت پیام جدید
  socket.on("message", ({ roomId, text }) => {
    // ذخیره پیام
    if (!app.locals.history[roomId]) app.locals.history[roomId] = [];
    const entry = { from: user, text };
    app.locals.history[roomId].push(entry);
    // پخش به همه داخل اتاق
    io.to(roomId).emit("message", entry);
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
