import { SignalJSON } from '../types/market';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  isEnabled: boolean;
}

export class TelegramService {
  private config: TelegramConfig = {
    botToken: '',
    chatId: '',
    isEnabled: true,
  };

  private lastSentSignalId: string = '';
  private lastSentTimestamp: number = 0;
  // Minimum cooldown between alerts: 5 minutes (300,000 ms) unless different signal direction
  private cooldownMs: number = 300000;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('TELEGRAM_BOT_TOKEN');
      const savedChatId = localStorage.getItem('TELEGRAM_CHAT_ID');
      const savedEnabled = localStorage.getItem('TELEGRAM_ALERTS_ENABLED');

      if (savedToken) this.config.botToken = savedToken;
      if (savedChatId) this.config.chatId = savedChatId;
      if (savedEnabled !== null) this.config.isEnabled = savedEnabled === 'true';
    }
  }

  public getConfig(): TelegramConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<TelegramConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (typeof window !== 'undefined') {
      if (newConfig.botToken !== undefined) localStorage.setItem('TELEGRAM_BOT_TOKEN', this.config.botToken);
      if (newConfig.chatId !== undefined) localStorage.setItem('TELEGRAM_CHAT_ID', this.config.chatId);
      if (newConfig.isEnabled !== undefined) localStorage.setItem('TELEGRAM_ALERTS_ENABLED', String(this.config.isEnabled));
    }
  }

  public formatSignalMessage(signal: SignalJSON): string {
    const isBuy = signal.signal === 'BUY';
    const signalEmoji = isBuy ? '🟢' : '🔴';
    const actionText = isBuy ? 'BUY SIGNAL' : 'SELL SIGNAL';
    const h1Status = signal.h1_trend === 'BULLISH' ? 'Bullish ✅' : signal.h1_trend === 'BEARISH' ? 'Bearish ✅' : 'Neutral ⚠️';
    const m15Structure = signal.m15_structure === 'BULLISH' ? 'Bullish Structure ✅' : signal.m15_structure === 'BEARISH' ? 'Bearish Structure ✅' : 'Range ⚠️';
    const m15Setup = isBuy ? 'Pullback → Support ✅' : 'Pullback → Resistance ✅';
    const m5Retest = signal.m5_confirmation === 'BREAK_RETEST' ? 'Break + Retest ✅' : 'Confirmed ✅';
    const momentumText = signal.momentum === 'STRONG' ? 'Strong ✅' : signal.momentum === 'MODERATE' ? 'Moderate ✅' : 'Normal';

    return `🔥 *STEP INDEX MASTER AI*

${signalEmoji} *${actionText}*

*Confidence:* ${signal.confidence}%

*Entry:* \`${signal.entry.toFixed(2)}\`
*Stop Loss:* \`${signal.stop_loss.toFixed(2)}\`
*TP1:* \`${signal.take_profit_1.toFixed(2)}\`
*TP2:* \`${signal.take_profit_2.toFixed(2)}\`

*Risk/Reward:* \`${signal.risk_reward}\`

*H1:* ${h1Status}
*M15:* ${m15Structure}
*M15:* ${m15Setup}
*M5:* ${m5Retest}
*Momentum:* ${momentumText}

*Trade Management:*
TP1 → Partial Profit
TP1 Hit → Protect Remaining Position
TP2 → Runner

*STATUS:* VALID ENTRY
*ID:* \`${signal.signal_id}\``;
  }

  public async sendSignal(signal: SignalJSON): Promise<{ success: boolean; error?: string }> {
    if (!this.config.isEnabled) {
      return { success: false, error: 'Telegram alerts are disabled in settings' };
    }

    if (!this.config.botToken || !this.config.chatId) {
      return { success: false, error: 'Telegram Bot Token or Chat ID not configured' };
    }

    // Cooldown and deduplication
    if (signal.signal_id === this.lastSentSignalId) {
      return { success: false, error: 'Duplicate signal already dispatched' };
    }

    const now = Date.now();
    if (now - this.lastSentTimestamp < this.cooldownMs) {
      return { success: false, error: 'Cooldown active between consecutive alerts' };
    }

    const message = this.formatSignalMessage(signal);
    const result = await this.sendMessage(message);

    if (result.success) {
      this.lastSentSignalId = signal.signal_id;
      this.lastSentTimestamp = now;
    }

    return result;
  }

  public async sendMessage(markdownText: string): Promise<{ success: boolean; error?: string }> {
    // 1. If client has credentials, try direct Telegram Bot API
    if (this.config.botToken && this.config.chatId) {
      try {
        const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.config.chatId,
            text: markdownText,
            parse_mode: 'Markdown',
          }),
        });

        const data = await response.json();
        if (response.ok && data.ok) {
          return { success: true };
        }
      } catch (err) {
        console.warn('[TelegramService] Direct API request failed, trying server proxy fallback...', err);
      }
    }

    // 2. Server Proxy Fallback (/api/telegram/broadcast)
    try {
      const proxyRes = await fetch('/api/telegram/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: this.config.botToken || undefined,
          chatId: this.config.chatId || undefined,
          message: markdownText,
        }),
      });

      const proxyData = await proxyRes.json();
      if (proxyRes.ok && proxyData.success) {
        return { success: true };
      }
      return { success: false, error: proxyData.error || 'Server broadcast failed' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Telegram alert dispatch error' };
    }
  }

  public async sendTestMessage(): Promise<{ success: boolean; error?: string }> {
    const testMessage = `🔥 *STEP INDEX MASTER AI* - Connection Test

✅ *Telegram Bot Integration Active*
📡 *Deriv Real-time Connection:* Active
⏱ *Timestamp:* ${new Date().toISOString()}

_Your 24/7 Step Index Master AI alert channel is connected successfully._`;

    return this.sendMessage(testMessage);
  }
}

export const telegramService = new TelegramService();
