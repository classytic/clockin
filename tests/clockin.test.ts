/**
 * ClockIn Integration Tests
 *
 * Comprehensive tests for the ClockIn library
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  ClockIn,
  createClockIn,
  loggingPlugin,
  notificationPlugin,
  isOk,
  isErr,
  unwrap,
  CORRECTION_REQUEST_TYPE,
} from '../src/index.js';
import { Attendance, Membership, Employee, createTestMember, createTestEmployee, createTestMemberWithoutOrg } from './models.js';

// ============================================================================
// SETUP
// ============================================================================

let mongoServer: MongoMemoryServer;
let testOrgId: mongoose.Types.ObjectId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  testOrgId = new mongoose.Types.ObjectId();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ============================================================================
// BUILDER TESTS
// ============================================================================

describe('ClockIn Builder', () => {
  it('should create ClockIn instance with builder pattern', async () => {
    const clockin = await ClockIn
      .create({ debug: false })
      .withModels({ Attendance, Membership })
      .build();

    expect(clockin).toBeDefined();
    expect(clockin.checkIn).toBeDefined();
    expect(clockin.checkOut).toBeDefined();
    expect(clockin.analytics).toBeDefined();
  });

  it('should throw error when Attendance model is missing', async () => {
    try {
      await ClockIn.create().withModels({} as any).build();
      expect.fail('Should have thrown');
    } catch (error) {
      expect((error as Error).message).toContain('Attendance model is required');
    }
  });

  it('should support single-tenant mode', async () => {
    const clockin = await ClockIn
      .create()
      .withModels({ Attendance, Membership })
      .forSingleTenant() // No args needed - uses internal default
      .build();

    expect(clockin.isSingleTenant).toBe(true);
    expect(clockin.singleTenantOrgId).toBeDefined(); // Has a default tenant ID
  });

  it('should register plugins', async () => {
    const onMilestone = vi.fn();

    const clockin = await ClockIn
      .create()
      .withModels({ Attendance, Membership })
      .withPlugin(loggingPlugin())
      .withPlugin(notificationPlugin({ onMilestone }))
      .build();

    expect(clockin.plugins.getPlugins()).toHaveLength(2);
  });

  it('should support createClockIn shorthand', async () => {
    const clockin = await createClockIn({
      models: { Attendance, Membership },
    });

    expect(clockin).toBeDefined();
    expect(clockin.checkIn).toBeDefined();
  });

  it('should deep merge withTargetModel config preserving nested defaults', async () => {
    // This test verifies the fix for shallow merge issue
    // When configuring only detection.type, other nested properties should be preserved
    const clockin = await ClockIn
      .create({ debug: false })
      .withModels({ Attendance, Membership })
      .withTargetModel('Membership', {
        detection: {
          type: 'time-based',  // Only set this
        },
      })
      .build();

    // Get the config registry from the container
    const configRegistry = clockin.container.get<Map<string, any>>('configRegistry');
    const membershipConfig = configRegistry.get('Membership');

    expect(membershipConfig).toBeDefined();
    expect(membershipConfig.detection.type).toBe('time-based');

    // These should be preserved from defaults (not lost due to shallow merge)
    expect(membershipConfig.detection.rules).toBeDefined();
    expect(membershipConfig.detection.rules.thresholds).toBeDefined();
    expect(membershipConfig.detection.rules.thresholds.fullDay).toBe(1);
    expect(membershipConfig.detection.rules.thresholds.overtime).toBe(10);
    expect(membershipConfig.detection.rules.thresholds.minimal).toBe(0.5);
    expect(membershipConfig.detection.rules.defaultType).toBe('full_day');

    // autoCheckout should also be preserved
    expect(membershipConfig.autoCheckout).toBeDefined();
    expect(membershipConfig.autoCheckout.enabled).toBe(true);
    expect(membershipConfig.autoCheckout.afterHours).toBe(6);

    // validation should also be preserved
    expect(membershipConfig.validation).toBeDefined();
    expect(membershipConfig.validation.allowWeekends).toBe(true);
  });

  it('should deep merge nested thresholds while preserving other threshold values', async () => {
    const clockin = await ClockIn
      .create({ debug: false })
      .withModels({ Attendance, Membership })
      .withTargetModel('Membership', {
        detection: {
          type: 'time-based',
          rules: {
            thresholds: {
              fullDay: 2,  // Override only fullDay
            },
          },
        },
      })
      .build();

    const configRegistry = clockin.container.get<Map<string, any>>('configRegistry');
    const config = configRegistry.get('Membership');

    // The overridden value should be applied
    expect(config.detection.rules.thresholds.fullDay).toBe(2);

    // Other threshold values should be preserved from defaults
    expect(config.detection.rules.thresholds.overtime).toBe(10);
    expect(config.detection.rules.thresholds.minimal).toBe(0.5);

    // defaultType should also be preserved
    expect(config.detection.rules.defaultType).toBe('full_day');
  });

  it('should deep merge Employee config with schedule-aware defaults', async () => {
    const clockin = await ClockIn
      .create({ debug: false })
      .withModels({ Attendance, Employee })
      .withTargetModel('Employee', {
        autoCheckout: {
          afterHours: 10,  // Override only afterHours
        },
      })
      .build();

    const configRegistry = clockin.container.get<Map<string, any>>('configRegistry');
    const config = configRegistry.get('Employee');

    // Should use Employee-specific defaults
    expect(config.detection.type).toBe('schedule-aware');
    expect(config.detection.scheduleSource).toBe('workSchedule');

    // The overridden value
    expect(config.autoCheckout.afterHours).toBe(10);

    // Preserved defaults
    expect(config.autoCheckout.enabled).toBe(true);
    expect(config.autoCheckout.maxSession).toBe(12);

    // Employee-specific detection rules should be preserved
    expect(config.detection.rules.thresholds.overtime).toBe(1.1);
    expect(config.detection.rules.thresholds.fullDay).toBe(0.75);
    expect(config.detection.rules.thresholds.halfDay).toBe(0.4);
    expect(config.detection.rules.fallback).toBeDefined();
    expect(config.detection.rules.fallback.standardHours).toBe(8);
  });
});

// ============================================================================
// CHECK-IN TESTS
// ============================================================================

describe('CheckIn Service', () => {
  let clockin: ClockIn;

  beforeAll(async () => {
    clockin = await ClockIn
      .create({ debug: false })
      .withModels({ Attendance, Membership, Employee })
      .build();
  });

  it('should record a check-in successfully', async () => {
    const member = await createTestMember(testOrgId);

    const result = await clockin.checkIn.record({
      member,
      targetModel: 'Membership',
      data: { method: 'manual' },
      context: { organizationId: testOrgId },
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.checkIn).toBeDefined();
      expect(result.value.stats.totalVisits).toBe(1);
      expect(result.value.stats.currentStreak).toBe(1);
    }
  });

  it('should validate check-in eligibility', async () => {
    const member = await createTestMember(testOrgId);

    const validation = clockin.checkIn.validate(member, 'Membership');

    expect(validation.valid).toBe(true);
  });

  it('should reject check-in for disabled attendance', async () => {
    const member = await createTestMember(testOrgId, {
      attendanceEnabled: false,
    });

    const result = await clockin.checkIn.record({
      member,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('ATTENDANCE_NOT_ENABLED');
    }
  });

  it('should prevent duplicate check-ins', async () => {
    const member = await createTestMember(testOrgId);

    // First check-in
    const first = await clockin.checkIn.record({
      member,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });
    expect(isOk(first)).toBe(true);

    // Get updated member
    const updatedMember = await Membership.findById(member._id);

    // Second check-in (too soon)
    const second = await clockin.checkIn.record({
      member: updatedMember!,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    expect(isErr(second)).toBe(true);
    if (isErr(second)) {
      expect(second.error.code).toBe('DUPLICATE_CHECK_IN');
    }
  });

  it('should update currentSession on check-in', async () => {
    const member = await createTestMember(testOrgId);

    const result = await clockin.checkIn.record({
      member,
      targetModel: 'Membership',
      data: { method: 'qr_code' },
      context: { organizationId: testOrgId },
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const updated = result.value.updatedMember;
      expect(updated.currentSession.isActive).toBe(true);
      expect(updated.currentSession.checkInId).toBeDefined();
      expect(updated.currentSession.method).toBe('qr_code');
    }
  });

  it('should allow missing member.organizationId in single-tenant mode (auto-inject)', async () => {
    const singleTenantClockin = await ClockIn
      .create({ debug: false })
      .withModels({ Attendance, Membership })
      .forSingleTenant() // No organizationId needed!
      .build();

    const member = await createTestMemberWithoutOrg();

    const result = await singleTenantClockin.checkIn.record({
      member,
      targetModel: 'Membership',
      // No context.organizationId on purpose
    });

    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      // Auto-inject should have written organizationId to the member record
      const refreshed = await Membership.findById(member._id);
      // Should match the default single-tenant org ID
      expect(refreshed?.organizationId?.toString()).toBe(singleTenantClockin.singleTenantOrgId?.toString());
    }
  });
});

// ============================================================================
// CHECK-OUT TESTS
// ============================================================================

describe('CheckOut Service', () => {
  let clockin: ClockIn;

  beforeAll(async () => {
    clockin = await ClockIn
      .create({ debug: false })
      .withModels({ Attendance, Membership, Employee })
      .build();
  });

  it('should record a check-out successfully', async () => {
    const member = await createTestMember(testOrgId);

    // First check in
    const checkInResult = await clockin.checkIn.record({
      member,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    expect(isOk(checkInResult)).toBe(true);
    const checkInId = unwrap(checkInResult).checkIn._id;

    // Then check out
    const checkOutResult = await clockin.checkOut.record({
      member: unwrap(checkInResult).updatedMember,
      targetModel: 'Membership',
      checkInId,
      context: { organizationId: testOrgId },
    });

    expect(isOk(checkOutResult)).toBe(true);
    if (isOk(checkOutResult)) {
      expect(checkOutResult.value.duration).toBeGreaterThanOrEqual(0);
      expect(checkOutResult.value.checkIn.checkOutAt).toBeDefined();
    }
  });

  it('should recompute work-day counters on check-out', async () => {
    const member = await createTestMember(testOrgId);

    const checkInResult = await clockin.checkIn.record({
      member,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    expect(isOk(checkInResult)).toBe(true);
    const checkInId = unwrap(checkInResult).checkIn._id;

    const attendance = await Attendance.findOne({
      tenantId: testOrgId,
      targetModel: 'Membership',
      targetId: member._id,
    });

    expect(attendance).toBeDefined();
    if (!attendance) {
      return;
    }

    attendance.checkIns.push(
      { timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), attendanceType: 'half_day_morning' },
      { timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), attendanceType: 'paid_leave' },
      { timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), attendanceType: 'overtime' }
    );
    await attendance.save();

    const checkOutResult = await clockin.checkOut.record({
      member: unwrap(checkInResult).updatedMember,
      targetModel: 'Membership',
      checkInId,
      context: { organizationId: testOrgId },
    });

    expect(isOk(checkOutResult)).toBe(true);

    const refreshed = await Attendance.findById(attendance._id);
    expect(refreshed?.fullDaysCount).toBe(1);
    expect(refreshed?.halfDaysCount).toBe(1);
    expect(refreshed?.paidLeaveDaysCount).toBe(1);
    expect(refreshed?.overtimeDaysCount).toBe(1);
    expect(refreshed?.totalWorkDays).toBe(3.5);
  });

  it('should batch check-out expired sessions', async () => {
    const member = await createTestMember(testOrgId);

    const checkInResult = await clockin.checkIn.record({
      member,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    expect(isOk(checkInResult)).toBe(true);

    await Membership.findByIdAndUpdate(member._id, {
      $set: {
        'currentSession.expectedCheckOutAt': new Date(Date.now() - 60 * 1000),
      },
    });

    const result = await clockin.checkOut.checkoutExpired({
      organizationId: testOrgId,
      targetModel: 'Membership',
      limit: 10,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.processed).toBe(1);
      expect(result.value.failed).toBe(0);
    }

    const refreshedMember = await Membership.findById(member._id).select('currentSession');
    expect(refreshedMember?.currentSession?.isActive).toBe(false);

    const attendance = await Attendance.findOne({
      tenantId: testOrgId,
      targetModel: 'Membership',
      targetId: member._id,
    });
    expect(attendance?.checkIns[0]?.checkOutAt).toBeDefined();
  });

  it('should toggle check-in/out correctly', async () => {
    const member = await createTestMember(testOrgId);

    // First toggle -> check-in
    const toggle1 = await clockin.checkOut.toggle({
      member,
      targetModel: 'Membership',
      data: { method: 'rfid' },
      context: { organizationId: testOrgId },
    });

    expect(isOk(toggle1)).toBe(true);
    if (isOk(toggle1)) {
      expect(toggle1.value.action).toBe('check-in');
    }

    // Get updated member
    const updatedMember = await Membership.findById(member._id);

    // Second toggle -> check-out
    const toggle2 = await clockin.checkOut.toggle({
      member: updatedMember!,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    expect(isOk(toggle2)).toBe(true);
    if (isOk(toggle2)) {
      expect(toggle2.value.action).toBe('check-out');
    }
  });

  it('should return error for non-existent session', async () => {
    const member = await createTestMember(testOrgId);

    const result = await clockin.checkOut.record({
      member,
      targetModel: 'Membership',
      checkInId: new mongoose.Types.ObjectId(),
      context: { organizationId: testOrgId },
    });

    expect(isErr(result)).toBe(true);
  });

  it('should get current occupancy', async () => {
    // Create members and check them in
    const member1 = await createTestMember(testOrgId);
    const member2 = await createTestMember(testOrgId);

    await clockin.checkIn.record({
      member: member1,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    await clockin.checkIn.record({
      member: member2,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    const occupancy = await clockin.checkOut.getOccupancy({
      organizationId: testOrgId,
    });

    expect(isOk(occupancy)).toBe(true);
    if (isOk(occupancy)) {
      expect(occupancy.value.total).toBe(2);
      expect(occupancy.value.byType['Membership']?.count).toBe(2);
    }
  });
});

// ============================================================================
// CORRECTIONS TESTS
// ============================================================================

describe('Correction Requests', () => {
  let clockin: ClockIn;

  beforeAll(async () => {
    clockin = await ClockIn
      .create({ debug: false })
      .withModels({ Attendance, Membership })
      .build();
  });

  it('should submit, review, and apply a correction request', async () => {
    const member = await createTestMember(testOrgId);

    const checkInResult = await clockin.checkIn.record({
      member,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    expect(isOk(checkInResult)).toBe(true);

    const attendance = await Attendance.findOne({
      tenantId: testOrgId,
      targetId: member._id,
    });

    expect(attendance).toBeTruthy();
    if (!attendance) {
      return;
    }

    const checkIn = attendance.checkIns[0];
    const originalTime = new Date(checkIn.timestamp);
    const newTime = new Date(originalTime.getTime() - 60 * 60 * 1000);

    const submitResult = await clockin.corrections.submit({
      memberId: member._id,
      organizationId: testOrgId,
      year: attendance.year,
      month: attendance.month,
      targetModel: 'Membership',
      requestType: CORRECTION_REQUEST_TYPE.UPDATE_CHECK_IN_TIME,
      checkInId: checkIn._id,
      proposedChanges: {
        checkInTime: newTime,
        reason: 'Device time was off',
      },
    });

    expect(isOk(submitResult)).toBe(true);
    if (!isOk(submitResult)) {
      return;
    }

    const listResult = await clockin.corrections.list({
      attendanceId: attendance._id,
    });

    expect(isOk(listResult)).toBe(true);
    if (isOk(listResult)) {
      expect(listResult.value.length).toBe(1);
    }

    const reviewerId = new mongoose.Types.ObjectId();
    const reviewResult = await clockin.corrections.review({
      attendanceId: attendance._id,
      requestId: submitResult.value._id!,
      approved: true,
      notes: 'Approved',
      context: {
        userId: reviewerId,
        userName: 'Admin',
        userRole: 'admin',
        organizationId: testOrgId,
      },
    });

    expect(isOk(reviewResult)).toBe(true);

    const applyResult = await clockin.corrections.apply({
      attendanceId: attendance._id,
      requestId: submitResult.value._id!,
      context: {
        userId: reviewerId,
        userName: 'Admin',
        userRole: 'admin',
        organizationId: testOrgId,
      },
    });

    expect(isOk(applyResult)).toBe(true);

    const updated = await Attendance.findById(attendance._id);
    expect(updated?.correctionRequests[0]?.status).toBe('applied');
    expect(updated?.checkIns[0]?.timestamp?.toISOString()).toBe(newTime.toISOString());
  });
});

// ============================================================================
// ANALYTICS TESTS
// ============================================================================

describe('Analytics Service', () => {
  let clockin: ClockIn;

  beforeAll(async () => {
    clockin = await ClockIn
      .create({ debug: false })
      .withModels({ Attendance, Membership, Employee })
      .build();
  });

  it('should get dashboard analytics', async () => {
    // Create some test data
    const member = await createTestMember(testOrgId);
    await clockin.checkIn.record({
      member,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    const result = await clockin.analytics.dashboard({
      MemberModel: Membership,
      organizationId: testOrgId,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.summary).toBeDefined();
      expect(result.value.summary.totalMembers).toBeGreaterThanOrEqual(1);
      expect(result.value.engagementDistribution).toBeDefined();
    }
  });

  it('should get member history', async () => {
    const member = await createTestMember(testOrgId);
    await clockin.checkIn.record({
      member,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    const result = await clockin.analytics.history({
      targetId: member._id,
      organizationId: testOrgId,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.length).toBeGreaterThan(0);
      expect(result.value[0].checkIns.length).toBeGreaterThan(0);
    }
  });

  it('should get daily trend', async () => {
    const member = await createTestMember(testOrgId);
    await clockin.checkIn.record({
      member,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    const result = await clockin.analytics.dailyTrend({
      organizationId: testOrgId,
      days: 7,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.length).toBeGreaterThan(0);
    }
  });

  it('should get time slot distribution', async () => {
    const member = await createTestMember(testOrgId);
    await clockin.checkIn.record({
      member,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    const result = await clockin.analytics.timeSlotDistribution({
      organizationId: testOrgId,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toHaveProperty('morning');
      expect(result.value).toHaveProperty('afternoon');
    }
  });
});

// ============================================================================
// EVENT SYSTEM TESTS
// ============================================================================

describe('Event System', () => {
  it('should emit checkIn:recorded event', async () => {
    const onCheckIn = vi.fn();

    const clockin = await ClockIn
      .create({ debug: false })
      .withModels({ Attendance, Membership })
      .build();

    clockin.on('checkIn:recorded', onCheckIn);

    const member = await createTestMember(testOrgId);
    await clockin.checkIn.record({
      member,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    // Wait for async event
    await new Promise((r) => setTimeout(r, 100));

    expect(onCheckIn).toHaveBeenCalled();
    expect(onCheckIn.mock.calls[0][0].data.member.id.toString()).toBe(member._id.toString());
  });

  it('should emit checkOut:recorded event', async () => {
    const onCheckOut = vi.fn();

    const clockin = await ClockIn
      .create({ debug: false })
      .withModels({ Attendance, Membership })
      .build();

    clockin.on('checkOut:recorded', onCheckOut);

    const member = await createTestMember(testOrgId);
    const checkInResult = await clockin.checkIn.record({
      member,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    expect(isOk(checkInResult)).toBe(true);
    const checkInId = unwrap(checkInResult).checkIn._id;

    await clockin.checkOut.record({
      member: unwrap(checkInResult).updatedMember,
      targetModel: 'Membership',
      checkInId,
      context: { organizationId: testOrgId },
    });

    await new Promise((r) => setTimeout(r, 100));

    expect(onCheckOut).toHaveBeenCalled();
  });
});

// ============================================================================
// PLUGIN TESTS
// ============================================================================

describe('Plugin System', () => {
  it('should call plugin hooks', async () => {
    const afterCheckIn = vi.fn();
    const afterCheckOut = vi.fn();

    const testPlugin = {
      name: 'test-plugin',
      afterCheckIn,
      afterCheckOut,
    };

    const clockin = await ClockIn
      .create({ debug: false })
      .withModels({ Attendance, Membership })
      .withPlugin(testPlugin)
      .build();

    const member = await createTestMember(testOrgId);
    const checkInResult = await clockin.checkIn.record({
      member,
      targetModel: 'Membership',
      context: { organizationId: testOrgId },
    });

    expect(afterCheckIn).toHaveBeenCalled();

    if (isOk(checkInResult)) {
      await clockin.checkOut.record({
        member: checkInResult.value.updatedMember,
        targetModel: 'Membership',
        checkInId: checkInResult.value.checkIn._id,
        context: { organizationId: testOrgId },
      });

      expect(afterCheckOut).toHaveBeenCalled();
    }
  });
});

// ============================================================================
// RESULT TYPE TESTS
// ============================================================================

describe('Result Type', () => {
  it('should work with ok values', () => {
    const result = { ok: true as const, value: 42 };
    expect(isOk(result)).toBe(true);
    expect(unwrap(result)).toBe(42);
  });

  it('should work with err values', () => {
    const result = { ok: false as const, error: new Error('test') };
    expect(isErr(result)).toBe(true);
    expect(() => unwrap(result)).toThrow('test');
  });
});
