import { Candle, SignalJSON, WaitJSON, TimeframeAnalysis, TrendDirection, StructureType, SetupState, EntryState, MomentumState, ScoreBreakdown } from '../types/market';
import { calculateEMA, calculateRSI, findSwingPoints, detectRejection } from '../utils/indicators';

export class StepIndexStrategyEngine {
  /**
   * Analyzes H1 candles to determine the overarching main trend.
   */
  public analyzeH1Trend(candles: Candle[]): {
    trend: TrendDirection;
    higherHighs: boolean;
    higherLows: boolean;
    ema20: number;
    ema50: number;
    recentHigh: number;
    recentLow: number;
    reasons: string[];
  } {
    if (candles.length < 20) {
      return {
        trend: 'NEUTRAL',
        higherHighs: false,
        higherLows: false,
        ema20: 0,
        ema50: 0,
        recentHigh: 0,
        recentLow: 0,
        reasons: ['Insufficient H1 historical candle data for trend analysis'],
      };
    }

    const closes = candles.map((c) => c.close);
    const ema20Series = calculateEMA(closes, 20);
    const ema50Series = calculateEMA(closes, 50);

    const latestEma20 = ema20Series[ema20Series.length - 1];
    const latestEma50 = ema50Series[ema50Series.length - 1];

    const { swingHighs, swingLows } = findSwingPoints(candles, 2);

    let higherHighs = false;
    let higherLows = false;
    let lowerHighs = false;
    let lowerLows = false;

    if (swingHighs.length >= 2) {
      const sh1 = swingHighs[swingHighs.length - 1].price;
      const sh2 = swingHighs[swingHighs.length - 2].price;
      higherHighs = sh1 > sh2;
      lowerHighs = sh1 < sh2;
    }

    if (swingLows.length >= 2) {
      const sl1 = swingLows[swingLows.length - 1].price;
      const sl2 = swingLows[swingLows.length - 2].price;
      higherLows = sl1 > sl2;
      lowerLows = sl1 < sl2;
    }

    const currentClose = candles[candles.length - 1].close;
    const reasons: string[] = [];

    let trend: TrendDirection = 'NEUTRAL';

    const recentHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : candles[candles.length - 1].high;
    const recentLow = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : candles[candles.length - 1].low;

    // Bullish H1: Higher High + Higher Low structure OR strong EMA20 > EMA50 continuation holding above EMA20
    if ((higherHighs && higherLows) || (currentClose > latestEma20 && latestEma20 > latestEma50 && !lowerLows)) {
      trend = 'BULLISH';
      reasons.push('H1 Higher High / Higher Low bullish continuation');
      if (latestEma20 > latestEma50) reasons.push('H1 EMA20 above EMA50 buyer dominance');
    } else if ((lowerHighs && lowerLows) || (currentClose < latestEma20 && latestEma20 < latestEma50 && !higherHighs)) {
      trend = 'BEARISH';
      reasons.push('H1 Lower Low / Lower High bearish continuation');
      if (latestEma20 < latestEma50) reasons.push('H1 EMA20 below EMA50 seller dominance');
    } else {
      trend = 'NEUTRAL';
      reasons.push('H1 choppy or sideways compression');
    }

    return {
      trend,
      higherHighs,
      higherLows,
      ema20: latestEma20,
      ema50: latestEma50,
      recentHigh,
      recentLow,
      reasons,
    };
  }

