import { Candle, Tick, DerivSymbol, DerivConnectionStatus, Timeframe, TIMEFRAME_GRANULARITIES } from '../types/market';

type TickListener = (tick: Tick) => void;
type CandleListener = (timeframe: Timeframe, candles: Candle[]) => void;
type StatusListener = (status: DerivConnectionStatus) => void;

export const TIMEFRAME_REQ_IDS: Record<Timeframe, number> = {
  H1: 1,
  M15: 2,
  M5: 3,
  M1: 4,
  M3: 5,
  M30: 6,
  H2: 7,
  '4H': 8,
  '1D': 9,
};

export const REQ_ID_TO_TF: Record<number, Timeframe> = {
  1: 'H1',
  2: 'M15',
  3: 'M5',
  4: 'M1',
  5: 'M3',
  6: 'M30',
  7: 'H2',
  8: '4H',
  9: '1D',
};

export class DerivService {
  private ws: WebSocket | null = null;
  // Official Deriv public WebSocket endpoint:
  private endpointBase: string = 'wss://api.derivws.com/trading/v1/options/ws/public';
  private appId: string = '1089';

  private activeSymbol: string = 'stpRNG';
  private symbolDisplayName: string = 'Step Index';
  private availableSymbols: DerivSymbol[] = [];

  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 50;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastPingSent: number = 0;
  private pingMs: number = 0;
  private lastStorageSaveTime: number = 0;

  // Stored candles for all 9 timeframes (M1, M3, M5, M15, M30, H1, H2, 4H, 1D)
  private candles: Record<Timeframe, Candle[]> = {
    M1: [],
    M3: [],
    M5: [],
    M15: [],
    M30: [],
    H1: [],
    H2: [],
    '4H': [],
    '1D': [],
  };

