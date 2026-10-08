/**
 * STEP INDEX MASTER AI
 * 
 * Real-time Step Index market analysis and quantitative signal generation
 * using REAL Deriv market data. Multi-Strategy Algorithmic Suite.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { derivService } from './services/derivService';
import { useStrategy } from './context/StrategyContext';
import { useSignalEngine } from './hooks/useSignalEngine';
import {
  Tick,
  Candle,
  Timeframe,
  DerivConnectionStatus,
  DerivSymbol,
} from './types/market';

import { Header } from './components/Header';
import { MarketMetricsBar } from './components/MarketMetricsBar';
import { SignalHeroCard } from './components/SignalHeroCard';
import { CandlestickChart } from './components/CandlestickChart';
import { TradeStatusBar } from './components/TradeStatusBar';
import { TimeframeAnalysisPanel } from './components/TimeframeAnalysisPanel';
import { SignalJournal } from './components/SignalJournal';
import { SettingsPanel } from './components/SettingsPanel';
import { DerivDebugPanel } from './components/DerivDebugPanel';
import { Analysis } from './components/Analysis';
import { BottomNav, NavTab } from './components/BottomNav';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('M5');
  const { activeStrategy, setActiveStrategyId, setStrategyResult } = useStrategy();
  const [derivStatus, setDerivStatus] = useState<DerivConnectionStatus>(derivService.getStatus());
  const [symbols, setSymbols] = useState<DerivSymbol[]>([]);
  
  const [latestTick, setLatestTick] = useState<Tick | null>(() => derivService.getLatestTick());
  const [prevTick, setPrevTick] = useState<Tick | null>(null);
  
  const [candlesM1, setCandlesM1] = useState<Candle[]>(() => derivService.getCandles('M1'));
  const [candlesM5, setCandlesM5] = useState<Candle[]>(() => derivService.getCandles('M5'));
  const [candlesM15, setCandlesM15] = useState<Candle[]>(() => derivService.getCandles('M15'));
  const [candlesH1, setCandlesH1] = useState<Candle[]>(() => derivService.getCandles('H1'));
  const [candleVersion, setCandleVersion] = useState<number>(0);

  // Initialize Telegram WebApp SDK if embedded in Telegram
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      tg.expand();
    }
  }, []);

  // Connect to Deriv WebSocket and subscribe to data listeners
  useEffect(() => {
    derivService.connect();

    const unsubStatus = derivService.onStatus((status) => {
      setDerivStatus(status);
      setSymbols(derivService.getAvailableSymbols());
    });

    const unsubTick = derivService.onTick((tick) => {
      setLatestTick((prev) => {
        setPrevTick(prev);
        return tick;
      });
    });

    const unsubCandles = (tf: Timeframe, candleList: Candle[]) => {
      if (tf === 'M1') setCandlesM1(candleList);
      else if (tf === 'M5') setCandlesM5(candleList);
      else if (tf === 'M15') setCandlesM15(candleList);
      else if (tf === 'H1') setCandlesH1(candleList);
      setCandleVersion((v) => v + 1);
    };
    const unsubCandlesListener = derivService.onCandles(unsubCandles);

    return () => {
      unsubStatus();
      unsubTick();
      unsubCandlesListener();
    };
  }, []);

  // Multi-timeframe candle map for strategy evaluation
  const candlesMap = useMemo(() => {
    return {
      M1: candlesM1.length > 0 ? candlesM1 : derivService.getCandles('M1'),
      M3: derivService.getCandles('M3'),
      M5: candlesM5.length > 0 ? candlesM5 : derivService.getCandles('M5'),
      M15: candlesM15.length > 0 ? candlesM15 : derivService.getCandles('M15'),
      M30: derivService.getCandles('M30'),
      H1: candlesH1.length > 0 ? candlesH1 : derivService.getCandles('H1'),
      H2: derivService.getCandles('H2'),
      '4H': derivService.getCandles('4H'),
      '1D': derivService.getCandles('1D'),
    };
  }, [candlesM1, candlesM5, candlesM15, candlesH1, candleVersion]);

  // Unified Quantitative Signal Engine Hook:
  // - Strict 100% confirmation threshold
  // - Active trade execution lock (no premature resets)
  // - TP1 hit -> Trail SL to BE, remain ACTIVE
  // - Terminal exit at TP2 or SL -> save to permanent journal, unlock trade & return to WAIT
  // - Independent active trade state per strategy
  const {
    activeSignal,
    decision,
    signal,
    waitStatus,
    analysis,
    strategyResult,
    signalHistory,
    clearJournalHistory,
  } = useSignalEngine({
    activeStrategy,
    activeSymbol: derivStatus.activeSymbol,
    latestTick,
    candlesMap,
    isConnected: derivStatus.isConnected,
    isLive: derivStatus.isLive,
    dataStatus: derivStatus.dataStatus,
  });

  // Synchronize StrategyContext with current strategy evaluation
  useEffect(() => {
    setStrategyResult(strategyResult);
  }, [strategyResult, setStrategyResult]);

  // Handle symbol change
  const handleSelectSymbol = (sym: string, displayName: string) => {
    derivService.setSymbol(sym, displayName);
  };

  // Handle strategy change
  const handleSelectStrategy = (id: string) => {
    setActiveStrategyId(id);
  };

  // Reconnect handler
  const handleReconnect = () => {
    derivService.disconnect();
    derivService.connect();
  };

  // Active candles for chart display based on selected timeframe (supports all 9 timeframes)
  const currentChartCandles = useMemo(() => {
    return derivService.getCandles(activeTimeframe);
  }, [activeTimeframe, candleVersion, latestTick, derivStatus.lastCandleTimestamp]);

  // Timeframe change handler: updates active timeframe and immediately requests fresh candles from Deriv
  const handleTimeframeChange = (tf: Timeframe) => {
    setActiveTimeframe(tf);
    derivService.fetchCandlesForTimeframe(tf, 100);
  };

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-100 flex flex-col pb-24">
      {/* Top Header */}
      <Header
        status={derivStatus}
        symbols={symbols}
        activeSymbol={derivStatus.activeSymbol}
        onSelectSymbol={handleSelectSymbol}
        onOpenSettings={() => setActiveTab('settings')}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-6 pt-2">
        {/* Real Data Engine Verification Debug Panel */}
        <DerivDebugPanel status={derivStatus} onReconnect={handleReconnect} />

        {/* Top 3 Metric Cards */}
        <MarketMetricsBar
          tick={latestTick}
          prevTick={prevTick}
          analysis={analysis}
          activeTimeframe={activeTimeframe}
          lastUpdateEpoch={derivStatus.lastTickTimestamp || derivStatus.lastCandleTimestamp}
          isConnected={derivStatus.isConnected && derivStatus.isLive}
        />

        {/* Tab: HOME (Main Trading View) - Dynamically recalibrated by active strategy */}
        {activeTab === 'home' && (
          <>
            {/* AI Signal Hero Card */}
            <SignalHeroCard
              decision={activeSignal ? activeSignal.signal : decision}
              signal={activeSignal || signal}
              wait={waitStatus}
              analysis={analysis}
              currentPrice={latestTick?.quote || 0}
              activeStrategy={activeStrategy}
              onNavigateToStrategies={() => setActiveTab('analysis')}
            />

            {/* Trade Status Bar */}
            <TradeStatusBar
              activeSignal={activeSignal}
              latestTick={latestTick}
            />

            {/* Multi-Timeframe Analysis Breakdown */}
            <TimeframeAnalysisPanel analysis={analysis} />
          </>
        )}

        {/* Tab: CHART (Dedicated MT5 Candlestick Chart with active strategy technical overlays) */}
        {activeTab === 'chart' && (
          <div className="py-2">
            <CandlestickChart
              candles={currentChartCandles}
              timeframe={activeTimeframe}
              onTimeframeChange={handleTimeframeChange}
              activeSignal={activeSignal || signal}
              symbol={derivStatus.symbolDisplayName || derivStatus.activeSymbol}
              currentPrice={latestTick?.quote || undefined}
              activeStrategy={activeStrategy}
            />
            <TradeStatusBar
              activeSignal={activeSignal}
              latestTick={latestTick}
            />
            <TimeframeAnalysisPanel analysis={analysis} />
          </div>
        )}

        {/* Tab: ANALYSIS (Multi-Strategy Suite & Switcher) */}
        {activeTab === 'analysis' && (
          <div className="py-2">
            <Analysis
              activeStrategy={activeStrategy}
              onSelectStrategy={handleSelectStrategy}
              analysis={analysis}
            />
          </div>
        )}

        {/* Tab: JOURNAL (Strategy-Specific Journal & Performance) */}
        {activeTab === 'journal' && (
          <div className="py-2">
            <SignalJournal
              signals={signalHistory}
              onClearHistory={clearJournalHistory}
              activeStrategy={activeStrategy}
            />
          </div>
        )}

        {/* Tab: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="py-2">
            <SettingsPanel
              derivStatus={derivStatus}
              onReconnectDeriv={handleReconnect}
              onUpdateAppId={(id) => derivService.setAppId(id)}
            />
          </div>
        )}
      </main>

      {/* Bottom Mobile-First Navigation Bar */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
