/**
 * 📝 Attendance Correction Request Model
 * Employee self-service correction requests
 *
 * Workflow:
 * 1. Employee submits correction request
 * 2. Admin reviews and approves/rejects
 * 3. If approved, correction is applied automatically
 * 4. Employee is notified
 *
 * @module lib/attendance/models/correction-request
 */

import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const { Schema } = mongoose;

const correctionRequestSchema = new Schema(
  {
    // Multi-tenancy
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },

    // Requester (employee/member)
    targetModel: {
      type: String,
      required: true,
      enum: ['Employee', 'Membership'],
    },

    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'targetModel',
      index: true,
    },

    // Request details
    requestType: {
      type: String,
      required: true,
      enum: [
        'update_check_in_time',
        'update_check_out_time',
        'add_missing_attendance',
        'delete_duplicate',
        'override_attendance_type',
      ],
    },

    // Status tracking
    status: {
      type: String,
      required: true,
      enum: ['pending', 'approved', 'rejected', 'applied'],
      default: 'pending',
      index: true,
    },

    // Original data
    checkInId: {
      type: Schema.Types.ObjectId,
      sparse: true, // Not required for add_missing_attendance
    },

    date: {
      type: Date,
      required: true,
      index: true,
    },

    // Requested changes
    requestedChanges: {
      checkInTime: Date,
      checkOutTime: Date,
      attendanceType: String,
      reason: {
        type: String,
        required: true,
        maxlength: 500,
      },
    },

    // Supporting evidence (optional)
    attachments: [
      {
        type: String, // URL or file path
        description: String,
      },
    ],

    // Review details
    reviewedBy: {
      userId: Schema.Types.ObjectId,
      userName: String,
      userRole: String,
    },

    reviewedAt: Date,

    reviewNotes: {
      type: String,
      maxlength: 500,
    },

    // Applied correction details
    appliedAt: Date,

    appliedCorrection: {
      type: Map,
      of: Schema.Types.Mixed,
    },

    // Priority (for urgent requests)
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },

    // Metadata
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
correctionRequestSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
correctionRequestSchema.index({ targetId: 1, status: 1, createdAt: -1 });
correctionRequestSchema.index({ tenantId: 1, date: 1, status: 1 });

// Virtuals
correctionRequestSchema.virtual('requester', {
  refPath: 'targetModel',
  localField: 'targetId',
  foreignField: '_id',
  justOne: true,
});

// Instance methods
correctionRequestSchema.methods.approve = function (adminContext, reviewNotes) {
  this.status = 'approved';
  this.reviewedBy = {
    userId: adminContext.userId,
    userName: adminContext.userName,
    userRole: adminContext.userRole,
  };
  this.reviewedAt = new Date();
  this.reviewNotes = reviewNotes;
};

correctionRequestSchema.methods.reject = function (adminContext, reviewNotes) {
  this.status = 'rejected';
  this.reviewedBy = {
    userId: adminContext.userId,
    userName: adminContext.userName,
    userRole: adminContext.userRole,
  };
  this.reviewedAt = new Date();
  this.reviewNotes = reviewNotes;
};

correctionRequestSchema.methods.markApplied = function (appliedCorrection) {
  this.status = 'applied';
  this.appliedAt = new Date();
  this.appliedCorrection = appliedCorrection;
};

// Plugins
correctionRequestSchema.plugin(mongoosePaginate);

const CorrectionRequest =
  mongoose.models.CorrectionRequest ||
  mongoose.model('CorrectionRequest', correctionRequestSchema);

export default CorrectionRequest;
