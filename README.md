# 🎯 ClockIn — Attendance Framework (Mongoose + TypeScript)

[![Test](https://github.com/classytic/clockin/actions/workflows/test.yml/badge.svg)](https://github.com/classytic/clockin/actions/workflows/test.yml)
[![npm version](https://badge.fury.io/js/@classytic%2Fclockin.svg)](https://www.npmjs.com/package/@classytic/clockin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

ClockIn is a **Mongoose-first attendance framework** for any kind of event check-in: gym members, employees, students, picnics, classes, IoT scans, QR/RFID/biometric—built as a clean, pluggable service.

## 🌟 Features

- **Multi-tenant ready**: everything is scoped by `organizationId` for SaaS apps
- **Single-tenant friendly**: just call `.forSingleTenant()` — no `organizationId` needed anywhere (see `docs/SINGLE_TENANT.md`)
- **Storage optimized**: **monthly aggregation** (1 document per member per month)
- **Fast analytics**: embedded `attendanceStats` + aggregation helpers
- **Event-driven**: type-safe `EventBus` + plugin hooks
- **Clean architecture**: Builder API, services, shared schemas & utilities

## 📦 Installation

```bash
npm install @classytic/clockin
```

**Requirements**
- Node.js >= 18
- Mongoose >= 8

## 🚀 Quick Start (v2)

### 1) Create the Attendance model (monthly aggregation)

```ts
import mongoose from 'mongoose';
import { createAttendanceSchema } from '@classytic/clockin';

export const Attendance = mongoose.model(
  'Attendance',
  createAttendanceSchema({
    ttlDays: 730,        // 0 disables TTL
    createIndexes: true, // opt-in to index creation (default: false)
  })
);
```

### 2) Add ClockIn fields to your target schema (e.g. `Membership`)

```ts
import mongoose from 'mongoose';
import { commonAttendanceFields, applyAttendanceIndexes } from '@classytic/clockin';

const membershipSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    customer: { name: String, email: String },
    membershipCode: String,
    status: { type: String, default: 'active' },

    // Adds: currentSession, attendanceStats, attendanceEnabled, attendanceNotes
    ...commonAttendanceFields,
  },
  { timestamps: true }
);

// Opt-in to index creation (recommended for production)
applyAttendanceIndexes(membershipSchema, {
  tenantField: 'organizationId',
  createIndexes: true, // default: false
});

export const Membership = mongoose.model('Membership', membershipSchema);
```

### 3) Build ClockIn

```ts
import { ClockIn, loggingPlugin } from '@classytic/clockin';
import { Attendance } from './models/attendance.js';
import { Membership } from './models/membership.js';

export const clockin = await ClockIn
  .create()
  .withModels({ Attendance, Membership })
  .withPlugin(loggingPlugin())
  .build();
```

### 4) Record a check-in

```ts
import { isOk } from '@classytic/clockin';
import { clockin } from './clockin.js';

const member = await mongoose.model('Membership').findOne({ _id: memberId, organizationId });

const result = await clockin.checkIn.record({
  member,
  targetModel: 'Membership',
  data: { method: 'qr_code', notes: 'Front gate' },
  context: { organizationId, userId, userName: 'Admin', userRole: 'admin' },
});

if (isOk(result)) {
  console.log(result.value.stats.totalVisits);
}
```

### 5) Analytics

```ts
const dashboard = await clockin.analytics.dashboard({
  MemberModel: Membership,
  organizationId,
});

if (dashboard.ok) {
  console.log(dashboard.value.summary.totalCheckIns);
}
```

## 🎯 Custom Target Models (v2.0)

ClockIn accepts **any target model** by default. Track attendance for memberships, employees, events, workshops, or any custom entity:

```ts
// Track attendance for a custom "Workshop" model
const clockin = await ClockIn
  .create()
  .withModels({ Attendance, Workshop })
  .build();

await clockin.checkIn.record({
  member: workshop,
  targetModel: 'Workshop',  // Any string works
  data: { method: 'api' },
  context: { organizationId },
});
```

### Configuring Target Models with Deep Merge

When you configure a target model with `.withTargetModel()`, your config is **deep merged** with smart defaults. This means you only need to specify the values you want to override—nested properties you don't specify are preserved from defaults:

```ts
const clockin = await ClockIn
  .create()
  .withModels({ Attendance, Membership })
  .withTargetModel('Membership', {
    detection: {
      type: 'time-based',  // Only override the type
      // rules.thresholds, scheduleSource, timeHints are preserved from defaults
    },
    autoCheckout: {
      afterHours: 4,  // Only override afterHours
      // enabled, maxSession are preserved from defaults
    },
  })
  .build();
```

Default configurations are generated based on the target model name:
- **Employee**: Uses `schedule-aware` detection with percentage-based thresholds
- **Other models**: Use `time-based` detection with absolute hour thresholds

### Restricting Target Models (Optional)

For stricter validation, restrict to a specific allowlist:

```ts
const clockin = await ClockIn
  .create()
  .withModels({ Attendance, Membership, Employee })
  .restrictTargetModels(['Membership', 'Employee'])  // Only these allowed
  .build();

// This will throw TargetModelNotAllowedError:
await clockin.checkIn.record({ targetModel: 'Workshop', ... });
```

## 🛡️ Error Handling

ClockIn uses a **Result type** (inspired by Rust) for explicit error handling—no try/catch needed:

```ts
import { isOk, isErr } from '@classytic/clockin';

const result = await clockin.checkIn.record({ ... });

if (isOk(result)) {
  console.log(result.value.stats.totalVisits);
} else {
  // result.error is a typed ClockInError
  console.error(result.error.code, result.error.message);
}
```

Common error types: `ValidationError`, `DuplicateCheckInError`, `AttendanceNotEnabledError`, `MemberNotFoundError`, `TargetModelNotAllowedError`.

## 🔄 Transactions

For atomic operations across multiple documents, pass a Mongoose session:

```ts
const session = await mongoose.startSession();
await session.withTransaction(async () => {
  await clockin.checkIn.record({
    member,
    targetModel: 'Membership',
    context: { organizationId, session },
  });
});
```

## 🧠 Important Notes

- **Target model naming matters**: services use the models you register via `.withModels(...)`.
  That means your `targetModel` string **must match the key** you passed in `.withModels({ ... })` (e.g. `'Membership'`, `'Employee'`).
- **Check-out requires a check-in id**: `checkOut.record` needs a `checkInId` (tests should pass it explicitly).
- **Half-day types**: schedule-aware detection can return `half_day_morning` or `half_day_afternoon` for employee check-outs.
- **Occupancy location**: use `clockin.checkOut.getOccupancy`, not `clockin.analytics`.

## 🧩 Type Exports

ClockIn exports its full type surface from the main package entry. Import what you need from `@classytic/clockin`:

```ts
import type {
  AttendanceTargetModel,
  AttendanceRecord,
  CheckInParams,
  CheckOutParams,
  OccupancyData,
  ActiveSessionData,
  CheckoutExpiredParams,
} from '@classytic/clockin';
```

## ⏱️ Auto-checkout (batch helper)

For scheduled jobs, use the built-in batch helper to close expired sessions safely in chunks:

```ts
await clockin.checkOut.checkoutExpired({
  organizationId,
  targetModel: 'Employee', // optional: process all registered models
  before: new Date(),
  limit: 500,
});
```

## 📈 Indexing for scale

Index creation is **opt-in** to give you full control over your database indexes. For production usage with bursty multi-tenant workloads, enable indexes explicitly:

```ts
// On your Attendance schema
createAttendanceSchema({
  ttlDays: 730,
  createIndexes: true,  // Creates query + TTL indexes
});

// On your target schemas (Membership, Employee, etc.)
applyAttendanceIndexes(schema, {
  tenantField: 'organizationId',
  createIndexes: true,  // Creates session + stats indexes
});
```

This includes real-time session indexes for `currentSession.isActive` and `currentSession.expectedCheckOutAt`.

## 🔌 Plugins & Events

```ts
// Subscribe to events (returns unsubscribe function)
const unsubscribe = clockin.on('checkIn:recorded', (event) => {
  console.log(`${event.data.member.name} checked in!`);
});

// Clean up when done
unsubscribe();
```

Built-in plugins: `loggingPlugin()`, `metricsPlugin()`, `notificationPlugin()`

### Plugin Fail-Fast Mode

By default, plugin errors are logged but don't stop execution. Enable fail-fast to throw on first plugin error:

```ts
const clockin = await ClockIn.create()
  .withModels({ Attendance })
  .withPlugin(myPlugin)
  .withPluginFailFast()  // Throws PluginError on failure
  .build();
```

### Cleanup

Always destroy the instance when shutting down to prevent memory leaks:

```ts
await clockin.destroy();
```

See: `docs/PLUGINS_AND_EVENTS.md`

## 📚 Documentation

- `INTEGRATION.md` — full integration guide (schemas, models, and best practices)
- `docs/SINGLE_TENANT.md` — single-tenant setup
- `docs/SCHEMAS_AND_MODELS.md` — schema details + indexing
- `docs/PLUGINS_AND_EVENTS.md` — plugin hooks + EventBus
- `docs/CORRECTIONS.md` — correction requests API

## 📝 License

MIT
