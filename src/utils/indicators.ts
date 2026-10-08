import { Candle } from '../types/market';

/**
 * Calculates Exponential Moving Average (EMA) for a series of values.
 */
export function calculateEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const emaArray: number[] = new Array(values.length);

  // Initialize first EMA as simple average of first period values (or first value)
  let sum = 0;
  const initialPeriod = Math.min(period, values.length);
  for (let i = 0; i < initialPeriod; i++) {
    sum += values[i];
  }
  let prevEma = sum / initialPeriod;
  emaArray[initialPeriod - 1] = prevEma;

  for (let i = initialPeriod; i < values.length; i++) {
    prevEma = values[i] * k + prevEma * (1 - k);
    emaArray[i] = prevEma;
  }

  // Fill preceding undefined values with initial average
  for (let i = 0; i < initialPeriod - 1; i++) {
    emaArray[i] = emaArray[initialPeriod - 1];
  }

  return emaArray;
}

/**
 * Calculates RSI (Relative Strength Index)
 */
export function calculateRSI(input: Candle[] | number[], period: number = 14): number {
  if (input.length <= period) return 50;

  const closes: number[] = typeof input[0] === 'number' ? (input as number[]) : (input as Candle[]).map((c) => c.close);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Finds recent swing highs and swing lows (fractals / local peaks and troughs)
 */
export function findSwingPoints(
  candles: Candle[],
  lookback: number = 3
): {
  swingHighs: { index: number; price: number; candle: Candle }[];
  swingLows: { index: number; price: number; candle: Candle }[];
} {
  const swingHighs: { index: number; price: number; candle: Candle }[] = [];
  const swingLows: { index: number; price: number; candle: Candle }[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= current.high || candles[i + j].high > current.high) {
        isHigh = false;
      }
      if (candles[i - j].low <= current.low || candles[i + j].low < current.low) {
        isLow = false;
      }
    }

    if (isHigh) {
      swingHighs.push({ index: i, price: current.high, candle: current });
    }
    if (isLow) {
      swingLows.push({ index: i, price: current.low, candle: current });
    }
  }

  return { swingHighs, swingLows };
}

/**
 * Detects if a candle has rejection characteristics
 */
export function detectRejection(candle: Candle): {
  isBullishRejection: boolean;
  isBearishRejection: boolean;
  lowerWickRatio: number;
  upperWickRatio: number;
} {
  const totalRange = candle.high - candle.low;
  if (totalRange <= 0.0001) {
    return {
      isBullishRejection: false,
      isBearishRejection: false,
      lowerWickRatio: 0,
      upperWickRatio: 0,
    };
  }

  const bodyTop = Math.max(candle.open, candle.close);
  const bodyBottom = Math.min(candle.open, candle.close);

  const upperWick = candle.high - bodyTop;
  const lowerWick = bodyBottom - candle.low;

  const lowerWickRatio = lowerWick / totalRange;
  const upperWickRatio = upperWick / totalRange;

  // Bullish rejection: lower wick is at least 45% of total candle range
  const isBullishRejection = lowerWickRatio >= 0.45 && candle.close >= candle.open * 0.9995;
  // Bearish rejection: upper wick is at least 45% of total candle range
  const isBearishRejection = upperWickRatio >= 0.45 && candle.close <= candle.open * 1.0005;

  return {
    isBullishRejection,
    isBearishRejection,
    lowerWickRatio,
    upperWickRatio,
  };
}
