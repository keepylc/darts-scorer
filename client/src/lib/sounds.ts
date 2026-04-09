let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

type SoundType = "hit" | "double" | "triple" | "bull" | "bust" | "win";

const SOUND_CONFIGS: Record<SoundType, { freq: number; duration: number; type: OscillatorType; gain: number; freqEnd?: number }> = {
  hit: { freq: 600, duration: 0.08, type: "sine", gain: 0.15 },
  double: { freq: 800, duration: 0.12, type: "sine", gain: 0.2 },
  triple: { freq: 1000, duration: 0.15, type: "triangle", gain: 0.2 },
  bull: { freq: 1200, duration: 0.2, type: "sine", gain: 0.25 },
  bust: { freq: 200, duration: 0.4, type: "sawtooth", gain: 0.2, freqEnd: 100 },
  win: { freq: 523, duration: 0.6, type: "sine", gain: 0.25, freqEnd: 1047 },
};

export function playSound(type: SoundType): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const config = SOUND_CONFIGS[type];
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = config.type;
    osc.frequency.setValueAtTime(config.freq, ctx.currentTime);

    if (config.freqEnd) {
      osc.frequency.linearRampToValueAtTime(config.freqEnd, ctx.currentTime + config.duration);
    }

    gainNode.gain.setValueAtTime(config.gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + config.duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + config.duration);

    // Win: play a second note for a chord effect
    if (type === "win") {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
      osc2.frequency.linearRampToValueAtTime(1319, ctx.currentTime + 0.6);
      gain2.gain.setValueAtTime(0.18, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.7);
    }
  } catch {
    // Silently fail if audio is unavailable
  }
}
