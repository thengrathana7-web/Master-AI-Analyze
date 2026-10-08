import React from 'react';
import { Trophy, TrendingUp, Percent, ShieldAlert, Award, Activity, BarChart2 } from 'lucide-react';
import { PerformanceStats } from '../types/market';

interface PerformanceDashboardProps {
  stats: PerformanceStats;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ stats }) => {
  return (
    <div className="glass-panel rounded-3xl p-5 md:p-6 border border-slate-800 shadow-xl mb-6">
      <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
          <Trophy className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-base md:text-lg font-extrabold text-white tracking-wide uppercase">
            PERFORMANCE METRICS
          </h2>
          <p className="text-xs text-slate-400">
            Computed exclusively from live recorded Step Index signals & market outcomes
          </p>
        </div>
      </div>

      {/* Grid of metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        {/* Metric 1: Win Rate */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>WIN RATE</span>
            <Percent className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-black text-white font-mono-numbers">
            {stats.winRate}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {stats.winningSignals} Wins / {stats.losingSignals} Losses
          </div>
        </div>

        {/* Metric 2: Profit Factor */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>PROFIT FACTOR</span>
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-black text-white font-mono-numbers">
            {stats.profitFactor.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Gross gains / losses ratio
          </div>
        </div>

        {/* Metric 3: Average R */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>AVERAGE R</span>
            <Award className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-black text-white font-mono-numbers">
            {stats.averageR > 0 ? `+${stats.averageR}` : stats.averageR}R
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Risk-adjusted expectancy
          </div>
        </div>

        {/* Metric 4: Max Drawdown */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>MAX DRAWDOWN</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-black text-white font-mono-numbers">
            {stats.maxDrawdown}R
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Peak-to-trough structural loss
          </div>
        </div>

        {/* Metric 5: Total Signals */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>TOTAL SIGNALS</span>
            <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-black text-white font-mono-numbers">
            {stats.totalSignals}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Score &ge; 80 qualified trades
          </div>
        </div>

        {/* Metric 6: TP1 Hit Rate */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>TP1 HIT RATE</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-black text-emerald-400 font-mono-numbers">
            {stats.tp1HitRate}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Partial profit secured (~1R)
          </div>
        </div>

        {/* Metric 7: TP2 Hit Rate */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>TP2 RUNNER HIT</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-black text-cyan-400 font-mono-numbers">
            {stats.tp2HitRate}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Full target reached (~2.8R)
          </div>
        </div>

        {/* Metric 8: Quality Filter */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>MIN SCORE FILTER</span>
            <Award className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl md:text-3xl font-black text-white font-mono-numbers">
            80 / 100
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Zero low-probability trades
          </div>
        </div>
      </div>
    </div>
  );
};
