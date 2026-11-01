/**
 * High-Fidelity Argentine Gaucho Guitar Punteo & Bordoneo Synthesizer
 * (Milonga Campera / Payada Pampeana)
 *
 * Implements physical acoustic nylon string synthesis with:
 * - Fleshy thumb/finger plucking impulse excitation
 * - Frequency-dependent string loss & wood bridge coupling
 * - Guitar body cavity resonance (Helmholtz ~104 Hz, Soundboard ~212 Hz)
 * - Dynamic tempo / rhythm scaling (45 BPM to 110 BPM)
 * - Real-time playback and studio-grade offline audio mixing for WAV export.
 */

const GUITAR_FREQS: Record<string, number> = {
  E2: 82.41,
  G2: 98.0,
  A2: 110.0,
  B2: 123.47,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  B3: 246.94,
  D4: 293.66,
  E4: 329.63,
};

interface PluckEvent {
  beat: number; // in musical beats (0 to 8)
  note: string;
  velocity: number;
  stringIndex: number; // 0 for bass strings (E2/A2/D3), 1 for treble strings
}

// Authentic Milonga Campera / Payada bordoneo pattern in 8 beats
const MILONGA_BEATS_LOOP: PluckEvent[] = [
  // Measure 1: Deep woody bordoneo
  { beat: 0.0, note: 'E2', velocity: 0.95, stringIndex: 0 },
  { beat: 0.75, note: 'B2', velocity: 0.70, stringIndex: 0 },
  { beat: 1.5, note: 'E3', velocity: 0.78, stringIndex: 1 },
  { beat: 2.1, note: 'G3', velocity: 0.65, stringIndex: 1 },
  { beat: 2.85, note: 'B3', velocity: 0.75, stringIndex: 1 },
  { beat: 3.65, note: 'E4', velocity: 0.70, stringIndex: 1 },

  // Measure 2: Melodic criollo walk
  { beat: 4.4, note: 'B2', velocity: 0.72, stringIndex: 0 },
  { beat: 5.1, note: 'G3', velocity: 0.68, stringIndex: 1 },
  { beat: 5.8, note: 'D3', velocity: 0.82, stringIndex: 0 },
  { beat: 6.5, note: 'A2', velocity: 0.90, stringIndex: 0 },
  { beat: 7.2, note: 'C3', velocity: 0.75, stringIndex: 0 },
  { beat: 7.8, note: 'E3', velocity: 0.70, stringIndex: 1 },

  // Measure 3: Syncopated bordoneo finish
  { beat: 8.6, note: 'A2', velocity: 0.92, stringIndex: 0 },
  { beat: 9.3, note: 'E3', velocity: 0.68, stringIndex: 1 },
  { beat: 10.0, note: 'A3', velocity: 0.80, stringIndex: 1 },
  { beat: 10.7, note: 'C3', velocity: 0.65, stringIndex: 0 },
  { beat: 11.4, note: 'B2', velocity: 0.88, stringIndex: 0 },
  { beat: 12.1, note: 'F3', velocity: 0.70, stringIndex: 1 },
  { beat: 12.8, note: 'B3', velocity: 0.80, stringIndex: 1 },
  { beat: 13.5, note: 'E3', velocity: 0.65, stringIndex: 1 },
  { beat: 14.2, note: 'E2', velocity: 0.95, stringIndex: 0 },
];

const BASE_TOTAL_BEATS = 15.0;

/**
 * Creates high-fidelity realistic plucked nylon acoustic guitar sound.
 */
