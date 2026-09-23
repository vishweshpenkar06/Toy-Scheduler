class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  private play(type: OscillatorType, f0: number, f1: number, dur: number, vol: number) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start();
      osc.stop(t + dur);
    } catch {
      return;
    }
  }

  playClick() { this.play('sine', 800, 400, 0.04, 0.12); }
  playStep() { this.play('triangle', 1200, 600, 0.03, 0.08); }
  playPlay() { this.play('sine', 440, 880, 0.1, 0.15); }
  playPause() { this.play('sine', 660, 330, 0.08, 0.15); }
}

export const soundFx = new SoundSynthesizer();
