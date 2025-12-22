import ClockInDefault, {
  ClockIn,
  createClockIn,
  isOk,
  commonAttendanceFields,
  createAttendanceSchema,
  // Enum value arrays (new exports)
  ATTENDANCE_STATUS_VALUES,
  CHECK_IN_METHOD_VALUES,
  ENGAGEMENT_LEVEL_VALUES,
  ATTENDANCE_PERIOD_VALUES,
  ATTENDANCE_TYPE_VALUES,
  TIME_SLOT_VALUES,
  CORRECTION_REQUEST_TYPE_VALUES,
  CORRECTION_REQUEST_STATUS_VALUES,
  PRIORITY_VALUES,
  type ClockInConfig,
  // New type exports
  type HistoryParams,
  type OccupancyData,
  type ActiveSessionData,
  type DailyTrendEntry,
  type PeriodStats,
  type ToggleResult,
  type CheckInData,
  type LocationData,
  type DeviceInfo,
  type AttendanceTargetModel,
  type CheckoutExpiredParams,
  type CheckoutExpiredResult,
} from '@classytic/clockin';

import { createEventBus, type Result } from '@classytic/clockin/core';
import { ClockInBuilder } from '@classytic/clockin/clockin';
import { generateDefaultConfig } from '@classytic/clockin/config';
import { ClockInError } from '@classytic/clockin/errors';
import { ATTENDANCE_STATUS, getTimeSlot } from '@classytic/clockin/enums';
import type { CheckInParams } from '@classytic/clockin/types';
import { CheckInFactory } from '@classytic/clockin/factories';

const _defaultExportSanity = ClockInDefault.ClockIn;
void _defaultExportSanity;

const bus = createEventBus();
bus.on('checkIn:recorded', () => {});

const _slot = getTimeSlot(9);
void _slot;

const _status = ATTENDANCE_STATUS.VALID;
void _status;

type _ResultSanity = Result<number, ClockInError>;
type _ParamsSanity = CheckInParams;
type _ConfigSanity = ClockInConfig;

// Validate new type exports
type _HistoryParamsSanity = HistoryParams;
type _OccupancyDataSanity = OccupancyData;
type _ActiveSessionDataSanity = ActiveSessionData;
type _DailyTrendEntrySanity = DailyTrendEntry;
type _PeriodStatsSanity = PeriodStats;
type _ToggleResultSanity = ToggleResult;
type _CheckInDataSanity = CheckInData;
type _LocationDataSanity = LocationData;
type _DeviceInfoSanity = DeviceInfo;
type _AttendanceTargetModelSanity = AttendanceTargetModel;
type _CheckoutExpiredParamsSanity = CheckoutExpiredParams;
type _CheckoutExpiredResultSanity = CheckoutExpiredResult;

// Validate enum value arrays are exported
const _checkInMethods: string[] = CHECK_IN_METHOD_VALUES;
const _attendanceStatuses: string[] = ATTENDANCE_STATUS_VALUES;
const _engagementLevels: string[] = ENGAGEMENT_LEVEL_VALUES;
const _attendancePeriods: string[] = ATTENDANCE_PERIOD_VALUES;
const _attendanceTypes: string[] = ATTENDANCE_TYPE_VALUES;
const _timeSlots: string[] = TIME_SLOT_VALUES;
const _correctionRequestTypes: string[] = CORRECTION_REQUEST_TYPE_VALUES;
const _correctionRequestStatuses: string[] = CORRECTION_REQUEST_STATUS_VALUES;
const _priorities: string[] = PRIORITY_VALUES;
void _checkInMethods;
void _attendanceStatuses;
void _engagementLevels;
void _attendancePeriods;
void _attendanceTypes;
void _timeSlots;
void _correctionRequestTypes;
void _correctionRequestStatuses;
void _priorities;

void commonAttendanceFields;
void createAttendanceSchema;

const builder: ClockInBuilder = ClockIn.create();
void builder;

const _config = generateDefaultConfig('Membership');
void _config;

const _factory = new CheckInFactory();
void _factory;

async function _createAndUse() {
  const instance = await createClockIn({} as any);
  const result = await instance.checkIn.record({} as any);
  if (isOk(result)) void result.value;
}

void _createAndUse;
