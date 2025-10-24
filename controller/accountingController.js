const express = require("express");
const router = express.Router();
const AccountClassifier = require("../services/AccountClassifier");
const AccountMappingService = require("../services/AccountMappingService");
const Account = require("../model/Account");
const JournalEntry = require("../model/JournalEntry");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

/**
 * @route   POST /api/accounting/transactions
 */
router.post(
    "/transactions",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const { description, amount, type, date, reference } = req.body;
        const userId = req.user.id;

        try {
            // 1. Pastikan default accounts tersedia
            await AccountMappingService.initializeDefaultAccounts(userId);

            // 2. **FIXED: Gunakan await untuk prediction**
            const prediction = await AccountClassifier.predictAccount(description, type);

            // 3. Map ke accounts yang sesuai
            const accounts = await AccountMappingService.mapPredictionToAccounts(
                prediction, type, amount, userId
            );

            // 4. Buat journal entries
            const journalEntries = [];

            if (type === 'income') {
                journalEntries.push(
                    {
                        account: accounts.debitAccount._id,
                        debit: amount,
                        credit: 0,
                        description: description
                    },
                    {
                        account: accounts.creditAccount._id,
                        debit: 0,
                        credit: amount,
                        description: description
                    }
                );
            } else {
                journalEntries.push(
                    {
                        account: accounts.debitAccount._id,
                        debit: amount,
                        credit: 0,
                        description: description
                    },
                    {
                        account: accounts.creditAccount._id,
                        debit: 0,
                        credit: amount,
                        description: description
                    }
                );
            }

            // 5. Simpan journal entry
            const journalEntry = await JournalEntry.create({
                transaction_date: date || new Date(),
                reference,
                description,
                entries: journalEntries,
                user: userId,
                predicted_category: prediction.category, // **FIXED: Sekarang sudah string, bukan Promise**
                ml_confidence: prediction.confidence,
                ...(prediction.error && { prediction_error: prediction.error })
            });

            // 6. Post journal untuk update balances
            await journalEntry.post();

            // 7. Response dengan detail
            const populatedEntry = await JournalEntry.findById(journalEntry._id)
                .populate('entries.account', 'name code type');

            res.status(200).json({
                code: 200,
                status: "success",
                data: {
                    journalEntry: populatedEntry,
                    prediction: {
                        category: prediction.category,
                        confidence: prediction.confidence,
                        auto_categorized: prediction.confidence > 0.3
                    },
                    message: "Transaction recorded with double-entry accounting"
                }
            });

        } catch (error) {
            console.error('❌ Accounting transaction error:', error);
            res.status(400).json({
                code: 400,
                status: "error",
                message: error.message
            });
        }
    })
);

/**
 * @route   GET /api/accounting/journal-entries
 * @desc    Get all journal entries with pagination and filters
 */
router.get(
    "/journal-entries",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const {
            page = 1,
            limit = 50,
            start_date,
            end_date,
            account,
            type
        } = req.query;

        const skip = (Number(page) - 1) * Number(limit);

        // Build filter
        const filter = { user: req.user.id };

        if (start_date || end_date) {
            filter.transaction_date = {};
            if (start_date) filter.transaction_date.$gte = new Date(start_date);
            if (end_date) filter.transaction_date.$lte = new Date(end_date);
        }

        if (account) {
            filter['entries.account'] = account;
        }

        const [entries, total] = await Promise.all([
            JournalEntry.find(filter)
                .populate('entries.account', 'name code type')
                .populate('user', 'name email')
                .sort({ transaction_date: -1, createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            JournalEntry.countDocuments(filter)
        ]);

        res.status(200).json({
            code: 200,
            status: "success",
            data: {
                journalEntries: entries,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit))
                }
            }
        });
    })
);

/**
 * @route   GET /api/accounting/accounts
 * @desc    Get all accounts for user
 */