function createRealisticGuitarSample(
  audioCtx: BaseAudioContext,
  freq: number,
  duration: number = 2.6,
  velocity: number = 0.8,
  isBassString: boolean = false
): AudioBuffer {
  const sampleRate = audioCtx.sampleRate;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = audioCtx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const period = Math.floor(sampleRate / freq);
  const excitation = new Float32Array(period);

  // Soft fleshy finger pluck excitation (combination of triangular pulse and warm noise)
  for (let i = 0; i < period; i++) {
    const phase = i / period;
    // Harmonic pluck profile
    const triangle = 1.0 - 2.0 * Math.abs(phase - 0.5);
    const noise = (Math.random() * 2 - 1) * 0.35;
    const fleshDamp = Math.sin(phase * Math.PI);
    excitation[i] = (triangle * 0.65 + noise) * fleshDamp * velocity;
  }

  // Karplus-Strong string loss simulation with acoustic guitar wood resonance
  const decayFactor = isBassString
    ? 0.993 - (freq / 6000) * 0.03 // Bass strings ring with warm acoustic sustain
    : 0.987 - (freq / 3500) * 0.04;

  let yPrev1 = 0;
  let yPrev2 = 0;

  // Body acoustic filter variables (Helmholtz 105Hz & soundboard 210Hz)
  const bodyResonanceFreq = isBassString ? 104 : 210;
  const bodyW = (2 * Math.PI * bodyResonanceFreq) / sampleRate;
  const bodyCos = Math.cos(bodyW);
  const bodyAlpha = Math.sin(bodyW) * 0.18; // Q ~ 2.8
  const b0 = bodyAlpha;
  const b2 = -bodyAlpha;
  const a0 = 1 + bodyAlpha;
  const a1 = -2 * bodyCos;
  const a2 = 1 - bodyAlpha;

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

  for (let i = 0; i < numSamples; i++) {
    let rawStringSample = 0;
    if (i < period) {
      rawStringSample = excitation[i];
    } else {
      const idx = i - period;
      const current = left[idx];
      // Low-pass averaging to simulate string dampening
      const filtered = 0.495 * current + 0.505 * yPrev1;
      yPrev1 = filtered;
      rawStringSample = filtered * decayFactor;
    }

    // Apply wooden body resonance filter
    const bodySample =
      ((b0 / a0) * rawStringSample +
        (b2 / a0) * x2 -
        (a1 / a0) * y1 -
        (a2 / a0) * y2) *
      0.45;

    x2 = x1;
    x1 = rawStringSample;
    y2 = y1;
    y1 = bodySample;

    // Combined sound: string attack + acoustic guitar wooden body
    const finalMono = (rawStringSample * 0.75 + bodySample * 0.55);

    // Stereo panning (bass strings panned slightly left, treble slightly right)
    const pan = isBassString ? -0.15 : 0.2;
    left[i] = finalMono * (0.5 * (1 - pan));
    right[i] = finalMono * (0.5 * (1 + pan));
  }

  return buffer;
}

/**
 * Real-time Background Guitar Accompanist with BPM Tempo & Volume control.
 */
export class GauchoGuitarAccompanist {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private loopTimer: any = null;
  private activeSources: AudioBufferSourceNode[] = [];
  private volume: number = 0.35;
  private tempoBpm: number = 70; // 45 to 110 BPM

  constructor(volume: number = 0.35, tempoBpm: number = 70) {
    this.volume = volume;
    this.tempoBpm = tempoBpm;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  public setTempo(bpm: number) {
    this.tempoBpm = Math.max(45, Math.min(120, bpm));
    if (this.isPlaying) {
      // Re-align on next loop cycle
    }
  }

  public getTempo(): number {
    return this.tempoBpm;
  }

  public start() {
    if (this.isPlaying) return;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.audioCtx) {
      this.audioCtx = new AudioCtx();
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    if (!this.masterGain) {
      this.masterGain = this.audioCtx.createGain();

      // Warm acoustic tone shaping EQ
      const lowShelf = this.audioCtx.createBiquadFilter();
      lowShelf.type = 'lowshelf';
      lowShelf.frequency.value = 250;
      lowShelf.gain.value = 4.0; // Warm guitar body

      const highShelf = this.audioCtx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 3500;
      highShelf.gain.value = -3.0; // Soften plastic highs for natural nylon tone

      this.masterGain.connect(lowShelf);
      lowShelf.connect(highShelf);
      highShelf.connect(this.audioCtx.destination);
    }

    this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    this.isPlaying = true;
    this.scheduleNextLoop(0);
  }

  private scheduleNextLoop(delaySec: number = 0) {
    if (!this.isPlaying || !this.audioCtx || !this.masterGain) return;

    const startTime = this.audioCtx.currentTime + delaySec;
    const secondsPerBeat = 60.0 / (this.tempoBpm * 1.8);
    const loopDurationSec = BASE_TOTAL_BEATS * secondsPerBeat;

    MILONGA_BEATS_LOOP.forEach((event) => {
      const timeOffset = event.beat * secondsPerBeat;
      const freq = GUITAR_FREQS[event.note] || 110;
      const sample = createRealisticGuitarSample(
        this.audioCtx!,
        freq,
        2.5,
        event.velocity,
        event.stringIndex === 0
      );

      const source = this.audioCtx!.createBufferSource();
      source.buffer = sample;
      source.connect(this.masterGain!);
      source.start(startTime + timeOffset);
      this.activeSources.push(source);
    });

    setTimeout(() => {
      this.activeSources = this.activeSources.slice(-25);
    }, 4000);

    this.loopTimer = setTimeout(() => {
      if (this.isPlaying) {
        this.scheduleNextLoop(0.04);
      }
    }, (loopDurationSec - 0.08) * 1000);
  }

  public stop() {
    this.isPlaying = false;
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    this.activeSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    });
    this.activeSources = [];
  }
}

