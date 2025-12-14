# Plugins & Events (v2)

ClockIn is built to be **pluggable**. Your app can react to check-ins (send notifications, publish webhooks, push metrics, etc.) without coupling that logic into the core attendance flow.

This guide covers:
- **Events**: listen to type-safe events with `clockin.on(...)`
- **Plugins**: hook into lifecycle methods (before/after check-in/out, milestones, engagement changes)

---

## EventBus (type-safe events)

Every `ClockIn` instance has an EventBus.

```ts
clockin.on('checkIn:recorded', (event) => {
  console.log('Check-in recorded:', event.data.member.id.toString());
});
```

### Available events

- `checkIn:recorded`
- `checkIn:failed`
- `checkOut:recorded`
- `milestone:achieved`
- `engagement:changed`
- `stats:updated`
- `member:atRisk`
- `session:expired`

**Tip:** Use events for “side effects” (notifications, webhook, analytics), not for validation or data writes.

---

## Plugin system (hooks)

Plugins provide structured hook points that run during ClockIn operations.

### Plugin hooks

- `onInit(ctx)`
- `beforeCheckIn(ctx, { memberId, targetModel })`
- `afterCheckIn(ctx, data)`
- `beforeCheckOut(ctx, { memberId, checkInId })`
- `afterCheckOut(ctx, data)`
- `onMilestone(ctx, data)`
- `onEngagementChange(ctx, data)`
- `onDestroy(ctx)`

### Create a plugin

```ts
import { definePlugin } from '@classytic/clockin';

export const myWebhookPlugin = definePlugin({
  name: 'my:webhook',

  async afterCheckIn(ctx, data) {
    await fetch(process.env.WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'checkin.recorded',
        memberId: data.memberId,
        targetModel: data.targetModel,
        checkInId: data.checkInId,
        timestamp: data.timestamp,
      }),
    });
  },
});
```

### Register plugins

```ts
import { ClockIn, loggingPlugin, metricsPlugin } from '@classytic/clockin';

export const clockin = ClockIn
  .create()
  .withModels({ Attendance, Membership })
  .withPlugin(loggingPlugin({ level: 'info' }))
  .withPlugin(metricsPlugin({
    onMetric: (m) => console.log('metric', m),
  }))
  .withPlugin(myWebhookPlugin)
  .build();
```

---

## Built-in plugins

### `loggingPlugin()`
Logs check-ins/check-outs and milestones using your configured logger.

### `metricsPlugin({ onMetric })`
Pushes metrics to your system (Prometheus, Datadog, OpenTelemetry wrapper, etc.).

### `notificationPlugin({ onMilestone, onEngagementChange, onAtRisk })`
Convenience wrapper to integrate notifications without writing a full plugin.

```ts
import { notificationPlugin } from '@classytic/clockin';

const notify = notificationPlugin({
  onMilestone: async (data) => {
    // sendEmail(data.memberId, data.message)
  },
  onAtRisk: async (data) => {
    // sendRetentionEmail(...)
  },
});
```

---

## Design guidelines (production-grade)

- **Do not throw** from plugins (ClockIn catches errors and logs them).
- Use a queue for slow side effects (email/SMS/webhooks): BullMQ / SQS / DB queue.
- Keep hooks fast and idempotent—plugins may retry in your infrastructure.


