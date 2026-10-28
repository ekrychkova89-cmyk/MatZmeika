type SoundName =
  | "start"
  | "correct"
  | "wrong"
  | "level"
  | "over"
  | "pause"
  | "resume"
  | "click"
  | "record";

interface ToneOptions {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
}

export class SoundEngine {
  private context: AudioContext | null = null;
  enabled = true;

  unlock() {
    if (!this.enabled) return;
    const context = this.getContext();
    if (context?.state === "suspended") void context.resume();
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.context) return this.context;

    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) return null;
    try {
      this.context = new AudioContextConstructor();
    } catch {
      return null;
    }
    return this.context;
  }

  private tone({
    frequency,
    duration,
    type = "sine",
    gain = 0.045,
    delay = 0,
    slideTo,
  }: ToneOptions) {
    const context = this.getContext();
    if (!context || !this.enabled) return;

    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const volume = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo) {
      oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    }

    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  play(name: SoundName) {
    if (!this.enabled) return;
    this.unlock();

    switch (name) {
      case "start":
        this.tone({ frequency: 392, duration: 0.12, type: "triangle", gain: 0.035 });
        this.tone({ frequency: 523.25, duration: 0.15, type: "triangle", gain: 0.04, delay: 0.08 });
        this.tone({ frequency: 783.99, duration: 0.22, type: "triangle", gain: 0.045, delay: 0.16 });
        break;
      case "correct":
        this.tone({ frequency: 659.25, duration: 0.09, type: "triangle", gain: 0.04 });
        this.tone({ frequency: 880, duration: 0.13, type: "triangle", gain: 0.04, delay: 0.055 });
        this.tone({ frequency: 1174.66, duration: 0.17, type: "sine", gain: 0.03, delay: 0.115 });
        break;
      case "wrong":
        this.tone({ frequency: 174, duration: 0.16, type: "sawtooth", gain: 0.035, slideTo: 110 });
        this.tone({ frequency: 138, duration: 0.21, type: "square", gain: 0.018, delay: 0.1 });
        break;
      case "level":
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) =>
          this.tone({
            frequency,
            duration: 0.16,
            type: "triangle",
            gain: 0.035,
            delay: index * 0.06,
          })
        );
        break;
      case "over":
        this.tone({ frequency: 392, duration: 0.2, type: "triangle", gain: 0.04 });
        this.tone({ frequency: 311.13, duration: 0.24, type: "triangle", gain: 0.04, delay: 0.15 });
        this.tone({ frequency: 196, duration: 0.42, type: "sine", gain: 0.05, delay: 0.32 });
        break;
      case "pause":
        this.tone({ frequency: 440, duration: 0.08, type: "sine", gain: 0.03 });
        this.tone({ frequency: 330, duration: 0.12, type: "sine", gain: 0.03, delay: 0.05 });
        break;
      case "resume":
        this.tone({ frequency: 330, duration: 0.08, type: "sine", gain: 0.03 });
        this.tone({ frequency: 440, duration: 0.12, type: "sine", gain: 0.03, delay: 0.05 });
        break;
      case "click":
        this.tone({ frequency: 620, duration: 0.045, type: "sine", gain: 0.022 });
        break;
      case "record":
        [783.99, 987.77, 1174.66, 1567.98].forEach((frequency, index) =>
          this.tone({
            frequency,
            duration: 0.22,
            type: "triangle",
            gain: 0.035,
            delay: index * 0.08,
          })
        );
        break;
    }
  }
}
