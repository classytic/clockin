/**
 * 📋 Attendance API JSON Schemas
 * Fastify/JSON schema definitions for API validation
 *
 * @module lib/attendance/schemas/api
 */

import {
  CHECK_IN_METHOD_VALUES,
  ENGAGEMENT_LEVEL_VALUES,
  ATTENDANCE_PERIOD_VALUES,
} from '../enums.js';

/**
 * Check-in request body
 */
export const checkInBody = {
  type: 'object',
  required: ['memberIdentifier'],
  properties: {
    memberIdentifier: {
      type: 'string',
      description: 'Member email, phone, or membership ID',
    },
    method: {
      type: 'string',
      enum: CHECK_IN_METHOD_VALUES,
      default: 'manual',
      description: 'Check-in method',
    },
    notes: {
      type: 'string',
      maxLength: 500,
      description: 'Optional notes',
    },
    location: {
      type: 'object',
      properties: {
        lat: { type: 'number' },
        lng: { type: 'number' },
        accuracy: { type: 'number' },
      },
    },
    device: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        platform: { type: 'string' },
        appVersion: { type: 'string' },
      },
    },
  },
};

/**
 * Check-in response
 */
export const checkInResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        checkInId: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        member: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
          },
        },
        stats: {
          type: 'object',
          properties: {
            totalVisits: { type: 'number' },
            thisMonthVisits: { type: 'number' },
            currentStreak: { type: 'number' },
            engagementLevel: { type: 'string', enum: ENGAGEMENT_LEVEL_VALUES },
          },
        },
        milestones: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              value: { type: 'number' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
};

/**
 * Get attendance history query params
 */
export const attendanceHistoryQuery = {
  type: 'object',
  properties: {
    year: {
      type: 'integer',
      minimum: 2020,
      maximum: 2100,
    },
    month: {
      type: 'integer',
      minimum: 1,
      maximum: 12,
    },
    startDate: {
      type: 'string',
      format: 'date',
    },
    endDate: {
      type: 'string',
      format: 'date',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 1000,
      default: 100,
    },
  },
};

/**
 * Analytics dashboard query
 */
export const analyticsQuery = {
  type: 'object',
  properties: {
    period: {
      type: 'string',
      enum: ATTENDANCE_PERIOD_VALUES,
      default: 'monthly',
    },
    startDate: {
      type: 'string',
      format: 'date',
    },
    endDate: {
      type: 'string',
      format: 'date',
    },
    groupBy: {
      type: 'string',
      enum: ['day', 'week', 'month', 'timeSlot', 'dayOfWeek'],
      default: 'day',
    },
  },
};

/**
 * Bulk check-in body (for importing historical data)
 */
export const bulkCheckInBody = {
  type: 'object',
  required: ['checkIns'],
  properties: {
    checkIns: {
      type: 'array',
      minItems: 1,
      maxItems: 1000,
      items: {
        type: 'object',
        required: ['memberIdentifier', 'timestamp'],
        properties: {
          memberIdentifier: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          method: { type: 'string', enum: CHECK_IN_METHOD_VALUES },
          notes: { type: 'string' },
        },
      },
    },
    overwrite: {
      type: 'boolean',
      default: false,
      description: 'Overwrite existing check-ins',
    },
  },
};

/**
 * Update stats body (manual recalculation)
 */
export const updateStatsBody = {
  type: 'object',
  properties: {
    memberIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'Specific member IDs to update (leave empty for all)',
    },
    recalculate: {
      type: 'boolean',
      default: false,
      description: 'Full recalculation from raw data',
    },
  },
};

/**
 * Export all schemas
 */
export default {
  checkInBody,
  checkInResponse,
  attendanceHistoryQuery,
  analyticsQuery,
  bulkCheckInBody,
  updateStatsBody,
};

