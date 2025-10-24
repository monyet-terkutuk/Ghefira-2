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
 * @route   PUT /api/accounting/transactions/:id/correct-category
 * @desc    Correct ML prediction and learn from it
 */
router.put(
    "/transactions/:id/correct-category",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const { correctCategory } = req.body;

        const journalEntry = await JournalEntry.findById(req.params.id);
        if (!journalEntry) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Journal entry not found"
            });
        }

        // Update journal entry dengan koreksi
        journalEntry.actual_category = correctCategory;
        await journalEntry.save();

        // Re-train model dengan koreksi
        await AccountClassifier.learnFromCorrection(
            journalEntry.description,
            journalEntry.entries[0].debit > 0 ? 'expense' : 'income',
            correctCategory
        );

        res.status(200).json({
            code: 200,
            status: "success",
            message: "Category corrected and model updated",
            data: {
                previous_prediction: journalEntry.predicted_category,
                corrected_category: correctCategory
            }
        });
    })
);

/**
 * @route   GET /api/accounting/trial-balance
 * @desc    Get trial balance report
 */
router.get(
    "/trial-balance",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const accounts = await Account.find({ user: req.user.id, is_active: true });

        const trialBalance = accounts.map(account => ({
            account_code: account.code,
            account_name: account.name,
            account_type: account.type,
            debit: account.normal_balance === 'debit' ? account.balance : 0,
            credit: account.normal_balance === 'credit' ? account.balance : 0
        }));

        const totalDebit = trialBalance.reduce((sum, item) => sum + item.debit, 0);
        const totalCredit = trialBalance.reduce((sum, item) => sum + item.credit, 0);

        res.status(200).json({
            code: 200,
            status: "success",
            data: {
                trial_balance: trialBalance,
                totals: {
                    debit: totalDebit,
                    credit: totalCredit
                },
                is_balanced: totalDebit === totalCredit,
                difference: Math.abs(totalDebit - totalCredit)
            }
        });
    })
);

/**
 * @route   GET /api/accounting/model-performance
 * @desc    Get ML model performance metrics for accounting
 */
router.get(
    "/model-performance",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        // Analisis akurasi prediksi berdasarkan koreksi user
        const journalEntries = await JournalEntry.find({
            user: req.user.id,
            actual_category: { $exists: true } // Hanya yang sudah dikoreksi
        });

        const performance = {
            total_corrections: journalEntries.length,
            accuracy_analysis: {}
        };

        if (journalEntries.length > 0) {
            const correctPredictions = journalEntries.filter(
                entry => entry.predicted_category === entry.actual_category
            ).length;

            performance.accuracy_analysis = {
                accuracy: (correctPredictions / journalEntries.length).toFixed(4),
                correct_predictions: correctPredictions,
                incorrect_predictions: journalEntries.length - correctPredictions
            };
        }

        res.status(200).json({
            code: 200,
            status: "success",
            data: {
                model_performance: performance,
                model_status: {
                    is_trained: AccountClassifier.isTrained,
                    total_categories: AccountClassifier.classifier.categories?.length || 0
                }
            }
        });
    })
);

/**
 * @route   POST /api/accounting/bulk-import
 * @desc    Bulk import transactions dengan auto-categorization
 */
router.post(
    "/bulk-import",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        const { transactions } = req.body; // Array of {description, amount, type, date}

        const results = await Promise.all(
            transactions.map(async (tx, index) => {
                try {
                    // Predict category untuk setiap transaction
                    const prediction = await AccountClassifier.predictAccount(tx.description, tx.type);

                    return {
                        original_data: tx,
                        prediction: prediction,
                        status: 'pending',
                        import_id: index
                    };
                } catch (error) {
                    return {
                        original_data: tx,
                        error: error.message,
                        status: 'failed',
                        import_id: index
                    };
                }
            })
        );

        // Return preview sebelum actual import
        res.status(200).json({
            code: 200,
            status: "success",
            data: {
                preview: results,
                summary: {
                    total: results.length,
                    pending: results.filter(r => r.status === 'pending').length,
                    failed: results.filter(r => r.status === 'failed').length
                },
                message: "Review predictions before actual import"
            }
        });
    })
);

/**
 * @route   GET /api/accounting/model-status
 * @desc    Get ML model status and info
 */
router.get(
    "/model-status",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        try {
            const modelStatus = AccountClassifier.getModelStatus();

            res.status(200).json({
                code: 200,
                status: "success",
                data: {
                    model_status: modelStatus,
                    classifier_implementation: "Fixed version with error handling"
                }
            });
        } catch (error) {
            res.status(500).json({
                code: 500,
                status: "error",
                message: "Failed to get model status",
                error: error.message
            });
        }
    })
);

/**
 * @route   POST /api/accounting/train-model
 * @desc    Manually train the ML model
 */
router.post(
    "/train-model",
    isAuthenticated,
    catchAsyncErrors(async (req, res) => {
        try {
            await AccountClassifier.trainWithAccountingData();
            const modelStatus = AccountClassifier.getModelStatus();

            res.status(200).json({
                code: 200,
                status: "success",
                data: {
                    message: "Model trained successfully",
                    model_status: modelStatus
                }
            });
        } catch (error) {
            res.status(500).json({
                code: 500,
                status: "error",
                message: "Model training failed",
                error: error.message
            });
        }
    })
);

module.exports = router;