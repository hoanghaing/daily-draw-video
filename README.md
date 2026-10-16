# daily-draw-video

One short vertical video a day for Daily Draw (dailydraw.app), rendered by a scheduled GitHub Actions
workflow and sent to a private Telegram channel. A person posts it by hand. This repo is public; it holds
code and two small state files, never video files.

- **Schedule:** `.github/workflows/daily.yml`, 06:30 Vietnam with a 09:30 backup. A day already in
  `content/log.json` exits at once, so the backup never sends a second video.
- **Secrets (Actions):** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` of the video bot and channel. Nothing prints them.
- **Content:** `content/knowledge.json` is the queue of scripts; `content/log.json` records each day.
  Both are committed back by the workflow.
- **Cards:** `daily/cards.json` is a snapshot made by `pnpm video:export-cards` in the site repo. After editing
  a card meaning there, export again and commit the file here.
- **Try it:** `gh workflow run daily -f date=2026-01-05 -f dry_run=true` renders and sends but changes no state.
- **Locally:** `pnpm test`, `pnpm check-queue`, `pnpm typecheck`; put the two variables in `.env` (git-ignored)
  to send. Never commit `out/` or `.env`.
