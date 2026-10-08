# Step Index Master AI - 24/7 Independent Worker

This background worker monitors Deriv's Step Index market 24 hours a day, 7 days a week. It maintains real-time H1, M15, and M5 candle data, runs the break-and-retest momentum quantitative strategy, and dispatches instant trade alerts to your Telegram bot even when the Web App or Telegram Mini App is closed.

---

## Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Your Telegram Bot token from @BotFather | (Required for alerts) |
| `TELEGRAM_CHAT_ID` | Your Telegram User/Channel/Group ID from @userinfobot | (Required for alerts) |
| `DERIV_APP_ID` | Deriv API App ID | `1089` |
| `DERIV_ACTIVE_SYMBOL` | Step Index symbol identifier | `stpRNG` |

---

## Deployment Options

### Option 1: Docker
```bash
cd worker
docker build -t step-index-worker .
docker run -d --restart=always \
  -e TELEGRAM_BOT_TOKEN="your_bot_token" \
  -e TELEGRAM_CHAT_ID="your_chat_id" \
  --name step-index-worker \
  step-index-worker
```

### Option 2: VPS with PM2
```bash
cd worker
npm install
npm run build
pm2 start dist/worker.js --name "step-index-worker"
pm2 save
pm2 startup
```

### Option 3: Railway / Render (Background Worker)
1. Link your repository.
2. Select Root Directory as `worker`.
3. Set Build Command: `npm install && npm run build`
4. Set Start Command: `npm start`
5. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in the Environment Variables panel.
