const express = require("express");
const router = express.Router();

const Saldo = require("../model/Saldo");
const Validator = require("fastest-validator");
const v = new Validator();

const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated, isAdmin } = require("../middleware/auth");

/**
 * @route   POST /create
 * @desc    Create saldo
 */
router.post(
    "",
    isAuthenticated,
    // kalau hanya admin yang boleh create, tambahkan isAdmin di sini
    catchAsyncErrors(async (req, res, next) => {
        try {
            const schema = {
                name: { type: "string", empty: false, max: 255 },
                amount: { type: "number", empty: false, convert: true },
                description: { type: "string", empty: false, max: 1024 },
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

            const saldo = await Saldo.create({
                name: body.name,
                amount: body.amount,
                description: body.description,
            });

            return res.status(200).json({
                code: 200,
                status: "success",
                data: saldo,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 400));
        }
    })
);

/**
 * @route   GET /list
 * @desc    Get all saldo
 */
router.get(
    "/list",
    isAuthenticated,
    catchAsyncErrors(async (req, res, next) => {
        const { page = 1, limit = 50 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const [items, total] = await Promise.all([
            Saldo.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
            Saldo.countDocuments(),
        ]);

        res.status(200).json({
            meta: {
                message: "Saldo retrieved successfully",
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
 * @desc    Get saldo by ID
 */
router.get(
    "/:id",
    isAuthenticated,
    catchAsyncErrors(async (req, res, next) => {
        const saldo = await Saldo.findById(req.params.id);
        if (!saldo) {
            return res.status(404).json({
                code: 404,
                message: "Saldo not found",
                data: null,
            });
        }

        res.status(200).json({
            meta: {
                message: "Saldo retrieved successfully",
                code: 200,
                status: "success",
            },
            data: saldo,
        });
    })
);

/**
 * @route   PUT /update/:id
 * @desc    Update saldo by ID
 */
router.put(
    "/:id",
    isAuthenticated,
    // tambahkan isAdmin jika perlu
    catchAsyncErrors(async (req, res, next) => {
        try {
            const schema = {
                name: { type: "string", empty: false, max: 255, optional: true },
                amount: { type: "number", empty: false, convert: true, optional: true },
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

            const saldo = await Saldo.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true }
            );

            if (!saldo) {
                return res.status(404).json({
                    code: 404,
                    message: "Saldo not found",
                    data: null,
                });
            }

            return res.status(200).json({
                meta: {
                    message: "Saldo updated successfully",
                    code: 200,
                    status: "success",
                },
                data: saldo,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 400));
        }
    })
);

/**
 * @route   DELETE /delete/:id
 * @desc    Delete saldo by ID
 */
router.delete(
    "/:id",
    isAuthenticated,
    // tambahkan isAdmin jika perlu
    catchAsyncErrors(async (req, res, next) => {
        const saldo = await Saldo.findByIdAndDelete(req.params.id);

        if (!saldo) {
            return res.status(404).json({
                code: 404,
                message: "Saldo not found",
            });
        }

        return res.status(200).json({
            code: 200,
            message: "Saldo deleted successfully",
        });
    })
);

module.exports = router;