router.get(
    "/accounts",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const accounts = await Account.find({
            user: req.user.id,
            is_active: true
        }).sort({ code: 1 });

        res.status(200).json({
            code: 200,
            status: "success",
            data: { accounts }
        });
    })
);

/**
 * @route   POST /api/accounting/accounts
 * @desc    Create new account
 */
router.post(
    "/accounts",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const { name, code, type, normal_balance, description } = req.body;

        // Check if code already exists
        const existingAccount = await Account.findOne({
            code,
            user: req.user.id
        });

        if (existingAccount) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Account code already exists"
            });
        }

        const account = await Account.create({
            name,
            code,
            type,
            normal_balance,
            description,
            user: req.user.id,
            balance: 0
        });

        res.status(201).json({
            code: 201,
            status: "success",
            data: { account },
            message: "Account created successfully"
        });
    })
);

/**
 * @route   GET /api/accounting/reports/income-statement
 * @desc    Get income statement for period
 */
router.get(
    "/reports/income-statement",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const { start_date, end_date } = req.query;

        // Default to current month if no dates provided
        const startDate = start_date ? new Date(start_date) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endDate = end_date ? new Date(end_date) : new Date();

        // Get revenue accounts and their balances within period
        const revenueAccounts = await Account.find({
            user: req.user.id,
            type: 'revenue',
            is_active: true
        });

        const expenseAccounts = await Account.find({
            user: req.user.id,
            type: 'expense',
            is_active: true
        });

        // Calculate period balances (simplified - in real app, you'd sum journal entries for period)
        const revenueData = revenueAccounts.map(acc => ({
            name: acc.name,
            code: acc.code,
            amount: acc.balance
        }));

        const expenseData = expenseAccounts.map(acc => ({
            name: acc.name,
            code: acc.code,
            amount: acc.balance
        }));

        const totalRevenue = revenueData.reduce((sum, acc) => sum + acc.amount, 0);
        const totalExpenses = expenseData.reduce((sum, acc) => sum + acc.amount, 0);
        const netIncome = totalRevenue - totalExpenses;

        res.status(200).json({
            code: 200,
            status: "success",
            data: {
                income_statement: {
                    revenue: {
                        accounts: revenueData,
                        total: totalRevenue
                    },
                    expenses: {
                        accounts: expenseData,
                        total: totalExpenses
                    },
                    net_income: netIncome
                },
                period: {
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0]
                }
            }
        });
    })
);

/**
 * @route   GET /api/accounting/reports/balance-sheet
 * @desc    Get balance sheet as of specific date
 */
router.get(
    "/reports/balance-sheet",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const { as_of_date } = req.query;
        const asOfDate = as_of_date ? new Date(as_of_date) : new Date();

        const accounts = await Account.find({
            user: req.user.id,
            is_active: true
        });

        const assets = accounts.filter(acc => acc.type === 'asset');
        const liabilities = accounts.filter(acc => acc.type === 'liability');
        const equity = accounts.filter(acc => acc.type === 'equity');

        const totalAssets = assets.reduce((sum, acc) => sum + acc.display_balance, 0);
        const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.display_balance, 0);
        const totalEquity = equity.reduce((sum, acc) => sum + acc.display_balance, 0);

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
                    difference: Math.abs(totalAssets - (totalLiabilities + totalEquity))
                },
                as_of_date: asOfDate.toISOString().split('T')[0]
            }
        });
    })
);

/**
 * @route   GET /api/accounting/reports/cash-flow
 * @desc    Get cash flow statement
 */
