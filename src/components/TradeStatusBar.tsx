import React, { useEffect, useState } from 'react';
import { Target, Clock, CheckCircle2, DollarSign } from 'lucide-react';
import { SignalJSON, Tick } from '../types/market';
import { calculateStepIndexPnl } from '../utils/storage';

interface TradeStatusBarProps {
  activeSignal: SignalJSON | null;
  latestTick: Tick | null;
}

export const TradeStatusBar: React.FC<TradeStatusBarProps> = ({
  activeSignal,
  latestTick,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!activeSignal || activeSignal.status !== 'RUNNING') {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const secs = Math.floor((now - activeSignal.timestamp) / 1000);
      setElapsedSeconds(secs);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSignal]);

  const formatDuration = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Compute TP1 and TP2 progress percentages
  let tp1Percent = 0;
  let tp2Percent = 0;
  let livePnl = 0;
  const isTp1Hit = activeSignal?.management.tp1_action === 'TP1_SECURED' || activeSignal?.status === 'TP1_HIT' || activeSignal?.status === 'TP2_HIT';

  if (activeSignal && latestTick) {
    const isBuy = activeSignal.signal === 'BUY';
    const entry = activeSignal.entry;
    const current = latestTick.quote;
    const target1 = activeSignal.take_profit_1;
    const target2 = activeSignal.take_profit_2;

    // Accurate Deriv Step Index Profit/Loss Calculation:
    // (Exit - Entry) * (LotSize * 10) for BUY
    livePnl = calculateStepIndexPnl(activeSignal.signal, entry, current, 0.10);

    if (isBuy) {
      const totalDist1 = Math.max(0.1, target1 - entry);
      const curDist1 = current - entry;
      tp1Percent = Math.min(100, Math.max(0, Math.round((curDist1 / totalDist1) * 100)));

      const totalDist2 = Math.max(0.1, target2 - entry);
      const curDist2 = current - entry;
      tp2Percent = Math.min(100, Math.max(0, Math.round((curDist2 / totalDist2) * 100)));
    } else {
      const totalDist1 = Math.max(0.1, entry - target1);
      const curDist1 = entry - current;
      tp1Percent = Math.min(100, Math.max(0, Math.round((curDist1 / totalDist1) * 100)));

      const totalDist2 = Math.max(0.1, entry - target2);
      const curDist2 = entry - current;
      tp2Percent = Math.min(100, Math.max(0, Math.round((curDist2 / totalDist2) * 100)));
    }
  }

  return (
    <div className="glass-panel rounded-2xl p-4 border border-slate-800/80 shadow-lg flex flex-wrap items-center justify-between gap-4 mb-5">
      {/* 1. Status */}
      <div className="flex items-center gap-3">
        <span
          className={`w-3 h-3 rounded-full ${
            activeSignal
              ? 'bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse'
              : 'bg-cyan-400'
          }`}
        />
        <div>
          <div className="text-xs font-bold text-white uppercase tracking-wider">
            {activeSignal ? `${activeSignal.signal} RUNNING` : 'WAITING FOR 100% SETUP'}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            {activeSignal
              ? isTp1Hit
                ? 'TP1 Secured • Protected at BE'
                : 'Execution locked until TP2 or SL'
              : 'Scanning Step Index structure'}
          </p>
        </div>
      </div>

      {/* 2. Live P&L (When trade is active) */}
      {activeSignal && (
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              livePnl >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
            }`}
          >
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Live P&L (0.10 Lot)</div>
            <div
              className={`text-xs font-bold font-mono-numbers ${
                livePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {livePnl >= 0 ? `+$${livePnl.toFixed(2)}` : `-$${Math.abs(livePnl).toFixed(2)}`}
            </div>
          </div>
        </div>
      )}

      {/* 3. TP1 Progress */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
          <Target className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-semibold">TP1 (1R)</div>
          <div className="text-xs font-bold text-white font-mono-numbers flex items-center gap-1">
            {isTp1Hit ? (
              <span className="text-emerald-400 flex items-center gap-1 font-sans">
                <CheckCircle2 className="w-3.5 h-3.5" /> SECURED
              </span>
            ) : (
              `${tp1Percent}%`
            )}
          </div>
        </div>
      </div>

      {/* 4. TP2 Progress */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
          <Target className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-semibold">TP2 (2.8R)</div>
          <div className="text-xs font-bold text-white font-mono-numbers">
            {tp2Percent}%
          </div>
        </div>
      </div>

      {/* 5. Duration */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Duration</div>
          <div className="text-xs font-bold text-white font-mono-numbers">
            {formatDuration(elapsedSeconds)}
          </div>
        </div>
      </div>
    </div>
  );
};
