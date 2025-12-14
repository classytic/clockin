/**
 * Test Models
 *
 * Mongoose models for testing
 */

import mongoose from 'mongoose';
import {
  createAttendanceSchema,
  commonAttendanceFields,
  applyAttendanceIndexes,
} from '../src/schemas/index.js';

const { Schema } = mongoose;

// ============================================================================
// ATTENDANCE MODEL
// ============================================================================

const attendanceSchema = createAttendanceSchema({
  ttlDays: 0, // No TTL for tests
});

export const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);

// ============================================================================
// MEMBERSHIP MODEL (for testing)
// ============================================================================

const membershipSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      required: false,
      index: true,
    },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
    },
    membershipCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'expired', 'cancelled'],
      default: 'active',
    },
    workSchedule: {
      hoursPerDay: Number,
      hoursPerWeek: Number,
      workingDays: [Number],
      shiftStart: String,
      shiftEnd: String,
    },
    ...commonAttendanceFields,
  },
  {
    timestamps: true,
  }
);

applyAttendanceIndexes(membershipSchema);

export const Membership = mongoose.models.Membership || mongoose.model('Membership', membershipSchema);

// ============================================================================
// EMPLOYEE MODEL (for testing schedule-aware features)
// ============================================================================

const employeeSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    email: { type: String, required: true },
    employeeCode: String,
    department: String,
    status: {
      type: String,
      enum: ['active', 'pending', 'inactive'],
      default: 'active',
    },
    workSchedule: {
      hoursPerDay: { type: Number, default: 8 },
      hoursPerWeek: { type: Number, default: 40 },
      workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
      shiftStart: { type: String, default: '09:00' },
      shiftEnd: { type: String, default: '18:00' },
    },
    ...commonAttendanceFields,
  },
  {
    timestamps: true,
  }
);

applyAttendanceIndexes(employeeSchema);

export const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

// ============================================================================
// HELPERS
// ============================================================================

export async function createTestMember(
  organizationId: mongoose.Types.ObjectId,
  overrides: Partial<any> = {}
) {
  const member = new Membership({
    organizationId,
    customer: {
      name: 'Test User',
      email: `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
    },
    membershipCode: `MEM-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    status: 'active',
    attendanceEnabled: true,
    currentSession: { isActive: false },
    attendanceStats: {
      totalVisits: 0,
      currentStreak: 0,
      longestStreak: 0,
      engagementLevel: 'inactive',
    },
    ...overrides,
  });

  await member.save();
  return member;
}

export async function createTestMemberWithoutOrg(overrides: Partial<any> = {}) {
  const member = new Membership({
    customer: {
      name: 'Test User',
      email: `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
    },
    membershipCode: `MEM-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    status: 'active',
    attendanceEnabled: true,
    currentSession: { isActive: false },
    attendanceStats: {
      totalVisits: 0,
      currentStreak: 0,
      longestStreak: 0,
      engagementLevel: 'inactive',
    },
    ...overrides,
  });

  await member.save();
  return member;
}

export async function createTestEmployee(
  organizationId: mongoose.Types.ObjectId,
  overrides: Partial<any> = {}
) {
  const employee = new Employee({
    organizationId,
    name: 'Test Employee',
    email: `emp-${Date.now()}@example.com`,
    employeeCode: `EMP-${Date.now()}`,
    status: 'active',
    workSchedule: {
      hoursPerDay: 8,
      hoursPerWeek: 40,
      workingDays: [1, 2, 3, 4, 5],
      shiftStart: '09:00',
      shiftEnd: '18:00',
    },
    attendanceEnabled: true,
    currentSession: { isActive: false },
    attendanceStats: {
      totalVisits: 0,
      currentStreak: 0,
      longestStreak: 0,
      engagementLevel: 'inactive',
    },
    ...overrides,
  });

  await employee.save();
  return employee;
}

