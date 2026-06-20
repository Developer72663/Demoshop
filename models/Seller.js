const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const SellerSchema = new Schema({
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    profileImageURL: {
        type: String,
        default: "/imgs/default.png"
    },
    storeName: {
        type: String,
        required: true,
        trim: true
    },
    storeDescription: {
        type: String,
        default: ""
    },
    phone: {
        type: String,
        default: ""
    },
    address: {
        type: String,
        default: ""
    },
    role: {
        type: String,
        enum: ["SELLER"],
        default: "SELLER"
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

SellerSchema.index({ email: 1 });
SellerSchema.index({ googleId: 1 });

// Find or create seller from Google profile
SellerSchema.static("findOrCreateGoogleSeller", async function (profile, extraData = {}) {
    try {
        const email = profile.emails[0].value.toLowerCase();
        const googleId = profile.id;

        let seller = await this.findOne({ googleId });

        if (!seller) {
            seller = await this.findOne({ email });

            if (seller) {
                seller.googleId = googleId;
                if (profile.photos && profile.photos[0] && profile.photos[0].value) {
                    seller.profileImageURL = profile.photos[0].value;
                }
                await seller.save();
            } else {
                seller = await this.create({
                    fullName: profile.displayName || "Google Seller",
                    email: email,
                    googleId: googleId,
                    profileImageURL: (profile.photos && profile.photos[0] && profile.photos[0].value)
                        ? profile.photos[0].value
                        : "/imgs/default.png",
                    storeName: extraData.storeName || (profile.displayName + "'s Store"),
                    storeDescription: extraData.storeDescription || "",
                    phone: extraData.phone || "",
                    address: extraData.address || ""
                });
            }
        }

        return seller;
    } catch (error) {
        console.error("findOrCreateGoogleSeller Error:", error.message);
        throw error;
    }
});

const Seller = mongoose.models.seller || model("seller", SellerSchema);

module.exports = Seller;