router.get(
    "/reports/cash-flow",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const { start_date, end_date } = req.query;

        const cashAccount = await Account.findOne({
            user: req.user.id,
            code: '101' // Cash account
        });

        if (!cashAccount) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Cash account not found"
            });
        }

        // Simplified cash flow calculation
        // In real implementation, you'd analyze journal entries for the period
        const operatingActivities = 0; // Net income + adjustments
        const investingActivities = 0; // Purchase/sale of assets
        const financingActivities = 0; // Loans, equity changes

        const netCashFlow = operatingActivities + investingActivities + financingActivities;
        const beginningCash = 0; // Cash balance at start of period
        const endingCash = cashAccount.balance;

        res.status(200).json({
            code: 200,
            status: "success",
            data: {
                cash_flow_statement: {
                    operating_activities: operatingActivities,
                    investing_activities: investingActivities,
                    financing_activities: financingActivities,
                    net_cash_flow: netCashFlow,
                    beginning_cash: beginningCash,
                    ending_cash: endingCash
                },
                period: {
                    start_date,
                    end_date
                }
            }
        });
    })
);

/**
 * @route   GET /api/accounting/analytics/transaction-stats
 * @desc    Get transaction statistics and insights
 */
router.get(
    "/analytics/transaction-stats",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const { period = 'month' } = req.query; // month, quarter, year

        // Total transactions count
        const totalTransactions = await JournalEntry.countDocuments({
            user: req.user.id,
            status: 'posted'
        });

        // Total income and expense
        const incomeResult = await JournalEntry.aggregate([
            { $match: { user: req.user.id, status: 'posted' } },
            { $unwind: '$entries' },
            {
                $match: {
                    'entries.account': { $exists: true },
                    'entries.credit': { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: null,
                    totalIncome: { $sum: '$entries.credit' }
                }
            }
        ]);

        const expenseResult = await JournalEntry.aggregate([
            { $match: { user: req.user.id, status: 'posted' } },
            { $unwind: '$entries' },
            {
                $match: {
                    'entries.account': { $exists: true },
                    'entries.debit': { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: null,
                    totalExpense: { $sum: '$entries.debit' }
                }
            }
        ]);

        const totalIncome = incomeResult[0]?.totalIncome || 0;
        const totalExpense = expenseResult[0]?.totalExpense || 0;
        const netProfit = totalIncome - totalExpense;

        // Category distribution
        const categoryStats = await JournalEntry.aggregate([
            { $match: { user: req.user.id, status: 'posted' } },
            {
                $group: {
                    _id: '$predicted_category',
                    count: { $sum: 1 },
                    totalAmount: { $sum: { $add: ['$entries.debit', '$entries.credit'] } }
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.status(200).json({
            code: 200,
            status: "success",
            data: {
                overview: {
                    total_transactions: totalTransactions,
                    total_income: totalIncome,
                    total_expense: totalExpense,
                    net_profit: netProfit,
                    profit_margin: totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0
                },
                category_distribution: categoryStats,
                period: period
            }
        });
    })
);

/**
 * @route   GET /api/accounting/export/journal-entries
 * @desc    Export journal entries to CSV
 */
router.get(
    "/export/journal-entries",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const { start_date, end_date } = req.query;

        const filter = { user: req.user.id, status: 'posted' };

        if (start_date || end_date) {
            filter.transaction_date = {};
            if (start_date) filter.transaction_date.$gte = new Date(start_date);
            if (end_date) filter.transaction_date.$lte = new Date(end_date);
        }

        const entries = await JournalEntry.find(filter)
            .populate('entries.account', 'name code')
            .sort({ transaction_date: 1 });

        // Convert to CSV format
        const csvData = [];
        csvData.push(['Date', 'Reference', 'Description', 'Account', 'Debit', 'Credit', 'Category']);

        entries.forEach(entry => {
            entry.entries.forEach(accountEntry => {
                csvData.push([
                    entry.transaction_date.toISOString().split('T')[0],
                    entry.reference || '',
                    entry.description,
                    `${accountEntry.account.code} - ${accountEntry.account.name}`,
                    accountEntry.debit,
                    accountEntry.credit,
                    entry.predicted_category || ''
                ]);
            });
        });

        // Convert to CSV string
        const csvString = csvData.map(row => row.join(',')).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=journal-entries.csv');
        res.send(csvString);
    })
);

/**
 * @route   GET /api/accounting/health
 * @desc    System health check
 */
router.get(
    "/health",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const accountsCount = await Account.countDocuments({ user: req.user.id });
        const entriesCount = await JournalEntry.countDocuments({ user: req.user.id });
        const postedEntriesCount = await JournalEntry.countDocuments({
            user: req.user.id,
            status: 'posted'
        });

        // Check trial balance
        const accounts = await Account.find({ user: req.user.id, is_active: true });
        const totalDebit = accounts
            .filter(acc => acc.normal_balance === 'debit')
            .reduce((sum, acc) => sum + acc.balance, 0);
        const totalCredit = accounts
            .filter(acc => acc.normal_balance === 'credit')
            .reduce((sum, acc) => sum + acc.balance, 0);

        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

        res.status(200).json({
            code: 200,
            status: "success",
            data: {
                system_health: {
                    accounts: accountsCount,
                    journal_entries: entriesCount,
                    posted_entries: postedEntriesCount,
                    trial_balance_balanced: isBalanced,
                    balance_difference: Math.abs(totalDebit - totalCredit)
                },
                ml_model: AccountClassifier.getModelStatus(),
                database: {
                    connected: true,
                    timestamp: new Date().toISOString()
                }
            }
        });
    })
);

