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
  createAttendanceSchema({ ttlDays: 730 }) // 0 disables TTL
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

applyAttendanceIndexes(membershipSchema, { tenantField: 'organizationId' });

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

## 🧠 Important Notes

- **Target model naming matters**: services use the models you register via `.withModels(...)`.
  That means your `targetModel` string **must match the key** you passed in `.withModels({ ... })` (e.g. `'Membership'`, `'Employee'`).
- **Transactions**: pass `context.session` to operations for atomic multi-document updates.

## 🔌 Plugins & Events

- `clockin.on('checkIn:recorded', handler)` for typed events
- `loggingPlugin()`, `metricsPlugin()`, `notificationPlugin()` for common integrations

See: `docs/PLUGINS_AND_EVENTS.md`

## 📚 Documentation

- `INTEGRATION.md` — full integration guide (schemas, models, and best practices)
- `docs/SINGLE_TENANT.md` — single-tenant setup
- `docs/SCHEMAS_AND_MODELS.md` — schema details + indexing
- `docs/PLUGINS_AND_EVENTS.md` — plugin hooks + EventBus

## 📝 License

MIT

