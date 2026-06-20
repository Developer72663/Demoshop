const { Router } = require("express");
const passport = require("passport");
const Seller = require("../models/Seller");
const { creatTokenForUser } = require("../services/authentication");
const { restrictToLoggedInUserOnly } = require("../middlewares/authentication");

const router = Router();

// ====================== GOOGLE SELLER STRATEGY ======================
const GoogleStrategy = require("passport-google-oauth20").Strategy;

// Store pending seller data during OAuth flow (in-memory, use Redis in production)
const pendingSellers = new Map();

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
        "google-seller",
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_SELLER_CALLBACK_URL || "http://localhost:8000/seller/auth/google/callback",
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    const state = profile._json.state || "{}";
                    const extraData = JSON.parse(state);

                    const seller = await Seller.findOrCreateGoogleUser(profile, extraData);
                    return done(null, seller);
                } catch (err) {
                    console.error("Google Seller Strategy Error:", err);
                    return done(err);
                }
            }
        )
    );
}

// ====================== GET SELLER REGISTER PAGE ======================
router.get("/register", (req, res) => {
    if (req.user && req.user.role === "SELLER") {
        return res.redirect("/seller/dashboard");
    }
    res.render("seller-register", { 
        error: null,
        user: req.user || null
    });
});

// ====================== POST SELLER REGISTER (with Google OAuth) ======================
// Step 1: Collect store details and redirect to Google OAuth
router.post("/register", async (req, res) => {
    const { storeName, storeDescription, phone, address } = req.body;

    if (!storeName) {
        return res.status(400).json({
            success: false,
            message: "Store name is required"
        });
    }

    // Store pending data in a temporary cookie/session approach
    // We'll pass it via state parameter in Google OAuth
    const stateData = Buffer.from(JSON.stringify({
        storeName: storeName.trim(),
        storeDescription: storeDescription || "",
        phone: phone || "",
        address: address || ""
    })).toString("base64");

    res.redirect(`/seller/auth/google?state=${encodeURIComponent(stateData)}`);
});

// ====================== GOOGLE SELLER AUTH ROUTES ======================
router.get("/auth/google", (req, res, next) => {
    const state = req.query.state || "";
    passport.authenticate("google-seller", {
        scope: ["profile", "email"],
        state: state
    })(req, res, next);
});

router.get("/auth/google/callback",
    passport.authenticate("google-seller", {
        failureRedirect: "/seller/register",
        session: false
    }),
    (req, res) => {
        if (!req.user) return res.redirect("/seller/register");

        const token = creatTokenForUser(req.user);

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.redirect("/seller/dashboard?registered=success");
    }
);

// ====================== GET SELLER DASHBOARD ======================
router.get("/dashboard", restrictToLoggedInUserOnly, async (req, res) => {
    if (!req.user || req.user.role !== "SELLER") {
        return res.status(403).send("Access Denied: Sellers Only");
    }

    try {
        const seller = await Seller.findById(req.user._id);
        if (!seller) {
            return res.redirect("/seller/register");
        }

        res.render("sellerHome", {
            title: "Seller Dashboard",
            seller: seller,
            user: req.user
        });
    } catch (error) {
        console.error("Dashboard Error:", error.message);
        res.status(500).send("Internal Server Error");
    }
});

// ====================== GET SELLER LOGOUT ======================
router.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/");
});

module.exports = router;
