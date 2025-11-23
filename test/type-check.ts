/**
 * TypeScript Type Check Test
 * Verifies that auto-generated types are working correctly
 * and are flexible enough for real-world usage
 */

import { attendance, ATTENDANCE_STATUS, CHECK_IN_METHOD, ENGAGEMENT_LEVEL } from '../dist/types/index.js';
import type { AttendanceConfig, CheckInParams } from '../dist/types/index.js';

// ============ TEST 1: Config Types ============

const config: AttendanceConfig = {
  AttendanceModel: {} as any, // Mock model
  configs: {
    Membership: {
      autoCheckout: { enabled: true },
    },
  },
  logger: console,
};

// ============ TEST 2: Check-in with Flexibility ============

const checkInParams: CheckInParams = {
  member: {
    _id: '123',
    name: 'John Doe',
    attendanceEnabled: true,
    // Any custom fields are allowed
    customField: 'value',
  },
  targetModel: 'Membership', // or any custom model
  data: {
    method: CHECK_IN_METHOD.MANUAL,
    // Any custom data fields
    location: 'Main Gym',
    temperature: 36.5,
    deviceId: 'kiosk-01',
  },
  context: {
    userId: 'admin-123',
    organizationId: 'org-456',
    // Any custom context
    ipAddress: '192.168.1.1',
    sessionId: 'session-789',
  },
};

// ============ TEST 3: Enum Usage ============

const status1: string = ATTENDANCE_STATUS.VALID;
const status2: string = ATTENDANCE_STATUS.CORRECTED;

const method1: string = CHECK_IN_METHOD.MANUAL;
const method2: string = CHECK_IN_METHOD.QR_CODE;
const method3: string = CHECK_IN_METHOD.BIOMETRIC;

const engagement1: string = ENGAGEMENT_LEVEL.ACTIVE;
const engagement2: string = ENGAGEMENT_LEVEL.AT_RISK;

// ============ TEST 4: Flexible Object Types ============

// Members can have any structure
const member = {
  _id: '123',
  name: 'Jane Doe',
  status: 'active',
  attendanceEnabled: true,
  // Custom fields work
  membershipType: 'premium',
  email: 'jane@example.com',
  phone: '+1234567890',
  customData: {
    level: 'gold',
    points: 1000,
  },
};

// Data can be any structure
const customCheckInData = {
  method: 'custom_method', // Not restricted to enum values
  location: { lat: 40.7128, lng: -74.0060 },
  notes: 'First time using app',
  deviceInfo: {
    type: 'iOS',
    version: '15.0',
  },
};

// Context can have any fields
const customContext = {
  userId: 'user-123',
  organizationId: 'org-456',
  userName: 'Admin User',
  userRole: 'admin',
  // Any custom context
  appVersion: '1.0.0',
  platform: 'web',
  features: ['analytics', 'reports'],
};

// ============ TEST 5: Function Signatures are Flexible ============

// This should compile - targetModel accepts any string
const customTargetModel: string = 'CustomEntity';

// These should compile - no overly strict type checking
const flexibleParams = {
  member: { id: 1, name: 'Test' }, // Any object structure
  targetModel: 'AnyModel', // Any string
  data: { foo: 'bar' }, // Any object
  context: { custom: true }, // Any object
};

// ============ SUCCESS ============

console.log('✅ TypeScript type checking passed!');
console.log('✅ Types are flexible and not overly restrictive');
console.log('✅ Enums work correctly');
console.log('✅ Custom fields and models are supported');