/**
 * Offline Audio Renderer & Mixer:
 * Combines voice WAV and synthesized acoustic guitar punteo with adjustable tempo and volume into a final WAV file.
 */
export async function mixVoiceWithGuitarPunteo(
  voiceWavBlob: Blob,
  guitarVolume: number = 0.35,
  guitarTempoBpm: number = 70
): Promise<Blob> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    return voiceWavBlob;
  }

  const voiceArrayBuffer = await voiceWavBlob.arrayBuffer();
  const tempCtx = new AudioCtx();
  const voiceAudioBuffer = await tempCtx.decodeAudioData(voiceArrayBuffer);

  const duration = voiceAudioBuffer.duration + 1.5; // tail for final ring
  const sampleRate = voiceAudioBuffer.sampleRate;

  const offlineCtx = new OfflineAudioContext(2, Math.floor(sampleRate * duration), sampleRate);

  // 1. Voice Track
  const voiceSource = offlineCtx.createBufferSource();
  voiceSource.buffer = voiceAudioBuffer;
  const voiceGain = offlineCtx.createGain();
  voiceGain.gain.value = 1.0;
  voiceSource.connect(voiceGain);
  voiceGain.connect(offlineCtx.destination);
  voiceSource.start(0);

  // 2. Synthesized Guitar Track with chosen Tempo BPM
  const guitarGain = offlineCtx.createGain();
  guitarGain.gain.value = guitarVolume * 0.85;
  guitarGain.connect(offlineCtx.destination);

  const secondsPerBeat = 60.0 / (Math.max(45, Math.min(120, guitarTempoBpm)) * 1.8);
  const loopDurationSec = BASE_TOTAL_BEATS * secondsPerBeat;

  let currentLoopTime = 0;
  while (currentLoopTime < duration) {
    MILONGA_BEATS_LOOP.forEach((event) => {
      const pluckTime = currentLoopTime + event.beat * secondsPerBeat;
      if (pluckTime < duration) {
        const freq = GUITAR_FREQS[event.note] || 110;
        const stringBuffer = createRealisticGuitarSample(
          offlineCtx,
          freq,
          2.5,
          event.velocity,
          event.stringIndex === 0
        );
        const stringSource = offlineCtx.createBufferSource();
        stringSource.buffer = stringBuffer;
        stringSource.connect(guitarGain);
        stringSource.start(pluckTime);
      }
    });
    currentLoopTime += loopDurationSec;
  }

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWavBlob(renderedBuffer);
}

export function audioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const left = audioBuffer.getChannelData(0);
  const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;

  const numSamples = left.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataByteLength = numSamples * blockAlign;
  const bufferByteLength = 44 + dataByteLength;

  const arrayBuffer = new ArrayBuffer(bufferByteLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(8, 'WAVE');

  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  writeString(36, 'data');
  view.setUint32(40, dataByteLength, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const sampleL = Math.max(-1, Math.min(1, left[i]));
    view.setInt16(offset, sampleL < 0 ? sampleL * 0x8000 : sampleL * 0x7fff, true);
    offset += 2;

    if (numChannels > 1) {
      const sampleR = Math.max(-1, Math.min(1, right[i]));
      view.setInt16(offset, sampleR < 0 ? sampleR * 0x8000 : sampleR * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
