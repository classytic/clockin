/**
 * Full Workflow Example for @classytic/clockin
 *
 * This example demonstrates a complete end-to-end attendance workflow
 * Run this file: node test/examples/full-workflow.js
 */

// Import main API
import {
  attendance,
  attendanceEvents,
  initializeAttendance,
  isInitialized,
} from '../../src/index.js';

// Import enums
import {
  CHECK_IN_METHOD,
  ENGAGEMENT_LEVEL,
  ATTENDANCE_TYPE,
} from '../../src/index.js';

// Import utilities
import {
  calculateEngagementLevel,
  calculateStreak,
  getTimeSlot,
} from '../../src/index.js';

console.log('🎯 @classytic/clockin - Full Workflow Example\n');

// Mock Mongoose model for demonstration
const mockAttendanceModel = {
  findOne: async () => null,
  create: async (data) => ({ _id: 'mock-id', ...data }),
  findOneAndUpdate: async (query, update) => update,
  find: async () => [],
};

// Step 1: Initialize the library
console.log('📦 Step 1: Initialize ClockIn Library');
console.log('----------------------------------------');

initializeAttendance({
  AttendanceModel: mockAttendanceModel,
});

console.log('✅ Library initialized:', isInitialized());
console.log();

// Step 2: Set up event listeners
console.log('🔔 Step 2: Set Up Event Listeners');
console.log('----------------------------------------');

attendanceEvents.on('checkIn:recorded', ({ member, stats }) => {
  console.log('📨 Event: Check-in recorded');
  console.log(`   Member: ${member?.customer?.name || 'Unknown'}`);
  console.log(`   Total visits: ${stats?.totalVisits || 0}`);
});

attendanceEvents.on('milestone:achieved', ({ member, milestone }) => {
  console.log('🎉 Event: Milestone achieved!');
  console.log(`   Member: ${member?.customer?.name || 'Unknown'}`);
  console.log(`   Milestone: ${milestone?.type} - ${milestone?.value}`);
});

attendanceEvents.on('engagement:changed', ({ member, from, to }) => {
  console.log('📊 Event: Engagement level changed');
  console.log(`   Member: ${member?.customer?.name || 'Unknown'}`);
  console.log(`   From: ${from} → To: ${to}`);
});

console.log('✅ Event listeners registered');
console.log();

// Step 3: Simulate a member check-in
console.log('👤 Step 3: Member Check-In');
console.log('----------------------------------------');

const mockMember = {
  _id: 'member-123',
  customer: {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
  },
  status: 'active',
  attendanceEnabled: true,
  attendanceStats: {
    totalVisits: 25,
    currentStreak: 5,
    longestStreak: 12,
    lastVisitedAt: new Date('2025-01-09'),
    engagementLevel: ENGAGEMENT_LEVEL.ACTIVE,
  },
};

console.log('Member:', mockMember.customer.name);
console.log('Email:', mockMember.customer.email);
console.log('Current streak:', mockMember.attendanceStats.currentStreak, 'days');
console.log('Total visits:', mockMember.attendanceStats.totalVisits);
console.log();

// Simulate check-in (would actually call API in production)
console.log('Processing check-in...');
const checkInTime = new Date();
const timeSlot = getTimeSlot(checkInTime.getHours());

console.log('✅ Check-in successful!');
console.log('   Time:', checkInTime.toLocaleTimeString());
console.log('   Time Slot:', timeSlot);
console.log('   Method:', CHECK_IN_METHOD.QR);
console.log();

// Step 4: Calculate updated stats
console.log('📊 Step 4: Calculate Updated Stats');
console.log('----------------------------------------');

const updatedStats = {
  totalVisits: mockMember.attendanceStats.totalVisits + 1,
  currentStreak: mockMember.attendanceStats.currentStreak + 1,
  longestStreak: Math.max(
    mockMember.attendanceStats.longestStreak,
    mockMember.attendanceStats.currentStreak + 1
  ),
  lastVisitedAt: checkInTime,
  engagementLevel: ENGAGEMENT_LEVEL.ACTIVE,
};

console.log('Updated stats:');
console.log('   Total visits:', updatedStats.totalVisits);
console.log('   Current streak:', updatedStats.currentStreak, 'days');
console.log('   Longest streak:', updatedStats.longestStreak, 'days');
console.log('   Engagement:', updatedStats.engagementLevel);
console.log();

// Step 5: Check for milestones
console.log('🎯 Step 5: Check Milestones');
console.log('----------------------------------------');

const milestones = [
  { type: 'visits', values: [10, 25, 50, 100, 250, 500] },
  { type: 'streak', values: [7, 14, 30, 60, 90, 180] },
];

function checkMilestone(current, milestoneValues) {
  return milestoneValues.find(value => value === current);
}

const visitMilestone = checkMilestone(updatedStats.totalVisits, milestones[0].values);
const streakMilestone = checkMilestone(updatedStats.currentStreak, milestones[1].values);

if (visitMilestone) {
  console.log('🎉 Visit milestone reached:', visitMilestone, 'total visits!');
} else {
  console.log('No visit milestone yet (next:', milestones[0].values.find(v => v > updatedStats.totalVisits) || 'N/A', ')');
}

