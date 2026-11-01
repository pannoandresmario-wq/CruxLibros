import { ReaderSettings, SentenceItem } from '../types';
import { GauchoGuitarAccompanist, mixVoiceWithGuitarPunteo } from './guitarSynth';

export type SpeechStatus = 'stopped' | 'playing' | 'paused' | 'buffering';

export interface SpeechEngineCallbacks {
  onStatusChange?: (status: SpeechStatus) => void;
  onSentenceChange?: (sentenceIndex: number) => void;
  onError?: (error: string) => void;
}

export class SpeechEngine {
  private status: SpeechStatus = 'stopped';
  private sentences: SentenceItem[] = [];
  private currentSentenceIndex: number = 0;
  private settings: ReaderSettings;
  private callbacks: SpeechEngineCallbacks;

  // Web Speech API
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private chromeKeepAliveTimer: any = null;

  // Gemini Audio & Web Audio API
  private currentAudioElement: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private audioCache: Map<string, string> = new Map();
  private abortController: AbortController | null = null;
  private isCancelled: boolean = false;
  private isPrebuffering: Set<number> = new Set();

  // Gaucho Guitar Accompaniment
  private guitarAccompanist: GauchoGuitarAccompanist | null = null;

  constructor(settings: ReaderSettings, callbacks: SpeechEngineCallbacks = {}) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.guitarAccompanist = new GauchoGuitarAccompanist(
      settings.guitarVolume ?? 0.35,
      settings.guitarTempo ?? 70
    );

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      // Preload available browser voices
      this.synthesis.getVoices();
      this.synthesis.onvoiceschanged = () => {
        this.synthesis?.getVoices();
      };
    }
  }

  public updateCallbacks(newCallbacks: SpeechEngineCallbacks) {
    this.callbacks = { ...this.callbacks, ...newCallbacks };
  }

  /**
   * Synchronously unlocks browser audio restrictions during the user's click gesture.
   */
  public unlockAudio() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioContext) {
          this.audioContext = new AudioCtx();
        }
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(() => {});
        }
        // Play an inaudible 1-sample buffer to satisfy autoplay policies
        const buffer = this.audioContext.createBuffer(1, 1, 22050);
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start(0);
      }

      if (this.synthesis) {
        if (this.synthesis.paused) {
          this.synthesis.resume();
        }
        // Prime the browser's speech synthesis engine during user click
        try {
          const primer = new SpeechSynthesisUtterance('');
          primer.volume = 0;
          this.synthesis.speak(primer);
        } catch {}
      }
    } catch (e) {
      console.warn('AudioContext unlock notice:', e);
    }
  }

  public updateSettings(newSettings: ReaderSettings) {
    const oldSettings = this.settings;
    this.settings = newSettings;

    // 1. Volume update
    if (this.gainNode && this.audioContext && newSettings.voiceVolume > 1) {
      const boostMultiplier = Math.max(0.1, newSettings.voiceVolume);
      this.gainNode.gain.setValueAtTime(boostMultiplier, this.audioContext.currentTime);
    } else if (this.currentAudioElement) {
      this.currentAudioElement.volume = Math.min(1, newSettings.voiceVolume);
    }

    // 2. Guitar volume & tempo update
    if (this.guitarAccompanist) {
      this.guitarAccompanist.setVolume(newSettings.guitarVolume ?? 0.35);
      if (newSettings.guitarTempo) {
        this.guitarAccompanist.setTempo(newSettings.guitarTempo);
      }
      const shouldPlayGuitar =
        (newSettings.voiceStyleMode === 'gaucho' || newSettings.guitarAccompaniment) &&
        this.status === 'playing';

      if (shouldPlayGuitar) {
        this.guitarAccompanist.start();
      } else if (!newSettings.guitarAccompaniment && newSettings.voiceStyleMode !== 'gaucho') {
        this.guitarAccompanist.stop();
      }
    }

    // 3. Immediate voice or speed change
    const speedChanged = oldSettings.playbackSpeed !== newSettings.playbackSpeed;
    const voiceChanged =
      oldSettings.voiceEngine !== newSettings.voiceEngine ||
      oldSettings.geminiVoice !== newSettings.geminiVoice ||
      oldSettings.selectedBrowserVoiceURI !== newSettings.selectedBrowserVoiceURI ||
      oldSettings.language !== newSettings.language ||
      oldSettings.voiceStyleMode !== newSettings.voiceStyleMode;

    if (voiceChanged) {
      this.audioCache.clear();
      if (this.status === 'playing' || this.status === 'buffering') {
        this.play(this.currentSentenceIndex);
      }
    } else if (speedChanged) {
      if (newSettings.voiceEngine === 'gemini' && this.currentAudioElement) {
        this.currentAudioElement.playbackRate = newSettings.playbackSpeed;
      } else if (newSettings.voiceEngine === 'browser') {
        if (this.status === 'playing' || this.status === 'buffering') {
          this.play(this.currentSentenceIndex);
        }
      }
    }
  }

  public setSentences(sentences: SentenceItem[], startIndex: number = 0) {
    this.stopPlaybackOnly();
    this.sentences = sentences;
    this.currentSentenceIndex = Math.max(0, Math.min(startIndex, Math.max(0, sentences.length - 1)));
    this.audioCache.clear();
  }

  public getCurrentSentenceIndex(): number {
    return this.currentSentenceIndex;
  }

  public getStatus(): SpeechStatus {
    return this.status;
  }

  public async play(fromIndex?: number) {
    this.unlockAudio();
    this.isCancelled = false;

    if (this.sentences.length === 0) {
      console.warn('SpeechEngine: No sentences loaded');
      this.setStatus('stopped');
      return;
    }

    let targetIdx = fromIndex !== undefined ? fromIndex : this.currentSentenceIndex;
    if (targetIdx < 0 || targetIdx >= this.sentences.length) {
      targetIdx = 0;
    }

    // Find first non-excluded sentence starting from targetIdx
    let found = -1;
    for (let i = targetIdx; i < this.sentences.length; i++) {
      if (!this.sentences[i]?.excluded) {
        found = i;
        break;
      }
    }
    if (found === -1) {
      for (let i = 0; i < targetIdx; i++) {
        if (!this.sentences[i]?.excluded) {
          found = i;
          break;
        }
      }
    }

    if (found === -1) {
      this.setStatus('stopped');
      this.callbacks.onError?.('Todas las oraciones están marcadas como excluidas para la lectura.');
      return;
    }

    this.currentSentenceIndex = found;

    if (this.status === 'paused' && fromIndex === undefined) {
      this.resume();
      return;
    }

    this.stopPlaybackOnly();
    this.setStatus('buffering');
    this.callbacks.onSentenceChange?.(this.currentSentenceIndex);

    // Start guitar if in Gaucho mode or guitar accompaniment is enabled
    if (this.settings.voiceStyleMode === 'gaucho' || this.settings.guitarAccompaniment) {
      this.guitarAccompanist?.start();
    }

    const currentSentence = this.sentences[this.currentSentenceIndex];
    const textToSpeak = currentSentence ? currentSentence.text.trim() : '';

    if (!textToSpeak) {
      this.next();
      return;
    }

    if (this.settings.voiceEngine === 'gemini') {
      await this.playGeminiTTS(textToSpeak, this.currentSentenceIndex);
    } else {
      this.playBrowserTTS(textToSpeak);
    }
  }

  public pause() {
    this.isCancelled = true;

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
    }

    if (this.synthesis) {
      this.clearChromeKeepAlive();
      this.synthesis.cancel();
    }

    this.guitarAccompanist?.stop();
    this.setStatus('paused');
  }

  public resume() {
    this.unlockAudio();
    this.isCancelled = false;

    if (this.status !== 'paused') return;

    if (this.settings.voiceStyleMode === 'gaucho' || this.settings.guitarAccompaniment) {
      this.guitarAccompanist?.start();
    }

    if (this.settings.voiceEngine === 'gemini') {
      if (this.currentAudioElement && this.currentAudioElement.src) {
        this.setStatus('playing');
        this.currentAudioElement.play().catch(() => {
          this.play(this.currentSentenceIndex);
        });
      } else {
        this.play(this.currentSentenceIndex);
      }
    } else {
      this.play(this.currentSentenceIndex);
    }
  }

  public stop() {
    this.isCancelled = true;
    this.guitarAccompanist?.stop();
    this.stopPlaybackOnly();
    this.setStatus('stopped');
  }

  private stopPlaybackOnly() {
    this.clearChromeKeepAlive();

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
        this.currentAudioElement.onended = null;
        this.currentAudioElement.onerror = null;
        this.currentAudioElement.onplay = null;
      } catch {}
      this.currentAudioElement = null;
    }

    if (this.synthesis) {
      try {
        this.synthesis.cancel();
      } catch {}
    }
  }

  public next() {
    let nextIdx = this.currentSentenceIndex + 1;
    while (nextIdx < this.sentences.length && this.sentences[nextIdx]?.excluded) {
      nextIdx++;
    }
    if (nextIdx < this.sentences.length) {
      this.play(nextIdx);
    } else {
      this.stop();
    }
  }

  public previous() {
    let prevIdx = this.currentSentenceIndex - 1;
    while (prevIdx >= 0 && this.sentences[prevIdx]?.excluded) {
      prevIdx--;
    }
    if (prevIdx >= 0) {
      this.play(prevIdx);
    } else {
      this.play(0);
    }
  }

  public skipSeconds(seconds: number) {
    if (this.currentAudioElement && !isNaN(this.currentAudioElement.currentTime)) {
      this.currentAudioElement.currentTime = Math.max(
        0,
        Math.min(
          this.currentAudioElement.duration || 9999,
          this.currentAudioElement.currentTime + seconds
        )
      );
    } else {
      if (seconds > 0) {
        this.next();
      } else {
        this.previous();
      }
    }
  }

  private setStatus(newStatus: SpeechStatus) {
    this.status = newStatus;
    this.callbacks.onStatusChange?.(newStatus);
  }

  // --- Browser Web Speech API with Distinct Voice Fidelity & Anti-Freeze Watchdog ---
  private playBrowserTTS(text: string) {
    if (!this.synthesis) {
      this.callbacks.onError?.('La síntesis de voz no está soportada en este navegador.');
      this.setStatus('stopped');
      return;
    }

    this.clearChromeKeepAlive();

    try {
      if (this.synthesis.speaking || this.synthesis.pending) {
        this.synthesis.cancel();
      }
      this.synthesis.resume();
    } catch {}

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance;

    const isGaucho = this.settings.voiceStyleMode === 'gaucho';
    const isMaleRequested =
      isGaucho ||
      this.settings.geminiVoice === 'Fenrir' ||
      this.settings.geminiVoice === 'Charon' ||
      this.settings.geminiVoice === 'Puck';

    const targetLang = this.settings.language || 'es-ES';
    utterance.lang = targetLang.includes('-') ? targetLang : `${targetLang}-${targetLang.toUpperCase()}`;
    utterance.volume = Math.min(1, this.settings.voiceVolume);

    // 1. Precise Pitch & Speed Configuration according to described persona
    if (isGaucho) {
      utterance.pitch = 0.65; // Deep resonant gaucho baritone
      utterance.rate = Math.max(0.6, Math.min(1.4, this.settings.playbackSpeed * 0.88));
    } else {
      switch (this.settings.geminiVoice) {
        case 'Fenrir':
          utterance.pitch = 0.68; // Distinctly deep, firm and masculine
          utterance.rate = this.settings.playbackSpeed * 0.96;
          break;
        case 'Charon':
          utterance.pitch = 0.74; // Low, academic, solemn and calm
          utterance.rate = this.settings.playbackSpeed * 0.90;
          break;
        case 'Puck':
          utterance.pitch = 0.88; // Energetic, dynamic, bright male
          utterance.rate = this.settings.playbackSpeed * 1.05;
          break;
        case 'Zephyr':
          utterance.pitch = 1.15; // Gentle, sweet, calm female
          utterance.rate = this.settings.playbackSpeed * 0.94;
          break;
        case 'Kore':
        default:
          utterance.pitch = 1.0; // Warm, natural, clear female narrator
          utterance.rate = this.settings.playbackSpeed * 1.0;
          break;
      }
    }

    // 2. Select appropriate male vs female browser voice
    const voices = this.synthesis.getVoices();
    if (voices && voices.length > 0) {
      if (this.settings.selectedBrowserVoiceURI) {
        const found = voices.find((v) => v.voiceURI === this.settings.selectedBrowserVoiceURI);
        if (found) utterance.voice = found;
      }

      if (!utterance.voice) {
        const langCode = targetLang.slice(0, 2).toLowerCase();
        const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(langCode));

        // Keyword recognition for male and female speech models across OSes
        const maleRegex = /\b(male|hombre|pablo|diego|jorge|raul|carlos|miguel|david|pedro|gonzalo|enrique|alvaro|guy|george|stefan|antonio|alberto)\b/i;
        const femaleRegex = /\b(female|mujer|monica|helena|paulina|rosa|laura|elena|lucia|carmen|marta|soledad|victoria|sabina|conchita|ines|penelope)\b/i;

        if (isMaleRequested) {
          const maleVoice = langVoices.find((v) => maleRegex.test(v.name)) ||
            langVoices.find((v) => !femaleRegex.test(v.name));
          if (maleVoice) utterance.voice = maleVoice;
        } else {
          const femaleVoice = langVoices.find((v) => femaleRegex.test(v.name));
          if (femaleVoice) utterance.voice = femaleVoice;
        }

        if (!utterance.voice && langVoices.length > 0) {
          utterance.voice = langVoices[0];
        }
      }
    }

    // 3. Anti-Freeze Watchdog: guarantees status becomes 'playing' and never hangs
    const bufferingWatchdog = setTimeout(() => {
      if (!this.isCancelled && this.status === 'buffering') {
        this.setStatus('playing');
      }
    }, 200);

    utterance.onstart = () => {
      clearTimeout(bufferingWatchdog);
      if (this.isCancelled) {
        this.synthesis?.cancel();
        return;
      }
      this.setStatus('playing');
      this.startChromeKeepAlive();
    };

    utterance.onend = () => {
      clearTimeout(bufferingWatchdog);
      this.clearChromeKeepAlive();
      if (this.status === 'playing' && !this.isCancelled) {
        this.next();
      }
    };

    utterance.onerror = (e) => {
      clearTimeout(bufferingWatchdog);
      this.clearChromeKeepAlive();
      if (e.error === 'interrupted' || e.error === 'canceled' || this.isCancelled) {
        return;
      }
      console.warn('SpeechSynthesis error:', e);
      this.setStatus('stopped');
    };

    // Chromium microtask dispatch
    setTimeout(() => {
      if (this.isCancelled || !this.synthesis) {
        clearTimeout(bufferingWatchdog);
        return;
      }
      try {
        this.synthesis.speak(utterance);
      } catch (err) {
        clearTimeout(bufferingWatchdog);
        console.warn('Browser speech speak failed:', err);
        this.setStatus('stopped');
      }
    }, 25);
  }

  private startChromeKeepAlive() {
    this.clearChromeKeepAlive();
    this.chromeKeepAliveTimer = setInterval(() => {
      if (this.synthesis && this.synthesis.speaking && !this.synthesis.paused) {
        this.synthesis.pause();
        this.synthesis.resume();
      }
    }, 10000);
  }

  private clearChromeKeepAlive() {
    if (this.chromeKeepAliveTimer) {
      clearInterval(this.chromeKeepAliveTimer);
      this.chromeKeepAliveTimer = null;
    }
  }

  // --- Style Prompt Provider (Guarantees identical vocal persona across all sentences) ---
  private getStylePrompt(voice: string, styleMode: string): string {
    if (styleMode === 'gaucho') {
      return 'Voz masculina campera y profunda de gaucho payador tradicional de la pampa argentina, tono grave, pausado y sentido, con la cadencia criolla de recitar versos camperos';
    }
    switch (voice) {
      case 'Fenrir':
        return 'Voz masculina profunda, grave y firme de locutor profesional en español';
      case 'Charon':
        return 'Voz masculina solemne, baja, calmada y académica en español';
      case 'Puck':
        return 'Voz masculina dinámica, vivaz, brillante y enérgica en español';
      case 'Zephyr':
        return 'Voz femenina suave, dulce, reflexiva y calmada en español';
      case 'Kore':
      default:
        return 'Voz femenina cálida, natural, expresiva y clara en español';
    }
  }

  // --- Gemini Natural Voice TTS with Generous Timeout & Seamless Continuation ---
  private async playGeminiTTS(text: string, index: number) {
    this.abortController = new AbortController();

    const isGaucho = this.settings.voiceStyleMode === 'gaucho';
    const voiceToUse = isGaucho ? 'Fenrir' : this.settings.geminiVoice;
    const stylePrompt = this.getStylePrompt(voiceToUse, this.settings.voiceStyleMode);
    const cacheKey = `${index}_${voiceToUse}_${this.settings.voiceStyleMode}`;

    // Generous synthesis timeout (15s): allows natural AI model generation without prematurely switching voices
    const fetchTimeoutTimer = setTimeout(() => {
      if (this.abortController) {
        this.abortController.abort();
      }
    }, 15000);

    try {
      let audioBase64 = this.audioCache.get(cacheKey);

      if (!audioBase64) {
        const response = await fetch('/api/gemini/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice: voiceToUse,
            style: stylePrompt,
          }),
          signal: this.abortController.signal,
        });

        clearTimeout(fetchTimeoutTimer);

        if (this.isCancelled) return;

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Error del servidor HTTP ${response.status}`);
        }

        const data = await response.json();
        audioBase64 = data.audioBase64;
        if (audioBase64) {
          this.audioCache.set(cacheKey, audioBase64);
        }
      } else {
        clearTimeout(fetchTimeoutTimer);
      }

      if (this.isCancelled) return;

      if (!audioBase64) {
        throw new Error('No se recibió audio válido');
      }

      const audioSrc = `data:audio/wav;base64,${audioBase64}`;
      const audio = new Audio(audioSrc);
      this.currentAudioElement = audio;

      audio.playbackRate = this.settings.playbackSpeed;

      // Direct native volume for reliable browser playback
      if (this.settings.voiceVolume <= 1.0) {
        audio.volume = Math.max(0, Math.min(1, this.settings.voiceVolume));
      } else {
        // Boost volume (> 100%) through Web Audio gain node
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            if (!this.audioContext) {
              this.audioContext = new AudioCtx();
            }
            if (this.audioContext.state === 'suspended') {
              this.audioContext.resume().catch(() => {});
            }
            const source = this.audioContext.createMediaElementSource(audio);
            const gain = this.audioContext.createGain();
            gain.gain.value = Math.max(1, this.settings.voiceVolume);
            source.connect(gain);
            gain.connect(this.audioContext.destination);
          }
        } catch {
          audio.volume = 1.0;
        }
      }

      audio.onplay = () => {
        if (this.isCancelled) {
          audio.pause();
          return;
        }
        this.setStatus('playing');
        // Proactively prebuffer the next 2 upcoming sentences with the same voice and style
        this.prebufferPipelined(index + 1, 2);
      };

      audio.onended = () => {
        if (this.status === 'playing' && !this.isCancelled) {
          this.next();
        }
      };

      audio.onerror = () => {
        if (this.isCancelled) return;
        console.warn('Audio element error, attempting fallback for this sentence:', text.slice(0, 40));
        this.playBrowserTTS(text);
      };

      if (!this.isCancelled && this.status !== 'paused') {
        try {
          await audio.play();
          this.setStatus('playing');
          this.prebufferPipelined(index + 1, 2);
        } catch (playErr) {
          console.warn('HTMLAudio play rejected, falling back to browser speech:', playErr);
          this.playBrowserTTS(text);
        }
      }
    } catch (err: any) {
      clearTimeout(fetchTimeoutTimer);
      if (err.name === 'AbortError' || this.isCancelled) {
        if (!this.isCancelled) {
          // Timeout occurred: temporarily use browser speech for this single sentence
          this.playBrowserTTS(text);
        }
        return;
      }

      console.warn('Gemini TTS temporary notice, fallback for this sentence:', err?.message);
      this.playBrowserTTS(text);
    }
  }

  /**
   * Pipelined Prebuffering: fetches ahead the next N non-excluded sentences
   * with the exact voice and style prompt so transitions are seamless and instant.
   */
  private async prebufferPipelined(startIndex: number, count: number = 2) {
    if (this.settings.voiceEngine !== 'gemini' || this.isCancelled) {
      return;
    }

    const isGaucho = this.settings.voiceStyleMode === 'gaucho';
    const voiceToUse = isGaucho ? 'Fenrir' : this.settings.geminiVoice;
    const stylePrompt = this.getStylePrompt(voiceToUse, this.settings.voiceStyleMode);

    let candidatesFound = 0;
    for (let i = startIndex; i < this.sentences.length && candidatesFound < count; i++) {
      const sentence = this.sentences[i];
      if (!sentence || sentence.excluded || !sentence.text.trim()) continue;

      candidatesFound++;
      const cacheKey = `${i}_${voiceToUse}_${this.settings.voiceStyleMode}`;
      if (this.audioCache.has(cacheKey) || this.isPrebuffering.has(i)) continue;

      this.isPrebuffering.add(i);

      try {
        const response = await fetch('/api/gemini/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: sentence.text.trim(),
            voice: voiceToUse,
            style: stylePrompt,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.audioBase64) {
            this.audioCache.set(cacheKey, data.audioBase64);
          }
        }
      } catch {
        // Silently catch background prebuffer errors
      } finally {
        this.isPrebuffering.delete(i);
      }
    }
  }

  /**
   * Helper: splits long text into clean chunks of up to maxChunkChars
   * preserving sentence boundaries (., ?, !, \n).
   */
  public static splitTextForTTS(text: string, maxChunkChars: number = 1000): string[] {
    const clean = text.trim();
    if (!clean) return [];
    if (clean.length <= maxChunkChars) return [clean];

    const chunks: string[] = [];
    const sentences = clean.split(/(?<=[.?!;\n])\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + ' ' + sentence).length <= maxChunkChars) {
        currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        if (sentence.length > maxChunkChars) {
          const words = sentence.split(/\s+/);
          let subChunk = '';
          for (const word of words) {
            if ((subChunk + ' ' + word).length <= maxChunkChars) {
              subChunk = subChunk ? `${subChunk} ${word}` : word;
            } else {
              if (subChunk) chunks.push(subChunk.trim());
              subChunk = word;
            }
          }
          if (subChunk) currentChunk = subChunk;
        } else {
          currentChunk = sentence;
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Generates a complete standalone WAV file for export covering the FULL text without truncation.
   * If text is long, it generates all chunks, concatenates raw 24kHz PCM, and wraps in a single valid WAV.
   * Optionally mixes the Argentine Gaucho guitar accompaniment across the entire track.
   */
  public static async generateFullAudioWAV(
    text: string,
    voice: string = 'Kore',
    isGauchoMode: boolean = false,
    includeGuitar: boolean = false,
    guitarVolume: number = 0.35,
    guitarTempoBpm: number = 70,
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<Blob> {
    const voiceToUse = isGauchoMode ? 'Fenrir' : voice;
    let stylePrompt = '';
    if (isGauchoMode) {
      stylePrompt = 'Voz masculina campera y profunda de gaucho payador tradicional de la pampa argentina, tono grave, pausado y solemne con cadencia campera criolla';
    } else {
      switch (voiceToUse) {
        case 'Fenrir':
          stylePrompt = 'Voz masculina profunda, grave y firme de locutor profesional en español';
          break;
        case 'Charon':
          stylePrompt = 'Voz masculina solemne, baja, calmada y académica en español';
          break;
        case 'Puck':
          stylePrompt = 'Voz masculina dinámica, vivaz, brillante y enérgica en español';
          break;
        case 'Zephyr':
          stylePrompt = 'Voz femenina suave, dulce, reflexiva y calmada en español';
          break;
        case 'Kore':
        default:
          stylePrompt = 'Voz femenina cálida, natural, expresiva y clara en español';
          break;
      }
    }

    const chunks = SpeechEngine.splitTextForTTS(text, 1000);
    if (chunks.length === 0) {
      throw new Error('No hay texto para generar audio.');
    }

    const pcmDataParts: Uint8Array[] = [];
    let sampleRate = 24000;
    let numChannels = 1;
    let bitDepth = 16;

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      if (onProgress) {
        onProgress(i + 1, chunks.length, `Sintetizando locución: parte ${i + 1} de ${chunks.length}...`);
      }

      const response = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: chunkText,
          voice: voiceToUse,
          style: stylePrompt,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Fallo al generar audio en parte ${i + 1}.`);
      }

      const data = await response.json();
      const binary = atob(data.audioBase64);
      const chunkBytes = new Uint8Array(binary.length);
      for (let j = 0; j < binary.length; j++) {
        chunkBytes[j] = binary.charCodeAt(j);
      }

      // Check WAV header (44 bytes standard Gemini WAV)
      if (chunkBytes.length > 44) {
        const view = new DataView(chunkBytes.buffer, chunkBytes.byteOffset, chunkBytes.byteLength);
        sampleRate = view.getUint32(24, true) || 24000;
        numChannels = view.getUint16(22, true) || 1;
        bitDepth = view.getUint16(34, true) || 16;

        // Strip the 44-byte WAV header and extract raw PCM
        const pcmChunk = chunkBytes.subarray(44);
        pcmDataParts.push(pcmChunk);
      } else {
        pcmDataParts.push(chunkBytes);
      }
    }

    // Concatenate all PCM chunks into one continuous audio track
    const totalPcmLength = pcmDataParts.reduce((acc, p) => acc + p.length, 0);
    const combinedPcm = new Uint8Array(totalPcmLength);
    let pcmOffset = 0;
    for (const part of pcmDataParts) {
      combinedPcm.set(part, pcmOffset);
      pcmOffset += part.length;
    }

    // Construct a master 44-byte WAV container for the complete audio
    const totalWavSize = 44 + totalPcmLength;
    const wavBuffer = new ArrayBuffer(totalWavSize);
    const view = new DataView(wavBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + totalPcmLength, true);
    writeString(8, 'WAVE');

    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    writeString(36, 'data');
    view.setUint32(40, totalPcmLength, true);

    new Uint8Array(wavBuffer, 44).set(combinedPcm);

    const fullVoiceBlob = new Blob([wavBuffer], { type: 'audio/wav' });

    if (includeGuitar || isGauchoMode) {
      if (onProgress) {
        onProgress(chunks.length, chunks.length, 'Componiendo y mezclando punteo de guitarra criolla...');
      }
      try {
        return await mixVoiceWithGuitarPunteo(fullVoiceBlob, guitarVolume, guitarTempoBpm);
      } catch (e) {
        console.warn('Could not mix guitar, returning clean voice WAV:', e);
        return fullVoiceBlob;
      }
    }

    return fullVoiceBlob;
  }
}
