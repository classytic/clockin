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
  createAttendanceSchema({ ttlDays: 730 })
);
```

### Required indexes

`createAttendanceSchema()` includes these indexes:
- Unique: `(tenantId, targetModel, targetId, year, month)`
- Query: `(tenantId, year, month)`, `(tenantId, targetModel, targetId, year desc, month desc)`
- Time: `(tenantId, checkIns.timestamp)`

---

## Target models (Membership / Employee / Student / ...)

To make a model “ClockIn-enabled”, add `commonAttendanceFields` and apply indexes:

```ts
import mongoose from 'mongoose';
import { commonAttendanceFields, applyAttendanceIndexes } from '@classytic/clockin';

const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  ...commonAttendanceFields,
});

applyAttendanceIndexes(schema, { tenantField: 'organizationId' });

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

`applyAttendanceIndexes()` also adds real-time session indexes for `currentSession.isActive`
and `currentSession.expectedCheckOutAt` to keep occupancy and auto-checkout queries fast.

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