  /**
   * Analyzes M15 candles for market structure and pullback into key support/resistance zones.
   */
  public analyzeM15Structure(
    candles: Candle[],
    h1Trend: TrendDirection
  ): {
    structure: StructureType;
    setup: SetupState;
    pullbackZoneActive: boolean;
    supportLevel: number;
    resistanceLevel: number;
    rejectionDetected: boolean;
    reasons: string[];
  } {
    if (candles.length < 15) {
      return {
        structure: 'RANGE',
        setup: 'WAIT',
        pullbackZoneActive: false,
        supportLevel: 0,
        resistanceLevel: 0,
        rejectionDetected: false,
        reasons: ['Insufficient M15 candle count'],
      };
    }

    const { swingHighs, swingLows } = findSwingPoints(candles, 2);
    const recentCandle = candles[candles.length - 1];
    const currentPrice = recentCandle.close;

    const supportLevel = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : Math.min(...candles.slice(-10).map((c) => c.low));
    const resistanceLevel = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : Math.max(...candles.slice(-10).map((c) => c.high));

    const closes = candles.map((c) => c.close);
    const ema20 = calculateEMA(closes, 20)[closes.length - 1];

    let structure: StructureType = 'RANGE';
    let setup: SetupState = 'WAIT';
    let pullbackZoneActive = false;
    const reasons: string[] = [];

    // Rejection on recent M15 candles
    const recentRejections = candles.slice(-3).map(detectRejection);
    const hasBullishRejection = recentRejections.some((r) => r.isBullishRejection);
    const hasBearishRejection = recentRejections.some((r) => r.isBearishRejection);

    const priceNearSupport = Math.abs(currentPrice - supportLevel) / Math.max(1, currentPrice) <= 0.006;
    const priceNearResistance = Math.abs(currentPrice - resistanceLevel) / Math.max(1, currentPrice) <= 0.006;

    if (h1Trend === 'BULLISH') {
      if (currentPrice >= ema20 * 0.998) {
        structure = 'BULLISH';
      }
      if (priceNearSupport || (currentPrice <= ema20 * 1.002 && currentPrice >= ema20 * 0.995)) {
        pullbackZoneActive = true;
        setup = 'PULLBACK_SUPPORT';
        reasons.push('M15 healthy pullback into support / demand area');
      } else if (currentPrice > resistanceLevel) {
        setup = 'BREAKOUT';
        reasons.push('M15 bullish breakout above resistance');
      }
    } else if (h1Trend === 'BEARISH') {
      if (currentPrice <= ema20 * 1.002) {
        structure = 'BEARISH';
      }
      if (priceNearResistance || (currentPrice >= ema20 * 0.998 && currentPrice <= ema20 * 1.005)) {
        pullbackZoneActive = true;
        setup = 'PULLBACK_RESISTANCE';
        reasons.push('M15 pullback into resistance / supply area');
      } else if (currentPrice < supportLevel) {
        setup = 'BREAKOUT';
        reasons.push('M15 bearish breakout below support');
      }
    } else {
      structure = 'RANGE';
      setup = 'WAIT';
      reasons.push('M15 indecision structure');
    }

    return {
      structure,
      setup,
      pullbackZoneActive,
      supportLevel,
      resistanceLevel,
      rejectionDetected: h1Trend === 'BULLISH' ? hasBullishRejection : hasBearishRejection,
      reasons,
    };
  }

