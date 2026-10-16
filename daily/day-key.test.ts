import assert from "node:assert/strict";
import { test } from "node:test";

import { todayKey } from "./day-key";

test("a UTC instant before 17:00 is still the same Vietnam day, from 17:00 it is the next", () => {
  assert.equal(todayKey(new Date("2026-10-16T16:59:59Z")), "2026-10-16");
  assert.equal(todayKey(new Date("2026-10-16T17:00:00Z")), "2026-10-17");
  assert.equal(todayKey(new Date("2026-10-16T23:30:00Z")), "2026-10-17"); // the 06:30 Vietnam cron
  assert.equal(todayKey(new Date("2026-10-17T02:30:00Z")), "2026-10-17"); // the backup cron
});