/**
 * @route   GET /api/accounting/analytics/model-accuracy
 * @desc    Get detailed ML model accuracy report
 */
router.get(
    "/analytics/model-accuracy",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const correctedEntries = await JournalEntry.find({
            user: req.user.id,
            actual_category: { $exists: true }
        });

        const accuracyByCategory = {};
        let totalCorrect = 0;

        correctedEntries.forEach(entry => {
            const isCorrect = entry.predicted_category === entry.actual_category;
            const category = entry.actual_category;

            if (!accuracyByCategory[category]) {
                accuracyByCategory[category] = {
                    total: 0,
                    correct: 0,
                    accuracy: 0
                };
            }

            accuracyByCategory[category].total++;
            if (isCorrect) {
                accuracyByCategory[category].correct++;
                totalCorrect++;
            }
        });

        // Calculate accuracy for each category
        Object.keys(accuracyByCategory).forEach(category => {
            accuracyByCategory[category].accuracy =
                (accuracyByCategory[category].correct / accuracyByCategory[category].total) * 100;
        });

        const overallAccuracy = correctedEntries.length > 0 ?
            (totalCorrect / correctedEntries.length) * 100 : 0;

        res.status(200).json({
            code: 200,
            status: "success",
            data: {
                overall_accuracy: overallAccuracy.toFixed(2),
                total_corrections: correctedEntries.length,
                accuracy_by_category: accuracyByCategory,
                model_confidence: {
                    average: await getAverageConfidence(req.user.id),
                    distribution: await getConfidenceDistribution(req.user.id)
                }
            }
        });
    })
);

// Helper functions
async function getAverageConfidence(userId) {
    const result = await JournalEntry.aggregate([
        { $match: { user: userId, ml_confidence: { $exists: true } } },
        {
            $group: {
                _id: null,
                averageConfidence: { $avg: '$ml_confidence' }
            }
        }
    ]);
    return result[0]?.averageConfidence || 0;
}

async function getConfidenceDistribution(userId) {
    const ranges = [
        { range: '0.8-1.0', min: 0.8, max: 1.0 },
        { range: '0.6-0.8', min: 0.6, max: 0.8 },
        { range: '0.4-0.6', min: 0.4, max: 0.6 },
        { range: '0.2-0.4', min: 0.2, max: 0.4 },
        { range: '0.0-0.2', min: 0.0, max: 0.2 }
    ];

    const distribution = [];

    for (const range of ranges) {
        const count = await JournalEntry.countDocuments({
            user: userId,
            ml_confidence: { $gte: range.min, $lt: range.max }
        });
        distribution.push({ range: range.range, count });
    }

    return distribution;
}

