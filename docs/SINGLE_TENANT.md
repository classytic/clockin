# Single-Tenant Usage Guide

@classytic/clockin was designed for multi-tenant SaaS applications, but it works perfectly for single-tenant apps too! Here's how to use it.

## 🎯 Quick Start (Recommended)

### Option 1: Use Single-Tenant Mode (Auto-Inject)

The easiest way - let the library handle organizationId automatically:

```javascript
// bootstrap/attendance.js
import { initializeAttendance } from '@classytic/clockin';
import Attendance from './models/attendance.model.js';

initializeAttendance({
  AttendanceModel: Attendance,
  singleTenant: {
    organizationId: process.env.ORGANIZATION_ID || '000000000000000000000001',
    autoInject: true  // Automatically adds organizationId to members
  }
});
```

**Benefits:**
- ✅ No schema changes needed
- ✅ Works with existing models
- ✅ Automatic organizationId injection
- ✅ Future-proof if you scale to multi-tenant

### Option 2: Add organizationId to Schema (Explicit)

Add a constant organizationId field to your model:

```javascript
import mongoose from 'mongoose';
import { attendanceStatsSchema } from '@classytic/clockin/schemas';

const FIXED_ORG_ID = new mongoose.Types.ObjectId('000000000000000000000001');

const membershipSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String, required: true },

  // Fixed organizationId for single-tenant
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    default: () => FIXED_ORG_ID,
    index: true,
  },

  // Required by clockin
  attendanceStats: attendanceStatsSchema,
  attendanceEnabled: { type: Boolean, default: true },
});

export default mongoose.model('Membership', membershipSchema);
```

Then initialize normally:

```javascript
initializeAttendance({ AttendanceModel: Attendance });
```

## 🚀 Usage

With either option, usage is exactly the same:

```javascript
import { attendance } from '@classytic/clockin';

// Find member
const member = await Membership.findOne({ email: 'john@example.com' });

// Check-in (organizationId handled automatically)
const result = await attendance.checkIn({
  member,
  targetModel: 'Membership',
  data: { method: 'qr_code' },
  context: { userId: staff._id },
});

// Dashboard
const dashboard = await attendance.dashboard({
  MemberModel: Membership,
  organizationId: member.organizationId,  // Use from member or env var
  startDate: new Date('2025-01-01'),
});
```

## 🔄 Migrating Existing Data

If you already have members without organizationId:

```javascript
import mongoose from 'mongoose';
import Membership from './models/membership.model.js';

const FIXED_ORG_ID = new mongoose.Types.ObjectId('000000000000000000000001');

// One-time migration
async function migrateToSingleTenant() {
  const result = await Membership.updateMany(
    { organizationId: { $exists: false } },
    { $set: { organizationId: FIXED_ORG_ID } }
  );

  console.log(`✅ Updated ${result.modifiedCount} members`);
}

await migrateToSingleTenant();
```

## ⚙️ Environment Configuration

Store your organization ID in environment variables:

```bash
# .env
ORGANIZATION_ID=000000000000000000000001
```

```javascript
// config/constants.js
import mongoose from 'mongoose';

export const ORGANIZATION_ID = new mongoose.Types.ObjectId(
  process.env.ORGANIZATION_ID || '000000000000000000000001'
);
```

## 🎓 Why organizationId is Required

The library was built for multi-tenant SaaS where:
- Multiple organizations use the same database
- Data MUST be isolated per organization
- All queries filter by organizationId for security

For single-tenant:
- You still need the field (for compatibility)
- But it's just a constant value
- No real overhead - just another field
- Makes future scaling easier

## 📊 Comparison

| Approach | Pros | Cons |
|----------|------|------|
| **Auto-Inject** | No schema changes, Works with existing data | Runtime overhead (minimal) |
| **Schema Default** | Explicit, No runtime overhead | Requires schema modification |

Both work perfectly! Choose based on your preference.

## ✅ Recommended: Auto-Inject for Single-Tenant

For most single-tenant apps, use auto-inject mode:

```javascript
initializeAttendance({
  AttendanceModel: Attendance,
  singleTenant: {
    organizationId: process.env.ORGANIZATION_ID,
    autoInject: true
  }
});
```

This gives you:
- 🚀 Zero schema changes
- 🔒 Security by default
- 📈 Easy to scale later
- 🎯 Simple configuration

## 🆘 Need Help?

- [Main Documentation](./README.md)
- [GitHub Issues](https://github.com/classytic/clockin/issues)
- [Integration Guide](./INTEGRATION.md)
