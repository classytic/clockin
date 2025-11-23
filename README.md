# 🎯 ClockIn - Attendance Framework

[![Test](https://github.com/classytic/clockin/actions/workflows/test.yml/badge.svg)](https://github.com/classytic/clockin/actions/workflows/test.yml)
[![npm version](https://badge.fury.io/js/@classytic%2Fclockin.svg)](https://www.npmjs.com/package/@classytic/clockin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive, reusable attendance tracking library for Node.js applications. Works for both multi-tenant SaaS and single-tenant applications.

## 🌟 Features

- **Multi-Tenant & Single-Tenant**: Secure data isolation with flexible deployment
- **Storage Optimized**: Monthly aggregation (1 document per member per month, not per check-in)
- **Real-Time Analytics**: Pre-calculated stats for instant dashboards
- **Engagement Tracking**: Automatic member engagement classification
- **Flexible**: Works with any entity (Membership, Employee, Trainer, etc.)
- **Scalable**: Handles millions of check-ins efficiently
- **Developer Friendly**: Clean DSL similar to Stripe/AWS SDKs

## 📦 Installation

```bash
npm install @classytic/clockin
```

**Requirements:**
- Node.js >= 18.0.0
- Mongoose >= 8.0.0 (supports both v8 and v9)

```javascript
// Bootstrap (call once at app startup)
import { initializeAttendance } from '@classytic/clockin';
import Attendance from './models/attendance.model.js';

// Multi-tenant (default)
initializeAttendance({ AttendanceModel: Attendance });

// Single-tenant (auto-inject organizationId)
initializeAttendance({
  AttendanceModel: Attendance,
  singleTenant: {
    organizationId: process.env.ORGANIZATION_ID,
    autoInject: true
  }
});
```

**📘 Single-Tenant Guide:** See [docs/SINGLE_TENANT.md](https://github.com/classytic/clockin/blob/main/docs/SINGLE_TENANT.md) for complete single-tenant setup.

## 🚀 Quick Start

### 1. Record a Check-In

```javascript
import { attendance } from '@classytic/clockin';
import Membership from './models/membership.model.js';

// Find member
const member = await Membership.findOne({ 
  'customer.email': 'john@example.com',
  organizationId 
});

// Check-in
const result = await attendance.checkIn({
  member,
  targetModel: 'Membership',
  data: {
    method: 'qr_code',
    notes: 'Regular check-in',
    location: { lat: 40.7128, lng: -74.0060 },
  },
  context: {
    userId: staffMember._id,
    userName: staffMember.name,
    userRole: 'admin',
  },
});

console.log(`Check-in successful! Total visits: ${result.stats.totalVisits}`);
```

### 2. Get Dashboard Analytics

```javascript
const dashboard = await attendance.dashboard({
  MemberModel: Membership,
  organizationId,
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
});

console.log(`Active members: ${dashboard.summary.activeMembers}`);
console.log(`Total check-ins: ${dashboard.summary.totalCheckIns}`);
console.log(`At-risk members: ${dashboard.atRiskMembers.length}`);
```

### 3. Get Member List with Filters

```javascript
const members = await attendance.memberList({
  MemberModel: Membership,
  organizationId,
  filters: {
    engagementLevel: 'active',
    minVisits: 8,
    sortBy: 'currentStreak',
    order: 'desc',
  },
  pagination: { page: 1, limit: 20 },
});

console.log(`Found ${members.totalDocs} active members`);
```

### 4. View Member Attendance History

```javascript
const history = await attendance.history({
  memberId: member._id,
  organizationId,
  year: 2025,
  month: 10,
  targetModel: 'Membership',
});

console.log(`${history.length} monthly records found`);
history.forEach(record => {
  console.log(`${record.year}-${record.month}: ${record.monthlyTotal} visits`);
});
```

## 🏗️ Architecture

### Storage Design

The system uses **monthly aggregation** for optimal storage and performance:

```javascript
// ❌ BAD: One document per check-in (inefficient)
// 1 member × 20 check-ins/month = 20 documents

// ✅ GOOD: One document per member per month
// 1 member × 20 check-ins/month = 1 document (with array of 20 check-ins)
```

### Attendance Document Structure

```javascript
{
  "_id": ObjectId("..."),
  "tenantId": ObjectId("gym_id"),
  "targetModel": "Membership",
  "targetId": ObjectId("member_id"),
  "year": 2025,
  "month": 10,
  "checkIns": [
    {
      "timestamp": ISODate("2025-10-01T08:00:00Z"),
      "method": "qr_code",
      "timeSlot": "early_morning",
      "recordedBy": { "userId": "...", "name": "Staff Member" },
      "notes": "Regular check-in"
    },
    // ... more check-ins
  ],
  "monthlyTotal": 20,
  "uniqueDaysVisited": 15,
  "timeSlotDistribution": {
    "early_morning": 5,
    "morning": 10,
    "afternoon": 3,
    "evening": 2,
    "night": 0
  }
}
```

### Pre-Calculated Stats

Each member document stores pre-calculated stats for fast queries:

```javascript
{
  "attendanceStats": {
    "totalVisits": 150,
    "lastVisitedAt": ISODate("..."),
    "currentStreak": 12,
    "longestStreak": 45,
    "monthlyAverage": 10,
    "thisMonthVisits": 15,
    "engagementLevel": "highly_active",
    "loyaltyScore": 85
  }
}
```

## 📊 Engagement Levels

Members are automatically classified based on their attendance:

| Level | Visits/Month | Description |
|-------|-------------|-------------|
| `highly_active` | 12+ | Exceptional attendance |
| `active` | 8-11 | Regular attendee |
| `regular` | 4-7 | Moderate attendance |
| `occasional` | 1-3 | Infrequent visitor |
| `inactive` | 0 | No visits this month |
| `at_risk` | - | No visit in 14+ days |
| `dormant` | - | No visit in 30+ days |

## 🔧 Configuration

### Engagement Thresholds

```javascript
import { ENGAGEMENT_THRESHOLDS } from '@classytic/clockin';

console.log(ENGAGEMENT_THRESHOLDS);
// {
//   highlyActive: 12,
//   active: 8,
//   regular: 4,
//   occasional: 1,
//   atRisk: { daysInactive: 14 },
//   dormant: { daysInactive: 30 }
// }
```

### Check-In Rules

```javascript
import { CHECK_IN_RULES } from '@classytic/clockin';

console.log(CHECK_IN_RULES);
// {
//   duplicatePreventionMinutes: 5,
//   minimumTimeBetweenCheckIns: 4,
//   earlyCheckInMinutes: 30,
//   lateCheckInMinutes: 15
// }
```

## 🎯 Use Cases

### 1. Gym Attendance (Implemented)

Track member check-ins with engagement scoring and analytics.

### 2. Employee Attendance (Future)

```javascript
const result = await attendance.checkIn({
  member: employee,
  targetModel: 'Employee',
  data: { method: 'biometric' },
  context: { ... },
});
```

### 3. Class Attendance (Future)

```javascript
const result = await attendance.checkIn({
  member: student,
  targetModel: 'Class',
  data: { method: 'qr_code' },
  context: { ... },
});
```

## 📈 Analytics

### Dashboard Metrics

```javascript
const dashboard = await attendance.dashboard({ MemberModel, organizationId });

// Available metrics:
// - summary.totalMembers
// - summary.activeMembers
// - summary.activationRate
// - summary.totalCheckIns
// - summary.avgVisitsPerMember
// - engagementDistribution
// - topMembers
// - atRiskMembers
// - timeSlotDistribution
// - attendanceTrend
```

### Time Slot Analysis

```javascript
const timeSlots = await attendance.timeSlots({
  organizationId,
  startDate,
  endDate,
});

// {
//   early_morning: 150,
//   morning: 450,
//   afternoon: 200,
//   evening: 600,
//   night: 50
// }
```

### Attendance Trends

```javascript
const trend = await attendance.trend({
  organizationId,
  days: 30,
});

// [
//   { date: '2025-10-01', count: 45, uniqueMembers: 32 },
//   { date: '2025-10-02', count: 52, uniqueMembers: 38 },
//   ...
// ]
```

## 🔒 Multi-Tenancy

All operations are automatically scoped to the organization:

```javascript
// Each gym/organization has isolated data
const result = await attendance.checkIn({
  member, // Must belong to organizationId
  targetModel: 'Membership',
  data: { ... },
  context: { organizationId }, // Enforced at query level
});
```

### Indexes for Performance

```javascript
// Compound unique index
{ tenantId: 1, targetId: 1, year: 1, month: 1 }

// Analytics queries
{ tenantId: 1, year: 1, month: 1 }
{ targetId: 1, year: -1, month: -1 }

// Time-based queries
{ tenantId: 1, 'checkIns.timestamp': 1 }
```

## 🎨 API Reference

### Check-In Operations

```javascript
// Record check-in
await attendance.checkIn({ member, targetModel, data, context })

// Validate before check-in
const validation = attendance.validate(member)

// Bulk import
await attendance.bulkCheckIn({ checkIns, context })
```

### Analytics Operations

```javascript
// Dashboard
await attendance.dashboard({ MemberModel, organizationId, startDate, endDate })

// Member list
await attendance.memberList({ MemberModel, organizationId, filters, pagination })

// Member history
await attendance.history({ memberId, organizationId, year, month, targetModel })

// Time slots
await attendance.timeSlots({ organizationId, startDate, endDate })

// Trends
await attendance.trend({ organizationId, days })
```

### Stats Operations

```javascript
// Get stats
const stats = attendance.getStats(member)

// Check engagement
const isActive = attendance.isActive(member)
const isAtRisk = attendance.isAtRisk(member)

// Recalculate
await attendance.recalculateStats({ MemberModel, organizationId, memberIds })
```

## 🧪 Testing

```javascript
import { attendance, isInitialized } from '@classytic/clockin';

// Check initialization
console.log(isInitialized()); // true

// Test check-in validation
const validation = attendance.validate(member);
if (!validation.valid) {
  console.error(validation.error);
}
```

## 🚀 Performance

- **Check-in**: ~50ms (includes stats update)
- **Dashboard**: ~200ms (10,000 members)
- **Member list**: ~100ms (paginated)
- **History**: ~50ms (single member, one year)

### Optimization Tips

1. Use pre-calculated stats (stored on member documents)
2. Query specific months instead of full history
3. Use indexes for filters
4. Cache dashboard results (5 minutes recommended)

## 📚 Related Documentation

- [Integration Guide](./INTEGRATION.md) - Integration with your project
- [@classytic/payroll](https://www.npmjs.com/package/@classytic/payroll) - HRM and payroll management

## 🤝 Contributing

This library follows the same patterns as the payroll library:

1. **Enums**: Single source of truth
2. **Config**: Centralized configuration
3. **Schemas**: Reusable mongoose schemas
4. **Core**: Business logic managers
5. **Orchestrator**: Unified public API
6. **Init**: Bootstrap initialization

## 📝 License

MIT

---

**Built with ❤️ following world-class architecture principles**

