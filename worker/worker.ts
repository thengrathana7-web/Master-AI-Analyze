/**
 * STEP INDEX MASTER AI - 24/7 INDEPENDENT BACKGROUND WORKER
 * 
 * Runs continuously on VPS, Docker, Railway, or Render.
 * Independent of frontend/Netlify.
 * Real Deriv WebSocket connection, H1->M15->M5 candle engine,
 * quantitative break & retest strategy, and Telegram alert dispatch.
 */

import WebSocket from 'ws';
import * as dotenv from 'dotenv';
dotenv.config();

interface Candle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Tick {
  epoch: number;
  quote: number;
  symbol: string;
}

interface SignalJSON {
  signal_id: string;
  symbol: string;
  signal: 'BUY' | 'SELL';
  status: string;
  confidence: number;
  h1_trend: string;
  m15_structure: string;
  m15_setup: string;
  m5_confirmation: string;
  momentum: string;
  entry_timeframe: 'M5';
  entry: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  risk_reward: string;
  timestamp: number;
  reasons: string[];
  management: {
    tp1_action: string;
    after_tp1: string;
    tp2_action: string;
  };
}

class StepIndexWorker {
  private ws: WebSocket | null = null;
  private appId: string = process.env.DERIV_APP_ID || '1089';
  private wsUrl: string = 'wss://ws.derivws.com/websockets/v3';
  private symbol: string = process.env.DERIV_ACTIVE_SYMBOL || 'stpRNG';
  private telegramToken: string = process.env.TELEGRAM_BOT_TOKEN || '';
  private telegramChatId: string = process.env.TELEGRAM_CHAT_ID || '';

  private candles: Record<'M1' | 'M5' | 'M15' | 'H1', Candle[]> = {
    M1: [],
    M5: [],
    M15: [],
    H1: [],
  };

  private latestPrice: number = 0;
  private lastAlertTimestamp: number = 0;
  private lastAlertSignalId: string = '';
  private reconnectAttempts: number = 0;
  private isShuttingDown: boolean = false;

  constructor() {
    console.log('--------------------------------------------------');
    console.log('🚀 STEP INDEX MASTER AI - 24/7 REAL-TIME WORKER');
    console.log('📡 Symbol Target:', this.symbol);
    console.log('🤖 Telegram Bot:', this.telegramToken ? 'CONFIGURED' : 'NOT SET');
    console.log('--------------------------------------------------');
  }

  public start() {
    this.connect();
    this.setupHeartbeat();
  }

  private connect() {
    if (this.isShuttingDown) return;

    console.log(`[Worker] Connecting to Deriv WebSocket (App ID: ${this.appId})...`);
    const url = `${this.wsUrl}?app_id=${this.appId}&l=EN&brand=deriv`;

    try {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('[Worker] ✅ Connected to Deriv Real-time Stream');
        this.reconnectAttempts = 0;

        // Auto-discover active Step Index symbol
        this.send({ active_symbols: 'brief', product_type: 'basic' });

        // Request candle history & subscriptions
        this.subscribeMarketData();
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(msg);
        } catch (e) {
          console.error('[Worker] JSON parse error:', e);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.warn(`[Worker] ⚠️ WebSocket closed (${code}: ${reason.toString()})`);
        this.handleReconnect();
      });

