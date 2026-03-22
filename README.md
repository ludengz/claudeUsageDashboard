# Claude Usage Dashboard

[![npm version](https://img.shields.io/npm/v/claude-usage-dashboard)](https://www.npmjs.com/package/claude-usage-dashboard)
[![npm downloads](https://img.shields.io/npm/dm/claude-usage-dashboard)](https://www.npmjs.com/package/claude-usage-dashboard)

> Find out what your Claude Code subscription is actually worth in API costs.

Your $200/month Max plan might be consuming **$15,000+/month** in API-equivalent value. This dashboard shows you exactly how much — per project, per session, per model. One command to start. Completely local. No data leaves your machine.

```bash
npx claude-usage-dashboard
```

![Dashboard Screenshot](docs/screenshots/dashboard.png)

## What You'll See

### Know What You're Spending

Real-time projected API cost at your current usage rate — weekly and monthly. At 5% quota utilization, you might be burning through **$3,600/week** equivalent. The dashboard calculates this from your actual quota window, not estimates.

### Track Your Quota in Real Time

Live utilization gauges for 5-hour, 7-day, and per-model quotas pulled directly from the Anthropic API. Auto-detects your plan tier (Pro / Max 5x / Max 20x). Never get throttled by surprise again.

### Find What's Eating Your Tokens

Per-project and per-session cost breakdowns show exactly where your usage goes. Sortable session table with cost, duration, and full token breakdown. Spot the expensive sessions instantly.

### Understand Your Cache Efficiency

You'll probably discover that ~95% of your tokens are cache reads at 1/10th the cost. The dashboard visualizes cache read vs. cache write vs. uncached requests so you can see how efficiently Claude is using context.

### Everything Else

Hourly/daily/weekly/monthly token trends · Dollar and token toggle · Model distribution across Opus/Sonnet/Haiku · Active hours heatmap · Auto-refresh (30s) · Persistent filters via localStorage · Dark theme

## Quick Start

Run directly — no install, no config, no API keys needed:

```bash
npx claude-usage-dashboard
```

Open [localhost:3000](http://localhost:3000). That's it.

### From Source

```bash
git clone https://github.com/ludengz/claude-usage-dashboard.git
cd claude-usage-dashboard
npm install
npm start
```

### Custom Port

```bash
PORT=8080 npx claude-usage-dashboard
```

## How It Works

Reads the JSONL session logs that Claude Code already writes to `~/.claude/projects/` on your machine. If you use Claude Code, the data is already there. Logs are re-read every 5 seconds — new usage appears without restarting.

Subscription quota data is fetched from the Anthropic API using your existing local OAuth credentials. Your plan tier is auto-detected.

## Running Tests

```bash
npm test
```

## License

ISC
