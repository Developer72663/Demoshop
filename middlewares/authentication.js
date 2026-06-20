const { verifyToken } = require("../services/authentication");

const checkForAuthenticationCookie = (cookieName) => {
  return (req, res, next) => {
    const token = req.cookies[cookieName];
    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const user = verifyToken(token);
      req.user = user;
    } catch (error) {
      req.user = null;
    }
    next();
  };
};

// Restrict to Logged-in Users Only
const restrictToLoggedInUserOnly = (req, res, next) => {
  if (!req.user) {
    return res.redirect("/user/signin");
  }
  next();
};

// Restrict to Admin Only
const restrictTo = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect("/user/signin");
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).send("Access Denied: Admins Only");
    }
    next();
  };
};

module.exports = {
  checkForAuthenticationCookie,
  restrictTo,
  restrictToLoggedInUserOnly
};