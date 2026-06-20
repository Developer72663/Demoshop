const { Router } = require("express");
const passport = require("passport");
const Seller = require("../models/Seller");
const { creatTokenForUser } = require("../services/authentication");

const router = Router();
const GoogleStrategy = require("passport-google-oauth20").Strategy;

// In-memory store for pending seller registration data (use Redis in production)
const pendingSellerData = new Map();

// ====================== GOOGLE SELLER STRATEGY ======================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
        "google-seller",
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_SELLER_CALLBACK_URL || "http://localhost:8000/seller/auth/google/callback",
                passReqToCallback: true
            },
            async (req, accessToken, refreshToken, profile, done) => {
                try {
                    // Get pending store data from session/state
                    const state = req.query.state;
                    let extraData = {};

                    if (state && pendingSellerData.has(state)) {
                        extraData = pendingSellerData.get(state);
                        pendingSellerData.delete(state); // clean up
                    }

                    const seller = await Seller.findOrCreateGoogleSeller(profile, extraData);
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
    res.render("seller-register", { error: null });
});

// ====================== POST SELLER REGISTER (Step 1: Collect store data) ======================
router.post("/register", async (req, res) => {
    const { storeName, storeDescription, phone, address } = req.body;

    if (!storeName) {
        return res.status(400).render("seller-register", { 
            error: "Store name is required" 
        });
    }

    // Generate a temporary key to store seller data
    const tempKey = require("crypto").randomBytes(16).toString("hex");

    pendingSellerData.set(tempKey, {
        storeName: storeName.trim(),
        storeDescription: storeDescription || "",
        phone: phone || "",
        address: address || ""
    });

    // Clean up old entries after 10 minutes
    setTimeout(() => {
        pendingSellerData.delete(tempKey);
    }, 10 * 60 * 1000);

    // Redirect to Google OAuth with the temp key as state
    res.redirect(`/seller/auth/google?state=${tempKey}`);
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

        res.redirect("/seller/register/success");
    }
);

// ====================== REGISTRATION SUCCESS PAGE ======================
router.get("/register/success", (req, res) => {
    res.render("seller-register-success", { user: req.user || null });
});

module.exports = router;
