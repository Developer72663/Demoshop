const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const passport = require("passport");
require("dotenv").config();

const SellerRoute = require("./routes/seller");
const GoogleAuthRoute = require("./routes/GoogleAuthentication");

const app = express();
const PORT = process.env.PORT || 8000;

// ====================== MONGODB CONNECTION ======================
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/sellerplasce")
 .then(() => console.log("✅ MongoDB Connected"))
 .catch(err => {
 console.error("❌ MongoDB Connection Error:", err.message);
 process.exit(1);
 });

// ====================== VIEW ENGINE ======================
app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));

// ====================== MIDDLEWARE ======================
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve("./public")));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'sellerplasce-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Security headers
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
});

// Make user/seller available to all views
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.seller = req.session.seller || null;
    next();
});

// ====================== ROUTES ======================
app.use("/seller", SellerRoute);
app.use("/seller", GoogleAuthRoute);

// ====================== HOME ROUTE ======================
app.get("/", async (req, res) => {
    try {
        // Fetch products for homepage if Product model exists
        let products = [];
        try {
            const Product = require('./models/Product');
            products = await Product.find().populate('seller', 'shopName').limit(8);
        } catch (e) {
            // Product model not available yet
        }

        res.render("home", {
            title: "LuxeMarket - Premium Shopping",
            user: req.user || null,
            seller: req.session.seller || null,
            products: products
        });
    } catch (err) {
        console.error('Home route error:', err);
        res.render("home", {
            title: "LuxeMarket - Premium Shopping",
            user: null,
            seller: null,
            products: []
        });
    }
});

// ====================== PRODUCTS PAGE ======================
app.get("/products", async (req, res) => {
    try {
        let products = [];
        try {
            const Product = require('./models/Product');
            products = await Product.find().populate('seller', 'shopName');
        } catch (e) {
            // Product model not available
        }

        res.render("products", {
            title: "All Products - LuxeMarket",
            user: req.user || null,
            seller: req.session.seller || null,
            products: products
        });
    } catch (err) {
        res.render("products", {
            title: "All Products - LuxeMarket",
            user: null,
            seller: null,
            products: []
        });
    }
});

// ====================== 404 HANDLER ======================
app.use((req, res) => {
    res.status(404).render("404", {
        title: "Page Not Found - LuxeMarket",
        user: req.user || null,
        seller: req.session.seller || null
    });
});

// ====================== ERROR HANDLER ======================
app.use((err, req, res, next) => {
    console.error("🚨 Server Error:", err);
    res.status(500).render("error", {
        title: "Error - LuxeMarket",
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong!' 
            : err.message,
        user: req.user || null,
        seller: req.session.seller || null
    });
});

// ====================== START SERVER ======================
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Visit http://localhost:${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
