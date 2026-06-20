const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "default_secret_key_change_in_production";

// Create Token
const creatTokenForUser = (user) => {
  const payload = {
    _id: user._id,
    email: user.email,
    fullName: user.fullName,
    profileImageURL: user.profileImageURL,
    role: user.role,
    googleId: user.googleId
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};

// Verify Token
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = {
  creatTokenForUser,
  verifyToken
};