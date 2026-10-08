import React, { useState, useMemo } from 'react';
import { Trash2, Clock, Calendar, Cpu } from 'lucide-react';
import { SignalJSON } from '../types/market';
import { useStrategy } from '../context/StrategyContext';
import { TradingStrategy, AVAILABLE_STRATEGIES } from '../strategies';
import { calculateStepIndexPnl } from '../utils/storage';
import { formatTradeTimestamp } from '../utils/formatters';

export { formatTradeTimestamp };

interface JournalProps {
  signals: SignalJSON[];
  onClearHistory: () => void;
  activeStrategy?: TradingStrategy;
}

export type PeriodFilter = 'D' | '3D' | '7D' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

/**
 * TradeCard Component:
 * Clean, production-grade Trade Card following Image 2 (រូបទី2) layout:
 * - Left Accent Bar: Green for Win (+), Red for Loss (-)
 * - Left Side: [BUY/SELL] [0.10 Lot] [Timeframe], and Entry → Exit price line
 * - Right Side: EXACTLY ONE line of Dollar PnL:
 *     If profit: +$X.XX in bold GREEN (no minus sign, no mixed signs)
 *     If loss:   -$X.XX in bold RED   (no plus sign, only minus)
 *   Underneath: Formatted timestamp (<24h relative vs >24h clean Date string)
 */
