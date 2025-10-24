const Account = require('../model/Account');

class AccountMappingService {
    constructor() {
        this.accountMappings = {
            // Asset Accounts
            cash_bank: {
                income: '101', // Cash - Debit
                expense: '101' // Cash - Credit
            },

            // Expense Accounts
            utilities: {
                expense: '501', // Utilities Expense
                income: null
            },
            office_supplies: {
                expense: '502', // Office Supplies Expense
                income: null
            },
            salary_expense: {
                expense: '503', // Salary Expense
                income: null
            },
            rent_expense: {
                expense: '504', // Rent Expense
                income: null
            },
            transportation: {
                expense: '505', // Transportation Expense
                income: null
            },

            // Revenue Accounts - ✅ PERBAIKAN: Tambah alternative formats
            sales_revenue: {
                income: '401', // Sales Revenue
                expense: null
            },
            'sales revenue': { // ✅ dengan space
                income: '401',
                expense: null
            },
            sales: { // ✅ shortened
                income: '401',
                expense: null
            },
            service_revenue: {
                income: '402', // Service Revenue
                expense: null
            },
            'service revenue': { // ✅ dengan space
                income: '402',
                expense: null
            },
            service: { // ✅ shortened
                income: '402',
                expense: null
            },

            // Liability Accounts
            bank_loan: {
                income: '201', // Bank Loan (meningkat saat menerima pinjaman)
                expense: '201' // Bank Loan (berkurang saat bayar)
            },
            accounts_payable: {
                income: '202', // Accounts Payable
                expense: '202'
            },

            // ✅ NEW: Tambah uncategorized sebagai fallback
            uncategorized: {
                income: '401', // Fallback ke Sales Revenue
                expense: '506' // Fallback ke Uncategorized Expense
            }
        };
    }

    async initializeDefaultAccounts(userId) {
        const defaultAccounts = [
            // Assets (Normal Balance: Debit)
            { code: '101', name: 'Cash and Bank', type: 'asset', normal_balance: 'debit' },
            { code: '102', name: 'Accounts Receivable', type: 'asset', normal_balance: 'debit' },

            // Liabilities (Normal Balance: Credit)
            { code: '201', name: 'Bank Loan', type: 'liability', normal_balance: 'credit' },
            { code: '202', name: 'Accounts Payable', type: 'liability', normal_balance: 'credit' },

            // Equity (Normal Balance: Credit)
            { code: '301', name: 'Owner Equity', type: 'equity', normal_balance: 'credit' },
            { code: '302', name: 'Retained Earnings', type: 'equity', normal_balance: 'credit' },

            // Revenue (Normal Balance: Credit)
            { code: '401', name: 'Sales Revenue', type: 'revenue', normal_balance: 'credit' },
            { code: '402', name: 'Service Revenue', type: 'revenue', normal_balance: 'credit' },

            // Expenses (Normal Balance: Debit)
            { code: '501', name: 'Utilities Expense', type: 'expense', normal_balance: 'debit' },
            { code: '502', name: 'Office Supplies Expense', type: 'expense', normal_balance: 'debit' },
            { code: '503', name: 'Salary Expense', type: 'expense', normal_balance: 'debit' },
            { code: '504', name: 'Rent Expense', type: 'expense', normal_balance: 'debit' },
            { code: '505', name: 'Transportation Expense', type: 'expense', normal_balance: 'debit' },
            { code: '506', name: 'Uncategorized Expense', type: 'expense', normal_balance: 'debit' }
        ];

        for (const acc of defaultAccounts) {
            const existing = await Account.findOne({ code: acc.code, user: userId });
            if (!existing) {
                await Account.create({ ...acc, user: userId, balance: 0 });
            }
        }

        console.log(`✅ Default accounts initialized for user ${userId}`);
    }

    // ✅ NEW: Method untuk normalize category names
    normalizeCategory(category) {
        if (!category) return 'uncategorized';

        const normalized = category
            .toLowerCase()
            .replace(/\s+/g, '_') // ganti space dengan underscore
            .replace(/[^a-z0-9_]/g, ''); // hapus karakter khusus

        console.log(`🔄 Normalized category: "${category}" → "${normalized}"`);
        return normalized;
    }