  private latestTick: Tick | null = null;
  private tickListeners: Set<TickListener> = new Set();
  private candleListeners: Set<CandleListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  private status: DerivConnectionStatus = {
    isConnected: false,
    isSubscribed: false,
    isLive: false,
    dataStatus: 'WAITING',
    stepIndexAvailable: true,
    lastTickTimestamp: null,
    lastTickTime: null,
    lastTickPrice: null,
    lastCandleTimestamp: null,
    activeSymbol: 'stpRNG',
    symbolDisplayName: 'Step Index',
    h1Count: 0,
    m15Count: 0,
    m5Count: 0,
    pingMs: 0,
    reconnectAttempts: 0,
    error: null,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      const savedSymbol = localStorage.getItem('DERIV_ACTIVE_SYMBOL');
      if (savedSymbol) this.activeSymbol = savedSymbol;

      // 1. Immediately restore cached historical candles from storage
      // This ensures candles are NEVER LOST even if phone is closed/updated/reloaded!
      this.loadAllCachedCandles(this.activeSymbol);

      // 2. Persist candles when app goes to background / phone locks / page unloads
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.saveCandlesToStorage();
        } else if (document.visibilityState === 'visible') {
          // Reconnect if connection was closed in sleep/background
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('[DerivService] App resumed from background/sleep, checking connection...');
            this.connect();
          }
        }
      });

      window.addEventListener('beforeunload', () => {
        this.saveCandlesToStorage();
      });
    }
  }

  private getStorageKey(symbol: string, tf: Timeframe): string {
    return `STEP_INDEX_CANDLES_${symbol}_${tf}`;
  }

  /**
   * Restores cached candles from localStorage so chart never appears empty
   */
  public loadAllCachedCandles(symbol: string) {
    if (typeof window === 'undefined') return;
    try {
      let hasAny = false;
      (Object.keys(TIMEFRAME_GRANULARITIES) as Timeframe[]).forEach((tf) => {
        const key = this.getStorageKey(symbol, tf);
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const list = JSON.parse(raw);
            if (Array.isArray(list) && list.length > 0) {
              this.candles[tf] = list;
              hasAny = true;
            }
          } catch {
            // ignore bad json
          }
        }
      });

      if (hasAny) {
        console.log(`[DerivService] 💾 Restored cached historical candles from localStorage for ${symbol}`);
        this.updateCandleCounts();
        const m5 = this.candles.M5;
        if (m5.length > 0) {
          const last = m5[m5.length - 1];
          this.status.lastCandleTimestamp = last.epoch * 1000;
          this.status.lastTickPrice = last.close;
        }
      }
    } catch (err) {
      console.warn('[DerivService] Failed to restore cached candles:', err);
    }
  }

  /**
   * Persists historical and real-time candles permanently into localStorage
   */
  public saveCandlesToStorage(symbol?: string, tf?: Timeframe) {
    if (typeof window === 'undefined') return;
    const targetSymbol = symbol || this.activeSymbol;
    try {
      if (tf) {
        const list = this.candles[tf] || [];
        if (list.length > 0) {
          const key = this.getStorageKey(targetSymbol, tf);
          localStorage.setItem(key, JSON.stringify(list.slice(-250)));
        }
      } else {
        (Object.keys(TIMEFRAME_GRANULARITIES) as Timeframe[]).forEach((t) => {
          const list = this.candles[t] || [];
          if (list.length > 0) {
            const key = this.getStorageKey(targetSymbol, t);
            localStorage.setItem(key, JSON.stringify(list.slice(-250)));
          }
        });
      }
    } catch (err) {
      // ignore storage quota limit errors
    }
  }

  public getStatus(): DerivConnectionStatus {
    return { ...this.status };
  }

  public getCandles(timeframe: Timeframe): Candle[] {
    return [...(this.candles[timeframe] || [])];
  }

  public getLatestTick(): Tick | null {
    return this.latestTick;
  }

  public getAvailableSymbols(): DerivSymbol[] {
    return [...this.availableSymbols];
  }

  public setSymbol(symbol: string, displayName?: string) {
    if (this.activeSymbol === symbol && this.symbolDisplayName === (displayName || symbol)) return;
    
    // Save current symbol candles before switching
    this.saveCandlesToStorage();

    // Clean name: change "Step Index 100" to "Step Index"
    let cleanName = displayName || symbol;
    if (symbol === 'stpRNG' || cleanName.toLowerCase() === 'step index 100') {
      cleanName = 'Step Index';
    }

    console.log(`[DerivService] Switching symbol to: ${symbol} (${cleanName})`);
    this.activeSymbol = symbol;
    this.symbolDisplayName = cleanName;
    this.status.activeSymbol = symbol;
    this.status.symbolDisplayName = cleanName;
    this.status.isLive = false;
    this.status.dataStatus = 'WAITING';
    this.status.lastTickPrice = null;
    this.latestTick = null;

    if (typeof window !== 'undefined') {
      localStorage.setItem('DERIV_ACTIVE_SYMBOL', symbol);
    }

    // Load cached candles for the newly selected symbol
    this.loadAllCachedCandles(symbol);
    this.updateCandleCounts();
    this.notifyStatus();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.subscribeMarketData();
    }
  }

  public setAppId(appId: string) {
    this.appId = appId;
    this.disconnect();
    this.connect();
  }

  public onTick(listener: TickListener): () => void {
    this.tickListeners.add(listener);
    return () => this.tickListeners.delete(listener);
  }

  public onCandles(listener: CandleListener): () => void {
    this.candleListeners.add(listener);
    return () => this.candleListeners.delete(listener);
  }

  public onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatus() {
    const s = this.getStatus();
    this.statusListeners.forEach((l) => l(s));
  }

  private notifyTick(tick: Tick) {
    this.tickListeners.forEach((l) => l(tick));
  }

  private notifyCandles(timeframe: Timeframe) {
    const list = this.candles[timeframe] || [];
    this.candleListeners.forEach((l) => l(timeframe, [...list]));
  }

  private updateCandleCounts() {
    this.status.h1Count = this.candles.H1.length;
    this.status.m15Count = this.candles.M15.length;
    this.status.m5Count = this.candles.M5.length;

    if (
      this.status.isConnected &&
      this.status.isLive &&
      this.status.h1Count >= 10 &&
      this.status.m15Count >= 10 &&
      this.status.m5Count >= 10 &&
      this.status.lastTickPrice !== null
    ) {
      this.status.dataStatus = 'READY';
    } else {
      this.status.dataStatus = 'WAITING';
    }
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    this.status.error = null;
    this.notifyStatus();

    const fullUrl = `${this.endpointBase}?app_id=${this.appId}`;
    console.log(`[DerivService] Connecting to Deriv official public WebSocket: ${fullUrl}`);

    try {
      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => {
        console.log('[DerivService] ✅ 1. WebSocket connected to Deriv official public market data stream');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.status.isConnected = true;
        this.status.reconnectAttempts = 0;
        this.status.error = null;
        this.notifyStatus();
        this.startPing();

        // STEP 1: Request active_symbols dynamically (NO product_type property)
        console.log('[DerivService] 📡 Requesting active_symbols from Deriv...');
        this.send({ active_symbols: 'brief' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (err) {
          console.error('[DerivService] Error parsing WebSocket message:', err);
        }
      };

      this.ws.onclose = (event) => {
        console.warn(`[DerivService] 🔴 Deriv WebSocket disconnected (code: ${event.code}, reason: ${event.reason || 'Network drop'})`);
        this.handleDisconnect('Deriv WebSocket disconnected');
      };

      this.ws.onerror = (err) => {
        console.error('[DerivService] ❌ Deriv WebSocket connection error:', err);
        this.handleDisconnect('Deriv connection error');
      };
    } catch (e: any) {
      this.handleDisconnect(e?.message || 'Failed to initialize WebSocket');
    }
  }

  private handleDisconnect(reason: string) {
    this.isConnecting = false;
    this.status.isConnected = false;
    this.status.isSubscribed = false;
    this.status.isLive = false;
    this.status.dataStatus = 'WAITING';
    this.status.error = reason;
    this.stopPing();
    this.notifyStatus();

    // Persist candles on disconnect
    this.saveCandlesToStorage();

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.status.reconnectAttempts = this.reconnectAttempts;
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
      console.log(`[DerivService] Auto-reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})...`);
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    }
  }

  public disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopPing();
    this.saveCandlesToStorage();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    this.status.isConnected = false;
    this.status.isSubscribed = false;
    this.status.isLive = false;
    this.status.dataStatus = 'WAITING';
    this.notifyStatus();
  }

  private send(payload: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.lastPingSent = Date.now();
      this.send({ ping: 1 });
    }, 25000);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Fetch historical candles for any requested timeframe using valid integer req_id
   */
  public fetchCandlesForTimeframe(timeframe: Timeframe, count: number = 100) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const granularity = TIMEFRAME_GRANULARITIES[timeframe] || 300;
    const reqId = TIMEFRAME_REQ_IDS[timeframe] || 1;

    console.log(`[DerivService] Requesting ${count} candles for ${this.activeSymbol} (${timeframe}, gran: ${granularity}s, req_id: ${reqId})...`);
    this.send({
      ticks_history: this.activeSymbol,
      style: 'candles',
      granularity,
      count,
      end: 'latest',
      req_id: reqId,
    });
  }

  private subscribeMarketData() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.activeSymbol) return;

    console.log(`[DerivService] 🔄 Subscribing to market data for ${this.activeSymbol}...`);
    this.send({ forget_all: 'ticks' });

    // Request primary operational candles with valid integer req_ids
    this.fetchCandlesForTimeframe('H1', 100);
    this.fetchCandlesForTimeframe('M15', 100);
    this.fetchCandlesForTimeframe('M5', 100);
    this.fetchCandlesForTimeframe('M1', 100);

    // Also fetch extended timeframes
    this.fetchCandlesForTimeframe('M3', 100);
    this.fetchCandlesForTimeframe('M30', 100);
    this.fetchCandlesForTimeframe('H2', 100);
    this.fetchCandlesForTimeframe('4H', 100);
    this.fetchCandlesForTimeframe('1D', 100);

    // Subscribe to live ticks
    console.log(`[DerivService] 📥 Subscribing to live ticks for ${this.activeSymbol}...`);
    this.send({
      ticks: this.activeSymbol,
      subscribe: 1,
    });

    this.status.isSubscribed = true;
    this.notifyStatus();
  }

  private handleMessage(data: any) {
    if (data.msg_type === 'ping') {
      if (this.lastPingSent > 0) {
        this.pingMs = Date.now() - this.lastPingSent;
        this.status.pingMs = this.pingMs;
        this.notifyStatus();
      }
      return;
    }

    // STEP 2 & 3: active_symbols response & Step Index discovery
    if (data.msg_type === 'active_symbols' && Array.isArray(data.active_symbols)) {
      console.log(`[DerivService] ✅ 2. active_symbols response received: ${data.active_symbols.length} total symbols`);
      
      const stepSymbols: DerivSymbol[] = [];

      for (const item of data.active_symbols) {
        const sym = item.underlying_symbol || item.symbol || '';
        let name = item.underlying_symbol_name || item.display_name || sym;
        const submarket = (item.submarket || '').toLowerCase();
        const symLower = sym.toLowerCase();
        const nameLower = name.toLowerCase();

        const isStep =
          submarket === 'step_index' ||
          symLower.includes('step') ||
          nameLower.includes('step') ||
          sym === 'stpRNG' ||
          sym.startsWith('stpRNG');

        if (isStep) {
          // Normalize display name: for primary stpRNG, use "Step Index"
          if (sym === 'stpRNG' || name.toLowerCase() === 'step index 100') {
            name = 'Step Index';
          }

          stepSymbols.push({
            symbol: sym,
            displayName: name,
            market: item.market,
            submarket: item.submarket,
            isActive: item.exchange_is_open === 1 && !item.is_trading_suspended,
          });
        }
      }

      if (stepSymbols.length === 0) {
        console.error('[DerivService] ❌ STEP INDEX NOT AVAILABLE in Deriv active_symbols list');
        this.status.stepIndexAvailable = false;
        this.status.symbolDisplayName = 'STEP INDEX NOT AVAILABLE';
        this.notifyStatus();
        return;
      }

      this.status.stepIndexAvailable = true;
      this.availableSymbols = stepSymbols;

      // Select Step Index (default stpRNG = Step Index)
      let chosen = stepSymbols.find((s) => s.symbol === this.activeSymbol);
      if (!chosen) {
        chosen = stepSymbols.find((s) => s.symbol === 'stpRNG') || stepSymbols[0];
      }

      this.activeSymbol = chosen.symbol;
      this.symbolDisplayName = chosen.displayName === 'Step Index 100' ? 'Step Index' : chosen.displayName;
      this.status.activeSymbol = chosen.symbol;
      this.status.symbolDisplayName = this.symbolDisplayName;

      console.log(`[DerivService] ✅ 3 & 4. Selected Step Index Symbol: "${this.activeSymbol}" (${this.symbolDisplayName})`);

      // STEP 5: Subscribe to ticks and candles for discovered symbol
      this.subscribeMarketData();
      return;
    }

    // Historical candles response from Deriv
    if (data.msg_type === 'candles' && Array.isArray(data.candles)) {
      const reqId = Number(data.echo_req?.req_id);
      const granularity = Number(data.echo_req?.granularity);
      
      let tf: Timeframe = 'M5';
      if (reqId && REQ_ID_TO_TF[reqId]) {
        tf = REQ_ID_TO_TF[reqId];
      } else {
        const matchedEntry = Object.entries(TIMEFRAME_GRANULARITIES).find(([_, g]) => g === granularity);
        if (matchedEntry) tf = matchedEntry[0] as Timeframe;
      }

      const parsed: Candle[] = data.candles.map((c: any) => ({
        epoch: Number(c.epoch),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }));

      // Combine existing cached candles and newly loaded candles by epoch to avoid overwrites
      const existing = this.candles[tf] || [];
      const map = new Map<number, Candle>();
      existing.forEach((c) => map.set(c.epoch, c));
      parsed.forEach((c) => {
        if (!map.has(c.epoch)) {
          map.set(c.epoch, c);
        } else {
          // Update high/low/close from Deriv
          const prev = map.get(c.epoch)!;
          prev.high = Math.max(prev.high, c.high);
          prev.low = Math.min(prev.low, c.low);
          prev.close = c.close;
        }
      });

      const merged = Array.from(map.values()).sort((a, b) => a.epoch - b.epoch);
      // Keep up to 250 historical candles
      this.candles[tf] = merged.slice(-250);
      this.status.lastCandleTimestamp = Date.now();
      
      // Save to localStorage immediately so candles are never lost
      this.saveCandlesToStorage(this.activeSymbol, tf);

      console.log(`[DerivService] ✅ ${tf} Candles Loaded & Saved: ${this.candles[tf].length} candles (Last Close: ${merged[merged.length - 1]?.close})`);

      this.updateCandleCounts();
      this.notifyCandles(tf);
      this.notifyStatus();
      return;
    }

    // Real-time tick update
    if (data.msg_type === 'tick' && data.tick) {
      const t = data.tick;
      const quote = Number(t.quote);
      const epoch = Number(t.epoch);

      const tick: Tick = {
        epoch,
        quote,
        symbol: t.symbol,
        ask: t.ask ? Number(t.ask) : undefined,
        bid: t.bid ? Number(t.bid) : undefined,
      };

      this.latestTick = tick;
      this.status.lastTickTimestamp = Date.now();
      this.status.lastTickTime = new Date(epoch * 1000).toLocaleTimeString();
      this.status.lastTickPrice = quote;
      this.status.isLive = true;

      // Update forming candles deterministically across all 9 timeframes
      this.updateCandlesWithTick(tick);
      this.updateCandleCounts();

      this.notifyTick(tick);
      this.notifyStatus();
      return;
    }

    if (data.error) {
      console.warn('[DerivService] Deriv API returned error:', data.error.message);
      this.status.error = data.error.message;
      this.notifyStatus();
    }
  }

  /**
   * Deterministic real-time candle building using incoming tick data for all 9 timeframes
   */
  private updateCandlesWithTick(tick: Tick) {
    let didCloseCandle = false;

    (Object.entries(TIMEFRAME_GRANULARITIES) as [Timeframe, number][]).forEach(([tf, seconds]) => {
      const list = this.candles[tf];
      if (!list) return;

      const candleEpoch = Math.floor(tick.epoch / seconds) * seconds;

      if (list.length === 0) {
        list.push({
          epoch: candleEpoch,
          open: tick.quote,
          high: tick.quote,
          low: tick.quote,
          close: tick.quote,
        });
        this.notifyCandles(tf);
      } else {
        const last = list[list.length - 1];
        if (last.epoch === candleEpoch) {
          // Update current active forming candle
          last.high = Math.max(last.high, tick.quote);
          last.low = Math.min(last.low, tick.quote);
          last.close = tick.quote;
          this.notifyCandles(tf);
        } else if (candleEpoch > last.epoch) {
          // Current candle closed, open new candle
          list.push({
            epoch: candleEpoch,
            open: tick.quote,
            high: tick.quote,
            low: tick.quote,
            close: tick.quote,
          });
          if (list.length > 250) list.shift();
          didCloseCandle = true;
          this.notifyCandles(tf);
        }
      }
    });

    // Save to localStorage whenever a candle closes, or every 15 seconds
    const now = Date.now();
    if (didCloseCandle || now - this.lastStorageSaveTime > 15000) {
      this.lastStorageSaveTime = now;
      this.saveCandlesToStorage();
    }
  }
}

export const derivService = new DerivService();
export default derivService;
