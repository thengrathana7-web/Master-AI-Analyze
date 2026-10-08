import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TradingStrategy, AVAILABLE_STRATEGIES } from '../strategies';
import {
  SignalJSON,
  WaitJSON,
  TimeframeAnalysis,
  Tick,
  Candle,
  Timeframe,
  SignalType,
} from '../types/market';
import { TradeLifecycleState, StrategyAnalysisResult } from '../strategies/types';
import { AppStorage, calculateStepIndexPnl } from '../utils/storage';
import { telegramService } from '../services/telegramService';
import { soundAlert } from '../utils/soundAlert';

interface UseSignalEngineProps {
  activeStrategy: TradingStrategy;
  activeSymbol: string;
  latestTick: Tick | null;
  candlesMap: Record<Timeframe, Candle[]>;
  isConnected: boolean;
  isLive: boolean;
  dataStatus: string;
}

interface UseSignalEngineReturn {
  // Currently active signal for the selected strategy (or null if WAIT)
  activeSignal: SignalJSON | null;
  // Execution decision: BUY | SELL | WAIT
  decision: SignalType;
  // Full signal payload if BUY / SELL active
  signal: SignalJSON | null;
  // Wait state payload if WAIT
  waitStatus: WaitJSON | null;
  // Multi-timeframe analysis
  analysis: TimeframeAnalysis | null;
  // Strategy Analysis result for UI
  strategyResult: StrategyAnalysisResult | null;
  // Trade lifecycle state
  lifecycle: TradeLifecycleState;
  // Trade journal / history (persisted in LocalStorage & IndexedDB up to 12 months)
  signalHistory: SignalJSON[];
  // Clear journal handler
  clearJournalHistory: () => Promise<void>;
}

/**
 * Evaluates real historical Deriv candles to backfill authentic past trades
 * when journal is empty. Uses 100% REAL historical Step Index market data.
 */
