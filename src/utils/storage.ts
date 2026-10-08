/**
 * STEP INDEX MASTER AI - Persistent Storage Engine
 * 
 * Provides unified, redundant persistence across IndexedDB and LocalStorage.
 * Retains trade journal entries for up to 12 months (365 days).
 * Includes precision Step Index financial PnL calculations.
 */

import { SignalJSON } from '../types/market';

const DB_NAME = 'StepIndexMasterDB';
const DB_VERSION = 1;
const STORE_JOURNAL = 'trade_journal';
const STORE_ACTIVE_TRADES = 'active_trades';

const RETENTION_MS = 365 * 24 * 60 * 60 * 1000; // 365 Days (12 Months)

/**
 * Deriv Step Index Financial Calculation Rule:
 * 1.00 index point with 0.10 Lot size equals exactly $1.00 USD.
 * Formula:
 * For BUY:  (ExitPrice - EntryPrice) * (LotSize * 10)
 * For SELL: (EntryPrice - ExitPrice) * (LotSize * 10)
 */
export function calculateStepIndexPnl(
  signal: 'BUY' | 'SELL',
  entryPrice: number,
  exitPrice: number,
  lotSize: number = 0.10
): number {
  const priceDiff = signal === 'BUY' ? exitPrice - entryPrice : entryPrice - exitPrice;
  const multiplier = lotSize * 10;
  const rawPnl = priceDiff * multiplier;
  return Number(rawPnl.toFixed(2));
}

// Open or initialize IndexedDB
function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_JOURNAL)) {
          const store = db.createObjectStore(STORE_JOURNAL, { keyPath: 'signal_id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('strategy_id', 'strategy_id', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_ACTIVE_TRADES)) {
          db.createObjectStore(STORE_ACTIVE_TRADES, { keyPath: 'strategyId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export class AppStorage {
  private static LOCAL_JOURNAL_KEY = 'STEP_INDEX_PERMANENT_JOURNAL';
  private static LOCAL_ACTIVE_TRADES_KEY = 'STEP_INDEX_ACTIVE_TRADES_MAP';

  /**
   * Loads all recorded trades, enforcing 12-month retention policy
   */
  public static async loadJournal(): Promise<SignalJSON[]> {
    const cutoff = Date.now() - RETENTION_MS;
    let list: SignalJSON[] = [];

    // 1. Try LocalStorage first for instant sync read
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.LOCAL_JOURNAL_KEY);
        if (raw) {
          list = JSON.parse(raw);
        }
      } catch (e) {
        console.warn('[Storage] Failed to read localStorage journal:', e);
      }
    }

    // 2. Try IndexedDB merge if available
    try {
      const db = await openDB();
      if (db) {
        const tx = db.transaction(STORE_JOURNAL, 'readonly');
        const store = tx.objectStore(STORE_JOURNAL);
        const req = store.getAll();
        const idbList: SignalJSON[] = await new Promise((resolve) => {
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });

        // Merge by signal_id without duplicates
        const map = new Map<string, SignalJSON>();
        list.forEach((item) => map.set(item.signal_id, item));
        idbList.forEach((item) => map.set(item.signal_id, item));
        list = Array.from(map.values());
      }
    } catch (e) {
      console.warn('[Storage] IndexedDB read fallback:', e);
    }

    // 3. Filter by 12-month retention and sort newest first
    const pruned = list
      .filter((s) => s.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);

    // Keep localStorage in sync
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.LOCAL_JOURNAL_KEY, JSON.stringify(pruned));
      } catch {
        // quota safety
      }
    }

    return pruned;
  }

  /**
   * Saves a completed trade into permanent storage
   */
  public static async saveTradeToJournal(trade: SignalJSON): Promise<void> {
    const cutoff = Date.now() - RETENTION_MS;
    if (trade.timestamp < cutoff) return;

    // 1. Save to LocalStorage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.LOCAL_JOURNAL_KEY);
        let list: SignalJSON[] = raw ? JSON.parse(raw) : [];
        list = list.filter((s) => s.signal_id !== trade.signal_id);
        list.unshift(trade);
        list = list.filter((s) => s.timestamp >= cutoff);
        localStorage.setItem(this.LOCAL_JOURNAL_KEY, JSON.stringify(list));
      } catch (e) {
        console.warn('[Storage] LocalStorage write error:', e);
      }
    }

    // 2. Save to IndexedDB
    try {
      const db = await openDB();
      if (db) {
        const tx = db.transaction(STORE_JOURNAL, 'readwrite');
        const store = tx.objectStore(STORE_JOURNAL);
        store.put(trade);
      }
    } catch (e) {
      console.warn('[Storage] IndexedDB put error:', e);
    }
  }

  /**
   * Clears trade history
   */
  public static async clearJournal(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.LOCAL_JOURNAL_KEY);
    }
    try {
      const db = await openDB();
      if (db) {
        const tx = db.transaction(STORE_JOURNAL, 'readwrite');
        tx.objectStore(STORE_JOURNAL).clear();
      }
    } catch {
      // ignore
    }
  }

  private static LOCAL_SOUND_SETTINGS_KEY = 'STEP_INDEX_STRATEGY_SOUND_SETTINGS';

  /**
   * Loads independent active trades for all strategies
   */
  public static loadActiveTradesMap(): Record<string, SignalJSON | null> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(this.LOCAL_ACTIVE_TRADES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /**
   * Saves active trade state map for all strategies
   */
  public static saveActiveTradesMap(map: Record<string, SignalJSON | null>): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.LOCAL_ACTIVE_TRADES_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  }

  /**
   * Loads sound alert toggle settings per strategy (defaults to true if unset)
   */
  public static loadStrategySoundSettings(): Record<string, boolean> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(this.LOCAL_SOUND_SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /**
   * Saves sound alert toggle settings per strategy
   */
  public static saveStrategySoundSettings(settings: Record<string, boolean>): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.LOCAL_SOUND_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }
}
