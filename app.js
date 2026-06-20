const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const SellerRoute = require("./routes/seller");

require("dotenv").config();

const UserRoute = require("./routes/User");
const GoogleAuthRoute = require("./routes/GoogleAuthentication");

const { checkForAuthenticationCookie } = require("./middlewares/authentication");
const { apiLimiter } = require("./middlewares/rateLimiting");

const app = express();
const PORT = process.env.PORT || 8000;

// ====================== MONGODB CONNECTION ======================
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/blogify")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

// ====================== MIDDLEWARE ======================
app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve("./public")));

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

app.use(passport.initialize());
app.use(checkForAuthenticationCookie("token"));
app.use("/api/", apiLimiter);

// ====================== ROUTES ======================
app.use("/user", UserRoute);
app.use("/user", GoogleAuthRoute);
app.use("/seller", SellerRoute);

// ====================== HOME ROUTE ======================
app.get("/", (req, res) => {
  res.render("home", {
    title: "Blogify",
    user: req.user || null
  });
});

// ====================== 404 HANDLER ======================
app.use((req, res) => {
  res.status(404).render("404");
});

// ====================== ERROR HANDLER ======================
app.use((err, req, res, next) => {
  console.error("🚨 Server Error:", err);
  res.status(500).send("Internal Server Error");
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Visit http://localhost:${PORT}`);
});

module.exports = app;
