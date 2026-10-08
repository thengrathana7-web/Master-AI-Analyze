import React, { useRef, useState, useMemo } from 'react';
import { Candle, SignalJSON, Timeframe } from '../types/market';
import { calculateEMA } from '../utils/indicators';
import { useStrategy } from '../context/StrategyContext';
import { TradingStrategy } from '../strategies';

interface CandlestickChartProps {
  candles: Candle[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  activeSignal: SignalJSON | null;
  symbol: string;
  currentPrice?: number;
  activeStrategy?: TradingStrategy;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candles,
  timeframe,
  onTimeframeChange,
  activeSignal,
  symbol,
  currentPrice,
  activeStrategy: propStrategy,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const { activeStrategy: ctxStrategy } = useStrategy();
  const currentStrategy = propStrategy || ctxStrategy;
  const stratId = currentStrategy?.id || 'strategy1_break_retest';

  // Normalize display name: always show clean "Step Index"
  const cleanSymbolName =
    symbol === 'stpRNG' || symbol === 'Step Index 100' || symbol.toLowerCase().includes('step index')
      ? 'Step Index'
      : symbol;

  // Use up to 80 recent candles for rich MT5/TradingView display
  const visibleCandles = useMemo(() => {
    return candles.slice(-80);
  }, [candles]);

  const closes = useMemo(() => visibleCandles.map((c) => c.close), [visibleCandles]);

  // Strategy-Specific Technical Indicators:
  // 1. Triple EMA Ribbon (10, 20, 50) for Strategy 2
  const ema10 = useMemo(() => (closes.length === 0 ? [] : calculateEMA(closes, 10)), [closes]);
  const ema20 = useMemo(() => (closes.length === 0 ? [] : calculateEMA(closes, 20)), [closes]);
  const ema50 = useMemo(() => (closes.length === 0 ? [] : calculateEMA(closes, 50)), [closes]);

  // 2. Fast Scalp EMAs (9, 21) for Strategy 4
  const ema9 = useMemo(() => (closes.length === 0 ? [] : calculateEMA(closes, 9)), [closes]);
  const ema21 = useMemo(() => (closes.length === 0 ? [] : calculateEMA(closes, 21)), [closes]);

  // 3. Key High & Low (Support/Resistance & Liquidity Pools for Strategies 1 & 3)
  const { keyHigh, keyLow } = useMemo(() => {
    if (visibleCandles.length < 5) return { keyHigh: 0, keyLow: 0 };
    // Look back last 30 candles
    const subset = visibleCandles.slice(-35);
    const maxH = Math.max(...subset.map((c) => c.high));
    const minL = Math.min(...subset.map((c) => c.low));
    return { keyHigh: maxH, keyLow: minL };
  }, [visibleCandles]);

  // Find min and max price across visible candles, current price, and trade levels
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (visibleCandles.length === 0) {
      const base = currentPrice && currentPrice > 0 ? currentPrice : 7260;
      return { minPrice: base - 5, maxPrice: base + 5, priceRange: 10 };
    }

    let min = Math.min(...visibleCandles.map((c) => c.low));
    let max = Math.max(...visibleCandles.map((c) => c.high));

    if (currentPrice && currentPrice > 0) {
      min = Math.min(min, currentPrice);
      max = Math.max(max, currentPrice);
    }

    if (activeSignal) {
      min = Math.min(min, activeSignal.stop_loss, activeSignal.entry, activeSignal.take_profit_1, activeSignal.take_profit_2);
      max = Math.max(max, activeSignal.stop_loss, activeSignal.entry, activeSignal.take_profit_1, activeSignal.take_profit_2);
    }

    // Add 8% vertical padding
    const pad = Math.max(1.0, (max - min) * 0.08);
    min -= pad;
    max += pad;

    return { minPrice: min, maxPrice: max, priceRange: Math.max(1.0, max - min) };
  }, [visibleCandles, activeSignal, currentPrice]);

  const chartHeight = 340;
  const chartWidth = 720;
  const priceAxisWidth = 65;
  const plotWidth = chartWidth - priceAxisWidth;

  const count = visibleCandles.length;
  const defaultSpacing = 11;
  const candleSpacing = count > 0 ? Math.min(14, Math.max(7, plotWidth / Math.max(45, count))) : defaultSpacing;
  const barWidth = Math.max(4, Math.min(9, candleSpacing * 0.72));

  // Anchor candles to the right edge (most recent candle on right)
  const rightMargin = 20;
  const getX = (index: number) => {
    const offsetFromRight = (count - 1 - index) * candleSpacing;
    return plotWidth - rightMargin - offsetFromRight;
  };

  const getY = (price: number) => {
    return chartHeight - ((price - minPrice) / priceRange) * (chartHeight - 30) - 15;
  };

  // Price axis scale ticks (0.1 step size aware)
  const priceTicks = useMemo(() => {
    const ticks = [];
    const step = priceRange / 6;
    for (let i = 0; i <= 6; i++) {
      ticks.push(minPrice + i * step);
    }
    return ticks;
  }, [minPrice, priceRange]);

  const hoveredCandle = hoverIndex !== null && visibleCandles[hoverIndex] ? visibleCandles[hoverIndex] : null;
  const livePriceValue = currentPrice || (visibleCandles.length > 0 ? visibleCandles[visibleCandles.length - 1].close : null);

  return (
    <div className="glass-panel rounded-3xl p-4 md:p-6 border border-slate-800/80 shadow-2xl mb-5">
      {/* Top Header of Chart */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <h2 className="font-extrabold text-sm md:text-base text-white tracking-wide uppercase">
            {cleanSymbolName}
          </h2>
          <span className="text-slate-600">•</span>
          <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md font-mono">
            {timeframe}
          </span>
          {/* Active Strategy Badge on Chart */}
          <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/70 border border-cyan-800/60 px-2 py-0.5 rounded-md hidden sm:inline">
            ⚙ {currentStrategy.shortName}
          </span>
        </div>

        {/* Timeframe Selector Buttons (All 9 Timeframes) */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full">
          {(['M1', 'M3', 'M5', 'M15', 'M30', 'H1', 'H2', '4H', '1D'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition ${
                timeframe === tf
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Indicator Legend & Hover OHLC - Dynamically matched to Active Strategy */}
      <div className="h-7 mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400 overflow-x-auto whitespace-nowrap">
        {hoveredCandle ? (
          <div className="flex items-center gap-3">
            <span>O: <strong className="text-white">{hoveredCandle.open.toFixed(1)}</strong></span>
            <span>H: <strong className="text-emerald-400">{hoveredCandle.high.toFixed(1)}</strong></span>
            <span>L: <strong className="text-rose-400">{hoveredCandle.low.toFixed(1)}</strong></span>
            <span>C: <strong className="text-white">{hoveredCandle.close.toFixed(1)}</strong></span>
            <span className="text-slate-500">
              {new Date(hoveredCandle.epoch * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* Strategy 1: Break & Retest */}
            {stratId === 'strategy1_break_retest' && (
              <>
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="w-2.5 h-0.5 bg-blue-500 inline-block" />
                  <span>EMA20</span>
                </span>
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="w-2.5 h-0.5 bg-rose-500 inline-block" />
                  <span>EMA50</span>
                </span>
                <span className="flex items-center gap-1 text-[10px] text-amber-400/90">
                  <span className="w-2.5 h-0.5 border-b border-dashed border-amber-400 inline-block" />
                  <span>Key Levels</span>
                </span>
              </>
            )}

            {/* Strategy 2: Triple EMA Ribbon */}
            {stratId === 'strategy2_ema_trend_rider' && (
              <>
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
                  <span>EMA10 (Fast)</span>
                </span>
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
                  <span>EMA20 (Mid)</span>
                </span>
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="w-2.5 h-0.5 bg-purple-400 inline-block" />
                  <span>EMA50 (Slow)</span>
                </span>
              </>
            )}

            {/* Strategy 3: SMC Liquidity Sweep */}
            {stratId === 'strategy3_liquidity_sweep' && (
              <>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <span className="w-2.5 h-0.5 border-b border-dashed border-emerald-400 inline-block" />
                  <span>BSL (Highs)</span>
                </span>
                <span className="flex items-center gap-1 text-[10px] text-rose-400">
                  <span className="w-2.5 h-0.5 border-b border-dashed border-rose-400 inline-block" />
                  <span>SSL (Lows)</span>
                </span>
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="w-2.5 h-0.5 bg-blue-500 inline-block" />
                  <span>EMA20</span>
                </span>
              </>
            )}

            {/* Strategy 4: Micro Scalper */}
            {stratId === 'strategy4_step_scalper' && (
              <>
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
                  <span>EMA9 (Scalp)</span>
                </span>
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
                  <span>EMA21</span>
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span>0.1 Step Range</span>
                </span>
              </>
            )}

            {livePriceValue && (
              <span className="text-slate-300 font-semibold ml-2">
                Live: <strong className="text-cyan-400">{livePriceValue.toFixed(2)}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* SVG Candlestick Chart Area */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden mt-1 cursor-crosshair select-none bg-[#050a14]/60 rounded-xl border border-slate-900/80"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-72 md:h-96 overflow-visible"
          preserveAspectRatio="none"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * chartWidth;
            let closestIdx = -1;
            let minDist = 999;
            for (let i = 0; i < count; i++) {
              const cx = getX(i);
              const dist = Math.abs(mouseX - cx);
              if (dist < minDist && dist < candleSpacing * 1.5) {
                minDist = dist;
                closestIdx = i;
              }
            }
            if (closestIdx >= 0) {
              setHoverIndex(closestIdx);
            }
          }}
        >
          {/* Horizontal Grid Lines */}
          {priceTicks.map((price, i) => {
            const y = getY(price);
            return (
              <g key={i}>
                <line
                  x1="0"
                  y1={y}
                  x2={plotWidth}
                  y2={y}
                  stroke="#1e293b"
                  strokeWidth="0.8"
                  strokeDasharray="2 4"
                />
                <text
                  x={plotWidth + 8}
                  y={y + 3.5}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {price.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* DYNAMIC TECHNICAL INDICATORS BASED ON ACTIVE STRATEGY */}

          {/* 1. STRATEGY 1: Break & Retest Indicators (EMA20, EMA50, Key Levels) */}
          {stratId === 'strategy1_break_retest' && (
            <>
              {ema20.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1.4"
                  strokeOpacity="0.85"
                  points={ema20.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ')}
                />
              )}
              {ema50.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeOpacity="0.85"
                  points={ema50.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ')}
                />
              )}
              {keyHigh > 0 && (
                <g>
                  <line
                    x1="0"
                    y1={getY(keyHigh)}
                    x2={plotWidth}
                    y2={getY(keyHigh)}
                    stroke="#f59e0b"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    strokeOpacity="0.7"
                  />
                  <text x="8" y={getY(keyHigh) - 3} fill="#fbbf24" fontSize="8" fontFamily="monospace">
                    Key Resistance ({keyHigh.toFixed(1)})
                  </text>
                </g>
              )}
              {keyLow > 0 && (
                <g>
                  <line
                    x1="0"
                    y1={getY(keyLow)}
                    x2={plotWidth}
                    y2={getY(keyLow)}
                    stroke="#10b981"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    strokeOpacity="0.7"
                  />
                  <text x="8" y={getY(keyLow) + 9} fill="#34d399" fontSize="8" fontFamily="monospace">
                    Key Support ({keyLow.toFixed(1)})
                  </text>
                </g>
              )}
            </>
          )}

          {/* 2. STRATEGY 2: Triple EMA Ribbon (EMA 10, 20, 50) */}
          {stratId === 'strategy2_ema_trend_rider' && (
            <>
              {ema10.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeOpacity="0.9"
                  points={ema10.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ')}
                />
              )}
              {ema20.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="1.5"
                  strokeOpacity="0.85"
                  points={ema20.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ')}
                />
              )}
              {ema50.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth="1.8"
                  strokeOpacity="0.9"
                  points={ema50.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ')}
                />
              )}
            </>
          )}

          {/* 3. STRATEGY 3: SMC Liquidity Pools & Swing Zones */}
          {stratId === 'strategy3_liquidity_sweep' && (
            <>
              {keyHigh > 0 && (
                <g>
                  <line
                    x1="0"
                    y1={getY(keyHigh)}
                    x2={plotWidth}
                    y2={getY(keyHigh)}
                    stroke="#10b981"
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                  />
                  <rect x="6" y={getY(keyHigh) - 12} width="110" height="12" fill="#064e3b" rx="2" opacity="0.8" />
                  <text x="10" y={getY(keyHigh) - 3} fill="#6ee7b7" fontSize="8" fontFamily="monospace" fontWeight="bold">
                    BSL (Equal Highs)
                  </text>
                </g>
              )}
              {keyLow > 0 && (
                <g>
                  <line
                    x1="0"
                    y1={getY(keyLow)}
                    x2={plotWidth}
                    y2={getY(keyLow)}
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                  />
                  <rect x="6" y={getY(keyLow)} width="110" height="12" fill="#7f1d1d" rx="2" opacity="0.8" />
                  <text x="10" y={getY(keyLow) + 9} fill="#fca5a5" fontSize="8" fontFamily="monospace" fontWeight="bold">
                    SSL (Equal Lows)
                  </text>
                </g>
              )}
              {ema20.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1.2"
                  strokeOpacity="0.7"
                  points={ema20.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ')}
                />
              )}
            </>
          )}

          {/* 4. STRATEGY 4: Micro Scalper EMAs (9 & 21) */}
          {stratId === 'strategy4_step_scalper' && (
            <>
              {ema9.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="1.6"
                  strokeOpacity="0.9"
                  points={ema9.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ')}
                />
              )}
              {ema21.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.4"
                  strokeOpacity="0.85"
                  points={ema21.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ')}
                />
              )}
            </>
          )}

          {/* Candlesticks (Clean MT5 style) */}
          {visibleCandles.map((c, i) => {
            const x = getX(i);
            const isGreen = c.close >= c.open;
            const candleColor = isGreen ? '#10b981' : '#ef4444';
            const bodyTop = getY(Math.max(c.open, c.close));
            const bodyBottom = getY(Math.min(c.open, c.close));
            const bodyHeight = Math.max(1.8, bodyBottom - bodyTop);
            const highY = getY(c.high);
            const lowY = getY(c.low);

            return (
              <g key={c.epoch + '-' + i} opacity={hoverIndex === null || hoverIndex === i ? 1 : 0.6}>
                {/* Thin Center High/Low Wick */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={candleColor}
                  strokeWidth="1.2"
                />
                {/* Candle Body */}
                <rect
                  x={x - barWidth / 2}
                  y={bodyTop}
                  width={barWidth}
                  height={bodyHeight}
                  fill={candleColor}
                  rx="1"
                />
              </g>
            );
          })}

          {/* Current Live Price Line & Badge */}
          {livePriceValue && (
            <g>
              <line
                x1="0"
                y1={getY(livePriceValue)}
                x2={plotWidth}
                y2={getY(livePriceValue)}
                stroke="#06b6d4"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              <rect
                x={plotWidth + 4}
                y={getY(livePriceValue) - 8}
                width={priceAxisWidth - 6}
                height={16}
                fill="#0891b2"
                rx="3"
              />
              <text
                x={plotWidth + 8}
                y={getY(livePriceValue) + 3.5}
                fill="#ffffff"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {livePriceValue.toFixed(1)}
              </text>
            </g>
          )}

          {/* Active Signal Levels (Entry, SL, TP1, TP2) */}
          {activeSignal && (
            <g>
              {/* Entry Level */}
              <line
                x1="0"
                y1={getY(activeSignal.entry)}
                x2={plotWidth}
                y2={getY(activeSignal.entry)}
                stroke="#38bdf8"
                strokeWidth="1.2"
              />
              <text x="12" y={getY(activeSignal.entry) - 4} fill="#38bdf8" fontSize="9" fontFamily="monospace" fontWeight="bold">
                ENTRY: {activeSignal.entry.toFixed(1)}
              </text>

              {/* Stop Loss Level */}
              <line
                x1="0"
                y1={getY(activeSignal.stop_loss)}
                x2={plotWidth}
                y2={getY(activeSignal.stop_loss)}
                stroke="#f43f5e"
                strokeWidth="1.2"
                strokeDasharray="4 2"
              />
              <text x="12" y={getY(activeSignal.stop_loss) - 4} fill="#f43f5e" fontSize="9" fontFamily="monospace" fontWeight="bold">
                SL: {activeSignal.stop_loss.toFixed(1)}
              </text>

              {/* Take Profit 1 */}
              <line
                x1="0"
                y1={getY(activeSignal.take_profit_1)}
                x2={plotWidth}
                y2={getY(activeSignal.take_profit_1)}
                stroke="#34d399"
                strokeWidth="1.2"
                strokeDasharray="4 2"
              />
              <text x="12" y={getY(activeSignal.take_profit_1) - 4} fill="#34d399" fontSize="9" fontFamily="monospace" fontWeight="bold">
                TP1: {activeSignal.take_profit_1.toFixed(1)}
              </text>

              {/* Take Profit 2 */}
              <line
                x1="0"
                y1={getY(activeSignal.take_profit_2)}
                x2={plotWidth}
                y2={getY(activeSignal.take_profit_2)}
                stroke="#10b981"
                strokeWidth="1.4"
                strokeDasharray="4 2"
              />
              <text x="12" y={getY(activeSignal.take_profit_2) - 4} fill="#10b981" fontSize="9" fontFamily="monospace" fontWeight="bold">
                TP2: {activeSignal.take_profit_2.toFixed(1)}
              </text>
            </g>
          )}

          {/* Hover Crosshair */}
          {hoverIndex !== null && visibleCandles[hoverIndex] && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1="0"
                x2={getX(hoverIndex)}
                y2={chartHeight}
                stroke="#94a3b8"
                strokeWidth="0.8"
                strokeDasharray="3 3"
              />
              <line
                x1="0"
                y1={getY(visibleCandles[hoverIndex].close)}
                x2={plotWidth}
                y2={getY(visibleCandles[hoverIndex].close)}
                stroke="#94a3b8"
                strokeWidth="0.8"
                strokeDasharray="3 3"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
