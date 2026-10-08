import React from 'react';
import { Cpu, ArrowUpRight, ArrowDownRight, RefreshCw, Shield, Target, Scale, Layers, Crosshair, Sparkles } from 'lucide-react';
import { SignalJSON, WaitJSON, TimeframeAnalysis, SignalType } from '../types/market';
import { useStrategy } from '../context/StrategyContext';
import { TradingStrategy } from '../strategies';

interface SignalHeroCardProps {
  decision: SignalType;
  signal: SignalJSON | null;
  wait: WaitJSON | null;
  analysis: TimeframeAnalysis | null;
  currentPrice: number;
  activeStrategy?: TradingStrategy;
  onNavigateToStrategies?: () => void;
}

export const SignalHeroCard: React.FC<SignalHeroCardProps> = ({
  decision,
  signal,
  wait,
  analysis,
  currentPrice,
  activeStrategy: propStrategy,
  onNavigateToStrategies,
}) => {
  const { activeStrategy: ctxStrategy, strategyResult } = useStrategy();
  const currentStrategy = propStrategy || ctxStrategy;

  // Use dynamic strategy result if available, fallback to props
  const effectiveDecision = strategyResult?.signal ?? decision;
  const isBuy = effectiveDecision === 'BUY';
  const isSell = effectiveDecision === 'SELL';
  const isWait = effectiveDecision === 'WAIT';

  // Confidence & Score from active strategy evaluation
  const confidence = strategyResult?.signalStrength ?? (signal ? signal.confidence : wait?.score ?? analysis?.scoreBreakdown.total ?? 65);

  // Colors & Styles based on signal
  let borderClass = 'border-slate-800';
  let glowClass = '';
  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
  let actionColor = 'text-slate-300';
  let circleStrokeColor = '#64748b';

  if (isBuy) {
    borderClass = 'border-emerald-500/50';
    glowClass = 'glow-emerald';
    badgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    actionColor = 'text-emerald-400';
    circleStrokeColor = '#10b981';
  } else if (isSell) {
    borderClass = 'border-rose-500/50';
    glowClass = 'glow-rose';
    badgeColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    actionColor = 'text-rose-400';
    circleStrokeColor = '#f43f5e';
  } else {
    borderClass = 'border-cyan-500/30';
    glowClass = 'glow-cyan';
    badgeColor = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    actionColor = 'text-cyan-300';
    circleStrokeColor = '#06b6d4';
  }

  // Trend text & specs
  const trendText =
    analysis?.h1.trend === 'BULLISH' ? 'UP' : analysis?.h1.trend === 'BEARISH' ? 'DOWN' : 'SIDEWAYS';
  const momentumText = analysis?.m5.momentum || 'MODERATE';
  const structureText = analysis?.m15.structure || (strategyResult?.marketStatus ?? 'RANGE');

  // SVG circle calculations for the gauge
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (confidence / 100) * circumference;

  // Numeric levels - dynamically populated from strategy result or signal
  const entryVal = strategyResult?.entry ?? signal?.entry ?? (currentPrice > 0 ? Number(currentPrice.toFixed(2)) : null);
  const slVal = strategyResult?.stopLoss ?? signal?.stop_loss ?? null;
  const tp1Val = strategyResult?.tp1 ?? signal?.take_profit_1 ?? null;
  const tp2Val = strategyResult?.tp2 ?? signal?.take_profit_2 ?? null;

  const diffTp1 = entryVal && tp1Val ? Math.abs(tp1Val - entryVal) : null;
  const diffTp2 = entryVal && tp2Val ? Math.abs(tp2Val - entryVal) : null;

  // Bullet points / Analysis notes from active strategy
  const analysisBullets = strategyResult?.analysisNotes && strategyResult.analysisNotes.length > 0
    ? strategyResult.analysisNotes
    : wait?.reason && wait.reason.length > 0
    ? wait.reason
    : [
        `Macro Trend: ${trendText} (${currentStrategy.timeframes.join(', ')})`,
        `Market Structure: ${structureText}`,
        `Momentum Confirmation: ${momentumText}`,
      ];

  return (
    <div
      className={`glass-panel rounded-3xl p-5 md:p-7 border ${borderClass} ${glowClass} relative overflow-hidden transition-all duration-300 shadow-2xl mb-5`}
    >
      {/* Background ambient radial highlight */}
      <div
        className={`absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none ${
          isBuy ? 'bg-emerald-500' : isSell ? 'bg-rose-500' : 'bg-cyan-500'
        }`}
      />

      {/* 1. TOP STRATEGY BANNER: Shows Active Strategy Engine clearly */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 mb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
            Active Strategy:
          </span>
          <span className="text-xs sm:text-sm font-extrabold text-white tracking-wide">
            {currentStrategy.shortName}
          </span>
          <span className="hidden sm:inline text-slate-500">•</span>
          <span className="hidden sm:inline text-[11px] text-slate-400 truncate max-w-xs">
            {currentStrategy.setupType}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 font-bold">
            Win: {currentStrategy.winRate || currentStrategy.expectedWinRate}
          </span>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 font-bold">
            R:R {currentStrategy.riskReward}
          </span>
          {onNavigateToStrategies && (
            <button
              onClick={onNavigateToStrategies}
              className="px-2 py-0.5 rounded-md text-[10px] font-sans font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
            >
              Switch ▾
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Row: AI SIGNAL Badge & Action & Gauge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div>
          {/* AI Signal Badge with Strategy Tag */}
          <div className="flex items-center gap-2 mb-3">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase border ${badgeColor}`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>AI SIGNAL</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
              {currentStrategy.id.replace('strategy', 'STRAT-')}
            </span>
          </div>

          {/* Large Action: BUY / SELL / WAIT */}
          <div className="flex items-baseline gap-3">
            <h2 className={`text-4xl md:text-6xl font-black tracking-tight uppercase ${actionColor}`}>
              {effectiveDecision}
            </h2>
            <div className="flex items-center gap-1 text-slate-400 font-semibold text-sm md:text-base">
              <span>STEP INDEX</span>
              {isBuy ? (
                <ArrowUpRight className="w-5 h-5 text-emerald-400" />
              ) : isSell ? (
                <ArrowDownRight className="w-5 h-5 text-rose-400" />
              ) : (
                <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
              )}
            </div>
          </div>
        </div>

        {/* Center/Right Gauge & Multi-Timeframe Specs */}
        <div className="flex items-center gap-6 justify-between md:justify-end">
          {/* Circular Gauge */}
          <div className="relative flex flex-col items-center justify-center">
            <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 96 96">
              {/* Background circle track */}
              <circle
                cx="48"
                cy="48"
                r={radius}
                className="stroke-slate-800"
                strokeWidth="7"
                fill="transparent"
              />
              {/* Progress circle */}
              <circle
                cx="48"
                cy="48"
                r={radius}
                stroke={circleStrokeColor}
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-extrabold text-white font-mono-numbers">
                {confidence}%
              </span>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-tight -mt-0.5">
                Signal Strength
              </span>
            </div>
          </div>

          {/* Right Parameters list */}
          <div className="space-y-1.5 text-xs text-slate-300 min-w-[150px]">
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-400">Trend:</span>
              <span className={`font-bold ${trendText === 'UP' ? 'text-emerald-400' : trendText === 'DOWN' ? 'text-rose-400' : 'text-slate-200'}`}>
                {trendText}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-400">Momentum:</span>
              <span className={`font-bold ${momentumText === 'STRONG' ? 'text-emerald-400' : momentumText === 'MODERATE' ? 'text-cyan-400' : 'text-amber-400'}`}>
                {momentumText}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-400">Structure:</span>
              <span className={`font-bold ${structureText.includes('BULL') ? 'text-emerald-400' : structureText.includes('BEAR') ? 'text-rose-400' : 'text-slate-200'}`}>
                {structureText}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-400">Target Asset:</span>
              <span className="font-bold text-slate-200">{currentStrategy.targetAsset}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Status Analysis Breakdown / Bullet Points */}
      <div className="my-4 p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold mb-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="uppercase font-mono text-[11px] tracking-wide">
            {isWait ? 'Status: Awaiting Structural Confirmation (No Forced Trades)' : `${effectiveDecision} Execution Criteria Confirmed`}
          </span>
        </div>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          {analysisBullets.map((bullet, i) => (
            <li key={i} className="leading-snug">{bullet}</li>
          ))}
        </ul>
      </div>

      {/* 4. Four Cards Grid: ENTRY | STOP LOSS | TP1 (1R) | TP2 (2R) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-5">
        {/* Card 1: ENTRY */}
        <div className="glass-card rounded-2xl p-3.5 border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
            <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span>ENTRY</span>
          </div>
          <div className="mt-2 text-lg md:text-xl font-black text-white font-mono-numbers">
            {entryVal !== null ? entryVal.toFixed(2) : '---.--'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
            {entryVal !== null ? '(Current Price)' : '(Awaiting Price)'}
          </div>
        </div>

        {/* Card 2: STOP LOSS */}
        <div className="glass-card rounded-2xl p-3.5 border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
            <div className="w-5 h-5 rounded-md bg-rose-500/10 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <span>STOP LOSS</span>
          </div>
          <div className="mt-2 text-lg md:text-xl font-black text-white font-mono-numbers">
            {slVal !== null ? slVal.toFixed(2) : '---.--'}
          </div>
          <div className="text-[10px] text-rose-400 mt-0.5 font-mono">
            {entryVal && slVal ? `(-${Math.abs(entryVal - slVal).toFixed(2)})` : '(Structure SL)'}
          </div>
        </div>

        {/* Card 3: TP1 (1R) */}
        <div className="glass-card rounded-2xl p-3.5 border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
            <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span>TP1 (1R)</span>
          </div>
          <div className="mt-2 text-lg md:text-xl font-black text-white font-mono-numbers">
            {tp1Val !== null ? tp1Val.toFixed(2) : '---.--'}
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5 font-mono">
            {diffTp1 !== null ? `(+${diffTp1.toFixed(2)})` : '---'}
          </div>
        </div>

        {/* Card 4: TP2 (2R) */}
        <div className="glass-card rounded-2xl p-3.5 border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
            <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span>TP2 (2R)</span>
          </div>
          <div className="mt-2 text-lg md:text-xl font-black text-white font-mono-numbers">
            {tp2Val !== null ? tp2Val.toFixed(2) : '---.--'}
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5 font-mono">
            {diffTp2 !== null ? `(+${diffTp2.toFixed(2)})` : '---'}
          </div>
        </div>
      </div>

      {/* 5. Bottom Row: Strategy Metrics & Position Specs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800/60">
        <div className="flex items-center gap-2.5 text-xs text-slate-300">
          <div className="w-8 h-8 rounded-lg bg-slate-800/80 flex items-center justify-center text-cyan-400">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">RISK / REWARD</div>
            <div className="font-bold text-white font-mono-numbers">{currentStrategy.riskReward}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs text-slate-300">
          <div className="w-8 h-8 rounded-lg bg-slate-800/80 flex items-center justify-center text-emerald-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">TIMEFRAMES</div>
            <div className="font-bold text-white font-mono">{currentStrategy.timeframes.join(' → ')}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs text-slate-300">
          <div className="w-8 h-8 rounded-lg bg-slate-800/80 flex items-center justify-center text-cyan-400">
            <Crosshair className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">ALGORITHM</div>
            <div className="font-bold text-white">{currentStrategy.shortName}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