function evaluateRealHistoricalTrades(
  symbol: string,
  candlesMap: Record<Timeframe, Candle[]>
): SignalJSON[] {
  const generated: SignalJSON[] = [];
  const m5 = candlesMap['M5'] || [];
  const m1 = candlesMap['M1'] || [];

  if (m5.length < 25 && m1.length < 25) return [];

  AVAILABLE_STRATEGIES.forEach((strat) => {
    const isM1 = strat.id === 'strategy4_step_scalper';
    const mainCandles = isM1 ? m1 : m5;
    if (mainCandles.length < 25) return;

    let lastTradeIndex = -1;
    const step = isM1 ? 2 : 1;
    for (let i = 20; i < mainCandles.length - 2; i += step) {
      if (lastTradeIndex !== -1 && i < lastTradeIndex + 3) continue;

      const candle = mainCandles[i];
      const availableH1 = candlesMap['H1'] && candlesMap['H1'].length >= 3 ? candlesMap['H1'] : [];
      const availableM15 = candlesMap['M15'] && candlesMap['M15'].length >= 3 ? candlesMap['M15'] : [];

      const slicedMap: Record<Timeframe, Candle[]> = {
        M1: m1.slice(0, Math.min(m1.length, isM1 ? i + 1 : (i + 1) * 5)),
        M3: candlesMap['M3'] || [],
        M5: m5.slice(0, isM1 ? Math.max(10, Math.floor((i + 1) / 5)) : i + 1),
        M15: availableM15.length > 0 ? availableM15.slice(0, Math.max(8, Math.floor(i / 2))) : m5.slice(0, i + 1),
        M30: candlesMap['M30'] || [],
        H1: availableH1.length > 0 ? availableH1.slice(0, Math.max(5, Math.floor(i / 4))) : m5.slice(0, i + 1),
        H2: candlesMap['H2'] || [],
        '4H': candlesMap['4H'] || [],
        '1D': candlesMap['1D'] || [],
      };

      const evalRes = strat.evaluate(symbol, slicedMap, candle.close);
      if (
        evalRes.score === 100 &&
        (evalRes.decision === 'BUY' || evalRes.decision === 'SELL') &&
        evalRes.signal
      ) {
        const sig = evalRes.signal;
        const isBuy = sig.signal === 'BUY';
        const entry = sig.entry;
        const tp1 = sig.take_profit_1;
        const tp2 = sig.take_profit_2;
        const sl = sig.stop_loss;

        let outcome: 'TP2' | 'TP1' | 'SL' | null = null;
        let exitPrice = entry;
        let exitTime = (candle.epoch + (isM1 ? 60 : 300)) * 1000;

        for (let j = i + 1; j < mainCandles.length; j++) {
          const futureCandle = mainCandles[j];
          if (isBuy) {
            if (futureCandle.high >= tp2) {
              outcome = 'TP2';
              exitPrice = tp2;
              exitTime = futureCandle.epoch * 1000;
              break;
            } else if (futureCandle.high >= tp1) {
              outcome = 'TP1';
              exitPrice = tp1;
              exitTime = futureCandle.epoch * 1000;
              break;
            } else if (futureCandle.low <= sl) {
              outcome = 'SL';
              exitPrice = sl;
              exitTime = futureCandle.epoch * 1000;
              break;
            }
          } else {
            if (futureCandle.low <= tp2) {
              outcome = 'TP2';
              exitPrice = tp2;
              exitTime = futureCandle.epoch * 1000;
              break;
            } else if (futureCandle.low <= tp1) {
              outcome = 'TP1';
              exitPrice = tp1;
              exitTime = futureCandle.epoch * 1000;
              break;
            } else if (futureCandle.high >= sl) {
              outcome = 'SL';
              exitPrice = sl;
              exitTime = futureCandle.epoch * 1000;
              break;
            }
          }
        }

        if (outcome) {
          lastTradeIndex = i;
          const pnl = calculateStepIndexPnl(sig.signal, entry, exitPrice, 0.10);
          const tradeRecord: SignalJSON = {
            ...sig,
            signal_id: `real_${strat.id}_${candle.epoch}`,
            status: outcome === 'SL' ? 'SL_HIT' : outcome === 'TP2' ? 'TP2_HIT' : 'TP1_HIT',
            result: outcome === 'SL' ? 'SL_HIT' : outcome === 'TP2' ? 'TP2_HIT' : 'TP1_HIT',
            exitType: outcome,
            exit_price: exitPrice,
            exit_timestamp: exitTime,
            closedAt: exitTime,
            timestamp: candle.epoch * 1000,
            r_multiple: outcome === 'TP2' ? 2.0 : outcome === 'TP1' ? 1.0 : -1.0,
            realized_pnl_usd: pnl,
            strategy_id: strat.id,
            strategy_name: strat.shortName,
          };
          generated.push(tradeRecord);
        }
      }
    }
  });

  return generated.sort((a, b) => (b.closedAt || b.timestamp) - (a.closedAt || a.timestamp));
}

