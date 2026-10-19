#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for scripts/cron-utils.mjs
//
// Usage: node scripts/test-cron-utils.mjs
// ---------------------------------------------------------------------------

import {
  matchesCron,
  nextCronTime,
  previousCronTime,
} from "./cron-utils.mjs";
import { assert, assertDeepEqual, finalizeTests } from "./test-utils.mjs";

console.log("Testing cron-utils.mjs...\n");

// ---------------------------------------------------------------------------
// matchesCron
// ---------------------------------------------------------------------------
{
  const expr = "0 6 * * *";
  assert(matchesCron(expr, new Date("2026-06-20T06:00:00Z")) === true, "matchesCron: exact 06:00 match");
  assert(matchesCron(expr, new Date("2026-06-20T06:01:00Z")) === false, "matchesCron: minute off");
  assert(matchesCron(expr, new Date("2026-06-20T05:59:00Z")) === false, "matchesCron: one minute before");
  assert(matchesCron(expr, new Date("2026-06-21T06:00:00Z")) === true, "matchesCron: another day same time");
  assert(matchesCron("*/15 * * * *", new Date("2026-06-20T06:00:00Z")) === true, "matchesCron: step value match");
  assert(matchesCron("*/15 * * * *", new Date("2026-06-20T06:07:00Z")) === false, "matchesCron: step value non-match");
  assert(matchesCron("0 6 * * 1", new Date("2026-06-22T06:00:00Z")) === true, "matchesCron: day-of-week Monday = 1");
  assert(matchesCron("0 6 * * 1", new Date("2026-06-21T06:00:00Z")) === false, "matchesCron: day-of-week Sunday = 0 not 1");
  assert(matchesCron("0 6 * * 0", new Date("2026-06-21T06:00:00Z")) === true, "matchesCron: day-of-week 0 = Sunday");
  assert(matchesCron("0 6 * * 7", new Date("2026-06-21T06:00:00Z")) === true, "matchesCron: day-of-week 7 = Sunday alias");
  assert(matchesCron("0 6 1 * *", new Date("2026-07-01T06:00:00Z")) === true, "matchesCron: day-of-month 1 across month boundary");
}

// ---------------------------------------------------------------------------
// nextCronTime
// ---------------------------------------------------------------------------
{
  const ref = new Date("2026-06-20T07:30:00Z");
  const next = nextCronTime("0 6 * * *", ref);
  assertDeepEqual(
    next?.toISOString(),
    "2026-06-21T06:00:00.000Z",
    "nextCronTime: tomorrow 06:00 from 07:30 ref"
  );
}

{
  const ref = new Date("2026-06-20T05:59:00Z");
  const next = nextCronTime("0 6 * * *", ref);
  assertDeepEqual(
    next?.toISOString(),
    "2026-06-20T06:00:00.000Z",
    "nextCronTime: today 06:00 from 05:59 ref (next match is later today)"
  );
}

{
  const ref = new Date("2026-06-20T06:00:00Z");
  const next = nextCronTime("0 6 * * *", ref);
  assertDeepEqual(
    next?.toISOString(),
    "2026-06-21T06:00:00.000Z",
    "nextCronTime: skips the exact reference time"
  );
}

{
  const ref = new Date("2026-06-20T07:30:00Z");
  const next = nextCronTime("0 6 1 * *", ref);
  assertDeepEqual(
    next?.toISOString(),
    "2026-07-01T06:00:00.000Z",
    "nextCronTime: crosses month boundary for day-of-month 1"
  );
}

{
  const ref = new Date("2026-12-31T07:30:00Z");
  const next = nextCronTime("0 6 1 1 *", ref);
  assertDeepEqual(
    next?.toISOString(),
    "2027-01-01T06:00:00.000Z",
    "nextCronTime: crosses year boundary"
  );
}

// ---------------------------------------------------------------------------
// previousCronTime
// ---------------------------------------------------------------------------
{
  const ref = new Date("2026-06-20T07:30:00Z");
  const prev = previousCronTime("0 6 * * *", ref);
  assertDeepEqual(
    prev?.toISOString(),
    "2026-06-20T06:00:00.000Z",
    "previousCronTime: today 06:00 from 07:30 ref"
  );
}

{
  const ref = new Date("2026-06-20T05:59:00Z");
  const prev = previousCronTime("0 6 * * *", ref);
  assertDeepEqual(
    prev?.toISOString(),
    "2026-06-19T06:00:00.000Z",
    "previousCronTime: yesterday 06:00 from 05:59 ref"
  );
}

finalizeTests();
