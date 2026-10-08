import { Candle, SignalJSON, WaitJSON, TimeframeAnalysis, SignalType, Timeframe } from '../types/market';

/**
 * Trade Lifecycle State matching execution rules
 */
export interface TradeLifecycleState {
  isActiveTrade: boolean;
  tp1Hit: boolean;
  tp2Hit: boolean;
  slHit: boolean;
  confirmationScore: number; // 0 to 100
  lockedTrade?: SignalJSON | null;
}

/**
 * Standard Strategy Analysis Result requested by architectural specification
 */
export interface StrategyAnalysisResult {
  signal: 'BUY' | 'SELL' | 'WAIT';
  signalStrength: number;
  marketStatus: string;
  analysisNotes: string[];
  entry: number | null;
  stopLoss: number | null;
  tp1: number | null;
  tp2: number | null;
  timestamp?: number;
  // Trade lifecycle state
  isActiveTrade: boolean;
  tp1Hit: boolean;
  tp2Hit: boolean;
  slHit: boolean;
  confirmationScore: number;
}

/**
 * Active Trade tracking instance for an independent strategy
 */
export interface ActiveTrade {
  signalId: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  signal: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward: string;
  entryTimestamp: number;
  timeframe: Timeframe;
  tp1Hit: boolean;
  tp1Timestamp?: number;
  highestPriceReached: number;
  lowestPriceReached: number;
  currentPips: number;
  currentProfitUsd: number;
  closedAt?: number;
  exitType?: 'SL' | 'TP1' | 'TP2';
  reasons: string[];
}

/**
 * Core Strategy interface specified by architectural requirements
 */
export interface Strategy {
  id: string;
  name: string;
  winRate: string;
  riskReward: string;
  description: string;
  indicators: string[];
  rules: string[];
  soundEnabled?: boolean;
  analyze: (marketData: any) => StrategyAnalysisResult;
}

/**
 * Detailed Strategy Evaluation Result containing deep timeframe analysis and signal payloads
 */
export interface StrategyEvaluationResult {
  decision: SignalType;
  signal?: SignalJSON;
  wait?: WaitJSON;
  score: number;
  analysis: TimeframeAnalysis;
  lifecycle?: TradeLifecycleState;
}

/**
 * Full Trading Strategy with multi-timeframe evaluation & metadata
 */
export interface TradingStrategy extends Strategy {
  shortName: string;
  version: string;
  author: string;
  descriptionKh: string;
  descriptionEn: string;
  targetAsset: string;
  timeframes: Timeframe[];
  expectedWinRate: string;
  setupType: string;
  executionRules: string[];
  soundEnabled?: boolean;
  evaluate: (
    symbol: string,
    candlesMap: Record<Timeframe, Candle[]>,
    currentPrice: number
  ) => StrategyEvaluationResult;
}
