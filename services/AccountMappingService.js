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

            // Revenue Accounts
            sales_revenue: {
                income: '401', // Sales Revenue
                expense: null
            },
            service_revenue: {
                income: '402', // Service Revenue
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

    async mapPredictionToAccounts(prediction, transactionType, amount, userId) {
        const mapping = this.accountMappings[prediction.category];

        if (!mapping) {
            // Fallback ke akun uncategorized
            return await this.getUncategorizedAccounts(transactionType, userId);
        }

        const accountCode = mapping[transactionType];
        if (!accountCode) {
            throw new Error(`No account mapping for ${prediction.category} with type ${transactionType}`);
        }

        const account = await Account.findOne({ code: accountCode, user: userId });
        if (!account) {
            throw new Error(`Account not found for code ${accountCode}`);
        }

        // Tentukan debit/credit berdasarkan account type dan transaction type
        if (transactionType === 'income') {
            return {
                debitAccount: await Account.findOne({ code: '101', user: userId }), // Cash
                creditAccount: account
            };
        } else { // expense
            return {
                debitAccount: account,
                creditAccount: await Account.findOne({ code: '101', user: userId }) // Cash
            };
        }
    }

    async getUncategorizedAccounts(transactionType, userId) {
        const cashAccount = await Account.findOne({ code: '101', user: userId });
        const uncategorizedAccount = await Account.findOne({ code: '506', user: userId });

        if (transactionType === 'income') {
            return {
                debitAccount: cashAccount,
                creditAccount: uncategorizedAccount
            };
        } else {
            return {
                debitAccount: uncategorizedAccount,
                creditAccount: cashAccount
            };
        }
    }
}

module.exports = new AccountMappingService();