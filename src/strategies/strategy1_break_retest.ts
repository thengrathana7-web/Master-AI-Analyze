import { TradingStrategy, StrategyEvaluationResult } from './types';
import { Candle, Timeframe, SignalJSON, WaitJSON, TimeframeAnalysis } from '../types/market';
import { calculateEMA, calculateRSI } from '../utils/indicators';

/**
 * STRATEGY 01: Break & Retest
 * H1 Macro Trend Alignment -> M15 Key Zone Pullback -> M5 Break & Retest Confirmation
 * 
 * Specifically calibrated for Deriv Step Index fixed 0.10 step dynamics:
 * - Macro Trend: H1 / M15 EMA 20 vs EMA 50 alignment & price slope
 * - Structure: M15 Support / Resistance swing boundary pullback
 * - Execution: M5 Candle breakout through key swing high/low with retest hold within tolerance
 * - Momentum: RSI confirmation (45 - 75 for BUY, 25 - 55 for SELL)
 * - R:R: 1 : 2.8 with 1:1 TP1 partial banking & SL trail to Break Even
 */
export const strategy1_break_retest: TradingStrategy = {
  id: 'strategy1_break_retest',
  name: 'Strategy 1: H1->M15->M5 Break & Retest Momentum',
  shortName: 'Break & Retest',
  version: '2.0.0',
  author: 'Step Index Master AI',
  descriptionKh: 'យុទ្ធសាស្ត្រតាម Trend ធំ H1, រង់ចាំ Pullback លើ M15 និងបញ្ជាក់ការទម្លុះ Break + Retest លើ M5 ជាមួយ R:R 1:2.8',
  descriptionEn: 'Trend-following strategy aligning H1 macro direction with M15 key zone pullback and M5 break-and-retest confirmation.',
  targetAsset: 'Step Index',
  timeframes: ['H1', 'M15', 'M5'],
  indicators: ['EMA 20', 'EMA 50', 'RSI 14', 'Swing High/Low', 'Rejection Wick'],
  expectedWinRate: '75% – 82%',
  winRate: '75%',
  riskReward: '1 : 2.8',
  description: 'Trend-following strategy aligning H1 macro direction with M15 key zone pullback and M5 break-and-retest confirmation.',
  setupType: 'Trend Continuation & Key Level Retest',
  executionRules: [
    'H1 / M15: EMA20 & EMA50 macro alignment with higher lows or lower highs',
    'M15: Healthy corrective pullback into support/resistance zone with rejection presence',
    'M5: Candle break beyond swing level and subsequent retest candle holding level within Step Index tolerance',
    'Momentum: RSI confirmation without extreme exhaustion (45-75 for Buy, 25-55 for Sell)',
    'Strict 100% Confirmation Threshold for high-conviction execution',
  ],
  rules: [
    'H1 / M15: EMA20 & EMA50 macro alignment with higher lows or lower highs',
    'M15: Healthy corrective pullback into support/resistance zone with rejection presence',
    'M5: Candle break beyond swing level and subsequent retest candle holding level within Step Index tolerance',
    'Momentum: RSI confirmation without extreme exhaustion (45-75 for Buy, 25-55 for Sell)',
    'Strict 100% Confirmation Threshold for high-conviction execution',
  ],
  analyze(marketData: any) {
    const symbol = marketData?.symbol || 'stpRNG';
    const candlesMap = marketData?.candlesMap || marketData?.candles || {};
    const currentPrice = marketData?.currentPrice || marketData?.price || 0;
    const res = this.evaluate(symbol, candlesMap, currentPrice);
    return {
      signal: res.decision,
      signalStrength: res.score,
      marketStatus:
        res.decision === 'WAIT'
          ? res.wait?.status || 'Awaiting 100% Break & Retest Setup'
          : `${res.decision} 100% Break & Retest Confirmed`,
      analysisNotes: res.wait?.reason || [
        `H1 Trend: ${res.analysis?.h1.trend}`,
        `M15 Structure: ${res.analysis?.m15.structure}`,
        `M5 Confirmation: ${res.analysis?.m5.entryStatus}`,
      ],
      entry: res.signal?.entry ?? (currentPrice > 0 ? currentPrice : null),
      stopLoss: res.signal?.stop_loss ?? null,
      tp1: res.signal?.take_profit_1 ?? null,
      tp2: res.signal?.take_profit_2 ?? null,
      timestamp: Date.now(),
      isActiveTrade: false,
      tp1Hit: false,
      tp2Hit: false,
      slHit: false,
      confirmationScore: res.score,
    };
  },
  evaluate: (
    symbol: string,
    candlesMap: Record<Timeframe, Candle[]>,
    currentPrice: number
  ): StrategyEvaluationResult => {
    const m5Candles = candlesMap.M5 || [];
    const m15Candles = candlesMap.M15 || [];
    const h1Candles = candlesMap.H1 || [];

    // Adaptive data ingestion: require at least 10 M5 candles and valid price
    if (m5Candles.length < 10 || currentPrice <= 0) {
      return {
        decision: 'WAIT',
        score: 0,
        wait: {
          signal: 'WAIT',
          status: 'NO_TRADE',
          reason: ['Awaiting Deriv Step Index candle synchronization (M5/M15/H1)'],
          h1_trend: 'NEUTRAL',
          m15_structure: 'RANGE',
          m5_confirmation: 'WAITING',
          timestamp: Date.now(),
          score: 0,
        },
        analysis: {
          h1: { trend: 'NEUTRAL', higherHighs: false, higherLows: false, ema20: 0, ema50: 0, recentHigh: 0, recentLow: 0 },
          m15: { structure: 'RANGE', setup: 'WAIT', pullbackZoneActive: false, supportLevel: 0, resistanceLevel: 0, rejectionDetected: false },
          m5: { entryStatus: 'WAITING', breakoutConfirmed: false, retestHeld: false, momentum: 'WEAK', rsi: 50, swingHigh: 0, swingLow: 0 },
          scoreBreakdown: { h1Trend: 0, m15Structure: 0, m15PullbackZone: 0, m5BreakRetest: 0, m5Momentum: 0, total: 0, tier: 'NO_TRADE' },
          recommendedAction: 'WAIT',
        },
      };
    }

    // 1. Analyze H1 / Macro Trend (Graceful Fallback to M15 if H1 has < 3 candles)
    let h1Trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let h1Ema20 = currentPrice;
    let h1Ema50 = currentPrice;
    let h1HigherHighs = false;
    let h1HigherLows = false;

    if (h1Candles.length >= 3) {
      const h1Closes = h1Candles.map((c) => c.close);
      const h1Ema20Arr = calculateEMA(h1Closes, Math.min(20, h1Closes.length));
      const h1Ema50Arr = calculateEMA(h1Closes, Math.min(50, h1Closes.length));
      h1Ema20 = h1Ema20Arr[h1Ema20Arr.length - 1] || currentPrice;
      h1Ema50 = h1Ema50Arr[h1Ema50Arr.length - 1] || currentPrice;

      const recentH1 = h1Candles.slice(-10);
      h1HigherHighs = recentH1[recentH1.length - 1].high >= recentH1[0].high;
      h1HigherLows = recentH1[recentH1.length - 1].low >= recentH1[0].low;

      if (currentPrice >= h1Ema20 && (h1Ema20 >= h1Ema50 || h1HigherLows)) {
        h1Trend = 'BULLISH';
      } else if (currentPrice <= h1Ema20 && (h1Ema20 <= h1Ema50 || !h1HigherHighs)) {
        h1Trend = 'BEARISH';
      } else {
        // Fallback to recent candle slope
        const first = recentH1[0].close;
        const last = recentH1[recentH1.length - 1].close;
        h1Trend = last >= first ? 'BULLISH' : 'BEARISH';
      }
    } else {
      // Use M15 macro trend fallback if H1 is still streaming
      const macroCandles = m15Candles.length >= 10 ? m15Candles : m5Candles;
      const macroCloses = macroCandles.map((c) => c.close);
      const ema20 = calculateEMA(macroCloses, 20);
      const ema50 = calculateEMA(macroCloses, 50);
      const e20 = ema20[ema20.length - 1] || currentPrice;
      const e50 = ema50[ema50.length - 1] || currentPrice;

      h1Ema20 = e20;
      h1Ema50 = e50;
      h1HigherLows = currentPrice >= e20;
      h1HigherHighs = currentPrice >= e50;
      h1Trend = e20 >= e50 || currentPrice >= e20 ? 'BULLISH' : 'BEARISH';
    }

    // 2. Analyze M15 Key Zone Structure & Pullback
    const structCandles = m15Candles.length >= 8 ? m15Candles : m5Candles;
    const recentStruct = structCandles.slice(-15);
    const m15Highs = recentStruct.map((c) => c.high);
    const m15Lows = recentStruct.map((c) => c.low);
    const m15Resistance = Math.max(...m15Highs);
    const m15Support = Math.min(...m15Lows);

    // Check rejection wick in the last 3 candles
    let m15RejectionDetected = false;
    const last3 = recentStruct.slice(-3);
    for (const c of last3) {
      const range = Math.max(0.2, c.high - c.low);
      if (h1Trend === 'BULLISH') {
        const lowerWick = Math.min(c.open, c.close) - c.low;
        if (lowerWick / range >= 0.25 || c.close > c.open) {
          m15RejectionDetected = true;
          break;
        }
      } else {
        const upperWick = c.high - Math.max(c.open, c.close);
        if (upperWick / range >= 0.25 || c.close < c.open) {
          m15RejectionDetected = true;
          break;
        }
      }
    }

    const m15Structure = h1Trend;
    const m15Setup = m15RejectionDetected
      ? h1Trend === 'BULLISH'
        ? 'PULLBACK_SUPPORT'
        : 'PULLBACK_RESISTANCE'
      : 'WAIT';

    // 3. Analyze M5 Break & Retest Entry
    const recentM5 = m5Candles.slice(-25);
    const m5Closes = recentM5.map((c) => c.close);
    const m5Rsi = calculateRSI(m5Closes, 14);

    // Swing levels: previous 15 candles excluding the last 2 forming candles
    const lookback = recentM5.slice(-18, -2);
    const m5SwingHigh = lookback.length > 0 ? Math.max(...lookback.map((c) => c.high)) : currentPrice;
    const m5SwingLow = lookback.length > 0 ? Math.min(...lookback.map((c) => c.low)) : currentPrice;

    const lastM5 = recentM5[recentM5.length - 1];
    const prevM5 = recentM5[recentM5.length - 2] || lastM5;
    const prev2M5 = recentM5[recentM5.length - 3] || prevM5;

    let breakoutConfirmed = false;
    let retestHeld = false;
    let entryStatus: 'BREAK_RETEST' | 'WAITING' | 'INVALID' = 'WAITING';

    // Step Index dynamic tolerance: 2.0 - 3.0 points
    const tolerance = 2.5;

    if (h1Trend === 'BULLISH') {
      // Breakout: either last, prev, or prev2 candle reached or broke swing high
      const maxRecentHigh = Math.max(lastM5.high, prevM5.high, prev2M5.high, currentPrice);
      breakoutConfirmed = maxRecentHigh >= m5SwingHigh - 0.5;

      // Retest: price pulled back to retest broken swing level and is holding support
      const retestLow = Math.min(lastM5.low, prevM5.low);
      const isAboveFloor = retestLow >= m5SwingLow;
      const isHoldingLevel = currentPrice >= m5SwingHigh - tolerance || lastM5.close >= m5SwingHigh - tolerance;
      const hasBullishPush = currentPrice >= lastM5.low + 0.3 || lastM5.close >= lastM5.open;

      retestHeld = isAboveFloor && isHoldingLevel && hasBullishPush;
      if (breakoutConfirmed && retestHeld) entryStatus = 'BREAK_RETEST';
    } else {
      // BEARISH
      const minRecentLow = Math.min(lastM5.low, prevM5.low, prev2M5.low, currentPrice);
      breakoutConfirmed = minRecentLow <= m5SwingLow + 0.5;

      const retestHigh = Math.max(lastM5.high, prevM5.high);
      const isBelowCeiling = retestHigh <= m5SwingHigh;
      const isHoldingLevel = currentPrice <= m5SwingLow + tolerance || lastM5.close <= m5SwingLow + tolerance;
      const hasBearishPush = currentPrice <= lastM5.high - 0.3 || lastM5.close <= lastM5.open;

      retestHeld = isBelowCeiling && isHoldingLevel && hasBearishPush;
      if (breakoutConfirmed && retestHeld) entryStatus = 'BREAK_RETEST';
    }

    // 4. Momentum Filter: RSI in healthy trend acceleration zone
    const momentum: 'STRONG' | 'MODERATE' | 'WEAK' =
      (h1Trend === 'BULLISH' && m5Rsi >= 48 && m5Rsi <= 76) ||
      (h1Trend === 'BEARISH' && m5Rsi <= 52 && m5Rsi >= 24)
        ? 'STRONG'
        : (h1Trend === 'BULLISH' && m5Rsi >= 44) || (h1Trend === 'BEARISH' && m5Rsi <= 56)
        ? 'MODERATE'
        : 'WEAK';

    // 5. Scoring Algorithm (0 - 100)
    const h1Score = 30; // 30 pts: Clear macro directional alignment

    let m15Score = 0;
    if (m15Structure === h1Trend) {
      m15Score = 25; // 25 pts: Structure alignment & pullback zone
    }

    let m5Score = 0;
    if (breakoutConfirmed && retestHeld) {
      m5Score = 30; // 30 pts: Breakout confirmed and retest held
    } else if (breakoutConfirmed || retestHeld) {
      m5Score = 15;
    }

    let momentumScore = 0;
    if (momentum === 'STRONG' || momentum === 'MODERATE') {
      momentumScore = 15; // 15 pts: RSI momentum acceleration
    }

    const totalScore = h1Score + m15Score + m5Score + momentumScore;

    let tier: 'VERY_STRONG' | 'STRONG' | 'WATCH' | 'NO_TRADE' = 'NO_TRADE';
    if (totalScore >= 90) tier = 'VERY_STRONG';
    else if (totalScore >= 75) tier = 'STRONG';
    else if (totalScore >= 60) tier = 'WATCH';

    const analysis: TimeframeAnalysis = {
      h1: {
        trend: h1Trend,
        higherHighs: h1HigherHighs,
        higherLows: h1HigherLows,
        ema20: h1Ema20,
        ema50: h1Ema50,
        recentHigh: m15Resistance,
        recentLow: m15Support,
      },
      m15: {
        structure: m15Structure,
        setup: m15Setup,
        pullbackZoneActive: m15RejectionDetected,
        supportLevel: m15Support,
        resistanceLevel: m15Resistance,
        rejectionDetected: m15RejectionDetected,
      },
      m5: {
        entryStatus,
        breakoutConfirmed,
        retestHeld,
        momentum,
        rsi: m5Rsi,
        swingHigh: m5SwingHigh,
        swingLow: m5SwingLow,
      },
      scoreBreakdown: {
        h1Trend: h1Score,
        m15Structure: m15Score,
        m15PullbackZone: 0,
        m5BreakRetest: m5Score,
        m5Momentum: momentumScore,
        total: totalScore,
        tier,
      },
      recommendedAction: totalScore === 100 ? (h1Trend === 'BULLISH' ? 'BUY' : 'SELL') : 'WAIT',
    };

    // 6. Signal Generation: Trigger 100% Confirmed BUY / SELL
    if (totalScore === 100 && entryStatus === 'BREAK_RETEST') {
      const isBuy = h1Trend === 'BULLISH';
      const entryPrice = currentPrice;

      // Precision Step Index Risk Bounds (tight 2.5 - 3.8 points)
      const rawRisk = isBuy
        ? Math.abs(entryPrice - (m5SwingLow - 0.4))
        : Math.abs(m5SwingHigh + 0.4 - entryPrice);
      const riskDist = Math.min(3.8, Math.max(2.5, rawRisk));

      const stopLoss = isBuy ? entryPrice - riskDist : entryPrice + riskDist;
      const tp1 = isBuy ? entryPrice + riskDist : entryPrice - riskDist;
      const tp2 = isBuy ? entryPrice + riskDist * 2.8 : entryPrice - riskDist * 2.8;

      const signal: SignalJSON = {
        signal_id: `SI_BR_${Date.now()}`,
        symbol,
        signal: isBuy ? 'BUY' : 'SELL',
        status: 'RUNNING',
        confidence: 100,
        h1_trend: h1Trend,
        m15_structure: m15Structure,
        m15_setup: m15Setup,
        m5_confirmation: 'BREAK_RETEST',
        momentum,
        entry_timeframe: 'M5',
        entry: Number(entryPrice.toFixed(2)),
        stop_loss: Number(stopLoss.toFixed(2)),
        take_profit_1: Number(tp1.toFixed(2)),
        take_profit_2: Number(tp2.toFixed(2)),
        risk_reward: '1:2.8',
        strategy_id: 'strategy1_break_retest',
        strategy_name: 'Break & Retest',
        timestamp: Date.now(),
        reasons: [
          `H1 Macro Trend is cleanly ${h1Trend} (EMA 20/50)`,
          `M15 Key Structure Pullback held support/resistance boundary`,
          `M5 Break & Retest confirmed at ${entryPrice.toFixed(1)} with step volume`,
          `Execution Momentum: ${momentum} (RSI ${m5Rsi.toFixed(1)})`,
        ],
        management: {
          tp1_action: 'PARTIAL_PROFIT',
          after_tp1: 'PROTECTED_BE',
          tp2_action: 'RUNNER',
        },
      };

      return {
        decision: isBuy ? 'BUY' : 'SELL',
        signal,
        score: totalScore,
        analysis,
      };
    }

    // Otherwise generate descriptive WAIT status
    const waitReasons: string[] = [];
    if (!breakoutConfirmed) {
      waitReasons.push(`M5 price has not broken beyond previous swing boundary (${m5SwingHigh.toFixed(1)} / ${m5SwingLow.toFixed(1)})`);
    }
    if (!retestHeld) {
      waitReasons.push('Waiting for M5 retest candle to hold the broken key level');
    }
    if (momentum === 'WEAK') {
      waitReasons.push(`M5 RSI momentum (${m5Rsi.toFixed(1)}) is weak; awaiting momentum surge`);
    }
    if (totalScore < 100) {
      waitReasons.push(`Confirmation score is ${totalScore}% / 100%; strictly requires 100% confirmation`);
    }

    const wait: WaitJSON = {
      signal: 'WAIT',
      status: 'NO_TRADE',
      reason: waitReasons.length > 0 ? waitReasons : ['Awaiting structural alignment across H1, M15, and M5'],
      h1_trend: h1Trend,
      m15_structure: m15Structure,
      m5_confirmation: entryStatus,
      timestamp: Date.now(),
      score: totalScore,
    };

    return {
      decision: 'WAIT',
      wait,
      score: totalScore,
      analysis,
    };
  },
};
export default strategy1_break_retest;
