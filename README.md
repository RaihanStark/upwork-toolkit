![Upwork Toolkit](./cover.png)

# Upwork Toolkit

A Chrome extension that monitors your Upwork job feed in real time and alerts you the instant matching jobs are posted.

> **Note**: This repository is an independent fork of the original [Upwork Toolkit by neeilya](https://github.com/neeilya/upwork-toolkit).

---

## Dashboard Preview

![Upwork Toolkit Dashboard](./screenshot.png)

---

## Features

- **Split-Pane Triage Dashboard** — Desktop side-by-side view with a quick-scan job triage column on the left and full job & client intelligence dossier on the right.
- **Client Intelligence** — Instantly review client verification status, historical hire rate, total spend, rating, and open jobs before applying.
- **Dynamic Connects & Pricing Estimates** — Automatically displays proposal Connect requirements and estimates cost in USD at Upwork's rate ($0.15/connect, e.g. `12 Connects (~$1.80)`).
- **Smart Merging & Extended History** — Background polling seamlessly merges new listings with existing ones up to 250 jobs without losing user read/unread state.
- **Live On-Demand Sync & 5-Minute Stale TTL** — Older listings outside the active polling batch show a dimmed indicator and automatically refresh connects and proposal tiers on click, cached for 5 minutes.
- **Mark All as Read** — Single-click action to clear unread badges from the dashboard.
- **Real-time Job Monitoring** — Tracks _My Feed / Saved Searches_, _Best Matches_, and _Most Recent_ feeds.
- **Instant Notifications** — Desktop notifications with sound alerts, volume control, and job deduplication.
- **Mobile Alerts** — Forward new job notifications directly to your phone via Telegram, ntfy, or custom webhooks.
- **Working Hours Scheduler** — Define active hours per day of the week to silence alerts outside working times.
- **AI Cover Letter Generation** — Generate tailored proposals using Google Gemini (free via Google AI Studio) or OpenAI directly on the job application page.
- **Cover Letter Templates** — Save and auto-insert reusable proposal drafts.
- **Privacy First** — Completely local and open source. All telemetry and tracking have been removed.

---

## Quickstart

### 1. Install & Build

Requires **Node.js >= 20** (Node 22 recommended):

```bash
# Clone the repository
git clone https://github.com/RaihanStark/upwork-toolkit.git
cd upwork-toolkit

# Install dependencies
npm install

# Build extension for Chrome MV3
npm run build
```

### 2. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** (top-right switch).
3. Click **Load unpacked** and select the `build/chrome-mv3` directory.
4. Log into Upwork in Chrome. The extension uses your active session cookies automatically.

---

## Development Scripts

| Command           | Description                                   |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Start extension in live-reload dev mode       |
| `npm run build`   | Create production build in `build/chrome-mv3` |
| `npm run compile` | Type-check TypeScript code (`tsc --noEmit`)   |
| `npm run format`  | Format codebase with Prettier                 |
| `npm run zip`     | Package the build into a distributable `.zip` |

---

## How It Works

- **Authentication**: Uses your active Upwork session cookies to query `https://www.upwork.com/api/graphql/v1`. No separate credentials or OAuth required.
- **Background Worker**: Manifest V3 service worker polls your feeds based on Chrome alarms.
- **Audio Playback**: Uses an offscreen document to play notification sounds reliably in MV3.
- **Zero Tracking**: Telemetry, Sentry, and Google Analytics are completely removed.

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
