# 🔗 ClockIn v2 Integration Guide (Mongoose Plugin-Style)

This guide shows the recommended “plug it into any schema” setup:

1) **Create an Attendance model** (monthly aggregation)  
2) **Embed ClockIn fields into your target schema** (Member/Employee/Student/…)  
3) **Build a ClockIn instance**  
4) Use `checkIn`, `checkOut`, and `analytics`

---

## 1) Create the Attendance model

ClockIn stores attendance as **one document per member per month**.

```ts
import mongoose from 'mongoose';
import { createAttendanceSchema } from '@classytic/clockin';

export const Attendance = mongoose.model(
  'Attendance',
  createAttendanceSchema({
    ttlDays: 730, // set 0 to disable TTL
    // additionalFields: { source: String } // optional extension point
  })
);
```

**Key fields (inside the attendance record)**
- `tenantId` (organizationId)
- `targetModel` (e.g. `'Membership'`)
- `targetId` (member `_id`)
- `year`, `month`
- `checkIns[]` with timestamps + metadata

---

## 2) Add ClockIn fields to your member/employee schema

ClockIn works with **any Mongoose model** as long as it has:
- `organizationId` (for tenant isolation)
- `attendanceEnabled`, `attendanceStats`, `currentSession` (provided by `commonAttendanceFields`)

```ts
import mongoose from 'mongoose';
import { commonAttendanceFields, applyAttendanceIndexes } from '@classytic/clockin';

const membershipSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    customer: { name: String, email: String },
    status: { type: String, default: 'active' },

    ...commonAttendanceFields,
  },
  { timestamps: true }
);

applyAttendanceIndexes(membershipSchema, { tenantField: 'organizationId' });

export const Membership = mongoose.model('Membership', membershipSchema);
```

---

## 3) Build ClockIn (recommended)

```ts
import { ClockIn, loggingPlugin } from '@classytic/clockin';
import { Attendance } from './attendance.js';
import { Membership } from './membership.js';

export const clockin = await ClockIn
  .create()
  .withModels({ Attendance, Membership })
  .withPlugin(loggingPlugin())
  .build();
```

---

## 4) Multi-tenant usage

For multi-tenant SaaS, always pass `organizationId` in the operation `context` (or ensure it exists on the member document).

```ts
const member = await Membership.findOne({ _id: memberId, organizationId });

const result = await clockin.checkIn.record({
  member,
  targetModel: 'Membership',
  data: { method: 'rfid' },
  context: { organizationId, userId },
});
```

---

## 5) Single-tenant usage

Single-tenant is just “one fixed orgId”. You can:
- store `organizationId` as a constant default on your model, OR
- always pass `context.organizationId`

See: `docs/SINGLE_TENANT.md`

---

## 6) Analytics

```ts
const dashboard = await clockin.analytics.dashboard({
  MemberModel: Membership,
  organizationId,
});

const history = await clockin.analytics.history({
  memberId,
  organizationId,
  targetModel: 'Membership',
});
```

---

## 7) Auto-checkout at scale

ClockIn ships a batch helper so you can safely close expired sessions in chunks (ideal for cron):

```ts
await clockin.checkOut.checkoutExpired({
  organizationId,
  targetModel: 'Employee', // optional
  before: new Date(),
  limit: 500,
});
```

### Cron recipe (multi-tenant safe)

The safest pattern is to run per tenant with small batches and a short interval. This avoids
noisy neighbors and keeps latency predictable:

```ts
const tenants = await Organization.find({}, { _id: 1 }).lean();

for (const tenant of tenants) {
  await clockin.checkOut.checkoutExpired({
    organizationId: tenant._id,
    before: new Date(),
    limit: 500,
  });
}
```

If you want a global sweep (single-tenant or low volume), you can omit `targetModel`
to process all registered models.

---

## 8) Critical pitfalls (read this)

### A) Your Mongoose model **must be registered**

ClockIn updates members using the models you register via `.withModels(...)`.

So if you call `targetModel: 'Membership'`, you must:
- create/register that Mongoose model, and
- pass it into ClockIn via `.withModels({ Attendance, Membership })`.

```ts
mongoose.model('Membership', membershipSchema);
```

### B) Indexing matters

ClockIn is designed for scale—make sure to apply:
- `createAttendanceSchema()` indexes (already included)
- `applyAttendanceIndexes()` on member/employee schemas

### C) Check-out requires a check-in id

`checkOut.record` needs a `checkInId`. If you call it directly (outside of `toggle`),
pass the id explicitly and store it from the check-in response.

### D) Occupancy is part of check-out

Use `clockin.checkOut.getOccupancy` for current occupancy queries.

### E) Half-day types in schedule-aware detection

For schedule-aware models (like `Employee`), check-out detection can return
`half_day_morning` or `half_day_afternoon` based on time hints.

### F) Indexes for current sessions

Use `applyAttendanceIndexes()` to add real-time indexes for `currentSession.isActive`
and `currentSession.expectedCheckOutAt` so occupancy and auto-checkout scans stay fast.

---

## 8) Next docs

- `docs/SCHEMAS_AND_MODELS.md`
- `docs/PLUGINS_AND_EVENTS.md`
