import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { TradingStrategy, AVAILABLE_STRATEGIES, StrategyAnalysisResult, strategyManager } from '../strategies';
import { AppStorage } from '../utils/storage';
import { soundAlert } from '../utils/soundAlert';

interface StrategyContextType {
  activeStrategyId: string;
  activeStrategy: TradingStrategy;
  availableStrategies: TradingStrategy[];
  setActiveStrategyId: (id: string) => void;
  strategyResult: StrategyAnalysisResult | null;
  setStrategyResult: (result: StrategyAnalysisResult | null) => void;
  // Sound alert management per strategy
  strategySoundSettings: Record<string, boolean>;
  isStrategySoundEnabled: (strategyId: string) => boolean;
  toggleStrategySound: (strategyId: string) => void;
}

const StrategyContext = createContext<StrategyContextType | undefined>(undefined);

export const StrategyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeStrategyId, setActiveStrategyIdState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('SELECTED_STRATEGY_ID');
      if (saved && AVAILABLE_STRATEGIES.some((s) => s.id === saved)) {
        return saved;
      }
    }
    return strategyManager.getActiveStrategy().id;
  });

  const [strategyResult, setStrategyResult] = useState<StrategyAnalysisResult | null>(null);

  // Sound settings map per strategy id (defaults to true if unset)
  const [strategySoundSettings, setStrategySoundSettings] = useState<Record<string, boolean>>(() => {
    return AppStorage.loadStrategySoundSettings();
  });

  // Query whether sound is enabled for a given strategy (default: true)
  const isStrategySoundEnabled = useCallback(
    (strategyId: string): boolean => {
      return strategySoundSettings[strategyId] !== false;
    },
    [strategySoundSettings]
  );

  // Toggle sound alert setting for a specific strategy
  const toggleStrategySound = useCallback(
    (strategyId: string) => {
      setStrategySoundSettings((prev) => {
        const current = prev[strategyId] !== false; // defaults to true
        const nextState = !current;
        const updated = { ...prev, [strategyId]: nextState };

        AppStorage.saveStrategySoundSettings(updated);

        // If toggling ON, play a subtle tactile confirmation chime and unlock AudioContext
        if (nextState) {
          soundAlert.playAlert('TEST');
        }

        console.log(`[StrategyContext] 🔊 Sound alert for ${strategyId}: ${nextState ? 'ENABLED' : 'MUTED'}`);
        return updated;
      });
    },
    []
  );

  // Available strategies enriched with current soundEnabled status
  const availableStrategies = useMemo(() => {
    return AVAILABLE_STRATEGIES.map((s) => ({
      ...s,
      soundEnabled: strategySoundSettings[s.id] !== false,
    }));
  }, [strategySoundSettings]);

  // Active strategy object enriched with soundEnabled
  const activeStrategy = useMemo(() => {
    const found = availableStrategies.find((s) => s.id === activeStrategyId);
    return found || availableStrategies[0];
  }, [availableStrategies, activeStrategyId]);

  // Synchronize active strategy switch
  const setActiveStrategyId = useCallback((id: string) => {
    if (!AVAILABLE_STRATEGIES.some((s) => s.id === id)) return;
    setActiveStrategyIdState(id);
    strategyManager.setActiveStrategy(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('SELECTED_STRATEGY_ID', id);
    }
    console.log(`[StrategyContext] 🔄 Switched active strategy to: ${id}`);
  }, []);

  // Listen to external strategyManager events if any
  useEffect(() => {
    const unsub = strategyManager.onStrategyChange((strat) => {
      if (strat.id !== activeStrategyId) {
        setActiveStrategyIdState(strat.id);
      }
    });
    return unsub;
  }, [activeStrategyId]);

  const value = useMemo(
    () => ({
      activeStrategyId,
      activeStrategy,
      availableStrategies,
      setActiveStrategyId,
      strategyResult,
      setStrategyResult,
      strategySoundSettings,
      isStrategySoundEnabled,
      toggleStrategySound,
    }),
    [
      activeStrategyId,
      activeStrategy,
      availableStrategies,
      setActiveStrategyId,
      strategyResult,
      strategySoundSettings,
      isStrategySoundEnabled,
      toggleStrategySound,
    ]
  );

  return <StrategyContext.Provider value={value}>{children}</StrategyContext.Provider>;
};

export const useStrategy = (): StrategyContextType => {
  const context = useContext(StrategyContext);
  if (!context) {
    throw new Error('useStrategy must be used within a StrategyProvider');
  }
  return context;
};
