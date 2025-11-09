# 🔗 ClockIn Library Integration Guide

## Attendance Model Integration

The ClockIn library provides a complete attendance tracking system for employees, members, and other entities. It includes a ready-to-use AttendanceModel, but you can also use your own custom model.

---

## 📋 **Integration Options**

### **Option 1: Use Library-Provided Model (Recommended)**

The simplest approach is to use the built-in AttendanceModel:

```javascript
// bootstrap/attendance.js
import { initializeAttendance } from '@classytic/clockin';
import AttendanceModel from '@classytic/clockin/models/attendance.model.js';

initializeAttendance({
  AttendanceModel: AttendanceModel, // ✅ Use library-provided model
  logger: myLogger // Optional custom logger
});
```

**Benefits:**
- ✅ Zero schema configuration
- ✅ Optimized storage design (1 doc/member/month)
- ✅ Built-in work days calculation
- ✅ Correction request system included
- ✅ Analytics-ready distribution tracking
- ✅ **Compatible with @classytic/payroll** payroll system

---

### **Option 2: Use Custom Model**

If you need custom fields or modifications, implement the required schema:

```javascript
// models/CustomAttendance.js
import mongoose from 'mongoose';

const customAttendanceSchema = new mongoose.Schema({
  // ... your custom schema (see requirements below)
});

export const CustomAttendance = mongoose.model('CustomAttendance', customAttendanceSchema);
```

```javascript
// bootstrap/attendance.js
import { initializeAttendance } from '@classytic/clockin';
import { CustomAttendance } from './models/CustomAttendance.js';

initializeAttendance({
  AttendanceModel: CustomAttendance, // ✅ Use your custom model
});
```

---

## 🎯 **Custom Model Requirements**

If using a custom AttendanceModel, it **MUST** include these fields:

### **Core Fields (Required)**

```javascript
{
  // Multi-tenancy (REQUIRED)
  tenantId: ObjectId,             // Organization ID

  // Polymorphic target (REQUIRED)
  targetModel: String,            // Model name: 'Employee' | 'Membership' | 'User'
  targetId: ObjectId,             // Reference to target entity

  // Time period (REQUIRED - one document per month!)
  year: Number,                   // Year (e.g., 2024)
  month: Number,                  // Month (1-12)

  // Check-in storage (REQUIRED)
  checkIns: [{                    // Array of check-in entries
    date: Date,                   // Check-in date/time
    checkOutTime: Date,           // Check-out date/time (optional)
    type: String,                 // 'full_day' | 'half_day' | 'paid_leave' | 'overtime'
    location: String,             // Check-in location (optional)
    notes: String,                // Admin notes (optional)
  }],

  // Monthly totals (REQUIRED for performance)
  monthlyTotal: Number,           // Total check-ins this month
  uniqueDaysVisited: Number,      // Unique days with check-ins

  // Work days tracking (REQUIRED for HRM integration!)
  fullDaysCount: Number,          // Count of full work days
  halfDaysCount: Number,          // Count of half work days
  paidLeaveDaysCount: Number,     // Count of paid leave days
  overtimeDaysCount: Number,      // Count of overtime days
  totalWorkDays: Number,          // Calculated total (decimal)
                                  // Formula: fullDays + (halfDays * 0.5) + paidLeave

  // Analytics (OPTIONAL but recommended)
  timeSlotDistribution: {
    early_morning: Number,
    morning: Number,
    afternoon: Number,
    evening: Number,
    night: Number,
  },

  dayOfWeekDistribution: Map<Number, Number>, // 0=Sunday, 6=Saturday
}
```

### **Required Indexes (CRITICAL!)**

```javascript
// Unique constraint: One document per member per month
attendanceSchema.index(
  { tenantId: 1, targetId: 1, year: 1, month: 1 },
  { unique: true }
);

// Fast tenant-scoped queries
attendanceSchema.index({ tenantId: 1, year: 1, month: 1 });

// Polymorphic reference queries
attendanceSchema.index({ targetModel: 1, targetId: 1, year: 1, month: 1 });
```

### **Required Methods**

Your model **MUST** implement:

#### **recalculateWorkDays()**

Recalculates work days based on check-ins:

