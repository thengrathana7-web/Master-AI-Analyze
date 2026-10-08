import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp, RefreshCw, CheckCircle2, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { DerivConnectionStatus } from '../types/market';

interface DerivDebugPanelProps {
  status: DerivConnectionStatus;
  onReconnect: () => void;
}

export const DerivDebugPanel: React.FC<DerivDebugPanelProps> = ({ status, onReconnect }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="w-full mb-4 rounded-2xl bg-slate-950/90 border border-cyan-500/40 p-3.5 shadow-xl font-mono text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-white tracking-wide">
            DERIV MARKET DATA ENGINE (REAL-TIME VERIFICATION)
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 ${
              status.isConnected && status.isLive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
            }`}
          >
            {status.isConnected && status.isLive ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                VERIFIED LIVE
              </>
            ) : status.isConnected ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                SUBSCRIBING...
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                DISCONNECTED
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onReconnect}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-sans font-semibold transition"
          >
            <RefreshCw className="w-3 h-3 text-cyan-400" />
            <span>Reconnect</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 transition"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-2.5 pt-1 text-[11px]">
          {/* 1. Deriv WebSocket */}
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold">
              Deriv WebSocket
            </div>
            <div
              className={`mt-1 font-bold flex items-center gap-1.5 ${
                status.isConnected ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {status.isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>CONNECTED</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>DISCONNECTED</span>
                </>
              )}
            </div>
          </div>

          {/* 2. Discovered Symbol */}
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold">
              Step Index Symbol
            </div>
            <div className="mt-1 font-bold text-cyan-300 truncate" title={status.activeSymbol}>
              {status.activeSymbol || 'Searching...'}
            </div>
            <div className="text-[9px] text-slate-400 truncate">
              {status.symbolDisplayName}
            </div>
          </div>

          {/* 3. Last Real Tick */}
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold">
              Last Tick Price
            </div>
            <div className="mt-1 font-extrabold text-white text-sm">
              {status.lastTickPrice !== null ? status.lastTickPrice.toFixed(2) : 'Awaiting tick...'}
            </div>
          </div>

          {/* 4. Last Tick Timestamp */}
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold">
              Last Tick Time
            </div>
            <div className="mt-1 font-medium text-slate-300">
              {status.lastTickTime || '---'}
            </div>
          </div>

          {/* 5. Historical Candles (H1, M15, M5) */}
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold">
              Historical Candles
            </div>
            <div className="mt-1 font-semibold text-slate-200">
              H1: <span className="text-cyan-400">{status.h1Count}</span> | M15: <span className="text-cyan-400">{status.m15Count}</span> | M5: <span className="text-cyan-400">{status.m5Count}</span>
            </div>
          </div>

          {/* 6. Data Status */}
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold">
              Data Status
            </div>
            <div
              className={`mt-1 font-bold uppercase ${
                status.dataStatus === 'READY' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {status.dataStatus === 'READY' ? 'READY (LIVE)' : 'WAITING FOR DATA'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