export const TradeCard: React.FC<{
  signal: SignalJSON;
  selectedLotSize: number;
  strategyTimeframe: string;
}> = ({ signal, selectedLotSize, strategyTimeframe }) => {
  const isBuy = signal.signal === 'BUY';

  // Determine true outcome: TP2, TP1, or SL
  const isTp2 =
    signal.exitType === 'TP2' ||
    signal.result === 'TP2_HIT' ||
    signal.status === 'TP2_HIT';

  const isTp1 =
    signal.exitType === 'TP1' ||
    signal.result === 'TP1_HIT' ||
    signal.status === 'TP1_HIT' ||
    signal.management?.tp1_action === 'TP1_SECURED';

  // Resolve authentic exit price from real market execution:
  let exitPrice = signal.exit_price;
  if (!exitPrice || exitPrice === signal.entry) {
    if (isTp2) {
      exitPrice = signal.take_profit_2;
    } else if (isTp1) {
      exitPrice = signal.take_profit_1;
    } else {
      exitPrice = signal.stop_loss;
    }
  }

  // Exact Deriv Step Index Dollar Calculation:
  // BUY:  (ExitPrice - EntryPrice) * (LotSize * 10)
  // SELL: (EntryPrice - ExitPrice) * (LotSize * 10)
  const calculatedPnl = calculateStepIndexPnl(signal.signal, signal.entry, exitPrice, selectedLotSize);

  // If standard 0.10 lot and realized_pnl_usd is stored from real execution, respect it
  const finalPnl =
    selectedLotSize === 0.10 && typeof signal.realized_pnl_usd === 'number'
      ? signal.realized_pnl_usd
      : calculatedPnl;

  // Determine win vs loss status unambiguously
  const isWin = isTp2 || isTp1 || finalPnl > 0;
  const isProfit = isWin && finalPnl >= 0;
  const absDollar = Math.abs(finalPnl);

  // Timeframe Tag
  const tfTag = signal.entry_timeframe || strategyTimeframe || 'M1';

  // Formatted timestamp (<24h relative vs >24h clean Date string)
  const closedTimestamp = signal.closedAt || signal.exit_timestamp || signal.timestamp;
  const formattedTime = formatTradeTimestamp(closedTimestamp);

  return (
    <div className="relative flex items-center justify-between p-3.5 rounded-2xl bg-[#091122]/90 border border-slate-800/80 shadow-md hover:border-slate-700 transition overflow-hidden">
      {/* Accent Bar on the far left edge: Green for profit (+), Red for loss (-) */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
          isProfit ? 'bg-emerald-500' : 'bg-rose-500'
        }`}
      />

      {/* Left Side: Badges & Price Levels */}
      <div className="pl-2 space-y-1">
        <div className="flex items-center gap-2">
          {/* 1. Direction Tag: BUY (green) or SELL (red) */}
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wide ${
              isBuy
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {signal.signal}
          </span>

          {/* 2. Lot Size Tag: Fixed 0.10 Lot */}
          <span className="px-2 py-0.5 rounded text-[11px] font-bold text-slate-300 bg-slate-800 font-mono">
            {selectedLotSize.toFixed(2)} Lot
          </span>

          {/* 3. Timeframe Tag: Execution timeframe (e.g. M1, M5, M15) */}
          <span className="px-2 py-0.5 rounded text-[11px] font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-500/30 font-mono">
            {tfTag}
          </span>
        </div>

        {/* 4. Price Levels: Entry: XXXX.XX → Exit: XXXX.XX */}
        <div className="text-xs text-slate-400 font-mono">
          <span>Entry: {signal.entry.toFixed(2)}</span>
          <span className="mx-1.5 text-slate-600">→</span>
          <span>Exit: {exitPrice.toFixed(2)}</span>
        </div>
      </div>

      {/* Right Side: Exact PnL with ONLY + for profit and ONLY - for loss (Matching Image 2) */}
      <div className="text-right">
        {isProfit ? (
          <div className="text-sm sm:text-base font-extrabold font-mono-numbers tracking-tight text-emerald-400">
            {`+$${absDollar.toFixed(2)}`}
          </div>
        ) : (
          <div className="text-sm sm:text-base font-extrabold font-mono-numbers tracking-tight text-rose-500">
            {`-$${absDollar.toFixed(2)}`}
          </div>
        )}

        {/* Formatted timestamp underneath */}
        <div className="text-[11px] text-slate-500 font-medium mt-0.5 font-mono">
          {formattedTime}
        </div>
      </div>
    </div>
  );
};

export const Journal: React.FC<JournalProps> = ({
  signals,
  onClearHistory,
  activeStrategy: propStrategy,
}) => {
  const { activeStrategy: ctxStrategy, setActiveStrategyId } = useStrategy();
  const currentStrategy = propStrategy || ctxStrategy;

  // Deriv Step Index Standard Lot Size = 0.10 Lot
  const [selectedLotSize, setSelectedLotSize] = useState<number>(0.10);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('D');

  // STRICT REQUIREMENT:
  // Journal must NEVER combine all strategies together!
  // Filter signals strictly by CURRENT ACTIVE STRATEGY & Period!
  const filteredSignals = useMemo(() => {
    const now = Date.now();
    return signals.filter((s) => {
      // 1. Strict strategy isolation
      const sigStratId = s.strategy_id || 'strategy1_break_retest';
      if (sigStratId !== currentStrategy.id) {
        return false;
      }

      // 2. Period filter: D (24h), 3D, 7D, 1M, 3M, 6M, 1Y, ALL
      const closedTime = s.closedAt || s.exit_timestamp || s.timestamp;
      const ageMs = now - closedTime;
      const oneDay = 24 * 60 * 60 * 1000;

      if (selectedPeriod === 'D' && ageMs > oneDay) return false;
      if (selectedPeriod === '3D' && ageMs > 3 * oneDay) return false;
      if (selectedPeriod === '7D' && ageMs > 7 * oneDay) return false;
      if (selectedPeriod === '1M' && ageMs > 30 * oneDay) return false;
      if (selectedPeriod === '3M' && ageMs > 90 * oneDay) return false;
      if (selectedPeriod === '6M' && ageMs > 180 * oneDay) return false;
      if (selectedPeriod === '1Y' && ageMs > 365 * oneDay) return false;

      return true;
    });
  }, [signals, selectedPeriod, currentStrategy.id]);

  // Compute metrics for this isolated strategy
  const recordedTrades = filteredSignals.filter(
    (s) =>
      s.result === 'TP1_HIT' ||
      s.result === 'TP2_HIT' ||
      s.result === 'SL_HIT' ||
      s.exitType === 'TP1' ||
      s.exitType === 'TP2' ||
      s.exitType === 'SL' ||
      s.management?.tp1_action === 'TP1_SECURED' ||
      s.status === 'TP1_HIT' ||
      s.status === 'TP2_HIT' ||
      s.status === 'SL_HIT'
  );
  const totalTrades = recordedTrades.length;

  let totalWins = 0;
  let netR = 0;
  let totalDollarGain = 0;

  recordedTrades.forEach((s) => {
    const isTp2 = s.exitType === 'TP2' || s.result === 'TP2_HIT' || s.status === 'TP2_HIT';
    const isTp1 =
      s.exitType === 'TP1' ||
      s.result === 'TP1_HIT' ||
      s.status === 'TP1_HIT' ||
      s.management?.tp1_action === 'TP1_SECURED';

    let exit = s.exit_price;
    if (!exit || exit === s.entry) {
      if (isTp2) exit = s.take_profit_2;
      else if (isTp1) exit = s.take_profit_1;
      else exit = s.stop_loss;
    }

    const calcPnl = calculateStepIndexPnl(s.signal, s.entry, exit, selectedLotSize);
    const finalPnl =
      selectedLotSize === 0.10 && typeof s.realized_pnl_usd === 'number'
        ? s.realized_pnl_usd
        : calcPnl;

    const isWin = isTp2 || isTp1 || finalPnl > 0;
    const r = isTp2 ? 2.0 : isTp1 ? 1.0 : -1.0;
    netR += r;
    if (isWin) totalWins++;
    totalDollarGain += finalPnl;
  });

  const winRate = totalTrades > 0 ? Number(((totalWins / totalTrades) * 100).toFixed(1)) : 0;
  const netRDisplay = Number(netR.toFixed(1));
  const primaryTimeframe = currentStrategy.id === 'strategy4_step_scalper' ? 'M1' : 'M5';

  return (
    <div className="w-full space-y-4 mb-6">
      {/* 1. STRATEGY SWITCHER TABS - Quick switch between algorithms to compare isolated journals */}
      <div className="glass-panel p-2.5 rounded-2xl border border-slate-800/80 bg-[#091122]/95 shadow-lg">
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="uppercase tracking-wider font-mono">SELECT STRATEGY JOURNAL:</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            (Dedicated & 100% Isolated)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {AVAILABLE_STRATEGIES.map((strat) => {
            const isActive = strat.id === currentStrategy.id;
            return (
              <button
                key={strat.id}
                onClick={() => setActiveStrategyId(strat.id)}
                className={`flex flex-col items-start p-2 rounded-xl transition text-left ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-950 to-blue-950 border border-cyan-500/50 text-white shadow-md shadow-cyan-500/10'
                    : 'bg-slate-900/70 border border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[11px] font-extrabold truncate ${isActive ? 'text-cyan-300' : 'text-slate-300'}`}>
                    {strat.shortName}
                  </span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#22d3ee]" />
                  )}
                </div>
                <span className="text-[9px] text-slate-500 font-mono mt-0.5 truncate w-full">
                  {strat.timeframes.join(' → ')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. TOP 3 METRICS CARDS (Dynamic strictly for selected Strategy) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {/* Card 1: WIN RATE */}
        <div className="rounded-2xl bg-[#091122]/90 border border-emerald-500/40 p-3 sm:p-4 text-center shadow-lg transition hover:border-emerald-500/60">
          <div className="text-[10px] sm:text-xs font-bold text-emerald-400/90 tracking-wider uppercase">
            WIN RATE
          </div>
          <div className="mt-1 text-xl sm:text-3xl font-extrabold text-emerald-400 font-mono-numbers">
            {winRate}%
          </div>
          <div className="text-[9px] text-emerald-500/80 mt-0.5 font-mono">
            {totalWins}/{totalTrades} Wins
          </div>
        </div>

        {/* Card 2: TOTAL GAIN ($) - Accurate Step Index Calculation */}
        <div className="rounded-2xl bg-[#091122]/90 border border-cyan-500/40 p-3 sm:p-4 text-center shadow-lg transition hover:border-cyan-500/60">
          <div className="text-[10px] sm:text-xs font-bold text-cyan-400/90 tracking-wider uppercase">
            TOTAL GAIN
          </div>
          <div
            className={`mt-1 text-xl sm:text-3xl font-extrabold font-mono-numbers ${
              totalDollarGain >= 0 ? 'text-cyan-400' : 'text-rose-400'
            }`}
          >
            {totalDollarGain >= 0 ? `+$${totalDollarGain.toFixed(2)}` : `-$${Math.abs(totalDollarGain).toFixed(2)}`}
          </div>
          <div className="text-[9px] text-cyan-500/80 mt-0.5 font-mono">
            @ {selectedLotSize.toFixed(2)} Lot
          </div>
        </div>

        {/* Card 3: NET R:R */}
        <div className="rounded-2xl bg-[#091122]/90 border border-purple-500/40 p-3 sm:p-4 text-center shadow-lg transition hover:border-purple-500/60">
          <div className="text-[10px] sm:text-xs font-bold text-purple-400/90 tracking-wider uppercase">
            NET R:R
          </div>
          <div
            className={`mt-1 text-xl sm:text-3xl font-extrabold font-mono-numbers ${
              netRDisplay >= 0 ? 'text-purple-400' : 'text-rose-400'
            }`}
          >
            {netRDisplay >= 0 ? `+${netRDisplay.toFixed(1)}R` : `${netRDisplay.toFixed(1)}R`}
          </div>
          <div className="text-[9px] text-purple-400/80 mt-0.5 font-mono">
            Risk-Reward Return
          </div>
        </div>
      </div>

      {/* 3. DEDICATED STRATEGY BANNER & LOT SIZE SELECTOR */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          {/* Active Strategy Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold font-mono text-xs shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Dedicated: {currentStrategy.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Step Index Lot Size Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800 text-[11px]">
            <span className="text-slate-400">Lot:</span>
            <select
              value={selectedLotSize}
              onChange={(e) => setSelectedLotSize(Number(e.target.value))}
              className="bg-transparent text-cyan-400 font-bold font-mono focus:outline-none cursor-pointer"
            >
              <option value="0.10" className="bg-slate-900 text-white">0.10 Lot (Std: 1 pt = $1)</option>
              <option value="0.01" className="bg-slate-900 text-white">0.01 Lot (1 pt = $0.10)</option>
              <option value="0.02" className="bg-slate-900 text-white">0.02 Lot (1 pt = $0.20)</option>
              <option value="0.05" className="bg-slate-900 text-white">0.05 Lot (1 pt = $0.50)</option>
              <option value="0.20" className="bg-slate-900 text-white">0.20 Lot (1 pt = $2.00)</option>
              <option value="0.50" className="bg-slate-900 text-white">0.50 Lot (1 pt = $5.00)</option>
              <option value="1.00" className="bg-slate-900 text-white">1.00 Lot (1 pt = $10.00)</option>
            </select>
          </div>

          <span className="text-slate-600">|</span>

          <div className="text-[11px] font-semibold text-slate-300">
            Trades: <strong className="text-white font-mono">{totalTrades}</strong>
          </div>

          {onClearHistory && (
            <button
              onClick={onClearHistory}
              title="Clear Journal History"
              className="p-1 rounded-md text-slate-500 hover:text-rose-400 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. ENLARGED & PROMINENT PERIOD FILTER BAR (NO TF IN JOURNAL) */}
      <div className="glass-panel p-3 sm:p-4 rounded-2xl border border-slate-800/90 bg-[#091122]/95 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-black text-white tracking-wider uppercase font-mono">
                PERIOD
              </span>
              <span className="text-[11px] text-slate-400 ml-2 hidden md:inline">
                ({currentStrategy.shortName} Performance Window)
              </span>
            </div>
          </div>

          {/* Large, High-Contrast Period Selection Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
            {(['D', '3D', '7D', '1M', '3M', '6M', '1Y', 'ALL'] as PeriodFilter[]).map((period) => {
              const isSelected = selectedPeriod === period;
              return (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-mono text-xs sm:text-sm font-extrabold transition-all duration-200 shrink-0 ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-300 scale-105 font-black'
                      : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  {period}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. REAL TRADE CARDS LIST FOR ACTIVE STRATEGY */}
      {recordedTrades.length === 0 ? (
        <div className="rounded-2xl bg-[#091122]/60 border border-slate-800/80 p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-slate-800/80 text-cyan-400 mx-auto flex items-center justify-center">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Awaiting Live Signals for {currentStrategy.shortName}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
              Journal នេះផ្តាច់មុខសម្រាប់តែ <strong>{currentStrategy.name}</strong> ប៉ុណ្ណោះ។ រាល់ពេល market ដើរដល់ TP1, TP2 ឬ SL វានឹងកត់ត្រាចូល Journal នេះភ្លាមៗដោយស្វ័យប្រវត្តិ។
            </p>
          </div>
          <div className="pt-2 text-[11px] text-slate-500 font-mono">
            Deriv Step Index Rule: 1.00 pt @ 0.10 Lot = $1.00 USD • Retained for 365 Days
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {recordedTrades.map((sig) => (
            <TradeCard
              key={sig.signal_id}
              signal={sig}
              selectedLotSize={selectedLotSize}
              strategyTimeframe={primaryTimeframe}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Journal;
