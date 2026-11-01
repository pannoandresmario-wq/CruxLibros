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

  // Gemini Audio & Web Audio API Gain Amplifier
  private currentAudioElement: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private mediaSourceNode: MediaElementAudioSourceNode | null = null;
  private audioCache: Map<string, string> = new Map();
  private abortController: AbortController | null = null;
  private isCancelled: boolean = false;

  // Gaucho Guitar Accompaniment
  private guitarAccompanist: GauchoGuitarAccompanist | null = null;

  constructor(settings: ReaderSettings, callbacks: SpeechEngineCallbacks = {}) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.guitarAccompanist = new GauchoGuitarAccompanist(settings.guitarVolume ?? 0.35, settings.guitarTempo ?? 70);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      this.synthesis.getVoices();
      this.synthesis.onvoiceschanged = () => {
        this.synthesis?.getVoices();
      };
    }
  }

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
      }
      if (this.synthesis && this.synthesis.paused) {
        this.synthesis.resume();
      }
    } catch (e) {
      console.warn('AudioContext unlock notice:', e);
    }
  }

  private initAudioContext(audioElement: HTMLAudioElement) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      try {
        this.mediaSourceNode = this.audioContext.createMediaElementSource(audioElement);
        this.gainNode = this.audioContext.createGain();
        this.compressorNode = this.audioContext.createDynamicsCompressor();

        this.compressorNode.threshold.setValueAtTime(-12, this.audioContext.currentTime);
        this.compressorNode.knee.setValueAtTime(20, this.audioContext.currentTime);
        this.compressorNode.ratio.setValueAtTime(8, this.audioContext.currentTime);
        this.compressorNode.attack.setValueAtTime(0.003, this.audioContext.currentTime);
        this.compressorNode.release.setValueAtTime(0.25, this.audioContext.currentTime);

        const boostMultiplier = Math.max(0.1, this.settings.voiceVolume * 1.5);
        this.gainNode.gain.setValueAtTime(boostMultiplier, this.audioContext.currentTime);

        this.mediaSourceNode.connect(this.gainNode);
        this.gainNode.connect(this.compressorNode);
        this.compressorNode.connect(this.audioContext.destination);
      } catch {
        audioElement.volume = Math.min(1, this.settings.voiceVolume);
      }
    } catch {
      audioElement.volume = Math.min(1, this.settings.voiceVolume);
    }
  }

  public updateSettings(newSettings: ReaderSettings) {
    const oldSettings = this.settings;
    this.settings = newSettings;

    // 1. Volume update
    if (this.gainNode && this.audioContext) {
      const boostMultiplier = Math.max(0.1, newSettings.voiceVolume * 1.5);
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

    // 3. Playback speed or voice change (Immediate!)
    const speedChanged = oldSettings.playbackSpeed !== newSettings.playbackSpeed;
    const voiceChanged = 
      oldSettings.voiceEngine !== newSettings.voiceEngine ||
      oldSettings.geminiVoice !== newSettings.geminiVoice ||
      oldSettings.selectedBrowserVoiceURI !== newSettings.selectedBrowserVoiceURI ||
      oldSettings.language !== newSettings.language ||
      oldSettings.voiceStyleMode !== newSettings.voiceStyleMode;

    if (this.status === 'playing' || this.status === 'buffering') {
      if (voiceChanged) {
        this.play(this.currentSentenceIndex);
      } else if (speedChanged) {
        if (newSettings.voiceEngine === 'gemini' && this.currentAudioElement) {
          this.currentAudioElement.playbackRate = newSettings.playbackSpeed;
        } else if (newSettings.voiceEngine === 'browser') {
          this.play(this.currentSentenceIndex);
        }
      }
    }
  }

  public setSentences(sentences: SentenceItem[], startIndex: number = 0) {
    this.stop();
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

    // Start guitar punteo if in Gaucho mode or guitar accompaniment is enabled
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

    // Stop guitar when paused
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
      this.currentAudioElement.pause();
      this.currentAudioElement.currentTime = 0;
      this.currentAudioElement.onended = null;
      this.currentAudioElement.onerror = null;
      this.currentAudioElement.onplay = null;
      this.currentAudioElement = null;
    }

    if (this.synthesis) {
      this.synthesis.cancel();
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

  // --- Browser Web Speech API ---
  private playBrowserTTS(text: string) {
    if (!this.synthesis) {
      this.callbacks.onError?.('La síntesis de voz no está soportada en este navegador.');
      this.setStatus('stopped');
      return;
    }

    this.clearChromeKeepAlive();
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance;

    utterance.rate = Math.max(0.5, Math.min(2.5, this.settings.playbackSpeed));
    utterance.pitch = this.settings.voiceStyleMode === 'gaucho' 
      ? 0.85 // slightly deeper pitch for gaucho style
      : Math.max(0.5, Math.min(1.5, this.settings.voicePitch));
    utterance.volume = Math.min(1, this.settings.voiceVolume);

    const targetLang = this.settings.language || 'es-ES';
    utterance.lang = targetLang.includes('-') ? targetLang : `${targetLang}-${targetLang.toUpperCase()}`;

    const voices = this.synthesis.getVoices();
    if (voices && voices.length > 0) {
      if (this.settings.selectedBrowserVoiceURI) {
        const found = voices.find((v) => v.voiceURI === this.settings.selectedBrowserVoiceURI);
        if (found) utterance.voice = found;
      }
      if (!utterance.voice) {
        const langCode = targetLang.slice(0, 2).toLowerCase();
        const matchingVoice = voices.find((v) => v.lang.toLowerCase().startsWith(langCode));
        if (matchingVoice) utterance.voice = matchingVoice;
      }
    }

    utterance.onstart = () => {
      if (this.isCancelled) {
        this.synthesis?.cancel();
        return;
      }
      this.setStatus('playing');
      this.startChromeKeepAlive();
    };

    utterance.onend = () => {
      this.clearChromeKeepAlive();
      if (this.status === 'playing' && !this.isCancelled) {
        this.next();
      }
    };

    utterance.onerror = (e) => {
      this.clearChromeKeepAlive();
      if (e.error === 'interrupted' || e.error === 'canceled' || this.isCancelled) {
        return;
      }
      console.warn('SpeechSynthesis error:', e);
      this.callbacks.onError?.(`Error de audio en el navegador: ${e.error}`);
      this.setStatus('stopped');
    };

    try {
      this.synthesis.speak(utterance);
    } catch {
      this.setStatus('stopped');
    }
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

  // --- Gemini Natural Voice TTS Implementation ---
  private async playGeminiTTS(text: string, index: number) {
    this.abortController = new AbortController();

    const isGaucho = this.settings.voiceStyleMode === 'gaucho';
    const voiceToUse = isGaucho ? 'Fenrir' : this.settings.geminiVoice;
    const stylePrompt = isGaucho
      ? 'Voz de gaucho payador tradicional de la pampa argentina, tono grave, pausado y sentido, con la cadencia criolla de recitar versos camperos o payada'
      : 'Clear, natural, engaging audiobook narrator with vivid expressive inflection';

    const cacheKey = `${index}_${voiceToUse}_${this.settings.voiceStyleMode}`;

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
      }

      if (this.isCancelled) return;

      if (!audioBase64) {
        throw new Error('No se recibió audio válido');
      }

      const audioSrc = `data:audio/wav;base64,${audioBase64}`;
      const audio = new Audio(audioSrc);
      this.currentAudioElement = audio;

      audio.playbackRate = this.settings.playbackSpeed;
      this.initAudioContext(audio);

      audio.onplay = () => {
        if (this.isCancelled) {
          audio.pause();
          return;
        }
        this.setStatus('playing');
        this.prebufferNext(index + 1);
      };

      audio.onended = () => {
        if (this.status === 'playing' && !this.isCancelled) {
          this.next();
        }
      };

      audio.onerror = () => {
        if (this.isCancelled) return;
        this.callbacks.onError?.('Error al reproducir audio de voz natural.');
        this.setStatus('stopped');
      };

      if (!this.isCancelled && this.status !== 'paused') {
        try {
          await audio.play();
        } catch (playErr) {
          console.warn('Direct HTMLAudio playback failed, falling back to browser speech:', playErr);
          this.playBrowserTTS(text);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || this.isCancelled) return;

      console.warn('Gemini TTS fallback to browser TTS:', err);
      this.callbacks.onError?.(`Voz natural no disponible (${err.message}). Cambiando a voz offline del dispositivo.`);
      this.playBrowserTTS(text);
    }
  }

  private async prebufferNext(nextIndex: number) {
    let idx = nextIndex;
    while (idx < this.sentences.length && this.sentences[idx]?.excluded) {
      idx++;
    }
    if (idx >= this.sentences.length || this.settings.voiceEngine !== 'gemini' || this.isCancelled) {
      return;
    }
    const nextSentence = this.sentences[idx];
    if (!nextSentence || !nextSentence.text.trim()) return;

    const isGaucho = this.settings.voiceStyleMode === 'gaucho';
    const voiceToUse = isGaucho ? 'Fenrir' : this.settings.geminiVoice;
    const cacheKey = `${idx}_${voiceToUse}_${this.settings.voiceStyleMode}`;
    if (this.audioCache.has(cacheKey)) return;

    try {
      const stylePrompt = isGaucho
        ? 'Voz de gaucho payador tradicional de la pampa argentina, tono grave, pausado y sentido, con la cadencia criolla de recitar versos camperos o payada'
        : 'Clear, natural, engaging audiobook narrator';

      const response = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: nextSentence.text,
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
      // Ignore background prebuffer errors
    }
  }

  /**
   * Generates a complete standalone WAV file for export,
   * with optional Gaucho acoustic guitar accompaniment mixed in with selectable tempo!
   */
  public static async generateFullAudioWAV(
    text: string,
    voice: string = 'Kore',
    isGauchoMode: boolean = false,
    includeGuitar: boolean = false,
    guitarVolume: number = 0.35,
    guitarTempoBpm: number = 70
  ): Promise<Blob> {
    const voiceToUse = isGauchoMode ? 'Fenrir' : voice;
    const stylePrompt = isGauchoMode
      ? 'Voz de gaucho payador tradicional de la pampa argentina, tono grave, pausado, solemne, con la cadencia campera de versos criollos o payada'
      : 'Clear, articulate, high quality summary narration';

    const response = await fetch('/api/gemini/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.slice(0, 1500),
        voice: voiceToUse,
        style: stylePrompt,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Fallo al generar el audio completo.');
    }

    const data = await response.json();
    const binary = atob(data.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const voiceBlob = new Blob([bytes], { type: 'audio/wav' });

    // If guitar is requested (or in gaucho mode with guitar), mix the guitar track into the WAV!
    if (includeGuitar || isGauchoMode) {
      try {
        return await mixVoiceWithGuitarPunteo(voiceBlob, guitarVolume, guitarTempoBpm);
      } catch (e) {
        console.warn('Could not mix guitar, returning clean voice WAV:', e);
        return voiceBlob;
      }
    }

    return voiceBlob;
  }
}
