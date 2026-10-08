export type Timeframe = 'M1' | 'M3' | 'M5' | 'M15' | 'M30' | 'H1' | 'H2' | '4H' | '1D';

export const ALL_TIMEFRAMES: Timeframe[] = ['M1', 'M3', 'M5', 'M15', 'M30', 'H1', 'H2', '4H', '1D'];

export const TIMEFRAME_GRANULARITIES: Record<Timeframe, number> = {
  M1: 60,
  M3: 180,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H2: 7200,
  '4H': 14400,
  '1D': 86400,
};

export interface Tick {
  epoch: number;
  quote: number;
  symbol: string;
  ask?: number;
  bid?: number;
}

export interface Candle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface DerivSymbol {
  symbol: string;
  displayName: string;
  market: string;
  submarket: string;
  isActive: boolean;
}

export type TrendDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type StructureType = 'BULLISH' | 'BEARISH' | 'RANGE';
export type SetupState = 'PULLBACK_SUPPORT' | 'PULLBACK_RESISTANCE' | 'BREAKOUT' | 'WAIT';
export type EntryState = 'BREAK_RETEST' | 'WAITING' | 'REJECTED';
export type MomentumState = 'STRONG' | 'MODERATE' | 'WEAK';
export type SignalType = 'BUY' | 'SELL' | 'WAIT';
export type SignalStatus = 'VALID' | 'NO_TRADE' | 'RUNNING' | 'TP1_HIT' | 'TP2_HIT' | 'SL_HIT' | 'EXPIRED';

export interface ScoreBreakdown {
  h1Trend: number;         // Max 30
  m15Structure: number;    // Max 25
  m15PullbackZone: number; // Max 15
  m5BreakRetest: number;   // Max 20
  m5Momentum: number;      // Max 10
  total: number;           // Max 100
  tier: 'VERY_STRONG' | 'STRONG' | 'WATCH' | 'NO_TRADE';
}

export interface SignalManagement {
  tp1_action: string;
  after_tp1: string;
  tp2_action: string;
  partial_close_pct?: number;
}

export interface SignalJSON {
  signal_id: string;
  symbol: string;
  signal: 'BUY' | 'SELL';
  status: SignalStatus;
  confidence: number;
  h1_trend: TrendDirection;
  m15_structure: StructureType;
  m15_setup: SetupState;
  m5_confirmation: EntryState;
  momentum: MomentumState;
  entry_timeframe: Timeframe;
  entry: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  risk_reward: string;
  timestamp: number;
  reasons: string[];
  management: SignalManagement;
  result?: 'TP1_HIT' | 'TP2_HIT' | 'SL_HIT' | 'RUNNING';
  r_multiple?: number;
  exit_price?: number;
  exit_timestamp?: number;
  duration_seconds?: number;
  strategy_id?: string;
  strategy_name?: string;
  tp1Hit?: boolean;
  pnl_usd?: number;
  realized_pnl_usd?: number;
  closedAt?: number;
  exitType?: 'SL' | 'TP1' | 'TP2';
}

export interface WaitJSON {
  signal: 'WAIT';
  status: 'NO_TRADE';
  reason: string[];
  h1_trend: TrendDirection;
  m15_structure: StructureType;
  m5_confirmation: string;
  timestamp: number;
  score?: number;
}

export interface TimeframeAnalysis {
  h1: {
    trend: TrendDirection;
    higherHighs: boolean;
    higherLows: boolean;
    ema20: number;
    ema50: number;
    recentHigh?: number;
    recentLow?: number;
  };
  m15: {
    structure: StructureType;
    setup: SetupState;
    pullbackZoneActive?: boolean;
    supportLevel: number;
    resistanceLevel: number;
    rejectionDetected: boolean;
  };
  m5: {
    entryStatus: EntryState;
    breakoutConfirmed: boolean;
    retestHeld: boolean;
    momentum: MomentumState;
    rsi: number;
    swingHigh: number;
    swingLow: number;
  };
  scoreBreakdown: ScoreBreakdown;
  recommendedAction: SignalType;
}

export interface PerformanceStats {
  totalSignals: number;
  winningSignals: number;
  losingSignals: number;
  winRate: number;
  averageR: number;
  profitFactor: number;
  maxDrawdown: number;
  tp1HitRate: number;
  tp2HitRate: number;
}

export interface DerivConnectionStatus {
  isConnected: boolean;
  isSubscribed: boolean;
  isLive: boolean;
  dataStatus: 'WAITING' | 'READY';
  stepIndexAvailable: boolean;
  lastTickTimestamp: number | null;
  lastTickTime: string | null;
  lastTickPrice: number | null;
  lastCandleTimestamp: number | null;
  activeSymbol: string;
  symbolDisplayName: string;
  h1Count: number;
  m15Count: number;
  m5Count: number;
  pingMs: number;
  reconnectAttempts: number;
  error: string | null;
}