  /**
   * Analyzes M5 candles for final entry confirmation:
   * Break of previous swing high/low + Retest hold + Momentum continuation.
   */
  public analyzeM5Entry(
    candles: Candle[],
    h1Trend: TrendDirection,
    m15Structure: StructureType
  ): {
    entryStatus: EntryState;
    breakoutConfirmed: boolean;
    retestHeld: boolean;
    momentum: MomentumState;
    rsi: number;
    swingHigh: number;
    swingLow: number;
    reasons: string[];
  } {
    if (candles.length < 15) {
      return {
        entryStatus: 'WAITING',
        breakoutConfirmed: false,
        retestHeld: false,
        momentum: 'WEAK',
        rsi: 50,
        swingHigh: 0,
        swingLow: 0,
        reasons: ['Insufficient M5 historical candles'],
      };
    }

    const { swingHighs, swingLows } = findSwingPoints(candles, 2);
    const currentPrice = candles[candles.length - 1].close;
    const rsi = calculateRSI(candles, 14);

    const swingHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : Math.max(...candles.slice(-8).map((c) => c.high));
    const swingLow = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : Math.min(...candles.slice(-8).map((c) => c.low));

    let breakoutConfirmed = false;
    let retestHeld = false;
    let entryStatus: EntryState = 'WAITING';
    const reasons: string[] = [];

    // Momentum assessment
    let momentum: MomentumState = 'MODERATE';
    const recent3 = candles.slice(-3);
    const avgBody = recent3.reduce((acc, c) => acc + Math.abs(c.close - c.open), 0) / 3;
    const avgRange = recent3.reduce((acc, c) => acc + (c.high - c.low), 0) / 3;

    if (h1Trend === 'BULLISH' && m15Structure === 'BULLISH') {
      if (rsi >= 50 && rsi <= 72 && avgBody / Math.max(0.01, avgRange) >= 0.45) {
        momentum = 'STRONG';
      } else if (rsi < 45) {
        momentum = 'WEAK';
      }

      // Break + Retest check:
      // Price broke above previous swing high in the last 4 candles and currently holds above or retested it
      const brokeAbove = candles.slice(-5, -1).some((c) => c.high >= swingHigh || c.close >= swingHigh);
      const holdsAboveOrRetesting = currentPrice >= swingHigh * 0.9995 && currentPrice >= swingLow;

      if (brokeAbove && holdsAboveOrRetesting) {
        breakoutConfirmed = true;
        retestHeld = true;
        entryStatus = 'BREAK_RETEST';
        reasons.push('M5 Break of previous swing high confirmed with retest holding');
      } else if (currentPrice > swingHigh) {
        breakoutConfirmed = true;
        retestHeld = false;
        entryStatus = 'WAITING';
        reasons.push('M5 initial break observed, waiting for retest confirmation');
      } else {
        reasons.push('M5 waiting for breakout of swing high ' + swingHigh.toFixed(2));
      }
    } else if (h1Trend === 'BEARISH' && m15Structure === 'BEARISH') {
      if (rsi <= 50 && rsi >= 28 && avgBody / Math.max(0.01, avgRange) >= 0.45) {
        momentum = 'STRONG';
      } else if (rsi > 55) {
        momentum = 'WEAK';
      }

      // Break below previous swing low + retest failed (held below)
      const brokeBelow = candles.slice(-5, -1).some((c) => c.low <= swingLow || c.close <= swingLow);
      const holdsBelowOrRetesting = currentPrice <= swingLow * 1.0005 && currentPrice <= swingHigh;

      if (brokeBelow && holdsBelowOrRetesting) {
        breakoutConfirmed = true;
        retestHeld = true;
        entryStatus = 'BREAK_RETEST';
        reasons.push('M5 Break of previous swing low confirmed with retest rejection');
      } else if (currentPrice < swingLow) {
        breakoutConfirmed = true;
        retestHeld = false;
        entryStatus = 'WAITING';
        reasons.push('M5 initial breakdown observed, waiting for retest confirmation');
      } else {
        reasons.push('M5 waiting for breakdown of swing low ' + swingLow.toFixed(2));
      }
    } else {
      entryStatus = 'WAITING';
      reasons.push('Multi-timeframe alignment not established');
    }

    return {
      entryStatus,
      breakoutConfirmed,
      retestHeld,
      momentum,
      rsi,
      swingHigh,
      swingLow,
      reasons,
    };
  }

  /**
   * Computes the 0-100 Entry Quality Score based on the specification:
   * H1 Trend = 30 pts
   * M15 Structure = 25 pts
   * M15 Pullback/Zone = 15 pts
   * M5 Break + Retest = 20 pts
   * M5 Momentum = 10 pts
   */
  public calculateQualityScore(
    h1Trend: TrendDirection,
    m15Structure: StructureType,
    m15Setup: SetupState,
    m15Rejection: boolean,
    m5Status: EntryState,
    momentum: MomentumState
  ): ScoreBreakdown {
    let h1Score = 0;
    if (h1Trend === 'BULLISH' || h1Trend === 'BEARISH') {
      h1Score = 30;
    } else {
      h1Score = 10;
    }

    let m15StructScore = 0;
    if ((h1Trend === 'BULLISH' && m15Structure === 'BULLISH') || (h1Trend === 'BEARISH' && m15Structure === 'BEARISH')) {
      m15StructScore = 25;
    } else if (m15Structure === 'RANGE') {
      m15StructScore = 8;
    }

    let m15ZoneScore = 0;
    if (m15Setup === 'PULLBACK_SUPPORT' || m15Setup === 'PULLBACK_RESISTANCE') {
      m15ZoneScore = m15Rejection ? 15 : 12;
    } else if (m15Setup === 'BREAKOUT') {
      m15ZoneScore = 10;
    } else {
      m15ZoneScore = 4;
    }

    let m5BreakScore = 0;
    if (m5Status === 'BREAK_RETEST') {
      m5BreakScore = 20;
    } else if (m5Status === 'WAITING') {
      m5BreakScore = 6;
    }

    let m5MomScore = 0;
    if (momentum === 'STRONG') {
      m5MomScore = 10;
    } else if (momentum === 'MODERATE') {
      m5MomScore = 6;
    } else {
      m5MomScore = 2;
    }

    const total = h1Score + m15StructScore + m15ZoneScore + m5BreakScore + m5MomScore;

    let tier: ScoreBreakdown['tier'] = 'NO_TRADE';
    if (total >= 90) {
      tier = 'VERY_STRONG';
    } else if (total >= 80) {
      tier = 'STRONG';
    } else if (total >= 70) {
      tier = 'WATCH';
    } else {
      tier = 'NO_TRADE';
    }

    return {
      h1Trend: h1Score,
      m15Structure: m15StructScore,
      m15PullbackZone: m15ZoneScore,
      m5BreakRetest: m5BreakScore,
      m5Momentum: m5MomScore,
      total,
      tier,
    };
  }

