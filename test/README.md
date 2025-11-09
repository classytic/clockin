# Test & Examples

This folder contains examples and tests for the @classytic/clockin library.

## Quick Start

```bash
# Run basic usage example
npm run example:basic

# Run mongoose integration example
npm run example:mongoose

# Run full workflow example
npm run example:workflow

# Run all examples
npm test
```

## Examples Available

### 1. Basic Usage (`examples/basic-usage.js`)
Demonstrates importing and using core library features:
- Enums (attendance status, check-in methods, engagement levels)
- Calculation utilities (streaks, engagement, stats)
- Validation utilities
- Schedule utilities

```bash
node test/examples/basic-usage.js
```

**What you'll learn:**
- How to import enums and constants
- Calculate attendance stats and streaks
- Work with engagement levels
- Validate check-in eligibility
- Use schedule utilities

---

### 2. Mongoose Integration (`examples/with-mongoose.js`)
Shows how to use library schemas with Mongoose models:
- Attendance schema structure
- Check-in entry schema
- Schema indexes
- Model creation

```bash
node test/examples/with-mongoose.js
```

**What you'll learn:**
- Integrate schemas into your Mongoose models
- Use attendance schema fields
- Structure attendance documents
- Apply proper indexes

---

### 3. Full Workflow (`examples/full-workflow.js`)
Complete end-to-end attendance workflow demonstration:
- Initializing the library
- Recording check-ins
- Calculating stats
- Managing check-outs
- Getting attendance history
- Dashboard analytics

```bash
node test/examples/full-workflow.js
```

**What you'll learn:**
- Initialize the attendance system
- Process check-ins and check-outs
- Calculate member statistics
- Generate dashboard analytics
- Handle attendance corrections

---

## Adding Your Own Tests

Create new example files in the `test/examples/` folder:

```javascript
// test/examples/my-test.js
import { attendance, ENGAGEMENT_LEVEL } from '../../src/index.js';

const stats = {
  totalCheckIns: 50,
  currentStreak: 10,
  longestStreak: 15,
};

console.log('Member stats:', stats);
```

Run it:
```bash
node test/examples/my-test.js
```

---

## Testing Without Database

All examples can run without a database connection. They demonstrate:
- Pure utility functions
- Calculation functions
- Schema structures
- Event system

To use with real database, initialize with your Mongoose models as shown in the full-workflow example.
