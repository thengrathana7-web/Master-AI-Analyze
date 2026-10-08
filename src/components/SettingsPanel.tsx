import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, Copy, Terminal, Server, Key, ShieldCheck } from 'lucide-react';
import { telegramService } from '../services/telegramService';
import { derivService } from '../services/derivService';
import { DerivConnectionStatus } from '../types/market';

export interface SettingsPanelProps {
  derivStatus?: DerivConnectionStatus;
  onReconnectDeriv?: () => void;
  onUpdateAppId?: (appId: string) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  derivStatus = derivService.getStatus(),
  onReconnectDeriv = () => {
    derivService.disconnect();
    derivService.connect();
  },
  onUpdateAppId = (appId: string) => {
    derivService.setAppId(appId);
  },
}) => {
  const telegramConfig = telegramService.getConfig();
  const [botToken, setBotToken] = useState(telegramConfig.botToken);
  const [chatId, setChatId] = useState(telegramConfig.chatId);
  const [alertsEnabled, setAlertsEnabled] = useState(telegramConfig.isEnabled);

  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; message?: string }>({
    loading: false,
  });

  const [appIdInput, setAppIdInput] = useState('1089');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const handleSaveTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    telegramService.updateConfig({
      botToken: botToken.trim(),
      chatId: chatId.trim(),
      isEnabled: alertsEnabled,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSendTestAlert = async () => {
    setTestStatus({ loading: true });
    // First save the current values
    telegramService.updateConfig({
      botToken: botToken.trim(),
      chatId: chatId.trim(),
      isEnabled: alertsEnabled,
    });

    const res = await telegramService.sendTestMessage();
    if (res.success) {
      setTestStatus({
        loading: false,
        success: true,
        message: 'Telegram test alert delivered successfully to your channel!',
      });
    } else {
      setTestStatus({
        loading: false,
        success: false,
        message: res.error || 'Failed to send test message. Check bot token and chat ID.',
      });
    }
  };

  const dockerCommand = `docker run -d --restart=always \\
  -e TELEGRAM_BOT_TOKEN="${botToken || 'YOUR_BOT_TOKEN'}" \\
  -e TELEGRAM_CHAT_ID="${chatId || 'YOUR_CHAT_ID'}" \\
  --name step-index-worker \\
  step-index-worker`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(dockerCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Telegram Bot Integration Card */}
      <div className="glass-panel rounded-3xl p-5 md:p-7 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-extrabold text-white tracking-wide uppercase">
              TELEGRAM BOT NOTIFICATIONS
            </h2>
            <p className="text-xs text-slate-400">
              Receive automatic BUY/SELL signal alerts directly in Telegram even when this dashboard is closed
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveTelegram} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              TELEGRAM BOT TOKEN
            </label>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white text-sm font-mono focus:outline-none focus:border-cyan-500 transition"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Create a bot with <span className="text-cyan-400">@BotFather</span> on Telegram and paste the token here.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              TELEGRAM CHAT / USER ID
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g. 987654321 or -100123456789"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white text-sm font-mono focus:outline-none focus:border-cyan-500 transition"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Find your chat ID with <span className="text-cyan-400">@userinfobot</span> or from your Telegram channel/group.
            </p>
          </div>

          <div className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              id="alertsEnabled"
              checked={alertsEnabled}
              onChange={(e) => setAlertsEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-cyan-500 bg-slate-800 border-slate-700 focus:ring-cyan-400"
            />
            <label htmlFor="alertsEnabled" className="text-xs font-semibold text-slate-300 cursor-pointer">
              Enable automated Telegram trade alert broadcasting
            </label>
          </div>

          {/* Test Status feedback */}
          {testStatus.message && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                testStatus.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {testStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{testStatus.message}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg"
            >
              {savedSuccess ? 'Settings Saved!' : 'Save Telegram Config'}
            </button>

            <button
              type="button"
              disabled={testStatus.loading || !botToken || !chatId}
              onClick={handleSendTestAlert}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider border border-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5 text-cyan-400" />
              <span>{testStatus.loading ? 'Sending Test...' : 'Send Test Alert'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Deriv API & Connection Status */}
      <div className="glass-panel rounded-3xl p-5 md:p-7 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              D
            </div>
            <div>
              <h2 className="text-base md:text-lg font-extrabold text-white tracking-wide uppercase">
                DERIV WEBSOCKET STATUS
              </h2>
              <p className="text-xs text-slate-400">
                Direct official connection to Deriv WebSocket infrastructure
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                derivStatus.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-xs font-bold text-slate-300 uppercase">
              {derivStatus.isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs font-mono">
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase">Active Symbol</div>
            <div className="text-white font-semibold mt-1">{derivStatus.activeSymbol}</div>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase">Ping Latency</div>
            <div className="text-emerald-400 font-semibold mt-1">{derivStatus.pingMs} ms</div>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase">Reconnects</div>
            <div className="text-slate-300 font-semibold mt-1">{derivStatus.reconnectAttempts}</div>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase">Feed Stream</div>
            <div className="text-cyan-400 font-semibold mt-1">Real-time Ticks + OHLC</div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={onReconnectDeriv}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 uppercase transition border border-slate-700"
          >
            Reconnect Deriv Stream
          </button>
        </div>
      </div>

      {/* 3. 24/7 Independent Worker Deployment Guide */}
      <div className="glass-panel rounded-3xl p-5 md:p-7 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-extrabold text-white tracking-wide uppercase">
              24/7 BACKGROUND WORKER ARCHITECTURE
            </h2>
            <p className="text-xs text-slate-400">
              Run Step Index Master AI continuously on a persistent container or VPS
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-xs text-slate-300">
          <p>
            The 24/7 Worker operates independently from the Web App and Netlify. It maintains permanent WebSocket connections with Deriv, aggregates H1, M15, M5 candles, evaluates strategy break-and-retests, and posts signals to Telegram around the clock.
          </p>

          <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 relative font-mono text-[11px] text-cyan-300">
            <button
              onClick={copyToClipboard}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Copy Command"
            >
              {copiedCmd ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <pre className="whitespace-pre-wrap overflow-x-auto">{dockerCommand}</pre>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Worker files located in: <code className="text-white font-mono">/worker/worker.ts</code> and <code className="text-white font-mono">/worker/Dockerfile</code></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
