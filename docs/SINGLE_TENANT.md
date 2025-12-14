# Single-Tenant Guide (v2)

For single-tenant apps, **you don't need `organizationId` at all**. Just call `.forSingleTenant()` and the library handles it transparently.

## Quick Setup

```ts
import mongoose from 'mongoose';
import { ClockIn, createAttendanceSchema, commonAttendanceFields } from '@classytic/clockin';

// 1. Your member schema - NO organizationId needed!
const membershipSchema = new mongoose.Schema({
  customer: { name: String, email: String },
  status: { type: String, default: 'active' },
  ...commonAttendanceFields,
}, { timestamps: true });

const Membership = mongoose.model('Membership', membershipSchema);
const Attendance = mongoose.model('Attendance', createAttendanceSchema());

// 2. Enable single-tenant mode
const clockin = ClockIn
  .create()
  .withModels({ Attendance, Membership })
  .forSingleTenant()  // ← That's it!
  .build();
```

## Usage

No `organizationId` in context either:

```ts
const member = await Membership.findOne({ 'customer.email': 'john@example.com' });

// Just check in - no organizationId needed anywhere
const result = await clockin.checkIn.record({
  member,
  targetModel: 'Membership',
  data: { method: 'qr_code' },
});
```

## How It Works

When you call `.forSingleTenant()`:

1. ClockIn uses an internal default tenant ID (`000000000000000000000001`)
2. All attendance records are scoped to this tenant automatically
3. You never have to pass or store `organizationId`

## Custom Tenant ID (Optional)

If you want a specific tenant ID (e.g., for data migration):

```ts
.forSingleTenant({ organizationId: 'my-company-id' })
```

## When to Use Multi-Tenant Instead

Use the default multi-tenant mode if:

- You're building a SaaS with multiple organizations
- Different users belong to different tenants
- You need strict data isolation between tenants

In multi-tenant mode, `organizationId` is required (on the member or in context) to ensure proper data isolation.

## Migrating from Multi-Tenant to Single-Tenant

If you previously had `organizationId` on your schema and want to simplify:

```ts
// Your schema no longer needs organizationId
// Just add .forSingleTenant() to your ClockIn builder

// Existing attendance records will still work - they have tenantId stored
// New records will use the default tenant ID
```
