/**
 * High-Fidelity Argentine Gaucho Guitar Synthesizer (Guitarra Criolla de Nylon)
 * Authentic Milonga Campera & Payada Pampeana Bordoneo & Punteo
 *
 * Implements physical acoustic modeling of classical nylon strings:
 * - Two-stage fleshy finger/nail plucking excitation
 * - Pick-position comb filter (striking at 1/7 string length for authentic acoustic twang)
 * - Frequency-dependent string damping (Jaffe-Smith Karplus-Strong waveguide)
 * - Wooden acoustic body filter bank (Helmholtz 105Hz, Soundboard 215Hz & 430Hz)
 * - Natural stereo soundstage and dynamic humanized milonga campera rhythm.
 */

// Precise concert pitches for standard guitar tuning (E A D G B E)
const GUITAR_FREQS: Record<string, number> = {
  E2: 82.41,
  F2: 87.31,
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
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
};

interface PluckEvent {
  beat: number; // In beats within loop
  note: string;
  velocity: number;
  stringIndex: number; // 0 for bass strings (E2/A2/D3), 1 for treble strings (G3/B3/E4)
  durationSec?: number;
}

// Authentic Milonga Campera / Payada bordoneo pattern in 8 beats (syncopated 3+3+2 criollo rhythm)
const MILONGA_BEATS_LOOP: PluckEvent[] = [
  // Compás 1: Bordoneo hondo con pulgar en cuerda grave (E2) y contestación en Si/Mi
  { beat: 0.0, note: 'E2', velocity: 0.95, stringIndex: 0, durationSec: 2.8 },
  { beat: 0.75, note: 'B2', velocity: 0.70, stringIndex: 0, durationSec: 1.8 },
  { beat: 1.5, note: 'G3', velocity: 0.72, stringIndex: 1, durationSec: 1.5 },
  { beat: 2.15, note: 'B3', velocity: 0.68, stringIndex: 1, durationSec: 1.4 },
  { beat: 2.9, note: 'E3', velocity: 0.74, stringIndex: 1, durationSec: 1.6 },
  { beat: 3.65, note: 'E4', velocity: 0.65, stringIndex: 1, durationSec: 1.3 },

  // Compás 2: Caminata criolla campera con bordona en La (A2) y acorde de Mi menor
  { beat: 4.4, note: 'A2', velocity: 0.90, stringIndex: 0, durationSec: 2.6 },
  { beat: 5.15, note: 'C3', velocity: 0.75, stringIndex: 0, durationSec: 1.7 },
  { beat: 5.85, note: 'E3', velocity: 0.78, stringIndex: 1, durationSec: 1.5 },
  { beat: 6.55, note: 'A3', velocity: 0.82, stringIndex: 1, durationSec: 1.5 },
  { beat: 7.25, note: 'C4', velocity: 0.70, stringIndex: 1, durationSec: 1.4 },
  { beat: 7.95, note: 'B3', velocity: 0.76, stringIndex: 1, durationSec: 1.8 },

  // Compás 3: Síncopa tradicional de payada (Si7 cadencial resolviendo a Mi menor)
  { beat: 8.75, note: 'B2', velocity: 0.92, stringIndex: 0, durationSec: 2.6 },
  { beat: 9.45, note: 'D3', velocity: 0.74, stringIndex: 0, durationSec: 1.6 },
  { beat: 10.15, note: 'F3', velocity: 0.70, stringIndex: 1, durationSec: 1.5 },
  { beat: 10.85, note: 'A3', velocity: 0.78, stringIndex: 1, durationSec: 1.5 },
  { beat: 11.55, note: 'B3', velocity: 0.85, stringIndex: 1, durationSec: 1.8 },
  { beat: 12.3, note: 'E3', velocity: 0.70, stringIndex: 1, durationSec: 1.6 },
  { beat: 13.1, note: 'B2', velocity: 0.75, stringIndex: 0, durationSec: 1.8 },
  { beat: 13.9, note: 'E2', velocity: 0.98, stringIndex: 0, durationSec: 3.2 },
];

const BASE_TOTAL_BEATS = 14.8;

