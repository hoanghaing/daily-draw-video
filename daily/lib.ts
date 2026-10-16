import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

/** One card as the video needs it; written by `pnpm video:export-cards` in the site repo. */
export type VideoCard = {
  id: string;
  name: string;
  teaser: string;
  nameVi: string;
  teaserVi: string;
  keywordsVi: string[];
  meaningVi: string | null;
  meaningEn: string | null;
};

let cached: VideoCard[] | null = null;
/** The deck snapshot (daily/cards.json), in the site's `FULL_DECK` order: the date hash indexes into it. */
export function loadDeck(): VideoCard[] {
  cached ??= JSON.parse(readFileSync(path.join(import.meta.dirname, "cards.json"), "utf8")) as VideoCard[];
  return cached;
}

/**
 * The daily video's plan (plans/daily-video-spec.md). Pure: a date key (a Vietnam
 * calendar day, `YYYY-MM-DD`) and the script queue in, the day's content out.
 */

export type Kind = "card" | "knowledge";

export type KnowledgeItem = {
  id: string;
  status: "queued" | "used";
  hook: string;
  lines: string[];
  cardId?: string;
  caption: string;
  /** The English comment the owner pastes under the Facebook / Threads post. */
  en: { hook: string; caption: string };
};

export type DayContent = {
  date: string;
  kind: Kind;
  /** The card id on a card day, the queue item id on a knowledge day. */
  ref: string;
  /** The card art to show, or null for the card back only. */
  cardId: string | null;
  hook: string;
  lines: string[];
  caption: string;
  english: { hook: string; caption: string };
  /** A knowledge day that had nothing queued and became a card day. */
  fellBack: boolean;
  queueLow: boolean;
};

const KNOWLEDGE_DAYS = new Set([2, 4, 6]); // Tuesday, Thursday, Saturday
const LOW_QUEUE = 5;
const SITE = "https://dailydraw.app";
const HASHTAGS = "#tarot #tarotvietnam #labaitarot #dailydraw #tarotmoingay";

export function kindFor(dateKey: string): Kind {
  // The key is already a Vietnam calendar date, so its weekday is read as a plain date.
  const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return KNOWLEDGE_DAYS.has(weekday) ? "knowledge" : "card";
}

export function cardForDate(dateKey: string, deck: VideoCard[] = loadDeck()): VideoCard {
  const digest = createHash("sha256").update(`daily-video:${dateKey}`).digest();
  return deck[digest.readUInt32BE(0) % deck.length];
}

export function nextKnowledge(queue: KnowledgeItem[]): KnowledgeItem | null {
  return queue.find((i) => i.status === "queued") ?? null;
}

function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
}

/** English hook and caption for a card day, from the card's authored English meaning. */
function englishCardDay(card: VideoCard): { hook: string; caption: string } {
  const meaning = card.meaningEn ?? card.teaser;
  const body = meaning.length <= 300 ? meaning : firstSentence(meaning);
  return {
    hook: `Card of the day: ${card.name}`,
    caption: `${body} What do you need from today?`,
  };
}

export function planDay(dateKey: string, queue: KnowledgeItem[], deck: VideoCard[] = loadDeck()): DayContent {
  const wantsKnowledge = kindFor(dateKey) === "knowledge";
  const next = wantsKnowledge ? nextKnowledge(queue) : null;
  const queued = queue.filter((i) => i.status === "queued").length;
  const queueLow = queued - (next ? 1 : 0) <= LOW_QUEUE;

  if (next) {
    const known = next.cardId && deck.some((c) => c.id === next.cardId);
    return {
      date: dateKey,
      kind: "knowledge",
      ref: next.id,
      cardId: known ? (next.cardId as string) : null,
      hook: next.hook,
      lines: next.lines,
      caption: next.caption,
      english: next.en,
      fellBack: false,
      queueLow,
    };
  }

  const base = cardForDate(dateKey, deck);
  const english = englishCardDay(base);
  const keywords = base.keywordsVi;
  // The upright meaning is the owner-approved Vietnamese; the hand-written teaser is the fallback.
  const teaser = firstSentence(base.meaningVi || base.teaserVi);
  const caption = base.meaningVi && base.meaningVi.length <= 300 ? base.meaningVi : teaser;
  return {
    date: dateKey,
    kind: "card",
    ref: base.id,
    cardId: base.id,
    hook: `Lá bài hôm nay: ${base.nameVi}`,
    lines: [
      teaser,
      keywords.length ? `Từ khoá: ${keywords.join(" · ")}` : base.nameVi,
      "Hôm nay bạn đang cần điều gì?",
    ],
    caption,
    english,
    fellBack: wantsKnowledge,
    queueLow: wantsKnowledge ? true : queueLow,
  };
}

