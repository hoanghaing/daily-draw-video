import assert from "node:assert/strict";
import { test } from "node:test";

import {
  loadDeck,
  buildCaptions,
  englishComment,
  cardForDate,
  kindFor,
  markUsed,
  nextKnowledge,
  parseEnv,
  planDay,
  validateKnowledge,
  type KnowledgeItem,
} from "./lib";

const item = (id: string, status: "queued" | "used" = "queued", extra: Partial<KnowledgeItem> = {}): KnowledgeItem => ({
  id,
  status,
  hook: "Lá bài bị sợ nhất lại hiếm khi nói về cái chết.",
  lines: ["Dòng một.", "Dòng hai.", "Dòng ba."],
  caption: "Một câu caption ngắn.",
  en: { hook: "A reversed card is not a bad card.", caption: "A short English caption. What do you think?" },
  ...extra,
});

test("kindFor: Tuesday, Thursday and Saturday are knowledge days", () => {
  // 2026-10-13 is a Tuesday.
  assert.equal(kindFor("2026-10-13"), "knowledge");
  assert.equal(kindFor("2026-10-14"), "card");
  assert.equal(kindFor("2026-10-15"), "knowledge");
  assert.equal(kindFor("2026-10-16"), "card");
  assert.equal(kindFor("2026-10-17"), "knowledge");
  assert.equal(kindFor("2026-10-18"), "card");
  assert.equal(kindFor("2026-10-19"), "card");
});

test("cardForDate is stable and reaches every card over time", () => {
  assert.equal(cardForDate("2026-10-14").id, cardForDate("2026-10-14").id);
  const seen = new Set<string>();
  for (let d = 0; d < 3000; d++) {
    const day = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000).toISOString().slice(0, 10);
    seen.add(cardForDate(day).id);
  }
  assert.equal(seen.size, 78);
});

test("nextKnowledge takes the first queued item, in file order", () => {
  assert.equal(nextKnowledge([item("a", "used"), item("b"), item("c")])?.id, "b");
  assert.equal(nextKnowledge([item("a", "used")]), null);
  assert.equal(nextKnowledge([]), null);
});

test("planDay: a card day uses the authored Vietnamese card text", () => {
  const day = planDay("2026-10-14", [item("a")]);
  assert.equal(day.kind, "card");
  assert.equal(day.fellBack, false);
  assert.ok(day.cardId);
  assert.equal(day.ref, day.cardId);
  assert.match(day.hook, /^Lá bài hôm nay: /);
  assert.equal(day.lines.length, 3);
  assert.ok(day.lines.every((l) => l.length > 0));
});

test("planDay: the card line is the first sentence of the approved upright meaning", () => {
  // Pick a date, then compare with the meaning the site shows for that card.
  const day = planDay("2026-10-14", []);
  const meaning = loadDeck().find((c) => c.id === day.cardId)?.meaningVi ?? "";
  assert.ok(meaning.length > 0);
  assert.ok(meaning.startsWith(day.lines[0]), `${day.lines[0]} should open ${meaning}`);
  assert.ok(day.lines[0].length <= 90);
  assert.ok(day.caption.length <= 300);
});

test("planDay: a knowledge day takes the next queued script", () => {
  const day = planDay("2026-10-13", [item("a", "used"), item("b", "queued", { cardId: "death" })]);
  assert.equal(day.kind, "knowledge");
  assert.equal(day.ref, "b");
  assert.equal(day.cardId, "death");
  assert.equal(day.fellBack, false);
});

test("planDay: an unknown or missing cardId renders with the card back only", () => {
  assert.equal(planDay("2026-10-13", [item("a", "queued", { cardId: "no-such-card" })]).cardId, null);
  assert.equal(planDay("2026-10-13", [item("a")]).cardId, null);
});

test("planDay: an empty queue on a knowledge day falls back to a card and flags it", () => {
  const day = planDay("2026-10-13", [item("a", "used")]);
  assert.equal(day.kind, "card");
  assert.equal(day.fellBack, true);
  assert.equal(day.queueLow, true);
});

