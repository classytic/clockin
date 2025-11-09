/**
 * Basic Usage Example for @classytic/clockin
 *
 * This example demonstrates how to import and use the ClockIn library
 * Run this file: node test/examples/basic-usage.js
 */

// Import enums and constants
import {
  ATTENDANCE_STATUS,
  CHECK_IN_METHOD,
  ENGAGEMENT_LEVEL,
  ATTENDANCE_TYPE,
  TIME_SLOT,
  ATTENDANCE_PERIOD,
} from '../../src/index.js';

// Import utilities
import {
  calculateStreak,
  calculateEngagementLevel,
  calculateAttendanceStats,
  validateCheckInEligibility,
  isActiveCheckIn,
  calculateDuration,
  getTimeSlot,
  calculateStandardHours,
  detectAttendanceType,
} from '../../src/index.js';

console.log('✅ @classytic/clockin library loaded successfully!\n');

// Example 1: Check enums
console.log('📋 Attendance Status:');
console.log('- Active:', ATTENDANCE_STATUS.ACTIVE);
console.log('- Inactive:', ATTENDANCE_STATUS.INACTIVE);
console.log('- Expired:', ATTENDANCE_STATUS.EXPIRED);

console.log('\n🔑 Check-In Methods:');
console.log('- Manual:', CHECK_IN_METHOD.MANUAL);
console.log('- QR Code:', CHECK_IN_METHOD.QR);
console.log('- NFC:', CHECK_IN_METHOD.NFC);
console.log('- Biometric:', CHECK_IN_METHOD.BIOMETRIC);

console.log('\n📊 Engagement Levels:');
console.log('- Active:', ENGAGEMENT_LEVEL.ACTIVE);
console.log('- At Risk:', ENGAGEMENT_LEVEL.AT_RISK);
console.log('- Inactive:', ENGAGEMENT_LEVEL.INACTIVE);
console.log('- Churned:', ENGAGEMENT_LEVEL.CHURNED);

console.log('\n⏰ Time Slots:');
console.log('- Early Morning:', TIME_SLOT.EARLY_MORNING);
console.log('- Morning:', TIME_SLOT.MORNING);
console.log('- Afternoon:', TIME_SLOT.AFTERNOON);
console.log('- Evening:', TIME_SLOT.EVENING);
console.log('- Night:', TIME_SLOT.NIGHT);

console.log('\n📅 Attendance Types:');
console.log('- Full Day:', ATTENDANCE_TYPE.FULL_DAY);
console.log('- Half Day:', ATTENDANCE_TYPE.HALF_DAY);
console.log('- Paid Leave:', ATTENDANCE_TYPE.PAID_LEAVE);
console.log('- Overtime:', ATTENDANCE_TYPE.OVERTIME);

// Example 2: Calculate engagement level
console.log('\n🎯 Engagement Calculation:');
const daysSinceLastVisit = 5;
const engagementLevel = calculateEngagementLevel(daysSinceLastVisit);
console.log(`- Days since last visit: ${daysSinceLastVisit}`);
console.log(`- Engagement Level: ${engagementLevel}`);

const atRiskDays = 15;
const atRiskLevel = calculateEngagementLevel(atRiskDays);
console.log(`\n- Days since last visit: ${atRiskDays}`);
console.log(`- Engagement Level: ${atRiskLevel}`);

// Example 3: Calculate streak
console.log('\n🔥 Streak Calculation:');
const checkIns = [
  { date: new Date('2025-01-10'), type: 'full_day' },
  { date: new Date('2025-01-09'), type: 'full_day' },
  { date: new Date('2025-01-08'), type: 'full_day' },
  { date: new Date('2025-01-07'), type: 'full_day' },
  { date: new Date('2025-01-06'), type: 'full_day' },
];
const currentStreak = calculateStreak(checkIns);
console.log('- Recent check-ins:', checkIns.length);
console.log('- Current Streak:', currentStreak, 'days');

