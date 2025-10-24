const AccountClassifier = require('./services/AccountClassifier');

async function testClassifier() {
    console.log('🧪 Testing Account Classifier...');

    // Test 1: Get model status
    console.log('1. Model Status:', AccountClassifier.getModelStatus());

    // Test 2: Train model
    console.log('2. Training model...');
    await AccountClassifier.trainWithAccountingData();

    // Test 3: Test prediction
    console.log('3. Testing prediction...');
    const result = await AccountClassifier.predictAccount('bayar listrik pln', 'expense');
    console.log('Prediction Result:', result);

    // Test 4: Test dengan deskripsi lain
    const result2 = await AccountClassifier.predictAccount('gaji karyawan', 'expense');
    console.log('Prediction Result 2:', result2);
}

testClassifier().catch(console.error);