test("planDay: the queue is low at five or fewer left after today's", () => {
  const q = Array.from({ length: 7 }, (_, i) => item(`k${i}`));
  assert.equal(planDay("2026-10-13", q).queueLow, false); // 6 left
  assert.equal(planDay("2026-10-13", q.slice(0, 6)).queueLow, true); // 5 left
});

test("buildCaptions: TikTok has no link promise, Instagram keeps its link in bio", () => {
  const md = buildCaptions(planDay("2026-10-14", []));
  const [head, tiktok, instagram] = md.split(/^## /m);
  assert.match(head, /^# 2026-10-14/);
  assert.match(tiktok, /^TikTok/);
  assert.match(instagram, /^Instagram/);

  // A TikTok caption link is plain text and the owner has no bio link there.
  assert.doesNotMatch(tiktok, /link ở bio/i);
  assert.doesNotMatch(tiktok, /https?:\/\//);
  assert.match(tiktok, /Rút lá miễn phí tại dailydraw\.app/);

  assert.match(instagram, /link ở bio/);
  assert.match(instagram, /utm_source=instagram&utm_medium=social&utm_campaign=daily-2026-10-14/);
  assert.ok((md.match(/#\w+/g) ?? []).length >= 4);
});

test("validateKnowledge accepts a good queue and names every problem in a bad one", () => {
  assert.deepEqual(validateKnowledge([item("a"), item("b")]), []);
  const errors = validateKnowledge([
    item("a"),
    item("a"), // duplicate id
    item("b", "queued", { lines: ["một", "hai"] }), // two lines
    item("c", "queued", { hook: "" }),
    item("d", "queued", { lines: ["x".repeat(91), "b", "c"] }),
  ]);
  assert.equal(errors.length, 4);
  assert.deepEqual(validateKnowledge("nope"), ["knowledge.json must be an array"]);
});

test("markUsed flips one item and leaves the rest alone", () => {
  const out = markUsed([item("a"), item("b")], "a");
  assert.deepEqual(out.map((i) => i.status), ["used", "queued"]);
});

test("parseEnv reads KEY=VALUE lines, skips comments, strips quotes", () => {
  assert.deepEqual(parseEnv("# c\nTELEGRAM_BOT_TOKEN=\"abc\"\n\nTELEGRAM_CHAT_ID=123\r\nBAD LINE\n"), {
    TELEGRAM_BOT_TOKEN: "abc",
    TELEGRAM_CHAT_ID: "123",
  });
});

test("planDay: an English version exists for card days and knowledge days", () => {
  const card = planDay("2026-10-14", []);
  assert.match(card.english.hook, /^Card of the day: /);
  assert.ok(card.english.caption.length > 0 && card.english.caption.length <= 400);
  const k = planDay("2026-10-13", [item("a")]);
  assert.equal(k.english.hook, "A reversed card is not a bad card.");
});

test("englishComment: ready to paste, with that platform's own tagged link", () => {
  const day = planDay("2026-10-13", [item("a")]);
  const fb = englishComment(day, "facebook");
  const th = englishComment(day, "threads");
  assert.ok(fb.startsWith(day.english.hook));
  assert.match(fb, /Draw yours free: dailydraw\.app/);
  assert.match(fb, /https:\/\/dailydraw\.app\/en\/astrology-table\?utm_source=facebook&utm_medium=social&utm_campaign=daily-2026-10-13/);
  assert.match(th, /utm_source=threads&utm_medium=social&utm_campaign=daily-2026-10-13/);
  assert.doesNotMatch(fb, /utm_source=threads/);
});

test("validateKnowledge also requires the English hook and caption", () => {
  const bad = { ...item("a"), en: { hook: "", caption: "x" } };
  assert.equal(validateKnowledge([bad]).length, 1);
  const missing = { ...item("b") } as Record<string, unknown>;
  delete missing.en;
  assert.equal(validateKnowledge([missing]).length, 1);
});
