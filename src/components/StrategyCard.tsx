import React from 'react';
import { Volume2, VolumeX, CheckCircle2 } from 'lucide-react';
import { TradingStrategy } from '../strategies';

interface StrategyCardProps {
  strategy: TradingStrategy;
  index: number;
  isActive: boolean;
  isSoundEnabled: boolean;
  onSelect: (id: string, name: string) => void;
  onToggleSound: (id: string) => void;
}

/**
 * StrategyCard Component:
 * Clean, production-ready Strategy Card matching Image specifications:
 * - Sequential index number prefix (01., 02., 03., 04.) in styled dimmed text
 * - Sound Alert Toggle Button (Volume2 / VolumeX) with instant tactile feedback
 * - Visual Active indicator badge
 * - Deriv Step Index Win Rate, Risk:Reward ratio, and Multi-timeframe filters
 */
export const StrategyCard: React.FC<StrategyCardProps> = ({
  strategy,
  index,
  isActive,
  isSoundEnabled,
  onSelect,
  onToggleSound,
}) => {
  // Format index with leading zero (01., 02., 03., etc.)
  const indexFormatted = (index + 1).toString().padStart(2, '0') + '.';

  return (
    <div
      onClick={() => onSelect(strategy.id, strategy.shortName)}
      className={`group cursor-pointer rounded-2xl p-4 md:p-5 border transition-all duration-200 relative flex flex-col justify-between overflow-hidden ${
        isActive
          ? 'bg-slate-900/95 border-cyan-400 shadow-[0_0_28px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/90'
          : 'bg-[#091122]/90 border-slate-800/80 hover:border-slate-700/90 hover:bg-slate-900/70 shadow-md'
      }`}
    >
      {/* Top ambient highlight for active engine */}
      {isActive && (
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />
      )}

      {/* Top Header Row: Strategy Title with Numbering + Badges & Sound Toggle */}
      <div>
        <div className="flex items-start justify-between gap-2">
          {/* 1. Strategy Numbering (01., 02...) & Title */}
          <div className="flex items-baseline gap-1.5 flex-1 min-w-0 pr-2">
            <span
              className={`font-mono text-xs sm:text-sm font-black tracking-tight shrink-0 ${
                isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-400'
              }`}
            >
              {indexFormatted}
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight truncate">
              {strategy.shortName}
            </h3>
          </div>

          {/* Right Action Icons: Sound Alert Toggle Button & Active Badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Audio Alert Toggle Button (Speaker Icon) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSound(strategy.id);
              }}
              title={
                isSoundEnabled
                  ? `Sound alerts ENABLED for ${strategy.shortName}. Click to Mute.`
                  : `Sound alerts MUTED for ${strategy.shortName}. Click to Unmute.`
              }
              aria-label={isSoundEnabled ? 'Mute sound alerts' : 'Enable sound alerts'}
              className={`p-1.5 rounded-lg border transition-all duration-200 flex items-center gap-1 ${
                isSoundEnabled
                  ? isActive
                    ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300 shadow-sm shadow-cyan-500/20 hover:bg-cyan-500/30'
                    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
                  : 'bg-slate-800/80 border-slate-700/60 text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              {isSoundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span className="text-[10px] font-mono font-bold hidden sm:inline">
                    {isActive ? 'ALERT ON' : 'ON'}
                  </span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span className="text-[10px] font-mono font-medium hidden sm:inline">
                    MUTED
                  </span>
                </>
              )}
            </button>

            {/* Active Pill Badge */}
            {isActive && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-cyan-400 text-slate-950 uppercase tracking-wider shadow-md shadow-cyan-400/20">
                <CheckCircle2 className="w-3 h-3 text-slate-950 stroke-[2.5]" />
                <span>ACTIVE</span>
              </span>
            )}
          </div>
        </div>

        {/* Expected Win Rate Spec */}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-cyan-400/90">
            Win Rate: {strategy.winRate || strategy.expectedWinRate}
          </span>
          {strategy.setupType && (
            <span className="text-[10px] text-slate-500 font-sans truncate hidden sm:inline">
              • {strategy.setupType}
            </span>
          )}
        </div>

        {/* Short Description */}
        <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
          {strategy.descriptionEn}
        </p>
      </div>

      {/* Bottom Specs Row: Risk:Reward Ratio + Execution Timeframes */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-400">
          <span>1 :</span>
          <span>{strategy.riskReward.replace(/^1\s*:\s*/, '')}</span>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-300 bg-slate-950/80 border border-slate-800 px-2 py-0.5 rounded-md">
          {strategy.timeframes.join(' • ')}
        </div>
      </div>
    </div>
  );
};

export default StrategyCard;