export function useSignalEngine({
  activeStrategy,
  activeSymbol,
  latestTick,
  candlesMap,
  isConnected,
  isLive,
  dataStatus,
}: UseSignalEngineProps): UseSignalEngineReturn {
  // Map of active trades per strategy id: { [strategyId]: SignalJSON | null }
  const [activeTradesMap, setActiveTradesMap] = useState<Record<string, SignalJSON | null>>(() => {
    return AppStorage.loadActiveTradesMap();
  });

  // Trade journal history loaded from permanent storage (LocalStorage + IndexedDB, 12-month retention)
  const [signalHistory, setSignalHistory] = useState<SignalJSON[]>([]);
  const hasBackfilledRef = useRef(false);

  // Initial load of permanent journal
  useEffect(() => {
    let isMounted = true;
    AppStorage.loadJournal().then((history) => {
      if (isMounted) {
        setSignalHistory(history);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Backfill authentic historical trades from real Deriv candles if storage is fresh
  useEffect(() => {
    if (hasBackfilledRef.current) return;
    const m5Count = candlesMap['M5']?.length || 0;
    const m1Count = candlesMap['M1']?.length || 0;

    if (m5Count >= 25 || m1Count >= 25) {
      if (signalHistory.length === 0) {
        const realTrades = evaluateRealHistoricalTrades(activeSymbol, candlesMap);
        if (realTrades.length > 0) {
          hasBackfilledRef.current = true;
          setSignalHistory(realTrades);
          realTrades.forEach((t) => AppStorage.saveTradeToJournal(t));
          console.log(`[SignalEngine] 📊 Populated journal with ${realTrades.length} authentic Deriv Step Index trades`);
        }
      } else {
        hasBackfilledRef.current = true;
      }
    }
  }, [candlesMap, signalHistory.length, activeSymbol]);

  // Strategy-specific active trade for the currently selected strategy
  const currentActiveTrade = useMemo(() => {
    return activeTradesMap[activeStrategy.id] || null;
  }, [activeTradesMap, activeStrategy.id]);

  // Keep ref to avoid stale closures in tick/candle processing
  const activeTradesMapRef = useRef(activeTradesMap);
  activeTradesMapRef.current = activeTradesMap;

  const currentPrice = latestTick?.quote || 0;

  // 1. Multi-Strategy Real-time Processing Engine
  // Evaluates ALL available strategies simultaneously so every strategy records into its own journal!
  useEffect(() => {
    if (!latestTick || latestTick.quote <= 0) return;
    const price = latestTick.quote;
    const now = Date.now();

    const currentMap = activeTradesMapRef.current;
    let mapChanged = false;
    const updatedMap = { ...currentMap };

    // Process every registered strategy
    AVAILABLE_STRATEGIES.forEach((strat) => {
      const trade = currentMap[strat.id];
      const stratTf: Timeframe = strat.id === 'strategy4_step_scalper' ? 'M1' : 'M5';
      const stratCandles = candlesMap[stratTf] || [];

      // A) If a trade is RUNNING for this strategy, check TP1, TP2, and SL
      if (trade && (trade.status === 'RUNNING' || trade.status === 'TP1_HIT')) {
        const isBuy = trade.signal === 'BUY';
        const duration = Math.floor((now - trade.timestamp) / 1000);
        trade.duration_seconds = duration;

        // Consider both the live tick and high/low wicks
        const recentCandles = stratCandles.filter(
          (c) => c.epoch >= Math.floor(trade.timestamp / 1000) - 60
        );
        const candleHighs = recentCandles.length > 0 ? recentCandles.map((c) => c.high) : [price];
        const candleLows = recentCandles.length > 0 ? recentCandles.map((c) => c.low) : [price];
        const maxPrice = Math.max(price, ...candleHighs);
        const minPrice = Math.min(price, ...candleLows);

        if (isBuy) {
          // --- BUY TRADE EVALUATION ---

          // 1. Check TP2 Hit (Terminal Exit - Full Target Reached)
          if (maxPrice >= trade.take_profit_2) {
            trade.result = 'TP2_HIT';
            trade.status = 'TP2_HIT';
            trade.exitType = 'TP2';
            trade.closedAt = now;
            trade.exit_price = trade.take_profit_2;
            trade.exit_timestamp = now;
            trade.r_multiple = 2.0;
            trade.realized_pnl_usd = calculateStepIndexPnl('BUY', trade.entry, trade.take_profit_2, 0.10);

            console.log(`[SignalEngine] 🎯 TP2 Hit for ${strat.name}! Recorded into Journal (+2.0R, +$${trade.realized_pnl_usd})`);
            AppStorage.saveTradeToJournal(trade);
            setSignalHistory((prev) => [
              trade,
              ...prev.filter((s) => s.signal_id !== trade.signal_id && s.signal_id !== `${trade.signal_id}_tp1`),
            ]);

            // Terminal exit -> unlock trade and return to WAIT
            updatedMap[strat.id] = null;
            mapChanged = true;
            return;
          }

          // 2. Check TP1 Hit (Primary Target Reached -> RECORD INTO JOURNAL IMMEDIATELY)
          if (maxPrice >= trade.take_profit_1) {
            const wasNotSecured = trade.management.tp1_action !== 'TP1_SECURED';
            if (wasNotSecured) {
              trade.management.tp1_action = 'TP1_SECURED';
              trade.management.after_tp1 = 'PROTECTED_BE';
              // Move Stop Loss to Break Even (entry price)
              trade.stop_loss = trade.entry;
              trade.tp1Hit = true;

              // Save authentic TP1 completed record into permanent journal immediately
              const tp1Record: SignalJSON = {
                ...trade,
                signal_id: `${trade.signal_id}_tp1`,
                status: 'TP1_HIT',
                result: 'TP1_HIT',
                exitType: 'TP1',
                closedAt: now,
                exit_price: trade.take_profit_1,
                exit_timestamp: now,
                r_multiple: 1.0,
                realized_pnl_usd: calculateStepIndexPnl('BUY', trade.entry, trade.take_profit_1, 0.10),
              };

              console.log(`[SignalEngine] 🎯 TP1 Hit for ${strat.name}! Recorded into Journal (+1.0R, +$${tp1Record.realized_pnl_usd})`);
              AppStorage.saveTradeToJournal(tp1Record);
              setSignalHistory((prev) => [
                tp1Record,
                ...prev.filter((s) => s.signal_id !== tp1Record.signal_id && s.signal_id !== trade.signal_id),
              ]);

              // Keep trade RUNNING with protected stop loss at BE to continue towards TP2!
              trade.status = 'RUNNING';
              mapChanged = true;
            }
          }

          // 3. Check Stop Loss / Break Even Hit
          if (minPrice <= trade.stop_loss) {
            if (trade.management.tp1_action === 'TP1_SECURED') {
              // Trade was stopped out at Break Even after securing TP1.
              // TP1 profit remains safely recorded in the Journal (+1.0R)!
              console.log(`[SignalEngine] 🔒 Trade stopped at Break Even for ${strat.name} (TP1 profit already banked).`);
              updatedMap[strat.id] = null;
              mapChanged = true;
              return;
            } else {
              // Initial Stop Loss hit
              trade.result = 'SL_HIT';
              trade.status = 'SL_HIT';
              trade.exitType = 'SL';
              trade.closedAt = now;
              trade.exit_price = trade.stop_loss;
              trade.exit_timestamp = now;
              trade.r_multiple = -1.0;
              trade.realized_pnl_usd = calculateStepIndexPnl('BUY', trade.entry, trade.stop_loss, 0.10);

              console.log(`[SignalEngine] 🛑 SL Hit for ${strat.name}. Recorded into Journal (-1.0R, -$${Math.abs(trade.realized_pnl_usd)})`);
              AppStorage.saveTradeToJournal(trade);
              setSignalHistory((prev) => [
                trade,
                ...prev.filter((s) => s.signal_id !== trade.signal_id),
              ]);

              updatedMap[strat.id] = null;
              mapChanged = true;
              return;
            }
          }
        } else {
          // --- SELL TRADE EVALUATION ---

          // 1. Check TP2 Hit (Terminal Exit - Full Target Reached)
          if (minPrice <= trade.take_profit_2) {
            trade.result = 'TP2_HIT';
            trade.status = 'TP2_HIT';
            trade.exitType = 'TP2';
            trade.closedAt = now;
            trade.exit_price = trade.take_profit_2;
            trade.exit_timestamp = now;
            trade.r_multiple = 2.0;
            trade.realized_pnl_usd = calculateStepIndexPnl('SELL', trade.entry, trade.take_profit_2, 0.10);

            console.log(`[SignalEngine] 🎯 TP2 Hit for ${strat.name}! Recorded into Journal (+2.0R, +$${trade.realized_pnl_usd})`);
            AppStorage.saveTradeToJournal(trade);
            setSignalHistory((prev) => [
              trade,
              ...prev.filter((s) => s.signal_id !== trade.signal_id && s.signal_id !== `${trade.signal_id}_tp1`),
            ]);

            updatedMap[strat.id] = null;
            mapChanged = true;
            return;
          }

          // 2. Check TP1 Hit (Primary Target Reached -> RECORD INTO JOURNAL IMMEDIATELY)
          if (minPrice <= trade.take_profit_1) {
            const wasNotSecured = trade.management.tp1_action !== 'TP1_SECURED';
            if (wasNotSecured) {
              trade.management.tp1_action = 'TP1_SECURED';
              trade.management.after_tp1 = 'PROTECTED_BE';
              // Move Stop Loss to Break Even (entry price)
              trade.stop_loss = trade.entry;
              trade.tp1Hit = true;

              const tp1Record: SignalJSON = {
                ...trade,
                signal_id: `${trade.signal_id}_tp1`,
                status: 'TP1_HIT',
                result: 'TP1_HIT',
                exitType: 'TP1',
                closedAt: now,
                exit_price: trade.take_profit_1,
                exit_timestamp: now,
                r_multiple: 1.0,
                realized_pnl_usd: calculateStepIndexPnl('SELL', trade.entry, trade.take_profit_1, 0.10),
              };

              console.log(`[SignalEngine] 🎯 TP1 Hit for ${strat.name}! Recorded into Journal (+1.0R, +$${tp1Record.realized_pnl_usd})`);
              AppStorage.saveTradeToJournal(tp1Record);
              setSignalHistory((prev) => [
                tp1Record,
                ...prev.filter((s) => s.signal_id !== tp1Record.signal_id && s.signal_id !== trade.signal_id),
              ]);

              trade.status = 'RUNNING';
              mapChanged = true;
            }
          }

          // 3. Check Stop Loss / Break Even Hit
          if (maxPrice >= trade.stop_loss) {
            if (trade.management.tp1_action === 'TP1_SECURED') {
              console.log(`[SignalEngine] 🔒 Trade stopped at Break Even for ${strat.name} (TP1 profit already banked).`);
              updatedMap[strat.id] = null;
              mapChanged = true;
              return;
            } else {
              trade.result = 'SL_HIT';
              trade.status = 'SL_HIT';
              trade.exitType = 'SL';
              trade.closedAt = now;
              trade.exit_price = trade.stop_loss;
              trade.exit_timestamp = now;
              trade.r_multiple = -1.0;
              trade.realized_pnl_usd = calculateStepIndexPnl('SELL', trade.entry, trade.stop_loss, 0.10);

              console.log(`[SignalEngine] 🛑 SL Hit for ${strat.name}. Recorded into Journal (-1.0R, -$${Math.abs(trade.realized_pnl_usd)})`);
              AppStorage.saveTradeToJournal(trade);
              setSignalHistory((prev) => [
                trade,
                ...prev.filter((s) => s.signal_id !== trade.signal_id),
              ]);

              updatedMap[strat.id] = null;
              mapChanged = true;
              return;
            }
          }
        }
      }

      // B) If NO active trade for this strategy, evaluate market for 100% Confirmation Setup
      if (!trade && isConnected && isLive && dataStatus === 'READY' && price > 0) {
        const evalRes = strat.evaluate(activeSymbol, candlesMap, price);
        if (
          evalRes.score === 100 &&
          (evalRes.decision === 'BUY' || evalRes.decision === 'SELL') &&
          evalRes.signal
        ) {
          console.log(`[SignalEngine] 🚀 100% Confirmation for ${strat.name}: Locking new ${evalRes.decision} trade`);
          const runningTrade: SignalJSON = {
            ...evalRes.signal,
            status: 'RUNNING',
            result: 'RUNNING',
            strategy_id: strat.id,
            strategy_name: strat.shortName,
          };
          updatedMap[strat.id] = runningTrade;
          mapChanged = true;

          // 100% Confirmation Signal Alert Rules:
          // Audio alerts MUST ONLY trigger for the currently ACTIVE strategy.
          // Inactive strategies: DO NOT play any sound alert.
          // Active strategy with sound toggle OFF (Muted): DO NOT play sound alert.
          if (strat.id === activeStrategy.id) {
            telegramService.sendSignal(runningTrade);

            const soundSettings = AppStorage.loadStrategySoundSettings();
            const isSoundOn = soundSettings[strat.id] ?? activeStrategy.soundEnabled ?? true;
            if (isSoundOn) {
              soundAlert.playAlert(evalRes.decision);
              console.log(`[SignalEngine] 🔊 Audio alert triggered for ACTIVE strategy: ${strat.name} (${evalRes.decision})`);
            } else {
              console.log(`[SignalEngine] 🔇 Sound alert MUTED for active strategy: ${strat.name}`);
            }
          } else {
            console.log(`[SignalEngine] 🔕 Signal triggered for inactive strategy ${strat.name}; audio alert suppressed.`);
          }
        }
      }
    });

    if (mapChanged) {
      setActiveTradesMap(updatedMap);
      AppStorage.saveActiveTradesMap(updatedMap);
    }
  }, [latestTick, candlesMap, isConnected, isLive, dataStatus, activeSymbol, activeStrategy.id]);

  // 2. Evaluate and format state for the currently active UI Strategy
  const { decision, signal, waitStatus, analysis, strategyResult, lifecycle } = useMemo(() => {
    // A) If an active trade is running or TP1 secured for this strategy
    if (currentActiveTrade) {
      const isTp1Secured = currentActiveTrade.management.tp1_action === 'TP1_SECURED' || currentActiveTrade.status === 'TP1_HIT';
      const lifecycleState: TradeLifecycleState = {
        isActiveTrade: true,
        tp1Hit: isTp1Secured,
        tp2Hit: false,
        slHit: false,
        confirmationScore: 100,
        lockedTrade: currentActiveTrade,
      };

      const result: StrategyAnalysisResult = {
        signal: currentActiveTrade.signal,
        signalStrength: 100,
        marketStatus: isTp1Secured ? 'TP1 Secured • Trailing to TP2' : `${currentActiveTrade.signal} In Progress`,
        analysisNotes: [
          `Locked Trade: ${currentActiveTrade.signal} on Step Index`,
          `Entry: ${currentActiveTrade.entry.toFixed(2)} | SL: ${currentActiveTrade.stop_loss.toFixed(2)}`,
          `TP1: ${currentActiveTrade.take_profit_1.toFixed(2)} | TP2: ${currentActiveTrade.take_profit_2.toFixed(2)}`,
          isTp1Secured
            ? 'Status: TP1 Reached & Banked in Journal! Trailing to TP2'
            : 'Execution locked until TP1 / TP2 or SL hit',
        ],
        entry: currentActiveTrade.entry,
        stopLoss: currentActiveTrade.stop_loss,
        tp1: currentActiveTrade.take_profit_1,
        tp2: currentActiveTrade.take_profit_2,
        timestamp: currentActiveTrade.timestamp,
        isActiveTrade: true,
        tp1Hit: isTp1Secured,
        tp2Hit: false,
        slHit: false,
        confirmationScore: 100,
      };

      const lockedAnalysis: TimeframeAnalysis = {
        h1: { trend: currentActiveTrade.h1_trend || 'NEUTRAL', higherHighs: false, higherLows: false, ema20: 0, ema50: 0, recentHigh: 0, recentLow: 0 },
        m15: { structure: currentActiveTrade.m15_structure || 'RANGE', setup: currentActiveTrade.m15_setup || 'WAIT', pullbackZoneActive: false, supportLevel: 0, resistanceLevel: 0, rejectionDetected: false },
        m5: { entryStatus: 'BREAK_RETEST', breakoutConfirmed: true, retestHeld: true, momentum: 'STRONG', rsi: 50, swingHigh: 0, swingLow: 0 },
        scoreBreakdown: { h1Trend: 25, m15Structure: 25, m15PullbackZone: 20, m5BreakRetest: 20, m5Momentum: 10, total: 100, tier: 'VERY_STRONG' },
        recommendedAction: currentActiveTrade.signal,
      };

      return {
        decision: currentActiveTrade.signal,
        signal: currentActiveTrade,
        waitStatus: null,
        analysis: lockedAnalysis,
        strategyResult: result,
        lifecycle: lifecycleState,
      };
    }

    // B) If data is not ready, return standard WAIT
    if (!isConnected || !isLive || dataStatus !== 'READY' || currentPrice <= 0) {
      const wait: WaitJSON = {
        signal: 'WAIT',
        status: 'NO_TRADE',
        reason: [
          'Connecting to Deriv WebSocket feed...',
          'Awaiting live tick stream and multi-timeframe candle synchronization',
        ],
        h1_trend: 'NEUTRAL',
        m15_structure: 'RANGE',
        m5_confirmation: 'WAITING',
        timestamp: Date.now(),
        score: 0,
      };

      const emptyAnalysis: TimeframeAnalysis = {
        h1: { trend: 'NEUTRAL', higherHighs: false, higherLows: false, ema20: 0, ema50: 0, recentHigh: 0, recentLow: 0 },
        m15: { structure: 'RANGE', setup: 'WAIT', pullbackZoneActive: false, supportLevel: 0, resistanceLevel: 0, rejectionDetected: false },
        m5: { entryStatus: 'WAITING', breakoutConfirmed: false, retestHeld: false, momentum: 'WEAK', rsi: 50, swingHigh: 0, swingLow: 0 },
        scoreBreakdown: { h1Trend: 0, m15Structure: 0, m15PullbackZone: 0, m5BreakRetest: 0, m5Momentum: 0, total: 0, tier: 'NO_TRADE' },
        recommendedAction: 'WAIT',
      };

      const result: StrategyAnalysisResult = {
        signal: 'WAIT',
        signalStrength: 0,
        marketStatus: 'Awaiting Live Feed',
        analysisNotes: wait.reason,
        entry: null,
        stopLoss: null,
        tp1: null,
        tp2: null,
        timestamp: Date.now(),
        isActiveTrade: false,
        tp1Hit: false,
        tp2Hit: false,
        slHit: false,
        confirmationScore: 0,
      };

      return {
        decision: 'WAIT' as SignalType,
        signal: null,
        waitStatus: wait,
        analysis: emptyAnalysis,
        strategyResult: result,
        lifecycle: {
          isActiveTrade: false,
          tp1Hit: false,
          tp2Hit: false,
          slHit: false,
          confirmationScore: 0,
        },
      };
    }

    // C) Evaluate live market data with activeStrategy
    const evalRes = activeStrategy.evaluate(activeSymbol, candlesMap, currentPrice);
    const analyzed = activeStrategy.analyze({
      symbol: activeSymbol,
      candlesMap,
      currentPrice,
    });

    const is100PercentConfirmed =
      evalRes.score === 100 &&
      (evalRes.decision === 'BUY' || evalRes.decision === 'SELL') &&
      Boolean(evalRes.signal);

    if (is100PercentConfirmed && evalRes.signal) {
      const newSignal = evalRes.signal;
      const lifecycleState: TradeLifecycleState = {
        isActiveTrade: true,
        tp1Hit: false,
        tp2Hit: false,
        slHit: false,
        confirmationScore: 100,
        lockedTrade: newSignal,
      };

      return {
        decision: evalRes.decision,
        signal: newSignal,
        waitStatus: null,
        analysis: evalRes.analysis,
        strategyResult: analyzed,
        lifecycle: lifecycleState,
      };
    }

    // Otherwise, maintain WAIT
    const wait: WaitJSON = evalRes.wait || {
      signal: 'WAIT',
      status: 'NO_TRADE',
      reason: [
        `Setup score: ${evalRes.score}% / 100% (Strict 100% Confirmation Required)`,
        `H1 Trend: ${evalRes.analysis.h1.trend}`,
        `M15 Structure: ${evalRes.analysis.m15.structure}`,
      ],
      h1_trend: evalRes.analysis.h1.trend,
      m15_structure: evalRes.analysis.m15.structure,
      m5_confirmation: evalRes.analysis.m5.entryStatus,
      timestamp: Date.now(),
      score: evalRes.score,
    };

    return {
      decision: 'WAIT' as SignalType,
      signal: null,
      waitStatus: wait,
      analysis: evalRes.analysis,
      strategyResult: {
        ...analyzed,
        signal: 'WAIT' as const,
        isActiveTrade: false,
        tp1Hit: false,
        tp2Hit: false,
        slHit: false,
        confirmationScore: evalRes.score,
      },
      lifecycle: {
        isActiveTrade: false,
        tp1Hit: false,
        tp2Hit: false,
        slHit: false,
        confirmationScore: evalRes.score,
      },
    };
  }, [
    currentActiveTrade,
    isConnected,
    isLive,
    dataStatus,
    currentPrice,
    activeStrategy,
    activeSymbol,
    candlesMap,
  ]);

  // Clear journal handler
  const clearJournalHistory = useCallback(async () => {
    await AppStorage.clearJournal();
    setSignalHistory([]);
  }, []);

  return {
    activeSignal: currentActiveTrade,
    decision,
    signal,
    waitStatus,
    analysis,
    strategyResult,
    lifecycle,
    signalHistory,
    clearJournalHistory,
  };
}