// Example 4: Time slot detection
console.log('\n⏰ Time Slot Detection:');
const earlyMorning = getTimeSlot(6);
const morning = getTimeSlot(9);
const afternoon = getTimeSlot(14);
const evening = getTimeSlot(18);
console.log('- 6:00 AM →', earlyMorning);
console.log('- 9:00 AM →', morning);
console.log('- 2:00 PM →', afternoon);
console.log('- 6:00 PM →', evening);

// Example 5: Schedule utilities
console.log('\n📋 Schedule Utilities:');
const workSchedule = {
  monday: { start: '09:00', end: '18:00' },
  tuesday: { start: '09:00', end: '18:00' },
  wednesday: { start: '09:00', end: '18:00' },
  thursday: { start: '09:00', end: '18:00' },
  friday: { start: '09:00', end: '18:00' },
};
const standardHours = calculateStandardHours(workSchedule);
console.log('- Work Days: Monday-Friday');
console.log('- Hours per day: 9:00 AM - 6:00 PM');
console.log('- Standard Hours:', standardHours, 'hours/day');

// Example 6: Attendance stats
console.log('\n📊 Attendance Stats:');
const memberCheckIns = [
  { date: new Date('2025-01-10'), type: 'full_day' },
  { date: new Date('2025-01-09'), type: 'full_day' },
  { date: new Date('2025-01-08'), type: 'half_day' },
  { date: new Date('2025-01-07'), type: 'full_day' },
  { date: new Date('2025-01-06'), type: 'full_day' },
  { date: new Date('2025-01-05'), type: 'full_day' },
];
const stats = calculateAttendanceStats(memberCheckIns);
console.log('- Total Check-ins:', stats.totalCheckIns);
console.log('- Current Streak:', stats.currentStreak);
console.log('- Longest Streak:', stats.longestStreak);
console.log('- Engagement Level:', stats.engagementLevel);

// Example 7: Check-in validation
console.log('\n✅ Check-In Validation:');
const activeMember = {
  status: 'active',
  attendanceEnabled: true,
};
const inactiveMember = {
  status: 'inactive',
  attendanceEnabled: false,
};
console.log('- Active member eligible:', validateCheckInEligibility(activeMember));
console.log('- Inactive member eligible:', validateCheckInEligibility(inactiveMember));

// Example 8: Active check-in detection
console.log('\n🟢 Active Session Detection:');
const activeSession = {
  date: new Date(),
  checkOutTime: null,
  type: 'full_day',
};
const completedSession = {
  date: new Date('2025-01-10T09:00:00'),
  checkOutTime: new Date('2025-01-10T18:00:00'),
  type: 'full_day',
};
console.log('- Session without checkout:', isActiveCheckIn(activeSession));
console.log('- Completed session:', isActiveCheckIn(completedSession));

// Example 9: Duration calculation
console.log('\n⏱️  Duration Calculation:');
const checkIn = { date: new Date('2025-01-10T09:00:00') };
const checkOut = { checkOutTime: new Date('2025-01-10T18:00:00') };
const duration = calculateDuration(checkIn, checkOut);
console.log('- Check-in: 9:00 AM');
console.log('- Check-out: 6:00 PM');
console.log('- Duration:', duration, 'hours');

console.log('\n✨ Library is working! You can now use these in your app.\n');

// Example 10: Import examples
console.log('📝 How to use in your project:');
console.log(`
// 1. Install the package
npm install @classytic/clockin

// 2. Import what you need
import {
  initializeAttendance,
  attendance,
  ATTENDANCE_STATUS,
  CHECK_IN_METHOD,
  calculateEngagementLevel,
  attendanceEvents,
} from '@classytic/clockin';

// 3. Initialize with your models
import AttendanceModel from './models/attendance.model.js';

initializeAttendance({
  AttendanceModel: AttendanceModel,
});

// 4. Use the attendance API
await attendance.checkIn({
  member,
  targetModel: 'Membership',
  data: { method: 'qr_code' },
  context: { organizationId },
});

const dashboard = await attendance.dashboard({
  MemberModel: Membership,
  organizationId,
});
`);

console.log('🎉 Test completed successfully!');
