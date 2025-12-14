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

export const clockin = ClockIn
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

## 7) Critical pitfalls (read this)

### A) Your Mongoose model **must be registered**

Internally, ClockIn updates members via `mongoose.model(targetModel)`.

So if you call `targetModel: 'Membership'`, you must have:

```ts
mongoose.model('Membership', membershipSchema);
```

### B) Indexing matters

ClockIn is designed for scale—make sure to apply:
- `createAttendanceSchema()` indexes (already included)
- `applyAttendanceIndexes()` on member/employee schemas

---

## 8) Next docs

- `docs/SCHEMAS_AND_MODELS.md`
- `docs/PLUGINS_AND_EVENTS.md`
