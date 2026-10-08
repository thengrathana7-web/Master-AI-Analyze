import React from 'react';
import { Layers, ShieldCheck, Zap, Award, CheckCircle2, AlertTriangle } from 'lucide-react';
import { TimeframeAnalysis } from '../types/market';

interface TimeframeAnalysisPanelProps {
  analysis: TimeframeAnalysis | null;
}

export const TimeframeAnalysisPanel: React.FC<TimeframeAnalysisPanelProps> = ({
  analysis,
}) => {
  if (!analysis) {
    return (
      <div className="glass-panel rounded-3xl p-6 border border-slate-800 text-center text-slate-400">
        Analyzing Step Index multi-timeframe structure...
      </div>
    );
  }

  const { h1, m15, m5, scoreBreakdown } = analysis;

  return (
    <div className="space-y-4">
      {/* 3-Timeframe Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* H1 Main Trend Card */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800/80">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              H1 MAIN TREND
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                h1.trend === 'BULLISH'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : h1.trend === 'BEARISH'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {h1.trend}
            </span>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Structure:</span>
              <span className="font-semibold text-slate-200">
                {h1.higherHighs ? 'Higher Highs' : 'Lower Lows / Chop'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">EMA20 / EMA50:</span>
              <span className="font-mono text-slate-200">
                {h1.ema20.toFixed(1)} / {h1.ema50.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Dominance:</span>
              <span className="font-semibold text-slate-300">
                {h1.ema20 > h1.ema50 ? 'Buyers in Control' : 'Sellers in Control'}
              </span>
            </div>
          </div>
        </div>

        {/* M15 Market Structure Card */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800/80">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              M15 STRUCTURE
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                m15.structure === 'BULLISH'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : m15.structure === 'BEARISH'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {m15.structure}
            </span>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Setup Pattern:</span>
              <span className="font-semibold text-cyan-400">
                {m15.setup.replace('_', ' ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Key Zone:</span>
              <span className="font-mono text-slate-200">
                {m15.supportLevel.toFixed(1)} - {m15.resistanceLevel.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Rejection:</span>
              <span className="font-semibold text-slate-300">
                {m15.rejectionDetected ? 'Rejection Wick Confirmed' : 'Normal candles'}
              </span>
            </div>
          </div>
        </div>

        {/* M5 Entry Confirmation Card */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800/80">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              M5 ENTRY (EXECUTION)
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                m5.entryStatus === 'BREAK_RETEST'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {m5.entryStatus}
            </span>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Breakout & Retest:</span>
              <span className="font-semibold text-slate-200">
                {m5.breakoutConfirmed && m5.retestHeld ? 'Holds Valid' : 'In Progress'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Momentum:</span>
              <span className={`font-semibold ${m5.momentum === 'STRONG' ? 'text-emerald-400' : 'text-slate-300'}`}>
                {m5.momentum} (RSI: {m5.rsi.toFixed(1)})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Swing Level:</span>
              <span className="font-mono text-slate-200">
                H: {m5.swingHigh.toFixed(1)} | L: {m5.swingLow.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quality Score Breakdown (0 - 100) */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
              ENTRY QUALITY SCORE (0–100)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-white font-mono-numbers">
              {scoreBreakdown.total}
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
            <span
              className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase ${
                scoreBreakdown.tier === 'VERY_STRONG'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : scoreBreakdown.tier === 'STRONG'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : scoreBreakdown.tier === 'WATCH'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {scoreBreakdown.tier.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Score Progress Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4 text-xs">
          <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex justify-between text-slate-400">
              <span>H1 Trend</span>
              <strong className="text-white font-mono">{scoreBreakdown.h1Trend}/30</strong>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${(scoreBreakdown.h1Trend / 30) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex justify-between text-slate-400">
              <span>M15 Structure</span>
              <strong className="text-white font-mono">{scoreBreakdown.m15Structure}/25</strong>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${(scoreBreakdown.m15Structure / 25) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex justify-between text-slate-400">
              <span>M15 Pullback/Zone</span>
              <strong className="text-white font-mono">{scoreBreakdown.m15PullbackZone}/15</strong>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${(scoreBreakdown.m15PullbackZone / 15) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex justify-between text-slate-400">
              <span>M5 Break + Retest</span>
              <strong className="text-white font-mono">{scoreBreakdown.m5BreakRetest}/20</strong>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${(scoreBreakdown.m5BreakRetest / 20) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex justify-between text-slate-400">
              <span>M5 Momentum</span>
              <strong className="text-white font-mono">{scoreBreakdown.m5Momentum}/10</strong>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${(scoreBreakdown.m5Momentum / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Signals require score &ge; 80 and full H1 &rarr; M15 &rarr; M5 alignment to trigger.</span>
        </div>
      </div>
    </div>
  );
};