/**
 * Creates an authentic, warm acoustic nylon guitar sample using physical modeling.
 */
function createRealisticGuitarSample(
  audioCtx: BaseAudioContext,
  freq: number,
  duration: number = 2.5,
  velocity: number = 0.8,
  isBassString: boolean = false
): AudioBuffer {
  const sampleRate = audioCtx.sampleRate;
  const numSamples = Math.floor(sampleRate * Math.max(1.2, duration));
  const buffer = audioCtx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Fundamental period in samples
  const period = Math.max(16, Math.floor(sampleRate / freq));
  const pickPos = Math.max(2, Math.floor(period / 7)); // Pluck at ~1/7 string length

  // 1. Dual-stage plucking excitation (soft flesh contact + nail friction)
  const excitation = new Float32Array(period);
  for (let i = 0; i < period; i++) {
    const phase = i / period;
    // Fleshy thumb/finger contact (asymmetric warm displacement)
    const displacement = Math.sin(phase * Math.PI);
    // Nail transient click (initial fast impulse)
    const nailTransient = i < 8 ? (1 - i / 8) * (Math.random() * 0.4 - 0.2) : 0;
    // Low-pass filtered finger noise
    const frictionNoise = (Math.random() * 2 - 1) * 0.15 * Math.sin(phase * Math.PI * 0.5);

    excitation[i] = (displacement * 0.85 + nailTransient + frictionNoise) * velocity;
  }

  // 2. Pick position comb filter: y_exc[n] = exc[n] - exc[n - pickPos]
  const combExcitation = new Float32Array(period);
  for (let i = 0; i < period; i++) {
    const delayed = i >= pickPos ? excitation[i - pickPos] : 0;
    combExcitation[i] = excitation[i] - 0.7 * delayed;
  }

  // 3. Karplus-Strong string loss loop with nylon frequency decay
  const delayLine = new Float32Array(period);
  for (let i = 0; i < period; i++) {
    delayLine[i] = combExcitation[i];
  }

  // Frequency-dependent damping: bass strings have longer acoustic sustain than treble
  const decay = isBassString
    ? 0.996 - (freq / 6000) * 0.02
    : 0.991 - (freq / 3500) * 0.035;

  let yPrev = 0;

  // 4. Acoustic guitar wooden soundboard resonance filter (Helmholtz ~105 Hz, Soundboard ~215 Hz)
  const bodyFreq1 = 105; // Air cavity
  const bodyFreq2 = 215; // Soundboard top plate
  const w1 = (2 * Math.PI * bodyFreq1) / sampleRate;
  const w2 = (2 * Math.PI * bodyFreq2) / sampleRate;
  const q1 = 3.2;
  const q2 = 4.0;
  const alpha1 = Math.sin(w1) / (2 * q1);
  const alpha2 = Math.sin(w2) / (2 * q2);

  // Biquad 1 coefficients (Helmholtz)
  const b0_1 = alpha1, b1_1 = 0, b2_1 = -alpha1;
  const a0_1 = 1 + alpha1, a1_1 = -2 * Math.cos(w1), a2_1 = 1 - alpha1;

  // Biquad 2 coefficients (Soundboard)
  const b0_2 = alpha2, b1_2 = 0, b2_2 = -alpha2;
  const a0_2 = 1 + alpha2, a1_2 = -2 * Math.cos(w2), a2_2 = 1 - alpha2;

  let x1_1 = 0, x2_1 = 0, y1_1 = 0, y2_1 = 0;
  let x1_2 = 0, x2_2 = 0, y1_2 = 0, y2_2 = 0;

  for (let i = 0; i < numSamples; i++) {
    const readIndex = i % period;
    const currentSample = delayLine[readIndex];

    // Nylon string lowpass damping filter (smoothing between current and previous)
    const lowpassed = 0.52 * currentSample + 0.48 * yPrev;
    yPrev = lowpassed;

    // Feedback into delay line with decay
    delayLine[readIndex] = lowpassed * decay;

    // Resonator 1: Air cavity
    const bodyOut1 =
      (b0_1 / a0_1) * currentSample +
      (b1_1 / a0_1) * x1_1 +
      (b2_1 / a0_1) * x2_1 -
      (a1_1 / a0_1) * y1_1 -
      (a2_1 / a0_1) * y2_1;
    x2_1 = x1_1;
    x1_1 = currentSample;
    y2_1 = y1_1;
    y1_1 = bodyOut1;

    // Resonator 2: Soundboard
    const bodyOut2 =
      (b0_2 / a0_2) * currentSample +
      (b1_2 / a0_2) * x1_2 +
      (b2_2 / a0_2) * x2_2 -
      (a1_2 / a0_2) * y1_2 -
      (a2_2 / a0_2) * y2_2;
    x2_2 = x1_2;
    x1_2 = currentSample;
    y2_2 = y1_2;
    y1_2 = bodyOut2;

    // Composite sound: direct string + wooden body reverberation
    const directSound = currentSample * 0.72;
    const bodyWood = bodyOut1 * 0.45 + bodyOut2 * 0.35;
    const guitarSample = (directSound + bodyWood) * 1.15;

    // Natural stereo placement (basses panned slightly left, trebles slightly right)
    const pan = isBassString ? -0.18 : 0.22;
    left[i] = guitarSample * (0.5 * (1 - pan));
    right[i] = guitarSample * (0.5 * (1 + pan));
  }

  return buffer;
}