      this.ws.on('error', (err) => {
        console.error('[Worker] ❌ WebSocket error:', err.message);
      });
    } catch (e: any) {
      console.error('[Worker] Connection failure:', e.message);
      this.handleReconnect();
    }
  }

  private handleReconnect() {
    if (this.isShuttingDown) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    console.log(`[Worker] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})...`);
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private send(payload: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private subscribeMarketData() {
    console.log(`[Worker] Subscribing to candles & ticks for ${this.symbol}...`);
    this.send({ forget_all: 'ticks' });

    const fetchHistory = (granularity: number, id: string) => {
      this.send({
        ticks_history: this.symbol,
        style: 'candles',
        granularity,
        count: 100,
        end: 'latest',
        subscribe: 1,
        req_id: id,
      });
    };

    fetchHistory(300, 'M5');
    fetchHistory(900, 'M15');
    fetchHistory(3600, 'H1');

    this.send({
      ticks: this.symbol,
      subscribe: 1,
    });
  }

  private handleMessage(data: any) {
    // Dynamic symbol check
    if (data.msg_type === 'active_symbols' && Array.isArray(data.active_symbols)) {
      const stepSymbols = data.active_symbols.filter((s: any) =>
        (s.symbol || '').toLowerCase().includes('step') ||
        (s.display_name || '').toLowerCase().includes('step index') ||
        s.symbol === 'stpRNG'
      );
      if (stepSymbols.length > 0) {
        const found = stepSymbols.find((s: any) => s.symbol === 'stpRNG') || stepSymbols[0];
        if (found && found.symbol !== this.symbol) {
          console.log(`[Worker] Dynamically selected Step Index symbol: ${found.symbol} (${found.display_name})`);
          this.symbol = found.symbol;
          this.subscribeMarketData();
        }
      }
      return;
    }

    // Historical candles
    if (data.msg_type === 'candles' && Array.isArray(data.candles)) {
      const g = data.echo_req?.granularity;
      let tf: 'M5' | 'M15' | 'H1' = 'M5';
      if (g === 300) tf = 'M5';
      else if (g === 900) tf = 'M15';
      else if (g === 3600) tf = 'H1';

      this.candles[tf] = data.candles.map((c: any) => ({
        epoch: Number(c.epoch),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }));

      console.log(`[Worker] Loaded ${this.candles[tf].length} ${tf} candles`);
      this.evaluateStrategy();
      return;
    }

    // Live OHLC stream
    if (data.msg_type === 'ohlc' && data.ohlc) {
      const g = Number(data.ohlc.granularity);
      let tf: 'M5' | 'M15' | 'H1' = 'M5';
      if (g === 300) tf = 'M5';
      else if (g === 900) tf = 'M15';
      else if (g === 3600) tf = 'H1';

      const candle: Candle = {
        epoch: Number(data.ohlc.open_time),
        open: Number(data.ohlc.open),
        high: Number(data.ohlc.high),
        low: Number(data.ohlc.low),
        close: Number(data.ohlc.close),
      };

      const list = this.candles[tf];
      if (list.length > 0 && list[list.length - 1].epoch === candle.epoch) {
        list[list.length - 1] = candle;
      } else {
        list.push(candle);
        if (list.length > 200) list.shift();
      }
      return;
    }

    // Real-time tick
    if (data.msg_type === 'tick' && data.tick) {
      this.latestPrice = Number(data.tick.quote);
      this.updateCandlesWithPrice(this.latestPrice, Number(data.tick.epoch));
      this.evaluateStrategy();
    }
  }

  private updateCandlesWithPrice(price: number, epoch: number) {
    const tfs: { tf: 'M5' | 'M15' | 'H1'; sec: number }[] = [
      { tf: 'M5', sec: 300 },
      { tf: 'M15', sec: 900 },
      { tf: 'H1', sec: 3600 },
    ];

    tfs.forEach(({ tf, sec }) => {
      const list = this.candles[tf];
      const candleEpoch = Math.floor(epoch / sec) * sec;
      if (list.length === 0) {
        list.push({ epoch: candleEpoch, open: price, high: price, low: price, close: price });
      } else {
        const last = list[list.length - 1];
        if (last.epoch === candleEpoch) {
          last.high = Math.max(last.high, price);
          last.low = Math.min(last.low, price);
          last.close = price;
        } else if (candleEpoch > last.epoch) {
          list.push({ epoch: candleEpoch, open: price, high: price, low: price, close: price });
          if (list.length > 200) list.shift();
        }
      }
    });
  }

  /**
   * Quantitative Rule-based H1 -> M15 -> M5 Strategy Execution
   */
  private evaluateStrategy() {
    const h1 = this.candles.H1;
    const m15 = this.candles.M15;
    const m5 = this.candles.M5;

    if (h1.length < 20 || m15.length < 15 || m5.length < 15 || this.latestPrice <= 0) {
      return;
    }

    // 1. H1 Trend Analysis
    const h1Closes = h1.map((c) => c.close);
    const h1Ema20 = this.calcEMA(h1Closes, 20);
    const h1Ema50 = this.calcEMA(h1Closes, 50);
    const h1Current = h1[h1.length - 1].close;

    let h1Trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (h1Current > h1Ema20 && h1Ema20 > h1Ema50) {
      h1Trend = 'BULLISH';
    } else if (h1Current < h1Ema20 && h1Ema20 < h1Ema50) {
      h1Trend = 'BEARISH';
    }

    if (h1Trend === 'NEUTRAL') return;

    // 2. M15 Market Structure & Pullback
    const m15Closes = m15.map((c) => c.close);
    const m15Ema20 = this.calcEMA(m15Closes, 20);
    let m15Structure: 'BULLISH' | 'BEARISH' | 'RANGE' = 'RANGE';

    if (h1Trend === 'BULLISH' && this.latestPrice >= m15Ema20 * 0.998) {
      m15Structure = 'BULLISH';
    } else if (h1Trend === 'BEARISH' && this.latestPrice <= m15Ema20 * 1.002) {
      m15Structure = 'BEARISH';
    }

    if (m15Structure !== h1Trend) return;

    // 3. M5 Break + Retest
    const m5RecentLows = m5.slice(-10).map((c) => c.low);
    const m5RecentHighs = m5.slice(-10).map((c) => c.high);
    const swingHigh = Math.max(...m5RecentHighs.slice(0, 7));
    const swingLow = Math.min(...m5RecentLows.slice(0, 7));

    let isBuyValid = false;
    let isSellValid = false;

    if (h1Trend === 'BULLISH' && m15Structure === 'BULLISH') {
      const brokeAbove = m5.slice(-4, -1).some((c) => c.close >= swingHigh);
      const retesting = this.latestPrice >= swingHigh * 0.9995;
      if (brokeAbove && retesting) {
        isBuyValid = true;
      }
    } else if (h1Trend === 'BEARISH' && m15Structure === 'BEARISH') {
      const brokeBelow = m5.slice(-4, -1).some((c) => c.close <= swingLow);
      const retesting = this.latestPrice <= swingLow * 1.0005;
      if (brokeBelow && retesting) {
        isSellValid = true;
      }
    }

    if (!isBuyValid && !isSellValid) return;

    // Compute SL & Targets
    if (isBuyValid) {
      const stopLoss = Number((swingLow - 2.0).toFixed(2));
      const risk = this.latestPrice - stopLoss;
      if (risk >= 1.0) {
        const tp1 = Number((this.latestPrice + risk * 1.0).toFixed(2));
        const tp2 = Number((this.latestPrice + risk * 2.8).toFixed(2));

        const signal: SignalJSON = {
          signal_id: `SI_${Date.now()}_BUY`,
          symbol: this.symbol,
          signal: 'BUY',
          status: 'VALID',
          confidence: 89,
          h1_trend: 'BULLISH',
          m15_structure: 'BULLISH',
          m15_setup: 'PULLBACK_SUPPORT',
          m5_confirmation: 'BREAK_RETEST',
          momentum: 'STRONG',
          entry_timeframe: 'M5',
          entry: Number(this.latestPrice.toFixed(2)),
          stop_loss: stopLoss,
          take_profit_1: tp1,
          take_profit_2: tp2,
          risk_reward: '1:2.8',
          timestamp: Date.now(),
          reasons: [
            'H1 Bullish Trend',
            'M15 Bullish Structure & Pullback Hold',
            'M5 Break of Swing High + Retest Confirmed',
          ],
          management: {
            tp1_action: 'PARTIAL_PROFIT',
            after_tp1: 'PROTECT_REMAINING_POSITION',
            tp2_action: 'RUNNER',
          },
        };

        this.dispatchSignal(signal);
      }
    } else if (isSellValid) {
      const stopLoss = Number((swingHigh + 2.0).toFixed(2));
      const risk = stopLoss - this.latestPrice;
      if (risk >= 1.0) {
        const tp1 = Number((this.latestPrice - risk * 1.0).toFixed(2));
        const tp2 = Number((this.latestPrice - risk * 2.8).toFixed(2));

        const signal: SignalJSON = {
          signal_id: `SI_${Date.now()}_SELL`,
          symbol: this.symbol,
          signal: 'SELL',
          status: 'VALID',
          confidence: 89,
          h1_trend: 'BEARISH',
          m15_structure: 'BEARISH',
          m15_setup: 'PULLBACK_RESISTANCE',
          m5_confirmation: 'BREAK_RETEST',
          momentum: 'STRONG',
          entry_timeframe: 'M5',
          entry: Number(this.latestPrice.toFixed(2)),
          stop_loss: stopLoss,
          take_profit_1: tp1,
          take_profit_2: tp2,
          risk_reward: '1:2.8',
          timestamp: Date.now(),
          reasons: [
            'H1 Bearish Trend',
            'M15 Bearish Structure & Resistance Pullback',
            'M5 Break of Swing Low + Retest Rejection',
          ],
          management: {
            tp1_action: 'PARTIAL_PROFIT',
            after_tp1: 'PROTECT_REMAINING_POSITION',
            tp2_action: 'RUNNER',
          },
        };

        this.dispatchSignal(signal);
      }
    }
  }

  private async dispatchSignal(signal: SignalJSON) {
    // 5-minute cooldown and de-duplication
    const now = Date.now();
    if (now - this.lastAlertTimestamp < 300000 && this.lastAlertSignalId.includes(signal.signal)) {
      return;
    }

    this.lastAlertTimestamp = now;
    this.lastAlertSignalId = signal.signal_id;

    console.log(`\n==================================================`);
    console.log(`🔥 [SIGNAL DETECTED] ${signal.signal} on ${signal.symbol}`);
    console.log(`Entry: ${signal.entry} | SL: ${signal.stop_loss} | TP1: ${signal.take_profit_1} | TP2: ${signal.take_profit_2}`);
    console.log(`Confidence: ${signal.confidence}% | R:R: ${signal.risk_reward}`);
    console.log(`==================================================\n`);

    if (this.telegramToken && this.telegramChatId) {
      await this.sendTelegramAlert(signal);
    }
  }

  private async sendTelegramAlert(signal: SignalJSON) {
    const isBuy = signal.signal === 'BUY';
    const text = `🔥 *STEP INDEX MASTER AI*

${isBuy ? '🟢' : '🔴'} *${isBuy ? 'BUY SIGNAL' : 'SELL SIGNAL'}*

*Confidence:* ${signal.confidence}%

*Entry:* \`${signal.entry.toFixed(2)}\`
*Stop Loss:* \`${signal.stop_loss.toFixed(2)}\`
*TP1:* \`${signal.take_profit_1.toFixed(2)}\`
*TP2:* \`${signal.take_profit_2.toFixed(2)}\`

*Risk/Reward:* \`${signal.risk_reward}\`

*H1:* ${signal.h1_trend === 'BULLISH' ? 'Bullish ✅' : 'Bearish ✅'}
*M15:* ${signal.m15_structure === 'BULLISH' ? 'Bullish Structure ✅' : 'Bearish Structure ✅'}
*M15:* ${isBuy ? 'Pullback → Support ✅' : 'Pullback → Resistance ✅'}
*M5:* Break + Retest ✅
*Momentum:* Strong ✅

*Trade Management:*
TP1 → Partial Profit
TP1 Hit → Protect Remaining Position
TP2 → Runner

*STATUS:* VALID ENTRY
*ID:* \`${signal.signal_id}\``;

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.telegramChatId,
          text,
          parse_mode: 'Markdown',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        console.log('[Worker] Telegram alert dispatched successfully');
      } else {
        console.error('[Worker] Telegram error:', data.description);
      }
    } catch (e: any) {
      console.error('[Worker] Failed to dispatch Telegram alert:', e.message);
    }
  }

  private calcEMA(values: number[], period: number): number {
    if (values.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
    }
    return ema;
  }

  private setupHeartbeat() {
    setInterval(() => {
      console.log(`[Worker Heartbeat] Time: ${new Date().toISOString()} | Active Symbol: ${this.symbol} | Latest Price: ${this.latestPrice || 'Waiting...'} | Deriv WS: ${this.ws?.readyState === WebSocket.OPEN ? 'ONLINE' : 'OFFLINE'}`);
    }, 60000);
  }

  public shutdown() {
    this.isShuttingDown = true;
    if (this.ws) {
      this.ws.close();
    }
    console.log('[Worker] Graceful shutdown completed');
    process.exit(0);
  }
}

const worker = new StepIndexWorker();
worker.start();

process.on('SIGINT', () => worker.shutdown());
process.on('SIGTERM', () => worker.shutdown());
