/**
 * STEP INDEX MASTER AI - Enhanced Signal Audio Alert System
 * 
 * Generates loud, crisp, synthesized dual-chime audio alerts (Double Alert)
 * for 100% confirmed BUY / SELL signals on the currently ACTIVE strategy.
 * Zero external asset dependencies (Web Audio API), operates reliably on iOS, Android,
 * Desktop, and inside Telegram WebApp with hardware haptics.
 */

class SoundAlertManager {
  private audioCtx: AudioContext | null = null;
  private isUnlocked: boolean = false;

  constructor() {
    this.initUserGestureUnlock();
  }

  /**
   * Automatically unlocks and resumes AudioContext on the first user interaction
   * (touch or click) to bypass mobile / Telegram WebView autoplay restrictions.
   */
  private initUserGestureUnlock(): void {
    if (typeof window === 'undefined') return;

    const unlockHandler = () => {
      try {
        const ctx = this.getAudioContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().then(() => {
            this.isUnlocked = true;
          }).catch(() => {});
        } else if (ctx) {
          this.isUnlocked = true;
        }
      } catch {
        // ignore
      }
      window.removeEventListener('touchstart', unlockHandler);
      window.removeEventListener('touchend', unlockHandler);
      window.removeEventListener('click', unlockHandler);
    };

    window.addEventListener('touchstart', unlockHandler, { passive: true });
    window.addEventListener('touchend', unlockHandler, { passive: true });
    window.addEventListener('click', unlockHandler, { passive: true });
  }

  /**
   * Lazy initializes the AudioContext with Webkit fallback
   */
  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      return this.audioCtx;
    } catch (e) {
      console.warn('[SoundAlert] AudioContext initialization failed:', e);
      return null;
    }
  }

  /**
   * Plays a single high-fidelity synthesized beep/chime tone
   * with dual harmonics for maximum punch and audibility on mobile speakers.
   */
  private playSingleChime(
    ctx: AudioContext,
    startTime: number,
    type: 'BUY' | 'SELL' | 'TEST'
  ): void {
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);

    if (type === 'BUY') {
      // Primary Oscillator: Ascending high-register chime 784Hz (G5) -> 1046.5Hz (C6) -> 1318.5Hz (E6)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(783.99, startTime);
      osc1.frequency.exponentialRampToValueAtTime(1046.5, startTime + 0.06);
      osc1.frequency.exponentialRampToValueAtTime(1318.51, startTime + 0.14);

      gain1.gain.setValueAtTime(0.001, startTime);
      gain1.gain.exponentialRampToValueAtTime(0.85, startTime + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.24);

      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(startTime);
      osc1.stop(startTime + 0.25);

      // Secondary Harmonic Overtone Oscillator: 1568Hz (G6) crisp top-end sparkle
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1567.98, startTime);
      osc2.frequency.exponentialRampToValueAtTime(2093.0, startTime + 0.12);

      gain2.gain.setValueAtTime(0.001, startTime);
      gain2.gain.exponentialRampToValueAtTime(0.45, startTime + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(startTime);
      osc2.stop(startTime + 0.23);
    } else if (type === 'SELL') {
      // Sharp, urgent descending alert chime: 1174.66Hz (D6) -> 880Hz (A5) -> 659.25Hz (E5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1174.66, startTime);
      osc1.frequency.exponentialRampToValueAtTime(880.0, startTime + 0.07);
      osc1.frequency.exponentialRampToValueAtTime(659.25, startTime + 0.15);

      gain1.gain.setValueAtTime(0.001, startTime);
      gain1.gain.exponentialRampToValueAtTime(0.9, startTime + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.24);

      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(startTime);
      osc1.stop(startTime + 0.25);

      // Punchy fundamental sub-tone for punch: 587.33Hz (D5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(587.33, startTime);

      gain2.gain.setValueAtTime(0.001, startTime);
      gain2.gain.exponentialRampToValueAtTime(0.5, startTime + 0.03);
      gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(startTime);
      osc2.stop(startTime + 0.23);
    } else {
      // TEST: Crisp tactile confirmation blip: 987.77Hz (B5) -> 1318.5Hz (E6)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, startTime);
      osc.frequency.exponentialRampToValueAtTime(1318.51, startTime + 0.05);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.65, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.16);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.17);
    }
  }

  /**
   * Plays an enhanced DOUBLE AUDIO ALERT with consecutive chimes separated by ~380ms.
   * Also triggers physical hardware haptic feedback and Telegram WebApp vibrations.
   * 
   * @param type 'BUY' | 'SELL' | 'TEST'
   */
  public playAlert(type: 'BUY' | 'SELL' | 'TEST'): void {
    // 1. Hardware haptic feedback on mobile / Telegram
    this.triggerHapticFeedback(type);

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 1st chime (immediate)
      this.playSingleChime(ctx, now, type);

      // 2nd chime (~380ms delay) -> Creates the crisp, unmistakable "Ding-Ding!" / "Beep-Beep!" double alert
      const secondChimeDelay = type === 'TEST' ? 0.22 : 0.38;
      this.playSingleChime(ctx, now + secondChimeDelay, type);
    } catch (e) {
      console.warn('[SoundAlert] Audio playback error:', e);
    }
  }

  /**
   * Triggers mobile device vibration & Telegram WebApp haptic vibration
   */
  private triggerHapticFeedback(type: 'BUY' | 'SELL' | 'TEST'): void {
    if (typeof window === 'undefined') return;

    try {
      // 1. Telegram WebApp native haptic feedback
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        if (type === 'BUY' || type === 'SELL') {
          tg.HapticFeedback.notificationOccurred('success');
          setTimeout(() => {
            tg.HapticFeedback.notificationOccurred('warning');
          }, 380);
        } else {
          tg.HapticFeedback.impactOccurred('medium');
        }
      }

      // 2. Browser standard Navigator vibration API
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        if (type === 'BUY' || type === 'SELL') {
          navigator.vibrate([220, 120, 220]);
        } else {
          navigator.vibrate(80);
        }
      }
    } catch {
      // ignore
    }
  }
}

export const soundAlert = new SoundAlertManager();
