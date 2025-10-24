const express = require("express");
const router = express.Router();

// Models
const Transaction = require("../model/Transaction");

// Middleware & Utils
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");

/**
 * @route   GET /transaction/chart/:year
 * @desc    Get transaction summary per month for chart
 */
router.get(
    "/chart/:year",
    isAuthenticated,
    catchAsyncErrors(async (req, res, next) => {
        const year = parseInt(req.params.year);

        const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${year + 1}-01-01T00:00:00.000Z`);

        const transactions = await Transaction.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lt: endDate },
                },
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$createdAt" },
                        type: "$type",
                    },
                    total: { $sum: "$amount" },
                },
            },
            {
                $project: {
                    month: "$_id.month",
                    type: "$_id.type",
                    total: 1,
                    _id: 0,
                },
            },
        ]);

        const monthNames = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ];

        // Default: 0 total untuk setiap bulan
        const income = [];
        const expense = [];

        for (let m = 1; m <= 12; m++) {
            const monthName = monthNames[m - 1];
            const dateLabel = `${monthName} ${year}`; // <== DIUBAH DI SINI

            const incomeData = transactions.find(t => t.month === m && t.type === 'income');
            const expenseData = transactions.find(t => t.month === m && t.type === 'expense');

            income.push({
                date: dateLabel,
                total: incomeData ? incomeData.total : 0,
            });

            expense.push({
                date: dateLabel,
                total: expenseData ? expenseData.total : 0,
            });
        }

        res.status(200).json({
            income,
            expense,
        });
    })
);

/**
 * @route   GET /transaction/summary?month=5&year=2024
 * @desc    Get total income and expense for a given month and year
 */
router.get(
    "/summary",
    isAuthenticated,
    catchAsyncErrors(async (req, res, next) => {
        const month = parseInt(req.query.month); // 1-12
        const year = parseInt(req.query.year);

        if (!month || !year || month < 1 || month > 12) {
            return res.status(400).json({
                message: "Invalid month or year",
                code: 400,
                status: "error",
            });
        }

        // Start date: YYYY-MM-01
        const startDate = new Date(Date.UTC(year, month - 1, 1));
        // End date: next month
        const endDate = new Date(Date.UTC(year, month, 1));

        const result = await Transaction.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: startDate,
                        $lt: endDate,
                    },
                },
            },
            {
                $group: {
                    _id: "$type",
                    total: { $sum: "$amount" },
                },
            },
        ]);

        let income = 0;
        let expense = 0;

        for (const r of result) {
            if (r._id === "income") income = r.total;
            if (r._id === "expense") expense = r.total;
        }

        res.status(200).json({
            income,
            expense,
            month,
            year,
        });
    })
);

module.exports = router;