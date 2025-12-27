# Schemas & Models (v2)

ClockIn is “schema-first”: you embed a small set of fields into any Mongoose model and ClockIn manages check-ins + analytics for that model.

---

## Attendance storage model (monthly aggregation)

ClockIn stores attendance records as:

- **1 document per member per month**
- `checkIns[]` contains individual check-in entries
- `monthlyTotal` and `uniqueDaysVisited` are maintained for fast reporting
- work-day counters (`fullDaysCount`, `halfDaysCount`, `paidLeaveDaysCount`, `overtimeDaysCount`, `totalWorkDays`) are recomputed on check-out from `checkIns[].attendanceType`

Create the schema via:

```ts
import mongoose from 'mongoose';
import { createAttendanceSchema } from '@classytic/clockin';

export const Attendance = mongoose.model(
  'Attendance',
  createAttendanceSchema({
    ttlDays: 730,
    createIndexes: true, // opt-in to index creation (default: false)
  })
);
```

### Indexes (opt-in)

Index creation is **opt-in** via the `createIndexes` option. When enabled, `createAttendanceSchema()` creates:
- Unique: `(tenantId, targetModel, targetId, year, month)`
- Query: `(tenantId, year, month)`, `(tenantId, targetModel, targetId, year desc, month desc)`
- Time: `(tenantId, checkIns.timestamp)`
- Text: `checkIns.notes`
- TTL: `createdAt` (if `ttlDays > 0`)

**Note:** If you don't enable `createIndexes`, you should define your own indexes based on your query patterns.

---

## Target models (Membership / Employee / Student / ...)

To make a model "ClockIn-enabled", add `commonAttendanceFields` and optionally apply indexes:

```ts
import mongoose from 'mongoose';
import { commonAttendanceFields, applyAttendanceIndexes } from '@classytic/clockin';

const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  ...commonAttendanceFields,
});

// Opt-in to index creation (recommended for production)
applyAttendanceIndexes(schema, {
  tenantField: 'organizationId',
  createIndexes: true, // default: false
});

export const Membership = mongoose.model('Membership', schema);
```

### What `commonAttendanceFields` adds

- `currentSession`
- `attendanceStats`
- `attendanceEnabled`
- `attendanceNotes`

These are used by services for:
- duplicate-prevention rules
- occupancy and session handling
- analytics queries (engagement/streak)

When `createIndexes: true`, `applyAttendanceIndexes()` creates:
- Stats indexes: `(tenantField, attendanceStats.engagementLevel)`, `(tenantField, attendanceStats.lastVisitedAt)`, etc.
- Session indexes: `(tenantField, currentSession.isActive)`, `(tenantField, currentSession.isActive, currentSession.expectedCheckOutAt)`

These keep occupancy and auto-checkout queries fast.

---

## Naming requirement

ClockIn uses the `targetModel` string to locate the model:

```ts
await clockin.checkIn.record({ targetModel: 'Membership', ... })
```

So your application must register:

```ts
mongoose.model('Membership', membershipSchema);
```

If the name doesn’t match, ClockIn can’t update the member’s embedded stats/session fields.
