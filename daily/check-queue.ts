import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadDeck, validateKnowledge, type KnowledgeItem } from "./lib";

/**
 * pnpm exec tsx video/daily/check-queue.ts [draft.json ...]
 * Checks knowledge.json (plus any draft files appended to it) for format problems,
 * duplicate ids and unknown card ids. Prints sizes, changes nothing.
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file: string): KnowledgeItem[] =>
  existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as KnowledgeItem[]) : [];

const drafts = process.argv.slice(2).map((f) => path.resolve(process.cwd(), f));
const all = [...read(path.join(ROOT, "content", "knowledge.json")), ...drafts.flatMap(read)];

console.log("problems:", validateKnowledge(all));
for (const i of all) {
  if (i.cardId && !loadDeck().some((c) => c.id === i.cardId)) console.log("unknown card id:", i.id, i.cardId);
}
const longest = (xs: string[]) => Math.max(0, ...xs.map((x) => x.length));
console.log(
  `items ${all.length} | queued ${all.filter((i) => i.status === "queued").length}` +
    ` | longest hook ${longest(all.map((i) => i.hook))}` +
    ` | longest line ${longest(all.flatMap((i) => i.lines))}` +
    ` | longest caption ${longest(all.map((i) => i.caption))}`
);
