/**
 * 🧹 Cleanup Stale Sessions Job
 * Automatically resets currentSession for members with expired sessions
 *
 * This job handles edge cases where auto-checkout fails:
 * - Server crashes during active session
 * - Auto-checkout function not called
 * - Database write failures
 *
 * Recommended: Run every 5-10 minutes via cron/scheduler
 *
 * Usage example - Run manually:
 *   import { cleanupStaleSessions } from '#lib/attendance/jobs/cleanup-stale-sessions.js';
 *   const result = await cleanupStaleSessions();
 *
 * Usage example - Schedule with node-cron (every 5 minutes):
 *   import cron from 'node-cron';
 *   cron.schedule('..every 5 minutes..', async () => {
 *     await cleanupStaleSessions();
 *   });
 *
 * @module lib/attendance/jobs/cleanup-stale-sessions
 */

import mongoose from 'mongoose';
import logger from '../utils/logger.js';

/**
 * Clean up stale sessions across all models
 * Resets currentSession for members with expired expectedCheckOutAt
 *
 * @param {Object} options - Configuration options
 * @param {Array<String>} options.models - Model names to clean (default: ['Membership', 'Employee'])
 * @param {Boolean} options.dryRun - If true, only count without updating (default: false)
 * @returns {Promise<Object>} Results by model
 */
export async function cleanupStaleSessions(options = {}) {
  const {
    models = ['Membership', 'Employee'],
    dryRun = false,
  } = options;

  const now = new Date();
  const results = {};

  logger.info('Starting stale session cleanup', {
    models,
    dryRun,
    timestamp: now.toISOString(),
  });

  for (const modelName of models) {
    try {
      // Check if model exists
      if (!mongoose.models[modelName]) {
        logger.warn(`Model ${modelName} not found, skipping`);
        continue;
      }

      const Model = mongoose.model(modelName);

      // Find members with expired sessions still marked as active
      const query = {
        'currentSession.isActive': true,
        'currentSession.expectedCheckOutAt': { $lt: now },
      };

      if (dryRun) {
        const count = await Model.countDocuments(query);
        results[modelName] = {
          found: count,
          cleaned: 0,
          dryRun: true,
        };
        logger.info(`[DRY RUN] Found ${count} stale sessions in ${modelName}`);
        continue;
      }

      // Reset currentSession for all stale sessions
      const update = {
        $set: {
          'currentSession': {
            isActive: false,
            checkInId: null,
            checkInTime: null,
            expectedCheckOutAt: null,
            method: null,
          },
        },
      };

      const updateResult = await Model.updateMany(query, update);

      results[modelName] = {
        found: updateResult.matchedCount,
        cleaned: updateResult.modifiedCount,
        dryRun: false,
      };

      if (updateResult.modifiedCount > 0) {
        logger.warn(`Cleaned ${updateResult.modifiedCount} stale sessions in ${modelName}`, {
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount,
        });
      }

    } catch (error) {
      logger.error(`Failed to clean stale sessions for ${modelName}`, {
        error: error.message,
        stack: error.stack,
      });
      results[modelName] = {
        error: error.message,
      };
    }
  }

  const totalCleaned = Object.values(results)
    .filter(r => !r.error)
    .reduce((sum, r) => sum + (r.cleaned || 0), 0);

  logger.info('Stale session cleanup completed', {
    totalCleaned,
    results,
  });

  return {
    timestamp: now,
    totalCleaned,
    byModel: results,
  };
}

/**
 * Cleanup stale sessions for a specific organization
 * Useful for multi-tenant isolation
 *
 * @param {ObjectId|String} organizationId - Organization ID
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Results
 */
export async function cleanupStaleSessionsForOrg(organizationId, options = {}) {
  const {
    models = ['Membership', 'Employee'],
    dryRun = false,
  } = options;

  const now = new Date();
  const results = {};

  logger.info('Starting stale session cleanup for organization', {
    organizationId,
    models,
    dryRun,
  });

  for (const modelName of models) {
    try {
      if (!mongoose.models[modelName]) {
        continue;
      }

      const Model = mongoose.model(modelName);

      const query = {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        'currentSession.isActive': true,
        'currentSession.expectedCheckOutAt': { $lt: now },
      };

      if (dryRun) {
        const count = await Model.countDocuments(query);
        results[modelName] = { found: count, cleaned: 0, dryRun: true };
        continue;
      }

      const update = {
        $set: {
          'currentSession': {
            isActive: false,
            checkInId: null,
            checkInTime: null,
            expectedCheckOutAt: null,
            method: null,
          },
        },
      };

      const updateResult = await Model.updateMany(query, update);

      results[modelName] = {
        found: updateResult.matchedCount,
        cleaned: updateResult.modifiedCount,
        dryRun: false,
      };

    } catch (error) {
      logger.error(`Failed to clean stale sessions for ${modelName}`, {
        error: error.message,
        organizationId,
      });
      results[modelName] = { error: error.message };
    }
  }

  const totalCleaned = Object.values(results)
    .filter(r => !r.error)
    .reduce((sum, r) => sum + (r.cleaned || 0), 0);

  return {
    organizationId,
    timestamp: now,
    totalCleaned,
    byModel: results,
  };
}

/**
 * Get count of currently stale sessions (for monitoring)
 * @param {Array<String>} models - Models to check
 * @returns {Promise<Object>} Count by model
 */
export async function getStaleSessionCount(models = ['Membership', 'Employee']) {
  const now = new Date();
  const counts = {};

  for (const modelName of models) {
    try {
      if (!mongoose.models[modelName]) {
        continue;
      }

      const Model = mongoose.model(modelName);

      const count = await Model.countDocuments({
        'currentSession.isActive': true,
        'currentSession.expectedCheckOutAt': { $lt: now },
      });

      counts[modelName] = count;

    } catch (error) {
      logger.error(`Failed to count stale sessions for ${modelName}`, {
        error: error.message,
      });
      counts[modelName] = -1; // Indicates error
    }
  }

  return {
    timestamp: now,
    total: Object.values(counts).reduce((sum, c) => sum + (c > 0 ? c : 0), 0),
    byModel: counts,
  };
}

export default {
  cleanupStaleSessions,
  cleanupStaleSessionsForOrg,
  getStaleSessionCount,
};
