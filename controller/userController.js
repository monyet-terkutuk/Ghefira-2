const express = require("express");
const router = express.Router();
const User = require("../model/User");
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
const Validator = require("fastest-validator");
const v = new Validator();

const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated, isAdmin } = require("../middleware/auth");

// /**
//  * @route   POST /register
//  * @desc    Register new user
//  */
router.post("/register", async (req, res, next) => {
  try {
    const schema = {
      name: { type: "string", empty: false, max: 255 },
      password: { type: "string", empty: false, min: 8 },
      email: { type: "email", empty: false },
      phone: { type: "string", empty: false, max: 15 },
      image: { type: "string", optional: true },
      role: { type: "enum", values: ["admin", "user"], default: "user" },
    };

    const { body } = req;
    const validation = v.validate(body, schema);

    if (validation !== true) {
      return res.status(400).json({
        code: 400,
        status: "error",
        data: { error: "Validation failed", details: validation },
      });
    }

    const emailUsed = await User.findOne({ email: body.email });
    const nameUsed = await User.findOne({ name: body.name });

    if (emailUsed || nameUsed) {
      return res.status(400).json({
        code: 400,
        status: "error",
        data: {
          error: emailUsed ? "Email has been used" : "Name has been used",
        },
      });
    }

    const hashedPassword = bcrypt.hashSync(body.password, 10);

    const user = await User.create({
      name: body.name,
      email: body.email,
      password: hashedPassword,
      phone: body.phone,
      image: body.image || "",
      role: body.role || "user",
    });

    return res.status(200).json({
      code: 200,
      status: "success",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
});

// /**
//  * @route   POST /login
//  * @desc    Authenticate user and return token
//  */

router.post("/login", async (req, res, next) => {
  const { email, password } = req.body;

  const schema = {
    email: { type: "email", empty: false },
    password: { type: "string", min: 8, empty: false },
  };

  try {
    const validation = v.validate(req.body, schema);
    if (validation !== true) {
      return res.status(400).json({
        meta: {
          message: "Validation failed",
          code: 400,
          status: "error",
        },
        data: validation,
      });
    }

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({
        meta: {
          message: "Invalid email or password",
          code: 401,
          status: "error",
        },
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        meta: {
          message: "Invalid email or password",
          code: 401,
          status: "error",
        },
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "24h" }
    );

    return res.status(200).json({
      meta: {
        message: "Authentication successful",
        code: 200,
        status: "success",
      },
      data: {
        id: user._id,
        user,
        token,
      },
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// /**
//  * @route   GET /list
//  * @desc    Get all users
//  */

router.get(
  "/list",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    const users = await User.find().sort({ createdAt: -1 });

    res.status(200).json({
      meta: {
        message: "Users retrieved successfully",
        code: 200,
        status: "success",
      },
      data: users
    });
  })
);

// /**
//  * @route   GET /:id
//  * @desc    Get user by ID
//  */

router.get(
  "/:id",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: "User not found",
        data: null,
      });
    }

    res.status(200).json({
      meta: {
        message: "User retrieved successfully",
        code: 200,
        status: "success",
      },
      data: user
    });
  })
);

// /**
//  * @route   DELETE /delete/:id
//  * @desc    Delete user by ID
//  */

router.delete(
  "/:id",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        code: 404,
        message: "User not found",
      });
    }

    return res.status(200).json({
      code: 200,
      message: "User deleted successfully",
    });
  })
);

module.exports = router;