  /**
   * Main evaluation method: takes H1, M15, M5 candle sets and current price,
   * evaluates structural rules and returns either a SignalJSON or a WaitJSON.
   */
  public evaluate(
    symbol: string,
    h1Candles: Candle[],
    m15Candles: Candle[],
    m5Candles: Candle[],
    currentPrice: number
  ): {
    decision: 'BUY' | 'SELL' | 'WAIT';
    signal?: SignalJSON;
    wait?: WaitJSON;
    analysis: TimeframeAnalysis;
  } {
    const h1 = this.analyzeH1Trend(h1Candles);
    const m15 = this.analyzeM15Structure(m15Candles, h1.trend);
    const m5 = this.analyzeM5Entry(m5Candles, h1.trend, m15.structure);

    const score = this.calculateQualityScore(
      h1.trend,
      m15.structure,
      m15.setup,
      m15.rejectionDetected,
      m5.entryStatus,
      m5.momentum
    );

    const waitReasons: string[] = [];
    if (h1.trend === 'NEUTRAL') waitReasons.push('H1 trend is neutral/choppy, waiting for structural clarity');
    if (h1.trend !== 'NEUTRAL' && m15.structure !== (h1.trend as unknown as StructureType)) {
      waitReasons.push('M15 structure conflicts with H1 trend direction');
    }
    if (m15.setup === 'WAIT') waitReasons.push('M15 waiting for valid pullback to key zone');
    if (m5.entryStatus !== 'BREAK_RETEST') waitReasons.push('M5 Break + Retest confirmation not completed');
    if (m5.momentum === 'WEAK') waitReasons.push('M5 momentum is weak or contradictory');
    if (score.total < 80) waitReasons.push(`Setup score (${score.total}/100) below 80 threshold`);

    const analysis: TimeframeAnalysis = {
      h1: {
        trend: h1.trend,
        higherHighs: h1.higherHighs,
        higherLows: h1.higherLows,
        ema20: h1.ema20,
        ema50: h1.ema50,
        recentHigh: h1.recentHigh,
        recentLow: h1.recentLow,
      },
      m15: {
        structure: m15.structure,
        setup: m15.setup,
        pullbackZoneActive: m15.pullbackZoneActive,
        supportLevel: m15.supportLevel,
        resistanceLevel: m15.resistanceLevel,
        rejectionDetected: m15.rejectionDetected,
      },
      m5: {
        entryStatus: m5.entryStatus,
        breakoutConfirmed: m5.breakoutConfirmed,
        retestHeld: m5.retestHeld,
        momentum: m5.momentum,
        rsi: m5.rsi,
        swingHigh: m5.swingHigh,
        swingLow: m5.swingLow,
      },
      scoreBreakdown: score,
      recommendedAction: 'WAIT',
    };

    // Mandatory structural check:
    const isBuyEligible =
      h1.trend === 'BULLISH' &&
      m15.structure === 'BULLISH' &&
      (m15.setup === 'PULLBACK_SUPPORT' || m15.setup === 'BREAKOUT') &&
      m5.entryStatus === 'BREAK_RETEST' &&
      m5.momentum !== 'WEAK' &&
      score.total >= 80;

    const isSellEligible =
      h1.trend === 'BEARISH' &&
      m15.structure === 'BEARISH' &&
      (m15.setup === 'PULLBACK_RESISTANCE' || m15.setup === 'BREAKOUT') &&
      m5.entryStatus === 'BREAK_RETEST' &&
      m5.momentum !== 'WEAK' &&
      score.total >= 80;

    if (isBuyEligible) {
      // Calculate Stop Loss based on confirmed M5/M15 swing low
      const logicalSL = Math.min(m5.swingLow, m15.supportLevel);
      // Small buffer for Step Index
      const stopLoss = Number((logicalSL - 2.0).toFixed(2));
      const risk = currentPrice - stopLoss;

      if (risk > 0.5) {
        // Enforce R:R >= 1:2
        const tp1 = Number((currentPrice + risk * 1.0).toFixed(2));
        const tp2 = Number((currentPrice + risk * 2.8).toFixed(2));
        const rrRatio = '1:2.8';

        analysis.recommendedAction = 'BUY';

        const signal: SignalJSON = {
          signal_id: `SI_${Date.now()}_BUY`,
          symbol,
          signal: 'BUY',
          status: 'VALID',
          confidence: score.total,
          h1_trend: 'BULLISH',
          m15_structure: 'BULLISH',
          m15_setup: m15.setup,
          m5_confirmation: 'BREAK_RETEST',
          momentum: m5.momentum,
          entry_timeframe: 'M5',
          entry: Number(currentPrice.toFixed(2)),
          stop_loss: stopLoss,
          take_profit_1: tp1,
          take_profit_2: tp2,
          risk_reward: rrRatio,
          timestamp: Date.now(),
          reasons: [
            'H1 Bullish trend confirmed',
            'M15 Bullish structure holding support',
            'M5 Break of swing high and retest hold confirmed',
            'Strong momentum supporting upside continuation',
          ],
          management: {
            tp1_action: 'PARTIAL_PROFIT',
            after_tp1: 'PROTECT_REMAINING_POSITION',
            tp2_action: 'RUNNER',
            partial_close_pct: 50,
          },
        };

        return { decision: 'BUY', signal, analysis };
      } else {
        waitReasons.push('Calculated risk buffer is too narrow to satisfy minimum 1:2 R:R');
      }
    }

    if (isSellEligible) {
      // Calculate Stop Loss based on confirmed M5/M15 swing high
      const logicalSL = Math.max(m5.swingHigh, m15.resistanceLevel);
      const stopLoss = Number((logicalSL + 2.0).toFixed(2));
      const risk = stopLoss - currentPrice;

      if (risk > 0.5) {
        const tp1 = Number((currentPrice - risk * 1.0).toFixed(2));
        const tp2 = Number((currentPrice - risk * 2.8).toFixed(2));
        const rrRatio = '1:2.8';

        analysis.recommendedAction = 'SELL';

        const signal: SignalJSON = {
          signal_id: `SI_${Date.now()}_SELL`,
          symbol,
          signal: 'SELL',
          status: 'VALID',
          confidence: score.total,
          h1_trend: 'BEARISH',
          m15_structure: 'BEARISH',
          m15_setup: m15.setup,
          m5_confirmation: 'BREAK_RETEST',
          momentum: m5.momentum,
          entry_timeframe: 'M5',
          entry: Number(currentPrice.toFixed(2)),
          stop_loss: stopLoss,
          take_profit_1: tp1,
          take_profit_2: tp2,
          risk_reward: rrRatio,
          timestamp: Date.now(),
          reasons: [
            'H1 Bearish trend confirmed',
            'M15 Bearish structure holding resistance',
            'M5 Break of swing low and retest rejection confirmed',
            'Strong momentum supporting downside continuation',
          ],
          management: {
            tp1_action: 'PARTIAL_PROFIT',
            after_tp1: 'PROTECT_REMAINING_POSITION',
            tp2_action: 'RUNNER',
            partial_close_pct: 50,
          },
        };

        return { decision: 'SELL', signal, analysis };
      } else {
        waitReasons.push('Calculated risk buffer is too narrow to satisfy minimum 1:2 R:R');
      }
    }

    // Default WAIT state as mandated by section 18
    const wait: WaitJSON = {
      signal: 'WAIT',
      status: 'NO_TRADE',
      reason: waitReasons.length > 0 ? waitReasons : ['M5 confirmation not completed'],
      h1_trend: h1.trend,
      m15_structure: m15.structure,
      m5_confirmation: m5.entryStatus === 'BREAK_RETEST' ? 'CONFIRMED' : 'WAITING',
      timestamp: Date.now(),
      score: score.total,
    };

    return { decision: 'WAIT', wait, analysis };
  }
}

export const strategyEngine = new StepIndexStrategyEngine();
