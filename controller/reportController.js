const express = require("express");
const router = express.Router();
const JournalEntry = require("../model/JournalEntry");
const Account = require("../model/Account");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

/**
 * @route   GET /api/accounting/income-statement
 * @desc    Get income statement (Profit & Loss)
 */
router.get(
    "/income-statement",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const { start_date, end_date } = req.query;

        const revenueAccounts = await Account.find({
            user: req.user.id,
            type: 'revenue'
        });

        const expenseAccounts = await Account.find({
            user: req.user.id,
            type: 'expense'
        });

        // Hitung total revenue dan expense
        const totalRevenue = revenueAccounts.reduce((sum, acc) => sum + acc.balance, 0);
        const totalExpense = expenseAccounts.reduce((sum, acc) => sum + acc.balance, 0);
        const netIncome = totalRevenue - totalExpense;

        res.status(200).json({
            code: 200,
            status: "success",
            data: {
                income_statement: {
                    revenue: {
                        accounts: revenueAccounts.map(acc => ({
                            name: acc.name,
                            code: acc.code,
                            amount: acc.balance
                        })),
                        total: totalRevenue
                    },
                    expenses: {
                        accounts: expenseAccounts.map(acc => ({
                            name: acc.name,
                            code: acc.code,
                            amount: acc.balance
                        })),
                        total: totalExpense
                    },
                    net_income: netIncome
                },
                period: {
                    start_date,
                    end_date: end_date || new Date().toISOString().split('T')[0]
                }
            }
        });
    })
);

/**
 * @route   GET /api/accounting/balance-sheet
 * @desc    Get balance sheet
 */
router.get(
    "/balance-sheet",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const accounts = await Account.find({ user: req.user.id, is_active: true });

        const assets = accounts.filter(acc => acc.type === 'asset');
        const liabilities = accounts.filter(acc => acc.type === 'liability');
        const equity = accounts.filter(acc => acc.type === 'equity');

        const totalAssets = assets.reduce((sum, acc) => sum + acc.display_balance, 0);
        const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.display_balance, 0);
        const totalEquity = equity.reduce((sum, acc) => sum + acc.display_balance, 0);

        // Basic accounting equation: Assets = Liabilities + Equity
        const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

        res.status(200).json({
            code: 200,
            status: "success",
            data: {
                balance_sheet: {
                    assets: {
                        accounts: assets.map(acc => ({
                            name: acc.name,
                            code: acc.code,
                            amount: acc.display_balance
                        })),
                        total: totalAssets
                    },
                    liabilities: {
                        accounts: liabilities.map(acc => ({
                            name: acc.name,
                            code: acc.code,
                            amount: acc.display_balance
                        })),
                        total: totalLiabilities
                    },
                    equity: {
                        accounts: equity.map(acc => ({
                            name: acc.name,
                            code: acc.code,
                            amount: acc.display_balance
                        })),
                        total: totalEquity
                    }
                },
                accounting_equation: {
                    assets: totalAssets,
                    liabilities_plus_equity: totalLiabilities + totalEquity,
                    is_balanced: isBalanced,
                    difference: totalAssets - (totalLiabilities + totalEquity)
                }
            }
        });
    })
);

module.exports = router;