/**
 * Real-time Background Gaucho Guitar Accompanist
 * Features humanized milonga tempo and natural wooden tone shaping.
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

      // Warm acoustic tone shaping EQ (Acoustic Cedar/Spruce Guitar)
      const lowShelf = this.audioCtx.createBiquadFilter();
      lowShelf.type = 'lowshelf';
      lowShelf.frequency.value = 240;
      lowShelf.gain.value = 3.5; // Warm wooden body thump

      const midPeak = this.audioCtx.createBiquadFilter();
      midPeak.type = 'peaking';
      midPeak.frequency.value = 1800;
      midPeak.Q.value = 1.0;
      midPeak.gain.value = -2.0; // Avoid synthetic harshness

      const highShelf = this.audioCtx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 4000;
      highShelf.gain.value = -3.5; // Sweet nylon top-end

      this.masterGain.connect(lowShelf);
      lowShelf.connect(midPeak);
      midPeak.connect(highShelf);
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
      // Subtle human micro-rubato (+/- 6ms) for natural acoustic feel
      const humanOffset = (Math.random() - 0.5) * 0.012;
      const timeOffset = Math.max(0, event.beat * secondsPerBeat + humanOffset);
      const freq = GUITAR_FREQS[event.note] || 110;
      const sample = createRealisticGuitarSample(
        this.audioCtx!,
        freq,
        event.durationSec || 2.5,
        event.velocity,
        event.stringIndex === 0
      );

      const source = this.audioCtx!.createBufferSource();
      source.buffer = sample;
      source.connect(this.masterGain!);
      source.start(startTime + timeOffset);
      this.activeSources.push(source);
    });

    // Clean up old source nodes
    setTimeout(() => {
      this.activeSources = this.activeSources.slice(-30);
    }, 4000);

    this.loopTimer = setTimeout(() => {
      if (this.isPlaying) {
        this.scheduleNextLoop(0.02);
      }
    }, (loopDurationSec - 0.05) * 1000);
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
 * Combines voice WAV and synthesized acoustic nylon guitar punteo with adjustable tempo and volume into a final WAV file.
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

  const duration = voiceAudioBuffer.duration + 2.0; // tail for acoustic ring
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
  guitarGain.gain.value = Math.max(0.05, Math.min(1.0, guitarVolume * 0.9));

  // Acoustic tone filter in offline context
  const lowShelf = offlineCtx.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 240;
  lowShelf.gain.value = 3.5;

  const highShelf = offlineCtx.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 3800;
  highShelf.gain.value = -3.5;

  guitarGain.connect(lowShelf);
  lowShelf.connect(highShelf);
  highShelf.connect(offlineCtx.destination);

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
          event.durationSec || 2.5,
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
