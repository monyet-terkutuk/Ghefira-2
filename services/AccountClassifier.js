const bayes = require('bayes');
const fs = require('fs');
const path = require('path');

class AccountClassifier {
    constructor() {
        this.classifier = null;
        this.modelPath = path.join(__dirname, '../models/account-classifier.json');
        this.isTrained = false;

        // Pastikan directory models ada
        this.ensureModelsDirectory();
        this.loadModel();
    }

    ensureModelsDirectory() {
        const modelsDir = path.dirname(this.modelPath);
        if (!fs.existsSync(modelsDir)) {
            fs.mkdirSync(modelsDir, { recursive: true });
            console.log('📁 Created models directory:', modelsDir);
        }
    }

    async loadModel() {
        try {
            if (fs.existsSync(this.modelPath)) {
                const modelData = fs.readFileSync(this.modelPath, 'utf8');
                this.classifier = bayes.fromJson(modelData);
                this.isTrained = true;
                console.log('✅ Account classifier model loaded');
            } else {
                await this.initializeNewClassifier();
            }
        } catch (error) {
            console.log('❌ Error loading model, initializing fresh:', error.message);
            await this.initializeNewClassifier();
        }
    }

    async initializeNewClassifier() {
        this.classifier = bayes();
        this.isTrained = false;
        console.log('🆕 New classifier initialized');
    }

    async saveModel() {
        try {
            if (!this.classifier) {
                throw new Error('Classifier not initialized');
            }

            this.ensureModelsDirectory(); // Pastikan directory ada

            const modelState = this.classifier.toJson();
            fs.writeFileSync(this.modelPath, modelState, 'utf8');
            console.log('💾 Account classifier model saved');
            return true;
        } catch (error) {
            console.error('❌ Failed to save model:', error);
            return false;
        }
    }

    // **FIXED: Method untuk mendapatkan kategori yang tersedia**
    getCategories() {
        if (!this.classifier) return [];

        try {
            // Untuk versi bayes yang lebih baru
            if (this.classifier.categories) {
                return Object.keys(this.classifier.categories);
            }

            // Fallback: coba dari state internal
            const state = this.classifier.toJson();
            const parsed = JSON.parse(state);
            return Object.keys(parsed.categories || {});
        } catch (error) {
            console.log('⚠️ Could not extract categories:', error.message);
            return [];
        }
    }

    // **FIXED: Method untuk menghitung confidence**
    calculateConfidence(text, category) {
        if (!this.classifier) return 0;

        try {
            const categories = this.getCategories();
            if (categories.length === 0) return 0.5;

            // Basic probability calculation
            const totalDocs = categories.reduce((sum, cat) => {
                return sum + (this.getDocumentCount(cat) || 0);
            }, 0);

            const categoryDocs = this.getDocumentCount(category) || 1;
            return Math.min(0.99, categoryDocs / Math.max(1, totalDocs));
        } catch (error) {
            console.log('⚠️ Confidence calculation failed:', error.message);
            return 0.5;
        }
    }

    // **FIXED: Helper method untuk document count**
    getDocumentCount(category) {
        if (!this.classifier) return 0;

        try {
            const state = this.classifier.toJson();
            const parsed = JSON.parse(state);
            return parsed.categories?.[category]?.docCount || 0;
        } catch (error) {
            return 0;
        }
    }

    // **FIXED: Training dengan async/await**
    async trainWithAccountingData() {
        if (!this.classifier) {
            await this.initializeNewClassifier();
        }

        const trainingData = [
            // Assets
            { text: "setor tunai bank", category: "cash_bank" },
            { text: "transfer masuk", category: "cash_bank" },
            { text: "penerimaan pembayaran", category: "cash_bank" },
            { text: "deposit bank", category: "cash_bank" },

            // Expenses
            { text: "bayar listrik pln", category: "utilities" },
            { text: "pembayaran air pdam", category: "utilities" },
            { text: "tagihan internet", category: "utilities" },
            { text: "pulsa hp", category: "utilities" },

            { text: "beli alat tulis", category: "office_supplies" },
            { text: "pembelian kertas", category: "office_supplies" },
            { text: "beli printer", category: "office_supplies" },

            { text: "gaji karyawan", category: "salary_expense" },
            { text: "upah kerja", category: "salary_expense" },
            { text: "bonus pegawai", category: "salary_expense" },

            { text: "sewa kantor", category: "rent_expense" },
            { text: "bayar kontrakan", category: "rent_expense" },

            { text: "biaya transportasi", category: "transportation" },
            { text: "bensin mobil", category: "transportation" },
            { text: "parkir kendaraan", category: "transportation" },

            // Revenues
            { text: "penjualan produk", category: "sales_revenue" },
            { text: "hasil jualan", category: "sales_revenue" },
            { text: "invoice customer", category: "sales_revenue" },

            { text: "pendapatan jasa", category: "service_revenue" },
            { text: "fee konsultan", category: "service_revenue" },

            // Liability
            { text: "pinjaman bank", category: "bank_loan" },
            { text: "hutang usaha", category: "accounts_payable" }
        ];

        console.log(`🎯 Training account classifier with ${trainingData.length} samples...`);

        // **FIXED: Gunakan for loop untuk async operations**
        for (const item of trainingData) {
            try {
                await this.classifier.learn(item.text.toLowerCase(), item.category);
            } catch (error) {
                console.log(`⚠️ Failed to learn: ${item.text} → ${item.category}`, error.message);
            }
        }

        this.isTrained = true;
        const saveResult = await this.saveModel();

        if (saveResult) {
            console.log(`✅ Training completed. Categories: ${this.getCategories().join(', ')}`);
        } else {
            console.log('❌ Training completed but failed to save model');
        }

        return this.isTrained;
    }

    // **FIXED: Prediksi dengan async/await yang benar**
    async predictAccount(description, transactionType) {
        if (!this.classifier || !this.isTrained) {
            console.log('🔄 Model not trained, training now...');
            await this.trainWithAccountingData();
        }

        const inputText = `${description} ${transactionType}`.toLowerCase();

        try {
            // **FIXED: classifier.categorize() adalah async function**
            const predictedCategory = await this.classifier.categorize(inputText);

            const confidence = this.calculateConfidence(inputText, predictedCategory);

            console.log(`🔮 Prediction: '${inputText}' → '${predictedCategory}' (confidence: ${confidence.toFixed(2)})`);

            return {
                category: predictedCategory,
                confidence: parseFloat(confidence.toFixed(4)),
                inputText: inputText
            };
        } catch (error) {
            console.error('❌ Prediction failed:', error.message);

            // Fallback prediction
            return {
                category: "uncategorized",
                confidence: 0.1,
                inputText: inputText,
                error: error.message
            };
        }
    }

    // **FIXED: Learning dari koreksi user dengan async/await**
    async learnFromCorrection(description, transactionType, correctCategory) {
        if (!this.classifier) {
            await this.initializeNewClassifier();
        }

        const inputText = `${description} ${transactionType}`.toLowerCase();

        try {
            await this.classifier.learn(inputText, correctCategory);
            await this.saveModel();
            console.log(`📚 Model updated: '${inputText}' → '${correctCategory}'`);
            return true;
        } catch (error) {
            console.error('❌ Failed to learn from correction:', error.message);
            return false;
        }
    }

    // **NEW: Get model status**
    getModelStatus() {
        return {
            isTrained: this.isTrained,
            categories: this.getCategories(),
            totalCategories: this.getCategories().length,
            modelPath: this.modelPath,
            modelExists: fs.existsSync(this.modelPath)
        };
    }
}

module.exports = new AccountClassifier();