if (streakMilestone) {
  console.log('🔥 Streak milestone reached:', streakMilestone, 'day streak!');
} else {
  console.log('No streak milestone yet (next:', milestones[1].values.find(v => v > updatedStats.currentStreak) || 'N/A', ')');
}
console.log();

// Step 6: Simulate engagement tracking
console.log('📈 Step 6: Engagement Tracking');
console.log('----------------------------------------');

const engagementScenarios = [
  { days: 3, level: calculateEngagementLevel(3) },
  { days: 10, level: calculateEngagementLevel(10) },
  { days: 20, level: calculateEngagementLevel(20) },
  { days: 35, level: calculateEngagementLevel(35) },
];

console.log('Engagement by days since last visit:');
engagementScenarios.forEach(scenario => {
  console.log(`   ${scenario.days} days → ${scenario.level}`);
});
console.log();

// Step 7: Demonstrate attendance history
console.log('📅 Step 7: Attendance History');
console.log('----------------------------------------');

const recentCheckIns = [
  { date: new Date('2025-01-10T09:15:00'), type: ATTENDANCE_TYPE.FULL_DAY, method: CHECK_IN_METHOD.QR },
  { date: new Date('2025-01-09T08:45:00'), type: ATTENDANCE_TYPE.FULL_DAY, method: CHECK_IN_METHOD.BIOMETRIC },
  { date: new Date('2025-01-08T09:00:00'), type: ATTENDANCE_TYPE.FULL_DAY, method: CHECK_IN_METHOD.QR },
  { date: new Date('2025-01-07T13:30:00'), type: ATTENDANCE_TYPE.HALF_DAY, method: CHECK_IN_METHOD.MANUAL },
  { date: new Date('2025-01-06T09:20:00'), type: ATTENDANCE_TYPE.FULL_DAY, method: CHECK_IN_METHOD.QR },
];

console.log('Recent check-ins:');
recentCheckIns.forEach((checkIn, index) => {
  const date = checkIn.date.toLocaleDateString();
  const time = checkIn.date.toLocaleTimeString();
  console.log(`   ${index + 1}. ${date} at ${time} - ${checkIn.type} (${checkIn.method})`);
});
console.log();

// Step 8: Calculate streak from history
console.log('🔥 Step 8: Streak Calculation');
console.log('----------------------------------------');

const streak = calculateStreak(recentCheckIns);
console.log('Calculated streak from recent check-ins:', streak, 'days');
console.log();

// Step 9: Dashboard summary
console.log('📊 Step 9: Dashboard Summary');
console.log('----------------------------------------');

const dashboardData = {
  summary: {
    totalMembers: 250,
    activeMembers: 180,
    activationRate: ((180 / 250) * 100).toFixed(1),
    totalCheckIns: 1250,
    avgVisitsPerMember: (1250 / 250).toFixed(1),
  },
  engagementDistribution: {
    [ENGAGEMENT_LEVEL.ACTIVE]: 120,
    [ENGAGEMENT_LEVEL.AT_RISK]: 40,
    [ENGAGEMENT_LEVEL.INACTIVE]: 60,
    [ENGAGEMENT_LEVEL.CHURNED]: 30,
  },
  topMembers: [
    { name: 'Alice Smith', visits: 45, streak: 20 },
    { name: 'Bob Johnson', visits: 42, streak: 15 },
    { name: 'Charlie Brown', visits: 38, streak: 12 },
  ],
};

console.log('Organization Overview:');
console.log('   Total Members:', dashboardData.summary.totalMembers);
console.log('   Active Members:', dashboardData.summary.activeMembers);
console.log('   Activation Rate:', dashboardData.summary.activationRate + '%');
console.log('   Total Check-ins:', dashboardData.summary.totalCheckIns);
console.log('   Avg Visits/Member:', dashboardData.summary.avgVisitsPerMember);
console.log();

console.log('Engagement Distribution:');
Object.entries(dashboardData.engagementDistribution).forEach(([level, count]) => {
  console.log(`   ${level}: ${count} members`);
});
console.log();

console.log('Top Members:');
dashboardData.topMembers.forEach((member, index) => {
  console.log(`   ${index + 1}. ${member.name} - ${member.visits} visits, ${member.streak} day streak`);
});
console.log();

// Step 10: Complete workflow summary
console.log('✅ Step 10: Workflow Summary');
console.log('========================================');
console.log('Complete attendance workflow demonstrated:');
console.log('   ✓ Library initialization');
console.log('   ✓ Event listener setup');
console.log('   ✓ Member check-in processing');
console.log('   ✓ Stats calculation');
console.log('   ✓ Milestone detection');
console.log('   ✓ Engagement tracking');
console.log('   ✓ Attendance history');
console.log('   ✓ Streak calculation');
console.log('   ✓ Dashboard analytics');
console.log();

console.log('📚 Next Steps:');
console.log('   1. Set up your Mongoose models');
console.log('   2. Initialize with initializeAttendance()');
console.log('   3. Use attendance.checkIn() in your API');
console.log('   4. Listen to events for notifications');
console.log('   5. Use attendance.dashboard() for analytics');
console.log();

console.log('🎉 Full workflow test completed successfully!');
