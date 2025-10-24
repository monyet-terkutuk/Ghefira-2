const express = require("express");
const router = express.Router();

const Category = require("../model/Category");
const Validator = require("fastest-validator");
const v = new Validator();

const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated, isAdmin } = require("../middleware/auth");

/**
 * @route   POST /
 * @desc    Create category
 */
router.post(
    "/",
    isAuthenticated,
    // tambahkan isAdmin jika hanya admin yang boleh buat
    catchAsyncErrors(async (req, res, next) => {
        try {
            const schema = {
                name: { type: "string", empty: false, max: 255 },
                type: { type: "enum", values: ["income", "expense"] },
                description: { type: "string", empty: false, max: 1024 },
            };

            const validation = v.validate(req.body, schema);

            if (validation !== true) {
                return res.status(400).json({
                    code: 400,
                    status: "error",
                    data: { error: "Validation failed", details: validation },
                });
            }

            const category = await Category.create(req.body);

            return res.status(200).json({
                code: 200,
                status: "success",
                data: category,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 400));
        }
    })
);

/**
 * @route   GET /list
 * @desc    Get all categories
 */
router.get(
    "/list",
    isAuthenticated,
    catchAsyncErrors(async (req, res, next) => {
        const { page = 1, limit = 50 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const [items, total] = await Promise.all([
            Category.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
            Category.countDocuments(),
        ]);

        res.status(200).json({
            meta: {
                message: "Category retrieved successfully",
                code: 200,
                status: "success",
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit)),
                },
            },
            data: items,
        });
    })
);

/**
 * @route   GET /:id
 * @desc    Get category by ID
 */
router.get(
    "/:id",
    isAuthenticated,
    catchAsyncErrors(async (req, res, next) => {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).json({
                code: 404,
                message: "Category not found",
                data: null,
            });
        }

        res.status(200).json({
            meta: {
                message: "Category retrieved successfully",
                code: 200,
                status: "success",
            },
            data: category,
        });
    })
);

/**
 * @route   PUT /:id
 * @desc    Update category by ID
 */
router.put(
    "/:id",
    isAuthenticated,
    // tambahkan isAdmin jika perlu
    catchAsyncErrors(async (req, res, next) => {
        try {
            const schema = {
                name: { type: "string", empty: false, max: 255, optional: true },
                type: { type: "enum", values: ["income", "expense"], optional: true },
                description: { type: "string", empty: false, max: 1024, optional: true },
            };

            const validation = v.validate(req.body, schema);

            if (validation !== true) {
                return res.status(400).json({
                    code: 400,
                    status: "error",
                    data: { error: "Validation failed", details: validation },
                });
            }

            const category = await Category.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true }
            );

            if (!category) {
                return res.status(404).json({
                    code: 404,
                    message: "Category not found",
                    data: null,
                });
            }

            return res.status(200).json({
                meta: {
                    message: "Category updated successfully",
                    code: 200,
                    status: "success",
                },
                data: category,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 400));
        }
    })
);

/**
 * @route   DELETE /:id
 * @desc    Delete category by ID
 */
router.delete(
    "/:id",
    isAuthenticated,
    // tambahkan isAdmin jika perlu
    catchAsyncErrors(async (req, res, next) => {
        const category = await Category.findByIdAndDelete(req.params.id);

        if (!category) {
            return res.status(404).json({
                code: 404,
                message: "Category not found",
            });
        }

        return res.status(200).json({
            code: 200,
            message: "Category deleted successfully",
        });
    })
);

module.exports = router;
