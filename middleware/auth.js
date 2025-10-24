require('dotenv').config();
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("./catchAsyncErrors");
const jwt = require("jsonwebtoken");
const User = require("../model/User");

exports.isAuthenticated = catchAsyncErrors(async (req, res, next) => {
  const token = req.headers.authorization;
  console.log("ini token", token)
  if (!token) {
    return next(new ErrorHandler("Please login to continue", 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  const user = await User.findById(decoded.id);

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  req.user = user; // Store user data in request object
  next();
});


exports.isAdmin = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(`${req.user.role} can not access this resources!`)
      );
    }
    next();
  };
};

exports.isOfficer = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(`${req.user.role} can not access this resources!`)
      );
    }
    next();
  };
};
