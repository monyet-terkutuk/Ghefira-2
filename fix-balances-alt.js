// fix-balances-alt.js - Menggunakan koneksi yang sama dengan app
const app = require('./app'); // Import app untuk mendapatkan koneksi
const Account = require('./model/Account');
const JournalEntry = require('./model/JournalEntry');

async function fixBalances() {
    try {
        // Tunggu koneksi database ready (jika app sudah running)
        const mongoose = require('mongoose');

        if (mongoose.connection.readyState !== 1) {
            console.log('🔄 Waiting for database connection...');
            await new Promise(resolve => {
                mongoose.connection.on('connected', resolve);
            });
        }

        console.log('✅ Database connected');

        const userId = '6884ba24a6a6615113b7a4a5';

        // ... rest of the fixBalances function code ...

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Jika dijalankan langsung
if (require.main === module) {
    // Jalankan app.js dulu untuk setup connection, lalu run fixBalances
    const app = require('./app');
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, async () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log('🔄 Running balance fix...');
        await fixBalances();
        console.log('✅ Balance fix completed');
    });
} else {
    module.exports = fixBalances;
}