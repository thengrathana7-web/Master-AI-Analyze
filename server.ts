import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// In-memory signals store for server API
interface StoredSignal {
  signal_id: string;
  symbol: string;
  signal: string;
  confidence: number;
  entry: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  risk_reward: string;
  timestamp: number;
  result?: string;
}

const recentSignals: StoredSignal[] = [];

// API: System status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Step Index Master AI Backend Engine',
    timestamp: Date.now(),
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    activeSymbol: process.env.DERIV_ACTIVE_SYMBOL || 'stpRNG',
  });
});

// API: List recorded signals
app.get('/api/signals', (req, res) => {
  res.json({
    signals: recentSignals,
  });
});

// API: Test Telegram configuration
app.post('/api/telegram/test', async (req, res) => {
  const token = req.body.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = req.body.chatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return res.status(400).json({
      success: false,
      error: 'Missing bot token or chat ID. Please provide them in settings.',
    });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🔥 *STEP INDEX MASTER AI* - Connection Test\n\n✅ *Telegram Alert Channel Verified*\n⏱ *Timestamp:* ${new Date().toISOString()}\n\n_Your 24/7 Step Index Master AI signals are ready for delivery._`,
        parse_mode: 'Markdown',
      }),
    });

    const data = await response.json();
    if (data.ok) {
      return res.json({ success: true, message: 'Telegram test message delivered!' });
    } else {
      return res.status(400).json({ success: false, error: data.description });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API: Broadcast live signal message to Telegram bot channel
app.post('/api/telegram/broadcast', async (req, res) => {
  const token = req.body.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = req.body.chatId || process.env.TELEGRAM_CHAT_ID;
  const message = req.body.message || req.body.text;

  if (!token || !chatId) {
    return res.status(400).json({
      success: false,
      error: 'Telegram Bot Token or Chat ID not configured on server or in request.',
    });
  }

  if (!message) {
    return res.status(400).json({ success: false, error: 'No message content provided.' });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const data = await response.json();
    if (data.ok) {
      return res.json({ success: true, messageId: data.result?.message_id });
    } else {
      return res.status(400).json({ success: false, error: data.description });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Serve frontend in production or dev
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // In dev, use Vite middlewares
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Step Index Master AI running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
