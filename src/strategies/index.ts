import { TradingStrategy } from './types';
import { strategy1_break_retest } from './strategy1_break_retest';
import { strategy2_ema_trend_rider } from './strategy2_ema_trend_rider';
import { strategy3_liquidity_sweep } from './strategy3_liquidity_sweep';
import { strategy4_step_scalper } from './strategy4_step_scalper';

/**
 * STRATEGY REGISTRY
 * 
 * To add a new strategy in the future:
 * 1. Create a new file in src/strategies/ (e.g. strategy5_custom.ts)
 * 2. Implement the TradingStrategy interface
 * 3. Add it to the AVAILABLE_STRATEGIES array below!
 */
export const AVAILABLE_STRATEGIES: TradingStrategy[] = [
  strategy1_break_retest,
  strategy2_ema_trend_rider,
  strategy3_liquidity_sweep,
  strategy4_step_scalper,
];

class StrategyManager {
  private activeStrategyId: string = 'strategy1_break_retest';
  private listeners: Set<(strategy: TradingStrategy) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('SELECTED_STRATEGY_ID');
      if (saved && AVAILABLE_STRATEGIES.some((s) => s.id === saved)) {
        this.activeStrategyId = saved;
      }
    }
  }

  public getAllStrategies(): TradingStrategy[] {
    return [...AVAILABLE_STRATEGIES];
  }

  public getActiveStrategy(): TradingStrategy {
    const found = AVAILABLE_STRATEGIES.find((s) => s.id === this.activeStrategyId);
    return found || AVAILABLE_STRATEGIES[0];
  }

  public setActiveStrategy(id: string) {
    if (!AVAILABLE_STRATEGIES.some((s) => s.id === id)) return;
    this.activeStrategyId = id;
    if (typeof window !== 'undefined') {
      localStorage.setItem('SELECTED_STRATEGY_ID', id);
    }
    const current = this.getActiveStrategy();
    this.listeners.forEach((l) => l(current));
  }

  public onStrategyChange(listener: (strategy: TradingStrategy) => void): () => void {
    this.listeners.add(listener);
    listener(this.getActiveStrategy());
    return () => this.listeners.delete(listener);
  }
}

export const strategyManager = new StrategyManager();
export * from './types';
export {
  strategy1_break_retest,
  strategy2_ema_trend_rider,
  strategy3_liquidity_sweep,
  strategy4_step_scalper,
};
