import React from 'react';
import { LineChart, Activity, Clock } from 'lucide-react';
import { Tick, TimeframeAnalysis, Timeframe } from '../types/market';

interface MarketMetricsBarProps {
  tick: Tick | null;
  prevTick: Tick | null;
  analysis: TimeframeAnalysis | null;
  activeTimeframe: Timeframe;
  lastUpdateEpoch: number | null;
  isConnected: boolean;
}

export const MarketMetricsBar: React.FC<MarketMetricsBarProps> = ({
  tick,
  prevTick,
  analysis,
  activeTimeframe,
  lastUpdateEpoch,
  isConnected,
}) => {
  const currentPrice = tick ? tick.quote : 0;
  const prevPrice = prevTick ? prevTick.quote : currentPrice;
  const diff = currentPrice - prevPrice;
  const diffPct = prevPrice > 0 ? (diff / prevPrice) * 100 : 0;

  const formattedPrice = currentPrice > 0 ? currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---.--';
  const isUp = diff >= 0;

  // Market Status determination
  let statusText = 'WAITING FOR DATA';
  let statusSubtext = 'Connecting to Deriv...';
  let statusColor = 'text-slate-400 bg-slate-500';

  if (isConnected && analysis) {
    if (analysis.h1.trend === 'BULLISH' || analysis.h1.trend === 'BEARISH') {
      statusText = 'TRENDING';
      statusSubtext = analysis.m5.momentum === 'STRONG' ? 'Strong Momentum' : 'Moderate Momentum';
      statusColor = 'text-emerald-400 bg-emerald-400 shadow-[0_0_8px_#34d399]';
    } else {
      statusText = 'RANGING';
      statusSubtext = 'Consolidation / Chop';
      statusColor = 'text-amber-400 bg-amber-400';
    }
  } else if (!isConnected) {
    statusText = 'DISCONNECTED';
    statusSubtext = 'Reconnecting...';
    statusColor = 'text-rose-500 bg-rose-500';
  }

  // Format last update time
  const formatTime = (epochMs: number | null) => {
    if (!epochMs) return 'Connecting...';
    const date = new Date(epochMs);
    return date.toTimeString().split(' ')[0];
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4">
      {/* 1. CURRENT PRICE */}
      <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border border-slate-800/80 shadow-lg">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            <span>CURRENT PRICE</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-extrabold text-white font-mono-numbers tracking-tight">
              {formattedPrice}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold">
            {currentPrice > 0 ? (
              <span className={`flex items-center font-mono ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isUp ? '▲ +' : '▼ '}
                {diff.toFixed(2)} ({isUp ? '+' : ''}{diffPct.toFixed(2)}%)
              </span>
            ) : (
              <span className="text-slate-500 text-xs">Awaiting market ticks</span>
            )}
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-slate-800/70 border border-slate-700/50 flex items-center justify-center text-cyan-400">
          <LineChart className="w-5 h-5" />
        </div>
      </div>

      {/* 2. MARKET STATUS */}
      <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border border-slate-800/80 shadow-lg">
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            MARKET STATUS
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
            <span className="text-lg md:text-xl font-bold tracking-tight text-white uppercase">
              {statusText}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400 font-medium">
            {statusSubtext}
          </p>
        </div>
        <div className="w-11 h-11 rounded-xl bg-slate-800/70 border border-slate-700/50 flex items-center justify-center text-emerald-400">
          <Activity className="w-5 h-5" />
        </div>
      </div>

      {/* 3. TIMEFRAME */}
      <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border border-slate-800/80 shadow-lg">
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            TIMEFRAME
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg md:text-xl font-bold text-white tracking-tight">
              {activeTimeframe} (Live)
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400 font-mono">
            Last Update: {formatTime(lastUpdateEpoch)}
          </p>
        </div>
        <div className="w-11 h-11 rounded-xl bg-slate-800/70 border border-slate-700/50 flex items-center justify-center text-cyan-400">
          <Clock className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
