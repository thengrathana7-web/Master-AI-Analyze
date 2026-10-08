import React, { useState } from 'react';
import { Cpu, CheckCircle2, Sparkles, Volume2, VolumeX, ShieldCheck } from 'lucide-react';
import { TradingStrategy } from '../strategies';
import { TimeframeAnalysis } from '../types/market';
import { useStrategy } from '../context/StrategyContext';
import { StrategyCard } from './StrategyCard';
import { TimeframeAnalysisPanel } from './TimeframeAnalysisPanel';

interface AnalysisProps {
  activeStrategy?: TradingStrategy;
  onSelectStrategy?: (id: string) => void;
  analysis: TimeframeAnalysis | null;
}

/**
 * Analysis View Component (Tab 3):
 * Provides full strategy suite switching, sequential 01-04 numbering,
 * and individual strategy audio alert toggle controls.
 */
export const Analysis: React.FC<AnalysisProps> = ({
  activeStrategy: propStrategy,
  onSelectStrategy,
  analysis,
}) => {
  const {
    activeStrategy: ctxStrategy,
    availableStrategies,
    setActiveStrategyId,
    isStrategySoundEnabled,
    toggleStrategySound,
  } = useStrategy();

  const currentStrategy = propStrategy || ctxStrategy;
  const [switchedNotice, setSwitchedNotice] = useState<string | null>(null);

  const handleSelect = (id: string, name: string) => {
    setActiveStrategyId(id);
    if (onSelectStrategy) {
      onSelectStrategy(id);
    }
    setSwitchedNotice(`Activated: ${name}`);
    setTimeout(() => setSwitchedNotice(null), 3000);
  };

  const isActiveSoundOn = isStrategySoundEnabled(currentStrategy.id);

  return (
    <div className="space-y-5 mb-8">
      {/* Toast Alert Notice on Strategy Switch */}
      {switchedNotice && (
        <div className="fixed top-16 right-4 z-50 bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-cyan-400/40 text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{switchedNotice} — Live Signal Engine Recalibrated!</span>
        </div>
      )}

      {/* 1. Header Section */}
      <div className="glass-panel rounded-3xl p-5 md:p-6 border border-slate-800 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Cpu className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black text-white uppercase tracking-wide">
                STEP INDEX AI ANALYSIS
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                ជ្រើសរើសយុទ្ធសាស្ត្រជួញដូរសម្រាប់ Step Index (Select Trading Strategy Algorithm)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{availableStrategies.length} Strategies Ready</span>
            </span>
          </div>
        </div>

        {/* Audio Alert Rule Explainer Banner */}
        <div className="mt-3.5 p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            {isActiveSoundOn ? (
              <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" />
            ) : (
              <VolumeX className="w-4 h-4 text-rose-400" />
            )}
            <span className="font-sans font-medium text-slate-300">
              Sound Alert Rule: Alerts trigger <strong>ONLY for the ACTIVE strategy</strong> (
              <span className="text-cyan-300 font-bold">{currentStrategy.shortName}</span>
              ).
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-slate-500">Active Status:</span>
            <span
              className={`px-2 py-0.5 rounded font-bold ${
                isActiveSoundOn
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              {isActiveSoundOn ? '🔊 SOUND ON' : '🔇 MUTED'}
            </span>
          </div>
        </div>

        {/* 2. Strategy Selector Cards List with 01., 02., 03., 04. Prefix Numbering */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4">
          {availableStrategies.map((strat, idx) => {
            const isActive = strat.id === currentStrategy.id;
            const isSoundOn = isStrategySoundEnabled(strat.id);

            return (
              <StrategyCard
                key={strat.id}
                strategy={strat}
                index={idx}
                isActive={isActive}
                isSoundEnabled={isSoundOn}
                onSelect={handleSelect}
                onToggleSound={toggleStrategySound}
              />
            );
          })}
        </div>
      </div>

      {/* 3. Detailed Active Strategy Inspection Card */}
      <div className="glass-panel rounded-3xl p-5 md:p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider font-mono">
                CURRENTLY ACTIVE ENGINE
              </span>
            </div>
            <h3 className="text-lg font-black text-white mt-0.5">{currentStrategy.name}</h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct Sound Toggle for Active Strategy */}
            <button
              onClick={() => toggleStrategySound(currentStrategy.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition ${
                isActiveSoundOn
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {isActiveSoundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{isActiveSoundOn ? 'Sound: ON' : 'Sound: MUTED'}</span>
            </button>

            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1.5 rounded-xl font-mono">
              Target: <strong className="text-white">{currentStrategy.targetAsset}</strong>
            </span>
            <span className="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1.5 rounded-xl font-mono font-bold">
              R:R {currentStrategy.riskReward}
            </span>
          </div>
        </div>

        {/* Descriptions (Khmer + English) */}
        <div className="space-y-1.5 text-xs">
          <p className="text-slate-200 leading-relaxed font-sans">
            🇰🇭 {currentStrategy.descriptionKh}
          </p>
          <p className="text-slate-400 leading-relaxed font-sans">
            🌐 {currentStrategy.descriptionEn}
          </p>
        </div>

        {/* Indicators Used */}
        <div className="pt-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            INDICATORS & TECHNICAL FILTERS
          </div>
          <div className="flex flex-wrap gap-2">
            {currentStrategy.indicators.map((ind, i) => (
              <span
                key={i}
                className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-900 text-cyan-300 border border-slate-800"
              >
                {ind}
              </span>
            ))}
          </div>
        </div>

        {/* Execution Rules List */}
        <div className="pt-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            STRATEGY EXECUTION RULES
          </div>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {currentStrategy.executionRules.map((rule, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 4. Live Multi-Timeframe Scoring & Analysis for this Strategy */}
      <TimeframeAnalysisPanel analysis={analysis} />
    </div>
  );
};

export default Analysis;
