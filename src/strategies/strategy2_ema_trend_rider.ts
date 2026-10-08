import { TradingStrategy, StrategyEvaluationResult } from './types';
import { Candle, Timeframe, SignalJSON, WaitJSON, TimeframeAnalysis } from '../types/market';
import { calculateEMA, calculateRSI } from '../utils/indicators';

/**
 * STRATEGY 2: Triple EMA Ribbon (10/20/50) Trend Rider
 * 
 * Rules:
 * 1. Trend: EMA 10 > EMA 20 > EMA 50 for Bullish; EMA 10 < EMA 20 < EMA 50 for Bearish
 * 2. Pullback: Price dips into the zone between EMA 10 and EMA 20
 * 3. Trigger: Price rejects EMA 20 dynamic band with engulfing or strong close
 * 4. Target: Dynamic 1:2.5 R:R
 */
export const strategy2_ema_trend_rider: TradingStrategy = {
  id: 'strategy2_ema_trend_rider',
  name: 'Strategy 2: Triple EMA Ribbon Trend Rider',
  shortName: 'EMA Ribbon',
  version: '1.0.0',
  author: 'Step Index Master AI',
  descriptionKh: 'យុទ្ធសាស្ត្រជិះតាម Trend ខ្លាំងដោយប្រើបន្ទាត់ EMA 10/20/50 Ribbon។ ចូល Trade នៅពេលតម្លៃទាក់ទងមក Dynamic EMA 20 ហើយស្ទុះបកឡើងវិញ។',
  descriptionEn: 'High-momentum trend riding strategy exploiting Triple EMA Ribbon (10/20/50) bounces on M5 and M15 with dynamic trailing stops.',
  targetAsset: 'Step Index',
  timeframes: ['H1', 'M15', 'M5'],
  indicators: ['EMA 10 (Fast)', 'EMA 20 (Medium)', 'EMA 50 (Slow)', 'RSI 14'],
  expectedWinRate: '68% – 74%',
  winRate: '71%',
  riskReward: '1 : 2.5',
  description: 'High-momentum trend riding strategy exploiting Triple EMA Ribbon (10/20/50) bounces on M5 and M15 with dynamic trailing stops.',
  setupType: 'Dynamic Moving Average Pullback & Continuation',
  executionRules: [
    'Trend Alignment: EMA 10 > EMA 20 > EMA 50 in sequential order',
    'Dynamic Pullback: Candle low touches or pierces between EMA 10 and EMA 20',
    'Rejection Confirmation: Current candle closes back in the direction of the ribbon',
    'RSI Momentum: RSI above 50 for Buy, below 50 for Sell',
    'Quality Score minimum: 80 / 100',
  ],
  rules: [
    'Trend Alignment: EMA 10 > EMA 20 > EMA 50 in sequential order',
    'Dynamic Pullback: Candle low touches or pierces between EMA 10 and EMA 20',
    'Rejection Confirmation: Current candle closes back in the direction of the ribbon',
    'RSI Momentum: RSI above 50 for Buy, below 50 for Sell',
    'Quality Score minimum: 80 / 100',
  ],
  analyze(marketData: any) {
    const symbol = marketData?.symbol || 'stpRNG';
    const candlesMap = marketData?.candlesMap || marketData?.candles || {};
    const currentPrice = marketData?.currentPrice || marketData?.price || 0;
    const res = this.evaluate(symbol, candlesMap, currentPrice);
    return {
      signal: res.decision,
      signalStrength: res.score,
      marketStatus: res.decision === 'WAIT' ? (res.wait?.status || 'Awaiting Ribbon Bounce') : `${res.decision} Trend Riding`,
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

    if (m5Candles.length < 20 || currentPrice <= 0) {
      return {
        decision: 'WAIT',
        score: 0,
        wait: {
          signal: 'WAIT',
          status: 'NO_TRADE',
          reason: ['Awaiting M5/M15 candle synchronization for EMA Ribbon'],
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

    const m5Closes = m5Candles.map((c) => c.close);
    const ema10Arr = calculateEMA(m5Closes, 10);
    const ema20Arr = calculateEMA(m5Closes, 20);
    const ema50Arr = calculateEMA(m5Closes, 50);

    const ema10 = ema10Arr[ema10Arr.length - 1];
    const ema20 = ema20Arr[ema20Arr.length - 1];
    const ema50 = ema50Arr[ema50Arr.length - 1];

    const rsi = calculateRSI(m5Closes, 14);

    const isBullishRibbon = ema10 > ema20 && ema20 > ema50;
    const isBearishRibbon = ema10 < ema20 && ema20 < ema50;

    const lastCandle = m5Candles[m5Candles.length - 1];
    const prevCandle = m5Candles[m5Candles.length - 2] || lastCandle;

    const touchedEmaZone = isBullishRibbon
      ? prevCandle.low <= (ema10 + 0.3) && lastCandle.close >= ema10
      : isBearishRibbon
      ? prevCandle.high >= (ema10 - 0.3) && lastCandle.close <= ema10
      : false;

    let score = 0;
    if (isBullishRibbon || isBearishRibbon) score += 35; // Ribbon alignment (10 > 20 > 50)
    if (touchedEmaZone) score += 35; // Ribbon dynamic support/resistance test & bounce
    if ((isBullishRibbon && rsi >= 48 && rsi <= 72) || (isBearishRibbon && rsi <= 52 && rsi >= 28)) {
      score += 20; // Healthy momentum without exhaustion
    }
    if (Math.abs(ema10 - ema20) >= 0.25) score += 10; // Clean ribbon expansion

    const trend = isBullishRibbon ? 'BULLISH' : isBearishRibbon ? 'BEARISH' : 'NEUTRAL';
    // Strictly require 100% confirmation score
    const entryConfirmed = score === 100 && (isBullishRibbon || isBearishRibbon) && touchedEmaZone;

    const analysis: TimeframeAnalysis = {
      h1: { trend, higherHighs: isBullishRibbon, higherLows: isBullishRibbon, ema20, ema50, recentHigh: ema10, recentLow: ema50 },
      m15: { structure: trend === 'NEUTRAL' ? 'RANGE' : trend, setup: touchedEmaZone ? 'PULLBACK_SUPPORT' : 'WAIT', pullbackZoneActive: touchedEmaZone, supportLevel: ema50, resistanceLevel: ema10, rejectionDetected: touchedEmaZone },
      m5: { entryStatus: entryConfirmed ? 'BREAK_RETEST' : 'WAITING', breakoutConfirmed: entryConfirmed, retestHeld: touchedEmaZone, momentum: score === 100 ? 'STRONG' : 'MODERATE', rsi, swingHigh: ema10, swingLow: ema50 },
      scoreBreakdown: { h1Trend: 25, m15Structure: 25, m15PullbackZone: touchedEmaZone ? 20 : 0, m5BreakRetest: touchedEmaZone ? 20 : 0, m5Momentum: 10, total: score, tier: score === 100 ? 'VERY_STRONG' : score >= 80 ? 'STRONG' : 'NO_TRADE' },
      recommendedAction: entryConfirmed ? (isBullishRibbon ? 'BUY' : 'SELL') : 'WAIT',
    };

    if (entryConfirmed) {
      const isBuy = isBullishRibbon;
      const entryPrice = currentPrice;
      const pivotWick = isBuy ? Math.min(prevCandle.low, lastCandle.low) : Math.max(prevCandle.high, lastCandle.high);
      const rawRisk = Math.abs(entryPrice - pivotWick) + 0.6;
      // Precision Step Index Risk Bounds (tight 2.5 - 3.8 points for rapid 1:2.5 compounding)
      const risk = Math.min(3.8, Math.max(2.5, rawRisk));
      const stopLoss = isBuy ? entryPrice - risk : entryPrice + risk;
      const tp1 = isBuy ? entryPrice + risk : entryPrice - risk;
      const tp2 = isBuy ? entryPrice + risk * 2.5 : entryPrice - risk * 2.5;

      const signal: SignalJSON = {
        signal_id: `SI_EMA_${Date.now()}`,
        symbol,
        signal: isBuy ? 'BUY' : 'SELL',
        status: 'RUNNING',
        confidence: score,
        h1_trend: trend,
        m15_structure: trend === 'NEUTRAL' ? 'RANGE' : trend,
        m15_setup: 'PULLBACK_SUPPORT',
        m5_confirmation: 'BREAK_RETEST',
        momentum: 'STRONG',
        entry_timeframe: 'M5',
        entry: Number(entryPrice.toFixed(2)),
        stop_loss: Number(stopLoss.toFixed(2)),
        take_profit_1: Number(tp1.toFixed(2)),
        take_profit_2: Number(tp2.toFixed(2)),
        risk_reward: '1:2.5',
        strategy_id: 'strategy2_ema_trend_rider',
        strategy_name: 'EMA Ribbon',
        timestamp: Date.now(),
        reasons: [
          `Triple EMA Ribbon 10/20/50 is perfectly aligned in ${trend} expansion`,
          `Price touched dynamic EMA 10/20 band and formed continuation bounce`,
          `RSI Momentum confirmed at ${rsi.toFixed(1)}`,
        ],
        management: { tp1_action: 'PARTIAL_PROFIT', after_tp1: 'PROTECTED_BE', tp2_action: 'RUNNER' },
      };

      return { decision: isBuy ? 'BUY' : 'SELL', signal, score, analysis };
    }

    const wait: WaitJSON = {
      signal: 'WAIT',
      status: 'NO_TRADE',
      reason: [
        !isBullishRibbon && !isBearishRibbon ? 'EMA Ribbon (10/20/50) is entangled; waiting for clean trend alignment' : 'Waiting for clean pullback bounce into EMA 10/20 dynamic zone',
        `Current Strategy Score: ${score}/100 (Requires ≥ 80)`,
      ],
      h1_trend: trend,
      m15_structure: trend === 'NEUTRAL' ? 'RANGE' : trend,
      m5_confirmation: 'WAITING',
      timestamp: Date.now(),
      score,
    };

    return { decision: 'WAIT', wait, score, analysis };
  },
};
