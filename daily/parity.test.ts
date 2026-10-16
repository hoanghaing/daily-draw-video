import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { planDay, type KnowledgeItem } from "./lib";

const fixture = JSON.parse(readFileSync(path.join(import.meta.dirname, "parity.json"), "utf8")) as {
  dates: string[];
  empty: unknown[];
  queued: unknown[];
};
const item = (id: string, status: "queued" | "used", extra: Partial<KnowledgeItem> = {}): KnowledgeItem => ({
  id,
  status,
  hook: "Hook.",
  lines: ["Một.", "Hai.", "Ba."],
  caption: "Caption.",
  en: { hook: "Hook.", caption: "Caption." },
  ...extra,
});
const QUEUE = [item("a", "used"), item("b", "queued", { cardId: "death" }), item("c", "queued")];

test("planDay matches what the pre-split code produced for 90 days", () => {
  fixture.dates.forEach((date, i) => {
    assert.deepEqual(planDay(date, []), fixture.empty[i], `empty queue, ${date}`);
    assert.deepEqual(planDay(date, QUEUE), fixture.queued[i], `queue, ${date}`);
  });
});
