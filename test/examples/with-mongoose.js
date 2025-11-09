/**
 * Mongoose Integration Example for @classytic/clockin
 *
 * This example demonstrates how to use ClockIn schemas with Mongoose models
 * Run this file: node test/examples/with-mongoose.js
 */

// Import schema components
import {
  checkInEntrySchema,
  attendanceStatsSchema,
  monthlyAttendanceSummarySchema,
  commonAttendanceFields,
  attendanceIndexes,
  applyAttendanceIndexes,
} from '../../src/index.js';

// Import enums for schema validation
import {
  ATTENDANCE_STATUS,
  CHECK_IN_METHOD,
  ENGAGEMENT_LEVEL,
  ATTENDANCE_TYPE,
  TIME_SLOT,
  ATTENDANCE_TARGET_MODEL_VALUES,
} from '../../src/index.js';

console.log('✅ @classytic/clockin Mongoose integration loaded!\n');

// Example 1: Check-in Entry Schema
console.log('📋 Check-In Entry Schema:');
console.log('Schema fields:', Object.keys(checkInEntrySchema.obj));
console.log('- date: Date (required)');
console.log('- checkOutTime: Date (optional)');
console.log('- type: String (enum)');
console.log('- method: String (enum)');
console.log('- location: String');
console.log('- notes: String');

// Example 2: Attendance Stats Schema
console.log('\n📊 Attendance Stats Schema:');
console.log('Schema fields:', Object.keys(attendanceStatsSchema.obj));
console.log('- totalVisits: Number');
console.log('- lastVisitedAt: Date');
console.log('- currentStreak: Number');
console.log('- longestStreak: Number');
console.log('- engagementLevel: String');
console.log('- loyaltyScore: Number');

// Example 3: Common Attendance Fields
console.log('\n🔧 Common Attendance Fields:');
console.log('Fields you can add to your models:');
const commonFieldKeys = Object.keys(commonAttendanceFields);
console.log(`- ${commonFieldKeys.length} common fields available`);
console.log('- tenantId (Organization ID)');
console.log('- targetModel (Membership/Employee/User)');
console.log('- targetId (Reference to member)');
console.log('- year, month (Time period)');
console.log('- checkIns (Array of check-in entries)');

// Example 4: Monthly Summary Schema
console.log('\n📅 Monthly Summary Schema:');
console.log('Schema fields:', Object.keys(monthlyAttendanceSummarySchema.obj));
console.log('- monthlyTotal: Number');
console.log('- uniqueDaysVisited: Number');
console.log('- fullDaysCount: Number');
console.log('- halfDaysCount: Number');
console.log('- totalWorkDays: Number');

// Example 5: Indexes
console.log('\n🔍 Attendance Indexes:');
console.log('Recommended indexes for performance:');
console.log('- Unique: { tenantId, targetId, year, month }');
console.log('- Query: { tenantId, year, month }');
console.log('- Reference: { targetModel, targetId, year, month }');

// Example 6: How to use in your Mongoose model
console.log('\n📝 How to integrate with your Mongoose models:\n');

const integrationExample = `
import mongoose from 'mongoose';
import {
  checkInEntrySchema,
  attendanceStatsSchema,
  commonAttendanceFields,
  applyAttendanceIndexes,
} from '@classytic/clockin';

const { Schema } = mongoose;

// Example 1: Create custom Attendance model
const customAttendanceSchema = new Schema({
  // Use common fields from library
  ...commonAttendanceFields,

  // Add your custom fields
  facilityId: { type: Schema.Types.ObjectId, ref: 'Facility' },
  customNote: String,
}, { timestamps: true });

// Apply library indexes
applyAttendanceIndexes(customAttendanceSchema);

const CustomAttendance = mongoose.model('CustomAttendance', customAttendanceSchema);

// Example 2: Add attendance stats to Member model
const membershipSchema = new Schema({
  // Member info
  customer: {
    name: String,
    email: String,
    phone: String,
  },

  // Add attendance stats from library
  attendanceStats: attendanceStatsSchema,

  // Other member fields
  status: String,
  plan: String,
}, { timestamps: true });

const Membership = mongoose.model('Membership', membershipSchema);

// Example 3: Add attendance stats to Employee model
const employeeSchema = new Schema({
  // Employee info
  firstName: String,
  lastName: String,
  email: String,

  // Add attendance stats
  attendanceStats: attendanceStatsSchema,

  // Employment info
  department: String,
  position: String,
}, { timestamps: true });

const Employee = mongoose.model('Employee', employeeSchema);
`;

console.log(integrationExample);

console.log('\n✨ Schema integration examples ready!\n');

// Example 7: Show enum values for validation
console.log('📋 Enum Values for Schema Validation:\n');

console.log('Target Models (for targetModel field):');
console.log(ATTENDANCE_TARGET_MODEL_VALUES);

console.log('\nAttendance Status:');
console.log(Object.values(ATTENDANCE_STATUS));

console.log('\nCheck-In Methods:');
console.log(Object.values(CHECK_IN_METHOD));

console.log('\nEngagement Levels:');
console.log(Object.values(ENGAGEMENT_LEVEL));

console.log('\nAttendance Types:');
console.log(Object.values(ATTENDANCE_TYPE));

console.log('\nTime Slots:');
console.log(Object.values(TIME_SLOT));

console.log('\n🎉 Mongoose integration test completed successfully!');