    async mapPredictionToAccounts(prediction, transactionType, amount, userId) {
        console.log(`🔍 Mapping prediction: "${prediction.category}" with type: ${transactionType}`);

        // ✅ PERBAIKAN: Normalize category name dulu
        const normalizedCategory = this.normalizeCategory(prediction.category);

        // Cari mapping dengan urutan: normalized → original → fallback
        let mapping = this.accountMappings[normalizedCategory] ||
            this.accountMappings[prediction.category];

        // ✅ PERBAIKAN: Better error handling dengan logging
        if (!mapping) {
            console.log(`❌ No mapping found for category: "${prediction.category}" (normalized: "${normalizedCategory}")`);
            console.log(`📋 Available categories: ${Object.keys(this.accountMappings).join(', ')}`);
            // Fallback ke akun uncategorized
            return await this.getUncategorizedAccounts(transactionType, userId);
        }

        const accountCode = mapping[transactionType];
        if (!accountCode) {
            console.log(`❌ No mapping for "${prediction.category}" with type "${transactionType}"`);
            throw new Error(`No account mapping for ${prediction.category} with type ${transactionType}`);
        }

        console.log(`✅ Found mapping: ${prediction.category} → ${accountCode}`);

        const account = await Account.findOne({ code: accountCode, user: userId });
        if (!account) {
            throw new Error(`Account not found for code ${accountCode}`);
        }

        // Tentukan debit/credit berdasarkan account type dan transaction type
        if (transactionType === 'income') {
            const cashAccount = await Account.findOne({ code: '101', user: userId });
            return {
                debitAccount: cashAccount, // Cash
                creditAccount: account
            };
        } else { // expense
            const cashAccount = await Account.findOne({ code: '101', user: userId });
            return {
                debitAccount: account,
                creditAccount: cashAccount // Cash
            };
        }
    }

    async getUncategorizedAccounts(transactionType, userId) {
        console.log(`🔄 Using fallback uncategorized accounts for ${transactionType}`);

        const cashAccount = await Account.findOne({ code: '101', user: userId });

        if (transactionType === 'income') {
            // Untuk income, fallback ke Sales Revenue (401)
            const revenueAccount = await Account.findOne({ code: '401', user: userId });
            return {
                debitAccount: cashAccount,
                creditAccount: revenueAccount || await this.createFallbackAccount('401', 'Sales Revenue', 'revenue', userId)
            };
        } else {
            // Untuk expense, fallback ke Uncategorized Expense (506)
            const expenseAccount = await Account.findOne({ code: '506', user: userId });
            return {
                debitAccount: expenseAccount || await this.createFallbackAccount('506', 'Uncategorized Expense', 'expense', userId),
                creditAccount: cashAccount
            };
        }
    }

    // ✅ NEW: Method untuk create fallback account jika tidak ada
    async createFallbackAccount(code, name, type, userId) {
        console.log(`📝 Creating fallback account: ${code} - ${name}`);
        const account = await Account.create({
            code: code,
            name: name,
            type: type,
            normal_balance: type === 'revenue' ? 'credit' : 'debit',
            user: userId,
            balance: 0
        });
        return account;
    }

    // ✅ NEW: Method untuk set initial owner equity
    async setInitialOwnerEquity(userId, initialCapital = 1000000) {
        const ownerEquity = await Account.findOne({ code: '301', user: userId });
        if (ownerEquity) {
            ownerEquity.balance = initialCapital;
            await ownerEquity.save();
            console.log(`✅ Owner Equity set to initial capital: ${initialCapital}`);
        }
    }

    // ✅ NEW: Method untuk debug available mappings
    debugMappings() {
        console.log('📋 Available Account Mappings:');
        Object.keys(this.accountMappings).forEach(category => {
            console.log(`   ${category}:`, this.accountMappings[category]);
        });
    }
}

module.exports = new AccountMappingService();