/**
 * @route   GET /api/accounting/journal-entries/:id
 * @desc    Get single journal entry by ID
 */
router.get(
    "/journal-entries/:id",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const journalEntry = await JournalEntry.findById(req.params.id)
            .populate('entries.account', 'name code type')
            .populate('user', 'name email');

        if (!journalEntry) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Journal entry not found"
            });
        }

        // Check ownership
        if (journalEntry.user._id.toString() !== req.user.id) {
            return res.status(403).json({
                code: 403,
                status: "error",
                message: "Access denied"
            });
        }

        res.status(200).json({
            code: 200,
            status: "success",
            data: { journalEntry }
        });
    })
);

/**
 * @route   PUT /api/accounting/journal-entries/:id
 * @desc    Update journal entry (only draft entries can be updated)
 */
router.put(
    "/journal-entries/:id",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const { description, reference, transaction_date, entries } = req.body;

        const journalEntry = await JournalEntry.findById(req.params.ieyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ODRiYTI0YTZhNjYxNTExM2I3YTRhNSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzYxMzI0NTg5LCJleHAiOjE3NjE0MTA5ODl9.rHn0Mbvo6ewHDlji4dw0JtS9OZ - SuWXD1708xIfRqVkd);
        if (!journalEntry) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Journal entry not found"
            });
        }

        // Only draft entries can be updated
        if (journalEntry.status !== 'draft') {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Only draft entries can be updated"
            });
        }

        // Validate entries balance
        if (entries) {
            const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0);
            const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0);

            if (totalDebit !== totalCredit) {
                return res.status(400).json({
                    code: 400,
                    status: "error",
                    message: `Unbalanced journal entry: Debit ${totalDebit} ≠ Credit ${totalCredit}`
                });
            }
        }

        // Update fields
        const updateData = {};
        if (description) updateData.description = description;
        if (reference) updateData.reference = reference;
        if (transaction_date) updateData.transaction_date = transaction_date;
        if (entries) updateData.entries = entries;

        const updatedEntry = await JournalEntry.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('entries.account', 'name code type');

        res.status(200).json({
            code: 200,
            status: "success",
            data: { journalEntry: updatedEntry },
            message: "Journal entry updated successfully"
        });
    })
);


/**
 * @route   DELETE /api/accounting/journal-entries/:id
 * @desc    Soft delete journal entry (change status to cancelled)
 */
router.delete(
    "/journal-entries/:id",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const journalEntry = await JournalEntry.findById(req.params.id);

        if (!journalEntry) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Journal entry not found"
            });
        }

        // Reverse the balances if entry was posted
        if (journalEntry.status === 'posted') {
            for (const entry of journalEntry.entries) {
                const account = await Account.findById(entry.account);

                if (entry.debit > 0) {
                    account.balance -= entry.debit;
                } else if (entry.credit > 0) {
                    account.balance += entry.credit;
                }

                await account.save();
            }
        }

        // Soft delete by changing status
        journalEntry.status = 'cancelled';
        await journalEntry.save();

        res.status(200).json({
            code: 200,
            status: "success",
            message: "Journal entry cancelled successfully"
        });
    })
);

/**
 * @route   PUT /api/accounting/accounts/:id
 * @desc    Update account
 */
router.put(
    "/accounts/:id",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const { name, description, is_active } = req.body;

        const account = await Account.findById(req.params.id);
        if (!account) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Account not found"
            });
        }

        // Cannot update code, type, or normal_balance for accounts with transactions
        if (account.balance !== 0 && (req.body.code || req.body.type || req.body.normal_balance)) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Cannot change code, type, or normal balance for accounts with transactions"
            });
        }

        const updatedAccount = await Account.findByIdAndUpdate(
            req.params.id,
            { name, description, is_active },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            code: 200,
            status: "success",
            data: { account: updatedAccount },
            message: "Account updated successfully"
        });
    })
);


module.exports = router;