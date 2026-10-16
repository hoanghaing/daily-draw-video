import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { todayKey } from "./day-key";
import {
  alreadyDone,
  buildCaptions,
  englishComment,
  isDateKey,
  markUsed,
  parseEnv,
  planDay,
  requireTelegramEnv,
  validateKnowledge,
  type DayContent,
  type KnowledgeItem,
} from "./lib";

/**
 * pnpm exec tsx video/daily/run.ts [--date YYYY-MM-DD] [--no-send]
 * Run from the repo root (see plans/daily-video-implementation.md).
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const KNOWLEDGE = path.join(ROOT, "content", "knowledge.json");
const LOG = path.join(ROOT, "content", "log.json");
const SITE = "https://dailydraw.app";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? "") : null;
}

function readJson<T>(file: string, fallback: T): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback;
}

function remotion(args: string[]) {
  execFileSync("pnpm", ["exec", "remotion", ...args], { cwd: ROOT, stdio: "inherit", shell: true, timeout: 20 * 60_000 });
}

async function telegram(env: Record<string, string>, method: string, body: FormData) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`telegram ${method} ${res.status}`);
}

async function deliver(env: Record<string, string>, day: DayContent, folder: string, captions: string) {
  const note = [
    `Video ${day.date} — ${day.kind === "card" ? "lá bài của ngày" : "kiến thức ngắn"}`,
    day.fellBack ? "Kho kịch bản đã hết, hôm nay làm lá bài của ngày." : "",
    day.queueLow ? "Kho kịch bản sắp hết (còn 5 hoặc ít hơn)." : "",
  ]
    .filter(Boolean)
    .join("\n");

  const form = new FormData();
  form.set("chat_id", env.TELEGRAM_CHAT_ID);
  form.set("caption", note.slice(0, 1000));
  form.set("supports_streaming", "true");
  form.set("video", new Blob([readFileSync(path.join(folder, "video.mp4"))], { type: "video/mp4" }), "video.mp4");
  await telegram(env, "sendVideo", form);

  // One message each, so every one can be copied whole on a phone: the Vietnamese captions
  // (TikTok, Instagram), then the English comment for Facebook, then for Threads.
  const texts = [
    captions,
    `Bình luận tiếng Anh, dán dưới bài Facebook:

${englishComment(day, "facebook")}`,
    `Bình luận tiếng Anh, dán dưới bài Threads:

${englishComment(day, "threads")}`,
  ];
  for (const text of texts) {
    const message = new FormData();
    message.set("chat_id", env.TELEGRAM_CHAT_ID);
    message.set("text", text.slice(0, 4000));
    message.set("disable_web_page_preview", "true");
    await telegram(env, "sendMessage", message);
  }
}

/** The local video/.env only: the video has its own Telegram bot and channel and reads no other file. */
function readEnv(file: string): Record<string, string> {
  return existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
}

async function main() {
  const date = arg("--date") || todayKey(new Date());
  if (!isDateKey(date)) throw new Error(`--date must be YYYY-MM-DD, got "${date}"`);
  const send = !process.argv.includes("--no-send");
  // Render and send, but change no state (knowledge.json, log.json): for trying the pipeline on any date.
  const dryRun = process.argv.includes("--dry-run");
  const folder = path.join(ROOT, "out", "daily", date);

  // The log is committed, so a fresh runner knows from its checkout that the day is done.
  if (!dryRun && alreadyDone(readJson<{ date: string }[]>(LOG, []), date)) {
    console.log(`${date}: already done, nothing to do.`);
    return;
  }

  // Checked before the render so a missing key fails in a second, not after five minutes.
  const telegramEnv = send ? requireTelegramEnv({ ...readEnv(path.join(ROOT, ".env")), ...process.env }) : null;

  const queue = readJson<KnowledgeItem[]>(KNOWLEDGE, []);
  const problems = validateKnowledge(queue);
  if (problems.length) {
    console.error("knowledge.json has problems:\n- " + problems.join("\n- "));
    process.exit(1);
  }

  const day = planDay(date, queue);
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, "source.json"), JSON.stringify(day, null, 2));

  const props = {
    hook: day.hook,
    lines: day.lines,
    artUrl: day.cardId ? `${SITE}/api/card-art/rws/${day.cardId}` : null,
  };
  const propsFile = path.join(folder, "props.json");
  writeFileSync(propsFile, JSON.stringify(props));

  remotion(["still", "src/index.ts", "DailyVideo", path.join(folder, "frame.png"), `--props=${propsFile}`, "--frame=120"]);
  remotion(["render", "src/index.ts", "DailyVideo", path.join(folder, "video.mp4"), `--props=${propsFile}`, "--log=error"]);

  const captions = buildCaptions(day);
  writeFileSync(
    path.join(folder, "captions.md"),
    [
      captions,
      "## English comment (Facebook)",
      "",
      englishComment(day, "facebook"),
      "",
      "## English comment (Threads)",
      "",
      englishComment(day, "threads"),
      "",
    ].join("\n")
  );

  // Only after a successful render does the script count as used. In CI these files are committed by a
  // later step that runs only if this whole run succeeded, so a failed send leaves them untouched.
  if (!dryRun) {
    if (day.kind === "knowledge" && !day.fellBack) writeFileSync(KNOWLEDGE, JSON.stringify(markUsed(queue, day.ref), null, 2));
    const log = readJson<unknown[]>(LOG, []);
    log.push({ date, kind: day.kind, ref: day.ref, renderedAt: new Date().toISOString(), posted: { tiktok: null, instagram: null } });
    writeFileSync(LOG, JSON.stringify(log, null, 2));
  }
  console.log(`${date}: rendered ${day.kind} ${day.ref}${dryRun ? " (dry run, no state changed)" : ""} -> ${folder}`);

  if (!telegramEnv) return;
  try {
    await deliver(telegramEnv, day, folder, captions);
    console.log(`${date}: sent to Telegram.`);
  } catch (err) {
    console.error("Telegram delivery failed:", err);
    // On a runner the mp4 dies with it, so a failed send must fail the job (and skip the commit).
    if (process.env.CI) process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