```javascript
attendanceSchema.methods.recalculateWorkDays = function() {
  const counts = { full: 0, half: 0, paidLeave: 0, overtime: 0 };

  this.checkIns.forEach(entry => {
    switch (entry.type) {
      case 'full_day': counts.full++; break;
      case 'half_day': counts.half++; break;
      case 'paid_leave': counts.paidLeave++; break;
      case 'overtime': counts.overtime++; break;
    }
  });

  this.fullDaysCount = counts.full;
  this.halfDaysCount = counts.half;
  this.paidLeaveDaysCount = counts.paidLeave;
  this.overtimeDaysCount = counts.overtime;

  // CRITICAL FORMULA (used by HRM payroll!)
  this.totalWorkDays = counts.full + (counts.half * 0.5) + counts.paidLeave;
};
```

---

## 🏗️ **Complete Custom Schema Example**

```javascript
// models/CustomAttendance.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const checkInEntrySchema = new Schema({
  date: { type: Date, required: true },
  checkOutTime: { type: Date },
  type: {
    type: String,
    enum: ['full_day', 'half_day', 'paid_leave', 'overtime', 'absent'],
    default: 'full_day'
  },
  location: { type: String },
  notes: { type: String },
}, { _id: true });

const customAttendanceSchema = new Schema({
  // Multi-tenancy
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },

  // Polymorphic target
  targetModel: {
    type: String,
    required: true,
    enum: ['Employee', 'Membership', 'User'],
  },
  targetId: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'targetModel',
    index: true,
  },

  // Time period
  year: {
    type: Number,
    required: true,
    index: true,
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
    index: true,
  },

  // Check-ins (array of entries)
  checkIns: {
    type: [checkInEntrySchema],
    default: [],
  },

  // Monthly totals
  monthlyTotal: {
    type: Number,
    default: 0,
    min: 0,
  },
  uniqueDaysVisited: {
    type: Number,
    default: 0,
    min: 0,
  },

  // Work days tracking (HRM integration)
  fullDaysCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  halfDaysCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  paidLeaveDaysCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  overtimeDaysCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalWorkDays: {
    type: Number,
    default: 0,
    min: 0,
  },

  // Analytics (optional)
  timeSlotDistribution: {
    early_morning: { type: Number, default: 0 },
    morning: { type: Number, default: 0 },
    afternoon: { type: Number, default: 0 },
    evening: { type: Number, default: 0 },
    night: { type: Number, default: 0 },
  },

  dayOfWeekDistribution: {
    type: Map,
    of: Number,
    default: () => new Map(),
  },

  // Custom fields (add your own!)
  customField1: String,
  customField2: Number,
}, {
  timestamps: true
});

// CRITICAL INDEXES
customAttendanceSchema.index(
  { tenantId: 1, targetId: 1, year: 1, month: 1 },
  { unique: true }
);

customAttendanceSchema.index({ tenantId: 1, year: 1, month: 1 });
customAttendanceSchema.index({ targetModel: 1, targetId: 1, year: 1, month: 1 });

// REQUIRED METHOD
customAttendanceSchema.methods.recalculateWorkDays = function() {
  const counts = { full: 0, half: 0, paidLeave: 0, overtime: 0 };

  this.checkIns.forEach(entry => {
    switch (entry.type) {
      case 'full_day': counts.full++; break;
      case 'half_day': counts.half++; break;
      case 'paid_leave': counts.paidLeave++; break;
      case 'overtime': counts.overtime++; break;
    }
  });

  this.fullDaysCount = counts.full;
  this.halfDaysCount = counts.half;
  this.paidLeaveDaysCount = counts.paidLeave;
  this.overtimeDaysCount = counts.overtime;

  // CRITICAL: HRM payroll uses this value!
  this.totalWorkDays = counts.full + (counts.half * 0.5) + counts.paidLeave;
};

export const CustomAttendance = mongoose.model('CustomAttendance', customAttendanceSchema);
```

---

## 🔗 **HRM Library Integration**

The Attendance library is designed to work seamlessly with the **@classytic/payroll** library for payroll processing.

### **How HRM Uses Attendance Data**