export function buildCaptions(day: DayContent): string {
  // The owner has no link in bio on TikTok, and a caption link is plain text there, so the
  // TikTok caption only names the site. Instagram can set a bio link, so it keeps the tagged one.
  const instagramLink = `${SITE}/vi/astrology-table?utm_source=instagram&utm_medium=social&utm_campaign=daily-${day.date}`;
  const head = (title: string) => [`## ${title}`, "", day.hook, "", day.caption, ""];
  const tiktok = [...head("TikTok"), "Rút lá miễn phí tại dailydraw.app", "", HASHTAGS];
  const instagram = [
    ...head("Instagram"),
    "Rút lá miễn phí tại dailydraw.app — link ở bio.",
    `Link cho bio: ${instagramLink}`,
    "",
    HASHTAGS,
  ];
  return [
    `# ${day.date} · ${day.kind === "card" ? "lá bài của ngày" : "kiến thức ngắn"} · ${day.ref}`,
    "",
    tiktok.join("\n"),
    "",
    instagram.join("\n"),
    "",
  ].join("\n");
}

/** The English comment for Facebook or Threads: plain text, the link there is clickable. */
export function englishComment(day: DayContent, platform: "facebook" | "threads"): string {
  const link = `${SITE}/en/astrology-table?utm_source=${platform}&utm_medium=social&utm_campaign=daily-${day.date}`;
  return [day.english.hook, "", day.english.caption, "", "Draw yours free: dailydraw.app", link].join("\n");
}

export function validateKnowledge(items: unknown): string[] {
  if (!Array.isArray(items)) return ["knowledge.json must be an array"];
  const errors: string[] = [];
  const seen = new Set<string>();
  items.forEach((raw, index) => {
    const it = raw as Partial<KnowledgeItem> | null;
    const at = `#${index + 1}${it && typeof it.id === "string" ? ` (${it.id})` : ""}`;
    if (!it || typeof it !== "object") return void errors.push(`${at}: not an object`);
    if (!it.id || typeof it.id !== "string") errors.push(`${at}: id missing`);
    else if (seen.has(it.id)) errors.push(`${at}: duplicate id`);
    else seen.add(it.id);
    if (it.status !== "queued" && it.status !== "used") errors.push(`${at}: status must be queued or used`);
    if (!it.hook || it.hook.length > 80) errors.push(`${at}: hook must be 1 to 80 characters`);
    if (!Array.isArray(it.lines) || it.lines.length !== 3 || it.lines.some((l) => !l || l.length > 90)) {
      errors.push(`${at}: lines must be 3 strings of 1 to 90 characters`);
    }
    if (!it.caption || it.caption.length > 300) errors.push(`${at}: caption must be 1 to 300 characters`);
    if (!it.en || !it.en.hook || it.en.hook.length > 80 || !it.en.caption || it.en.caption.length > 400) {
      errors.push(`${at}: en.hook must be 1 to 80 and en.caption 1 to 400 characters`);
    }
  });
  return errors;
}

export function markUsed(queue: KnowledgeItem[], id: string): KnowledgeItem[] {
  return queue.map((i) => (i.id === id ? { ...i, status: "used" as const } : i));
}

export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/** True when the date already has its video: the log is committed, so a fresh runner can tell. */
export function alreadyDone(log: { date: string }[], date: string): boolean {
  return log.some((entry) => entry.date === date);
}

/** The video bot's two variables, or an error that names the one that is missing. Nothing else is read. */
export function requireTelegramEnv(env: Record<string, string | undefined>) {
  for (const name of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"] as const) {
    if (!env[name]?.trim()) throw new Error(`${name} is not set`);
  }
  return { TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN!.trim(), TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID!.trim() };
}

/** A real calendar day written YYYY-MM-DD. */
export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
