import React, { useState } from 'react';
import { TrendingUp, ChevronDown, Check, Wifi, WifiOff } from 'lucide-react';
import { DerivConnectionStatus, DerivSymbol } from '../types/market';

interface HeaderProps {
  status: DerivConnectionStatus;
  symbols: DerivSymbol[];
  activeSymbol: string;
  onSelectSymbol: (symbol: string, displayName: string) => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  symbols,
  activeSymbol,
  onSelectSymbol,
  onOpenSettings,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fallback list if symbols not yet loaded from Deriv API
  const displaySymbols =
    symbols.length > 0
      ? symbols
      : [
          { symbol: 'stpRNG', displayName: 'Step Index', market: 'synthetic_index', submarket: 'step_index', isActive: true },
          { symbol: 'step_index_200', displayName: 'Step Index 200', market: 'synthetic_index', submarket: 'step_index', isActive: true },
          { symbol: 'step_index_500', displayName: 'Step Index 500', market: 'synthetic_index', submarket: 'step_index', isActive: true },
        ];

  const rawDisplay =
    displaySymbols.find((s) => s.symbol === activeSymbol)?.displayName ||
    status.symbolDisplayName ||
    'Step Index';

  const currentDisplay = rawDisplay === 'Step Index 100' ? 'Step Index' : rawDisplay;

  return (
    <header className="relative w-full pt-4 pb-3 px-4 md:px-6 border-b border-slate-800/80 bg-[#070d18]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Brand Zone */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <TrendingUp className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg md:text-xl font-extrabold tracking-tight text-white uppercase font-sans">
                STEP INDEX
              </h1>
            </div>
            <p className="text-[10px] md:text-xs font-semibold tracking-[0.2em] text-cyan-400 uppercase">
              AI ANALYSIS
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Deriv Connection Badge */}
          <div
            onClick={onOpenSettings}
            title={status.isConnected ? `Connected (Ping: ${status.pingMs}ms)` : 'Disconnected. Click to configure'}
            className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/60 text-xs font-medium transition hover:border-slate-600"
          >
            <span className="font-bold tracking-tight text-slate-300 lowercase text-[13px]">
              deriv
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  status.isConnected && status.isLive
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                    : status.isConnected
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
              <span
                className={`text-[11px] font-bold tracking-wide uppercase ${
                  status.isConnected && status.isLive
                    ? 'text-emerald-400'
                    : status.isConnected
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {status.isConnected && status.isLive ? 'LIVE' : status.isConnected ? 'SYNCING' : 'DISCONNECTED'}
              </span>
            </div>
          </div>

          {/* Symbol Dropdown Selector */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/60 hover:border-cyan-500/40 text-xs font-semibold text-slate-200 transition shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="truncate max-w-[110px] md:max-w-none">{currentDisplay}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 py-1.5 rounded-xl bg-[#0b1426] border border-slate-700/80 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    Deriv Step Symbols
                  </div>
                  {displaySymbols.map((item) => {
                    const isSelected = item.symbol === activeSymbol;
                    return (
                      <button
                        key={item.symbol}
                        onClick={() => {
                          onSelectSymbol(item.symbol, item.displayName);
                          setDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition ${
                          isSelected
                            ? 'bg-cyan-500/15 text-cyan-300 font-semibold'
                            : 'text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <div>
                          <div>{item.displayName}</div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {item.symbol}
                          </span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Subtitle Banner matching image.png */}
      <div className="max-w-5xl mx-auto mt-2 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[10px] md:text-[11px] font-medium tracking-wider text-slate-400 uppercase">
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <span className="text-cyan-400">REAL DATA FROM DERIV</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">SMART ANALYSIS</span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400">ACCURATE SIGNALS</span>
        </div>
        {status.pingMs > 0 && (
          <div className="hidden sm:flex items-center gap-1 text-slate-500 text-[10px] font-mono">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span>{status.pingMs}ms</span>
          </div>
        )}
      </div>
    </header>
  );
};
