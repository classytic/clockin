/**
 * Test for currentSession validation hook
 * Tests the schema validation to ensure Mongoose v9 compatibility
 */

import mongoose from 'mongoose';
import { currentSessionSchema } from '../src/schemas/attendance.schema.js';
import { CHECK_IN_METHOD } from '../src/enums.js';

// Create a test model using currentSessionSchema
const TestSchema = new mongoose.Schema({
  name: String,
  currentSession: {
    type: currentSessionSchema,
    default: () => ({ isActive: false }),
  },
});

const TestModel = mongoose.model('CurrentSessionTest', TestSchema);

async function runTests() {
  console.log('🧪 Testing currentSession validation hook...\n');

  try {
    // Connect to MongoDB (or use in-memory for testing)
    await mongoose.connect('mongodb://localhost:27017/clockin-test', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.log('⚠️  MongoDB not available, using in-memory validation\n');
  }

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Valid inactive session (all nulls)
  try {
    const doc1 = new TestModel({
      name: 'Test 1',
      currentSession: {
        isActive: false,
        checkInId: null,
        checkInTime: null,
        method: null,
      },
    });
    await doc1.validate();
    console.log('✅ Test 1 PASSED: Inactive session with null fields is valid');
    testsPassed++;
  } catch (error) {
    console.log('❌ Test 1 FAILED:', error.message);
    testsFailed++;
  }

  // Test 2: Valid active session (all required fields present)
  try {
    const doc2 = new TestModel({
      name: 'Test 2',
      currentSession: {
        isActive: true,
        checkInId: new mongoose.Types.ObjectId(),
        checkInTime: new Date(),
        method: CHECK_IN_METHOD.QR,
      },
    });
    await doc2.validate();
    console.log('✅ Test 2 PASSED: Active session with all required fields is valid');
    testsPassed++;
  } catch (error) {
    console.log('❌ Test 2 FAILED:', error.message);
    testsFailed++;
  }

  // Test 3: Invalid - Active session without checkInId
  try {
    const doc3 = new TestModel({
      name: 'Test 3',
      currentSession: {
        isActive: true,
        checkInId: null,
        checkInTime: new Date(),
        method: CHECK_IN_METHOD.QR,
      },
    });
    doc3.currentSession.markModified('isActive'); // Force subdocument validation
    await doc3.validate();
    console.log('❌ Test 3 FAILED: Should have thrown error for missing checkInId');
    testsFailed++;
  } catch (error) {
    if (error.message.includes('checkInId')) {
      console.log('✅ Test 3 PASSED: Correctly rejected active session without checkInId');
      testsPassed++;
    } else {
      console.log('❌ Test 3 FAILED: Wrong error:', error.message);
      testsFailed++;
    }
  }

  // Test 4: Invalid - Active session without checkInTime
  try {
    const doc4 = new TestModel({
      name: 'Test 4',
      currentSession: {
        isActive: true,
        checkInId: new mongoose.Types.ObjectId(),
        checkInTime: null,
        method: CHECK_IN_METHOD.QR,
      },
    });
    await doc4.validate();
    console.log('❌ Test 4 FAILED: Should have thrown error for missing checkInTime');
    testsFailed++;
  } catch (error) {
    if (error.message.includes('checkInTime')) {
      console.log('✅ Test 4 PASSED: Correctly rejected active session without checkInTime');
      testsPassed++;
    } else {
      console.log('❌ Test 4 FAILED: Wrong error:', error.message);
      testsFailed++;
    }
  }

  // Test 5: Invalid - Active session without method
  try {
    const doc5 = new TestModel({
      name: 'Test 5',
      currentSession: {
        isActive: true,
        checkInId: new mongoose.Types.ObjectId(),
        checkInTime: new Date(),
        method: null,
      },
    });
    await doc5.validate();
    console.log('❌ Test 5 FAILED: Should have thrown error for missing method');
    testsFailed++;
  } catch (error) {
    if (error.message.includes('method')) {
      console.log('✅ Test 5 PASSED: Correctly rejected active session without method');
      testsPassed++;
    } else {
      console.log('❌ Test 5 FAILED: Wrong error:', error.message);
      testsFailed++;
    }
  }

  // Test 6: Invalid - Inactive session with checkInId
  try {
    const doc6 = new TestModel({
      name: 'Test 6',
      currentSession: {
        isActive: false,
        checkInId: new mongoose.Types.ObjectId(),
        checkInTime: null,
        method: null,
      },
    });
    await doc6.validate();
    console.log('❌ Test 6 FAILED: Should have thrown error for checkInId on inactive session');
    testsFailed++;
  } catch (error) {
    if (error.message.includes('null checkInId')) {
      console.log('✅ Test 6 PASSED: Correctly rejected inactive session with checkInId');
      testsPassed++;
    } else {
      console.log('❌ Test 6 FAILED: Wrong error:', error.message);
      testsFailed++;
    }
  }

  // Test 7: Invalid - Inactive session with checkInTime
  try {
    const doc7 = new TestModel({
      name: 'Test 7',
      currentSession: {
        isActive: false,
        checkInId: null,
        checkInTime: new Date(),
        method: null,
      },
    });
    await doc7.validate();
    console.log('❌ Test 7 FAILED: Should have thrown error for checkInTime on inactive session');
    testsFailed++;
  } catch (error) {
    if (error.message.includes('null checkInTime')) {
      console.log('✅ Test 7 PASSED: Correctly rejected inactive session with checkInTime');
      testsPassed++;
    } else {
      console.log('❌ Test 7 FAILED: Wrong error:', error.message);
      testsFailed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('='.repeat(50));

  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
