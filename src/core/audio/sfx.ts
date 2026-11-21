import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Papyrus Fantasy RPG Audio Engine
 * Provides synthesized Web Audio sound effects (SFX) and ambient Lo-Fi Fantasy
 * study background music (BGM) with tactile haptics on mobile.
 */
class SoundEffectsManager {
  private ctx: AudioContext | null = null;
  private sfxMuted: boolean = false;
  private bgmMuted: boolean = false;
  private bgmPlaying: boolean = false;
  private bgmTimer: any = null;
  private bgmGainNode: GainNode | null = null;

  private getContext(): AudioContext | null {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if (!this.ctx) {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            this.ctx = new AudioContextClass();
          }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          void this.ctx.resume();
        }
        return this.ctx;
      } catch {
        return null;
      }
    }
    return null;
  }

  public setMuted(muted: boolean) {
    this.sfxMuted = muted;
    this.bgmMuted = muted;
    if (muted) {
      this.stopBGM();
    }
  }

  public isMuted(): boolean {
    return this.sfxMuted && this.bgmMuted;
  }

  public setSfxMuted(muted: boolean) {
    this.sfxMuted = muted;
  }

  public isSfxMuted(): boolean {
    return this.sfxMuted;
  }

  public setBgmMuted(muted: boolean) {
    this.bgmMuted = muted;
    if (muted) {
      this.stopBGM();
    } else if (!this.bgmPlaying) {
      this.playBGM();
    }
  }

  public isBgmMuted(): boolean {
    return this.bgmMuted;
  }

  public isBgmActive(): boolean {
    return this.bgmPlaying && !this.bgmMuted;
  }

  // --- BACKGROUND MUSIC ENGINE (Lo-Fi Fantasy Academy) ---

  public playBGM() {
    if (this.bgmMuted || this.bgmPlaying) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.bgmPlaying = true;
    this.bgmGainNode = ctx.createGain();
    this.bgmGainNode.gain.setValueAtTime(0.08, ctx.currentTime);
    this.bgmGainNode.connect(ctx.destination);

    // Ethereal chord progressions: Am9 -> Fmaj7 -> Cmaj9 -> Gsus4
    const chords = [
      [220.0, 261.63, 329.63, 392.0, 493.88], // Am9
      [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj7
      [261.63, 329.63, 392.0, 493.88, 587.33], // Cmaj9
      [196.0, 261.63, 293.66, 392.0, 440.0],  // Gsus4
    ];

    let chordIndex = 0;

    const playChordStep = () => {
      if (!this.bgmPlaying || this.bgmMuted || !this.ctx || !this.bgmGainNode) return;
      const now = this.ctx.currentTime;
      const currentChord = chords[chordIndex % chords.length];
      chordIndex++;
      if (!currentChord) return;

      // Play soft warm chord tones
      currentChord.forEach((freq, noteIdx) => {
        try {
          const osc = this.ctx!.createOscillator();
          const noteGain = this.ctx!.createGain();

          osc.type = noteIdx === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, now + noteIdx * 0.12);

          // Soft ambient envelope
          const start = now + noteIdx * 0.12;
          noteGain.gain.setValueAtTime(0.001, start);
          noteGain.gain.linearRampToValueAtTime(0.04, start + 0.4);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, start + 3.4);

          osc.connect(noteGain);
          noteGain.connect(this.bgmGainNode!);

          osc.start(start);
          osc.stop(start + 3.5);
        } catch {
          // Fallback
        }
      });

      this.bgmTimer = setTimeout(playChordStep, 3600);
    };

    playChordStep();
  }

  public stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (this.bgmGainNode && this.ctx) {
      try {
        this.bgmGainNode.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      } catch {
        // Fallback
      }
    }
  }

  public toggleBGM(): boolean {
    if (this.bgmPlaying && !this.bgmMuted) {
      this.stopBGM();
      this.setBgmMuted(true);
      return false;
    } else {
      this.setBgmMuted(false);
      this.playBGM();
      return true;
    }
  }

  // --- SOUND EFFECTS (SFX) ---

  /**
   * Tia chùm sét tri thức (Knowledge Beam / Spell Cast)
   */
  public playSpellCast() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    if (this.sfxMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(1450, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.35);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Trả lời ĐÚNG / Chiến thắng (Correct / Chime of Wisdom)
   */
  public playCorrect() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    if (this.sfxMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.07;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.46);
      });
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Trả lời SAI / Bị sấm sét đánh (Hurt / Heavy Impact)
   */
  public playWrong() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    if (this.sfxMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.35);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Lật phiến đá ma thuật 3D (Card Flip - Stone Click)
   */
  public playCardFlip() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (this.sfxMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.06);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Trái Tim Pha Lê Vỡ (Crystal Heart Shatter)
   */
  public playCrystalBreak() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    if (this.sfxMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [1800, 2400, 3100, 1200];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + i * 0.03;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.4, start + 0.25);

        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.26);
      });
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Combo Rực Lửa (Combo Ignition)
   */
  public playCombo() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    if (this.sfxMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(950, now + 0.25);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.31);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Thăng cấp / Vinh quang (Level Up / Victory Fanfare)
   */
  public playLevelUp() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    if (this.sfxMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const fanfare = [
        { f: 523.25, d: 0.12 },
        { f: 659.25, d: 0.12 },
        { f: 783.99, d: 0.12 },
        { f: 1046.5, d: 0.35 },
        { f: 1318.5, d: 0.5 },
      ];

      let t = now;
      fanfare.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.f, t);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.005, t + n.d);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + n.d + 0.02);
        t += n.d * 0.85;
      });
    } catch {
      // Audio autoplay policy fallback
    }
  }
}

export const sfx = new SoundEffectsManager();