When HRM processes employee payroll, it:

1. **Queries attendance** for the pay period:
   ```javascript
   const attendance = await AttendanceModel.findOne({
     tenantId: organizationId,
     targetId: employeeId,
     targetModel: 'Employee',
     year: 2024,
     month: 3
   });
   ```

2. **Reads `totalWorkDays`** (pre-calculated by Attendance library)

3. **Calculates deductions**:
   ```javascript
   const totalDaysInMonth = 31;
   const absentDays = totalDaysInMonth - attendance.totalWorkDays;
   const deduction = absentDays * dailyRate;
   ```

### **Integration Example**

```javascript
// bootstrap/index.js
import { initializeAttendance } from '@classytic/clockin';
import { initializeHRM } from '@classytic/payroll';
import AttendanceModel from '@classytic/clockin/models/attendance.model.js';
import Employee from './models/Employee.js';
import PayrollRecord from './models/PayrollRecord.js';
import Transaction from './models/Transaction.js';

// 1. Initialize Attendance
initializeAttendance({
  AttendanceModel: AttendanceModel,
});

// 2. Initialize HRM with Attendance integration
initializeHRM({
  EmployeeModel: Employee,
  PayrollRecordModel: PayrollRecord,
  TransactionModel: Transaction,
  AttendanceModel: AttendanceModel,  // ✅ Enable payroll deductions
});
```

**See also:** [HRM Integration Guide](../hrm/INTEGRATION.md) for detailed HRM-Attendance contract.

---

## 🎯 **Storage Optimization**

The Attendance library uses **monthly aggregation** for optimal storage:

### **Why One Document Per Month?**

```javascript
// ❌ BAD: One document per check-in
// 1 employee with 20 check-ins/month = 20 documents
CheckIn { employeeId, date, type }
CheckIn { employeeId, date, type }
// ... 18 more documents

// ✅ GOOD: One document per month
// 1 employee with 20 check-ins/month = 1 document
Attendance {
  employeeId,
  year: 2024,
  month: 3,
  checkIns: [
    { date, type },
    { date, type },
    // ... 18 more entries
  ],
  totalWorkDays: 18.5  // Pre-calculated!
}
```

**Benefits:**
- 📉 **95% storage reduction** (1 doc/month vs 20-30 docs/month)
- ⚡ **Faster queries** (single indexed lookup vs array scan)
- 🎯 **Pre-calculated totals** for instant reporting
- 💰 **Lower database costs**

---

## ✅ **Compatibility Checklist**

Before using a custom AttendanceModel, verify:

### **Schema Requirements**
- [ ] Has `tenantId` field (ObjectId)
- [ ] Has `targetModel` field (String, with 'Employee')
- [ ] Has `targetId` field (ObjectId, refPath: targetModel)
- [ ] Has `year` field (Number)
- [ ] Has `month` field (Number, 1-12)
- [ ] Has `checkIns` array with `date`, `type`, `checkOutTime`
- [ ] Has `monthlyTotal` field (Number)
- [ ] Has `uniqueDaysVisited` field (Number)
- [ ] Has `fullDaysCount` field (Number)
- [ ] Has `halfDaysCount` field (Number)
- [ ] Has `paidLeaveDaysCount` field (Number)
- [ ] Has `totalWorkDays` field (Number, decimal)

### **Indexes**
- [ ] **Unique compound index** on `(tenantId, targetId, year, month)`
- [ ] Index on `(tenantId, year, month)` for fast queries
- [ ] Index on `(targetModel, targetId, year, month)`

### **Methods**
- [ ] Implements `recalculateWorkDays()` method
- [ ] Formula: `fullDays + (halfDays × 0.5) + paidLeaveDays`

### **HRM Integration (if using)**
- [ ] `totalWorkDays` is calculated correctly before payroll runs
- [ ] `targetModel` includes 'Employee' in enum values

---

## 📖 **Related Documentation**

- [Attendance Library README](./README.md)
- [Attendance Model Source](./models/attendance.model.js)
- [Check-in Manager](./core/check-in.manager.js)
- [HRM Integration Guide](../hrm/INTEGRATION.md)
- [Analytics Manager](./core/analytics.manager.js)
