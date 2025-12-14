# 🔔 Notification / Event Integrations (Deprecated doc)

## How Notification Services Work in Production

This file describes notification/event integrations from the older architecture.

**Updated v2 docs:**
- `docs/PLUGINS_AND_EVENTS.md`

You can still use the concepts in this file (queues, email/SMS/push), but the integration points in v2 are:
- `clockin.on(...)` events
- Plugin hooks (`afterCheckIn`, `onMilestone`, etc.)

> **Note**: This is an **optional feature guide**. The attendance library works perfectly without notifications. This document shows you how to add email/SMS/push notifications if you need them in your application.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Components](#components)
3. [Integration with Attendance](#integration-with-attendance)
4. [Production Examples](#production-examples)
5. [Implementation Guide](#implementation-guide)
6. [Best Practices](#best-practices)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────┐
│  Attendance     │
│  Library        │
└────────┬────────┘
         │ Events
         ▼
┌─────────────────┐
│  Event Bus      │  ◄── attendanceEvents.on('milestone:achieved', ...)
│  (EventEmitter) │
└────────┬────────┘
         │ Triggers
         ▼
┌─────────────────┐
│  Notification   │
│  Service        │
└────────┬────────┘
         │ Dispatches
         ▼
┌─────────────────────────────────────────┐
│  Notification Channels                  │
├─────────────┬─────────────┬────────────┤
│   Email     │    SMS      │  Push      │
│  (Resend)   │  (Twilio)   │ (Firebase) │
└─────────────┴─────────────┴────────────┘
```

---

## Components

### 1. **Event Bus** (Already Implemented)

Located at: `lib/attendance/events/attendance.events.js`

**What it does:**
- Emits events when things happen (check-in, milestone, at-risk)
- Allows decoupled communication
- Multiple listeners can react to same event

**Events emitted:**
```javascript
attendanceEvents.emit('checkIn:recorded', { member, stats, checkIn });
attendanceEvents.emit('milestone:achieved', { member, milestone });
attendanceEvents.emit('engagement:changed', { member, from, to });
attendanceEvents.emit('member:atRisk', { member, stats });
```

---

### 2. **Notification Service** (To Be Implemented)

**Location:** `modules/notification/notification.service.js`

**Responsibilities:**
- Listen to events from various sources
- Determine who to notify and how
- Choose notification channel (email, SMS, push)
- Queue notifications for delivery
- Track delivery status
- Handle retries

**Core Methods:**
```javascript
class NotificationService {
  // Send notification
  async send({ to, channel, template, data });

  // Send to multiple recipients
  async sendBatch(notifications);

  // Get notification status
  async getStatus(notificationId);

  // Get user's notification preferences
  async getPreferences(userId);
}
```

---

### 3. **Notification Channels** (External Services)

#### Email Channel (via Resend, SendGrid, or AWS SES)

```javascript
// email.channel.js
import { Resend } from 'resend';

class EmailChannel {
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async send({ to, subject, template, data }) {
    return await this.resend.emails.send({
      from: 'FitVerse <noreply@fitverse.com>',
      to,
      subject,
      react: templates[template](data),
    });
  }
}
```

**Popular Email Services:**
- **Resend** - Modern, developer-friendly (recommended)
- **SendGrid** - Enterprise-grade, 100/day free tier
- **AWS SES** - Cheap at scale, complex setup
- **Mailgun** - Reliable, good pricing

#### SMS Channel (via Twilio)

```javascript
// sms.channel.js
import twilio from 'twilio';

class SMSChannel {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async send({ to, message }) {
    return await this.client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
      body: message,
    });
  }
}
```

**Popular SMS Services:**
- **Twilio** - Industry standard, reliable
- **AWS SNS** - Cheap, limited features
- **Vonage (Nexmo)** - Good international coverage

#### Push Notification Channel (via Firebase)

```javascript
// push.channel.js
import admin from 'firebase-admin';

class PushChannel {
  async send({ token, title, body, data }) {
    return await admin.messaging().send({
      token,
      notification: { title, body },
      data,
    });
  }
}
```

**Popular Push Services:**
- **Firebase Cloud Messaging (FCM)** - Free, cross-platform
- **OneSignal** - Feature-rich, generous free tier
- **Pusher Beams** - Developer-friendly

---

### 4. **Notification Queue** (Optional but Recommended)

**Purpose:** Don't block API requests waiting for email/SMS delivery

**Options:**

#### Option A: BullMQ (Redis-based)
```javascript
import { Queue, Worker } from 'bullmq';

// Add to queue
const notificationQueue = new Queue('notifications');
await notificationQueue.add('send-email', {
  to: 'user@example.com',
  template: 'milestone_achieved',
  data: { visits: 100 }
});

// Process queue
const worker = new Worker('notifications', async (job) => {
  await notificationService.send(job.data);
});
```

**Pros:** Fast, reliable, Redis required
**Cons:** Additional infrastructure

#### Option B: Database Queue (Simple)
```javascript
// Notification queue table
const NotificationQueue = new Schema({
  to: String,
  channel: String,
  template: String,
  data: Object,
  status: String, // 'pending', 'sent', 'failed'
  attempts: Number,
  scheduledFor: Date,
});

// Cron job processes queue every minute
cron.schedule('* * * * *', async () => {
  const pending = await NotificationQueue.find({
    status: 'pending',
    scheduledFor: { $lte: new Date() }
  });

  for (const notification of pending) {
    await notificationService.send(notification);
  }
});
```

**Pros:** Simple, no extra infrastructure
**Cons:** Slower, less reliable

---

## Integration with Attendance

### Step 1: Create Notification Service

```javascript
// modules/notification/notification.service.js
import { attendanceEvents } from '@classytic/clockin';
import { EmailChannel } from './channels/email.channel.js';
import { SMSChannel } from './channels/sms.channel.js';

class NotificationService {
  constructor() {
    this.channels = {
      email: new EmailChannel(),
      sms: new SMSChannel(),
    };

    // Register event listeners
    this.registerAttendanceListeners();
  }

  registerAttendanceListeners() {
    // Milestone notifications
    attendanceEvents.on('milestone:achieved', async ({ member, milestone }) => {
      await this.send({
        to: member.customer.email,
        channel: 'email',
        template: 'milestone_achieved',
        data: {
          memberName: member.customer.name,
          milestoneType: milestone.type,
          milestoneValue: milestone.value,
          message: milestone.message,
        },
      });
    });

    // At-risk member alerts
    attendanceEvents.on('member:atRisk', async ({ member, stats }) => {
      await this.send({
        to: member.customer.email,
        channel: 'email',
        template: 'we_miss_you',
        data: {
          memberName: member.customer.name,
          lastVisit: stats.lastVisitedAt,
          daysSince: stats.daysSinceLastVisit,
        },
      });
    });

    // Engagement changed
    attendanceEvents.on('engagement:changed', async ({ member, from, to }) => {
      // Only notify on positive changes
      if (isPositiveChange(from, to)) {
        await this.send({
          to: member.customer.email,
          channel: 'email',
          template: 'engagement_upgrade',
          data: {
            memberName: member.customer.name,
            newLevel: to,
          },
        });
      }
    });
  }

  async send({ to, channel, template, data }) {
    try {
      // Get user preferences (opt-out check)
      const preferences = await this.getPreferences(to);
      if (!preferences[channel]) {
        return { sent: false, reason: 'user_opted_out' };
      }

      // Send via channel
      const result = await this.channels[channel].send({
        to,
        template,
        data,
      });

      // Log delivery
      await this.logDelivery({
        to,
        channel,
        template,
        status: 'sent',
        result,
      });

      return { sent: true, id: result.id };
    } catch (error) {
      // Log failure
      await this.logDelivery({
        to,
        channel,
        template,
        status: 'failed',
        error: error.message,
      });

      throw error;
    }
  }

  async getPreferences(userId) {
    // TODO: Fetch from database
    return {
      email: true,
      sms: true,
      push: true,
    };
  }

  async logDelivery(data) {
    // TODO: Store in NotificationLog collection
    console.log('[Notification]', data);
  }
}

export const notificationService = new NotificationService();
```

### Step 2: Create Email Templates

```javascript
// modules/notification/templates/milestone_achieved.jsx
import { Html, Text, Button } from '@react-email/components';

export default function MilestoneAchieved({ memberName, milestoneValue, message }) {
  return (
    <Html>
      <Text>Hi {memberName},</Text>
      <Text>🎉 Congratulations! {message}</Text>
      <Text>You've reached {milestoneValue} total visits!</Text>
      <Text>Keep up the great work!</Text>
      <Button href="https://fitverse.com/dashboard">
        View Your Stats
      </Button>
    </Html>
  );
}
```

### Step 3: Initialize in Bootstrap

```javascript
// bootstrap/notification.js
import { notificationService } from './notification/notification.service.js';

export async function initializeNotifications() {
  console.log('✅ Notification service initialized');
  console.log('📧 Email channel: Ready');
  console.log('📱 SMS channel: Ready');

  // Notification service automatically listens to attendance events
  // No additional wiring needed!
}
```

---

## Production Examples

### Example 1: Gym Membership Milestone

**Trigger:** Member reaches 100 visits

**Flow:**
1. Check-in happens → `attendance.checkIn()`
2. Library detects milestone → `attendanceEvents.emit('milestone:achieved')`
3. Notification service listens → `notificationService.send()`
4. Email sent via Resend → Member receives email

**Email Content:**
```
Subject: 🎉 You've reached 100 visits!

Hi John,

Congratulations! You've just hit an incredible milestone: 100 total visits!

Your dedication is truly inspiring. Keep up the amazing work!

[View Your Progress] [Claim Your Badge]

- FitVerse Team
```

---

### Example 2: At-Risk Member Re-engagement

**Trigger:** Member hasn't visited in 14 days

**Flow:**
1. Daily cron job checks engagement → `recalculateStats()`
2. Engagement changes to 'at_risk' → `attendanceEvents.emit('member:atRisk')`
3. Re-engagement email sent

**Email Content:**
```
Subject: We miss you at the gym!

Hi Sarah,

We noticed it's been 14 days since your last visit. Everything okay?

Your current streak: 0 days
Previous best: 30 days

Let's get you back on track! We're here to help.

[Book a Session] [Talk to a Trainer]
```

---

### Example 3: Streak Celebration

**Trigger:** Member reaches 30-day streak

**Flow:**
1. Check-in extends streak to 30 → `attendanceEvents.emit('milestone:achieved')`
2. Email + Push notification sent
3. Social media share prompt

**Push Notification:**
```
🔥 30-Day Streak!
You're on fire! 30 days in a row!
Tap to share your achievement →
```

---

## Implementation Guide

### Phase 1: Basic Email (Week 1-2)

1. **Install dependencies**
   ```bash
   npm install resend @react-email/components
   ```

2. **Create email channel**
   - Set up Resend account
   - Create email templates
   - Test delivery

3. **Connect to events**
   - Listen to `milestone:achieved`
   - Send congratulations email

### Phase 2: SMS Notifications (Week 3)

1. **Install Twilio**
   ```bash
   npm install twilio
   ```

2. **Create SMS channel**
   - Set up Twilio account
   - Buy phone number
   - Test SMS delivery

3. **Add SMS preferences**
   - User opt-in/opt-out
   - SMS template system

### Phase 3: Push Notifications (Week 4)

1. **Set up Firebase**
   ```bash
   npm install firebase-admin
   ```

2. **Create push channel**
   - Configure FCM
   - Handle device tokens
   - Test push delivery

3. **Mobile app integration**
   - Register devices
   - Handle notification clicks

### Phase 4: Advanced Features (Week 5-6)

1. **Notification queue** (BullMQ)
2. **Delivery tracking**
3. **A/B testing templates**
4. **Analytics dashboard**

---

## Best Practices

### 1. **User Preferences**

Always respect user notification preferences:

```javascript
const NotificationPreferences = new Schema({
  userId: ObjectId,
  channels: {
    email: { enabled: Boolean, categories: [String] },
    sms: { enabled: Boolean, categories: [String] },
    push: { enabled: Boolean, categories: [String] },
  },
});
```

### 2. **Rate Limiting**

Don't spam users:

```javascript
// Max 1 milestone email per day
const lastMilestoneEmail = await getLastNotification(userId, 'milestone_achieved');
if (lastMilestoneEmail && isSameDay(lastMilestoneEmail.sentAt, new Date())) {
  return; // Skip
}
```

### 3. **Delivery Tracking**

Log everything:

```javascript
const NotificationLog = new Schema({
  userId: ObjectId,
  channel: String,
  template: String,
  status: String, // 'queued', 'sent', 'delivered', 'failed', 'bounced'
  providerId: String, // External service ID
  sentAt: Date,
  deliveredAt: Date,
  openedAt: Date,
  clickedAt: Date,
});
```

### 4. **Graceful Degradation**

Never let notification failures break your app:

```javascript
try {
  await notificationService.send(...);
} catch (error) {
  logger.error('Notification failed', error);
  // App continues working
}
```

### 5. **Template Versioning**

Version your templates:

```javascript
templates/
  v1/
    milestone_achieved.jsx
    we_miss_you.jsx
  v2/
    milestone_achieved.jsx  # Improved design
    we_miss_you.jsx
```

### 6. **Testing**

Test notifications in staging:

```javascript
// config.js
const NOTIFICATION_CONFIG = {
  production: {
    email: { provider: 'resend', from: 'noreply@fitverse.com' },
  },
  staging: {
    email: { provider: 'resend', from: 'staging@fitverse.com' },
    testMode: true, // Only send to test emails
  },
};
```

---

## Cost Estimation

### Small Gym (100 members)

- **Email (Resend):** Free (up to 3,000/month)
- **SMS (Twilio):** $0.0079/SMS × 100 SMS/month = **$0.79/month**
- **Push (FCM):** Free

**Total: ~$1/month**

### Medium Gym (1,000 members)

- **Email (Resend):** $20/month (50,000 emails)
- **SMS (Twilio):** $0.0079 × 1,000 SMS = **$7.90/month**
- **Push (FCM):** Free

**Total: ~$28/month**

### Large Chain (10,000 members)

- **Email (SendGrid):** $90/month (100k emails)
- **SMS (Twilio):** $0.0079 × 10,000 = **$79/month**
- **Push (FCM):** Free

**Total: ~$170/month**

---

## Recommended Tech Stack

### Starter (MVP)

- **Email:** Resend (free tier)
- **Queue:** Database-based (simple)
- **Templates:** Plain HTML strings

### Growth (Scaling)

- **Email:** Resend or SendGrid
- **SMS:** Twilio
- **Queue:** BullMQ + Redis
- **Templates:** React Email

### Enterprise (Large Scale)

- **Email:** AWS SES (cost-effective at scale)
- **SMS:** Twilio + fallback provider
- **Push:** FCM + APNs
- **Queue:** BullMQ + Redis Cluster
- **Templates:** React Email + A/B testing
- **Analytics:** Mixpanel or Segment

---

## Next Steps

1. **Week 1-2:** Implement basic email notifications with Resend
2. **Week 3:** Add SMS for critical alerts (at-risk members)
3. **Week 4:** Implement push notifications for mobile app
4. **Week 5-6:** Add queue system and delivery tracking

---

## Resources

- [Resend Documentation](https://resend.com/docs)
- [Twilio SMS Quickstart](https://www.twilio.com/docs/sms/quickstart)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [React Email Components](https://react.email)
- [BullMQ Documentation](https://docs.bullmq.io)

---

**Questions?** Check the attendance library docs or create an issue.
