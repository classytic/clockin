# Correction Requests

ClockIn supports self-service correction requests stored on the Attendance record.

You can use either the instance API (`clockin.corrections.*`) or the functional API.

## Instance API

```typescript
import { ClockIn, isOk } from '@classytic/clockin';

const clockin = await ClockIn
  .create()
  .withModels({ Attendance, Membership })
  .build();

// Submit a correction request
const submitResult = await clockin.corrections.submit({
  memberId: member._id,
  organizationId,
  year: 2024,
  month: 9,
  targetModel: 'Membership',
  requestType: 'update_check_in_time',
  checkInId: checkInId,
  proposedChanges: {
    checkInTime: new Date('2024-09-01T09:00:00Z'),
    reason: 'Clocked in from the wrong device.',
  },
});

if (isOk(submitResult)) {
  console.log('Request submitted:', submitResult.value._id);
}

// List requests for an attendance record
const listResult = await clockin.corrections.list({
  attendanceId,
  status: 'pending',
});

// Review a request
await clockin.corrections.review({
  attendanceId,
  requestId,
  approved: true,
  notes: 'Approved by admin.',
  context: { userId, userName: 'Admin', userRole: 'admin', organizationId },
});

// Apply a request
await clockin.corrections.apply({
  attendanceId,
  requestId,
  context: { userId, userName: 'Admin', userRole: 'admin', organizationId },
});
```

## Functional API

```typescript
import {
  submitCorrectionRequest,
  listCorrectionRequests,
  reviewCorrectionRequest,
  applyCorrectionRequest,
} from '@classytic/clockin';

await submitCorrectionRequest(clockin, {
  memberId: member._id,
  organizationId,
  year: 2024,
  month: 9,
  targetModel: 'Membership',
  requestType: 'update_check_in_time',
  checkInId: checkInId,
  proposedChanges: {
    checkInTime: new Date('2024-09-01T09:00:00Z'),
    reason: 'Clocked in from the wrong device.',
  },
});
```

## Parameters

### submit

- `memberId` (required): the member/employee ID.
- `organizationId` (required unless single-tenant auto-inject is enabled).
- `year`, `month` (required): the attendance period.
- `targetModel` (required when the attendance record does not exist yet).
- `requestType` (required): one of `update_check_in_time`, `update_check_out_time`,
  `add_missing_attendance`, `delete_duplicate`, `override_attendance_type`.
- `checkInId`: required for all request types except `add_missing_attendance`.
- `proposedChanges`: requested updates with a required `reason`.
- `priority`: optional, defaults to `normal`.
- `context`: optional, for session/user metadata.

### list

- `attendanceId`: list for a specific attendance record.
- or `organizationId`, `memberId`, `year`, `month` (all required together).
- optional filters: `status`, `requestType`, `targetModel`.

### review

- `attendanceId`, `requestId` (required).
- `approved` (required): `true` or `false`.
- `notes` (optional).
- `context` (required): reviewer info and organization.

### apply

- `attendanceId`, `requestId` (required).
- `context` (required): applier info and organization.
