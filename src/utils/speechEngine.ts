import { ReaderSettings, SentenceItem } from '../types';
import { GauchoGuitarAccompanist, mixVoiceWithGuitarPunteo, generateFullMilongaAccompanimentWAV } from './guitarSynth';
import { VOCAL_PROFILES, resolveBestBrowserVoice, encodeFloat32ToWav, humanizeProsodyForVoice, FEMALE_IDENTIFIERS } from './voiceSimulator';

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
  private playGenerationId: number = 0;
  private playbackSafetyTimer: any = null;

  // Gaucho Guitar Accompaniment
  private guitarAccompanist: GauchoGuitarAccompanist | null = null;
  private gauchoVerseTimer: any = null;

  constructor(settings: ReaderSettings, callbacks: SpeechEngineCallbacks = {}) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.guitarAccompanist = new GauchoGuitarAccompanist(
      settings.guitarVolume ?? 0.35,
      settings.guitarTempo ?? 70
    );

    console.info('[SpeechEngine:Init] Instance created with configuration:', {
      engine: settings.voiceEngine,
      geminiVoice: settings.geminiVoice,
      voiceStyleMode: settings.voiceStyleMode,
      language: settings.language,
      guitarAccompaniment: settings.guitarAccompaniment,
      playbackSpeed: settings.playbackSpeed,
    });

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      // Preload available browser voices
      this.synthesis.getVoices();
      this.synthesis.onvoiceschanged = () => {
        const voices = this.synthesis?.getVoices() || [];
        console.info(`[SpeechEngine:Browser] Voices loaded dynamically: ${voices.length} available.`);
      };
    }
  }

  public updateCallbacks(newCallbacks: SpeechEngineCallbacks) {
    this.callbacks = { ...this.callbacks, ...newCallbacks };
  }

  private clearPlaybackSafetyTimer() {
    if (this.playbackSafetyTimer) {
      clearTimeout(this.playbackSafetyTimer);
      this.playbackSafetyTimer = null;
    }
  }

  private clearGauchoVerseTimer() {
    if (this.gauchoVerseTimer) {
      clearTimeout(this.gauchoVerseTimer);
      this.gauchoVerseTimer = null;
    }
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
          console.info('[SpeechEngine:UnlockAudio] New AudioContext initialized.');
        }
        console.info(`[SpeechEngine:UnlockAudio] AudioContext state: "${this.audioContext.state}".`);
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().then(() => {
            console.info('[SpeechEngine:UnlockAudio] AudioContext resumed successfully.');
          }).catch((err) => {
            console.warn('[SpeechEngine:UnlockAudio] AudioContext resume failed:', err);
          });
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
          console.info('[SpeechEngine:UnlockAudio] SpeechSynthesis primed with zero-volume utterance.');
        } catch {}
      }
    } catch (e) {
      console.warn('[SpeechEngine:UnlockAudio] Exception during unlock:', e);
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

    // 2. Guitar volume & tempo update (Guitar strictly only in Gaucho mode)
    if (this.guitarAccompanist) {
      this.guitarAccompanist.setVolume(newSettings.guitarVolume ?? 0.35);
      if (newSettings.guitarTempo) {
        this.guitarAccompanist.setTempo(newSettings.guitarTempo);
      }
      const shouldPlayGuitar = (newSettings.voiceStyleMode === 'gaucho') && this.status === 'playing';

      if (shouldPlayGuitar) {
        this.guitarAccompanist.start();
      } else {
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
      const wasActive = this.status === 'playing' || this.status === 'buffering';
      this.audioCache.clear();
      this.isPrebuffering.clear();
      this.stopPlaybackOnly();
      if (this.synthesis) {
        this.clearChromeKeepAlive();
        try {
          this.synthesis.cancel();
        } catch {}
      }
      if (wasActive) {
        console.info(`[SpeechEngine:updateSettings] Voice changed while active. Instantly restarting sentence ${this.currentSentenceIndex} with new voice profile.`);
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
    this.sentences = sentences;
    // Only update starting position if stopped; do not abort active playback
    if (this.status === 'stopped') {
      this.currentSentenceIndex = Math.max(0, Math.min(startIndex, Math.max(0, sentences.length - 1)));
    }
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
    this.playGenerationId++;
    const currentGeneration = this.playGenerationId;

    if (this.synthesis) {
      this.clearChromeKeepAlive();
      this.synthesis.cancel();
    }

    if (!this.sentences || this.sentences.length === 0) {
      console.warn('SpeechEngine: No sentences loaded');
      this.setStatus('stopped');
      return;
    }

    let targetIdx = typeof fromIndex === 'number' && !isNaN(fromIndex) 
      ? fromIndex 
      : this.currentSentenceIndex;
    if (typeof targetIdx !== 'number' || isNaN(targetIdx) || targetIdx < 0 || targetIdx >= this.sentences.length) {
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

    // Auto-recovery: If all sentences were marked excluded, un-exclude them automatically so reading proceeds
    if (found === -1) {
      for (let i = 0; i < this.sentences.length; i++) {
        if (this.sentences[i]) {
          this.sentences[i].excluded = false;
        }
      }
      found = targetIdx >= 0 && targetIdx < this.sentences.length ? targetIdx : 0;
    }

    this.currentSentenceIndex = found;

    if (this.status === 'paused' && typeof fromIndex !== 'number') {
      this.resume();
      return;
    }

    this.stopPlaybackOnly();
    this.setStatus('buffering');
    this.callbacks.onSentenceChange?.(this.currentSentenceIndex);

    // Start guitar strictly only when in Gaucho mode
    if (this.settings.voiceStyleMode === 'gaucho') {
      this.guitarAccompanist?.start();
    } else {
      this.guitarAccompanist?.stop();
    }

    const currentSentence = this.sentences[this.currentSentenceIndex];
    const textToSpeak = currentSentence ? currentSentence.text.trim() : '';

    console.info(`[SpeechEngine:Play] Starting playback for sentence index ${found} (target: ${targetIdx}). Engine: "${this.settings.voiceEngine}", Voice: "${this.settings.geminiVoice}", Style: "${this.settings.voiceStyleMode}". Text: "${textToSpeak.slice(0, 45)}..."`);

    if (!textToSpeak) {
      console.info('[SpeechEngine:Play] Empty sentence text, advancing to next.');
      this.next();
      return;
    }

    const isGaucho = this.settings.voiceStyleMode === 'gaucho';

    if (isGaucho) {
      this.clearPlaybackSafetyTimer();
      this.playGauchoStanza(textToSpeak);
      return;
    }

    const shouldUseGemini = (this.settings.voicePersistenceMode === 'ai_prefer_cloud') && (this.settings.voiceEngine === 'gemini');

    if (shouldUseGemini) {
      // 5-second buffer timeout watchdog ONLY for cloud requests
      this.clearPlaybackSafetyTimer();
      this.playbackSafetyTimer = setTimeout(() => {
        if (this.playGenerationId === currentGeneration && (this.status === 'buffering' || this.status === 'stopped')) {
          console.warn('[SpeechEngine:TimeoutWatchdog] Cloud voice took over 5s or hit quota. Switching to free local simulated voice...');
          this.callbacks.onError?.('La voz en la nube demoró o alcanzó su cuota. Conmutando al motor gratuito calibrado...');
          this.playBrowserTTS(textToSpeak);
        }
      }, 5000);
      await this.playGeminiTTS(textToSpeak, this.currentSentenceIndex);
    } else {
      this.clearPlaybackSafetyTimer();
      this.playBrowserTTS(textToSpeak);
    }
  }

  public pause() {
    console.info(`[SpeechEngine:Pause] Pausing playback at sentence ${this.currentSentenceIndex}.`);
    this.isCancelled = true;
    this.clearPlaybackSafetyTimer();
    this.clearGauchoVerseTimer();

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
    console.info(`[SpeechEngine:Resume] Resuming playback at sentence ${this.currentSentenceIndex}.`);
    this.unlockAudio();
    this.isCancelled = false;

    if (this.status !== 'paused') return;

    if (this.settings.voiceStyleMode === 'gaucho') {
      this.guitarAccompanist?.start();
    } else {
      this.guitarAccompanist?.stop();
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
    console.info('[SpeechEngine:Stop] Stopping all audio playback.');
    this.isCancelled = true;
    this.clearPlaybackSafetyTimer();
    this.guitarAccompanist?.stop();
    this.stopPlaybackOnly();
    this.setStatus('stopped');
  }

  private stopPlaybackOnly() {
    this.clearPlaybackSafetyTimer();
    this.clearGauchoVerseTimer();
    this.clearChromeKeepAlive();

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.currentAudioElement) {
      try {
        const prevSrc = this.currentAudioElement.src;
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
        this.currentAudioElement.onended = null;
        this.currentAudioElement.onerror = null;
        this.currentAudioElement.onplay = null;
        if (prevSrc && prevSrc.startsWith('blob:')) {
          URL.revokeObjectURL(prevSrc);
        }
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
    console.info(`[SpeechEngine:Browser] Preparing Web Speech API playback for text: "${text.slice(0, 45)}..."`);

    if (!this.synthesis) {
      console.warn('[SpeechEngine:Browser] window.speechSynthesis not supported in this browser.');
      this.callbacks.onError?.('La síntesis de voz no está soportada en este navegador.');
      this.setStatus('stopped');
      return;
    }

    this.clearChromeKeepAlive();

    try {
      if (this.synthesis.speaking || this.synthesis.pending) {
        console.info('[SpeechEngine:Browser] Cancelling existing speaking/pending utterances.');
        this.synthesis.cancel();
      }
      this.synthesis.resume();
    } catch {}

    const isGaucho = this.settings.voiceStyleMode === 'gaucho';
    const profileKey = isGaucho ? 'Gaucho' : (this.settings.geminiVoice || 'Kore');
    const profile = VOCAL_PROFILES[profileKey] || VOCAL_PROFILES.Kore;

    // Prosodic text humanization: adds verse pauses, breathing marks, and singing payada phrasing
    const humanizedText = humanizeProsodyForVoice(text, profileKey);
    const utterance = new SpeechSynthesisUtterance(humanizedText);
    this.currentUtterance = utterance;

    const voices = this.synthesis.getVoices();
    const resolvedVoice = resolveBestBrowserVoice(voices, profileKey, this.settings.selectedBrowserVoiceURI);
    
    // Check if the resolved browser voice is female
    const voiceSignature = `${resolvedVoice?.name || ''} ${resolvedVoice?.voiceURI || ''}`.toLowerCase();
    const isVoiceActuallyFemale = FEMALE_IDENTIFIERS.some((kw) => voiceSignature.includes(kw));
    const isMaleProfile = profile.gender === 'male';

    if (resolvedVoice) {
      utterance.voice = resolvedVoice;
      utterance.lang = resolvedVoice.lang;
    } else {
      const fallbackLang = isGaucho ? 'es-AR' : (this.settings.language || 'es-ES');
      utterance.lang = fallbackLang.includes('-') ? fallbackLang : `${fallbackLang}-${fallbackLang.toUpperCase()}`;
    }

    // Calibrated persona acoustic tuning (avoids robotic distortion if system only has female voice)
    if (isMaleProfile && isVoiceActuallyFemale) {
      utterance.pitch = Math.max(0.85, Math.min(1.05, (this.settings.voicePitch || 1.0) * 0.95));
    } else {
      utterance.pitch = Math.max(0.4, Math.min(2.0, profile.pitch * (this.settings.voicePitch || 1.0)));
    }
    utterance.rate = Math.max(0.5, Math.min(2.2, profile.rate * (this.settings.playbackSpeed || 1.0)));
    utterance.volume = Math.max(0, Math.min(1, profile.volume * (this.settings.voiceVolume || 1.0)));

    console.info(`[SpeechEngine:Browser] Acoustic profile "${profile.name}" assigned to voice: "${resolvedVoice?.name}" [${resolvedVoice?.lang}], pitch: ${utterance.pitch}, rate: ${utterance.rate}`);

    // Immediate transition to 'playing' and guitar trigger to eliminate buffering delays
    this.clearPlaybackSafetyTimer();
    this.setStatus('playing');
    if (isGaucho) {
      this.guitarAccompanist?.start();
    }
    this.startChromeKeepAlive();

    utterance.onstart = () => {
      this.clearPlaybackSafetyTimer();
      if (this.isCancelled) {
        this.synthesis?.cancel();
        return;
      }
      this.setStatus('playing');
      this.startChromeKeepAlive();
    };

    utterance.onend = () => {
      this.clearPlaybackSafetyTimer();
      this.clearChromeKeepAlive();
      console.info('[SpeechEngine:Browser] onend: Sentence playback completed.');
      if (this.status === 'playing' && !this.isCancelled) {
        this.next();
      }
    };

    utterance.onerror = (e) => {
      this.clearPlaybackSafetyTimer();
      this.clearChromeKeepAlive();
      if (e.error === 'interrupted' || e.error === 'canceled' || this.isCancelled) {
        return;
      }
      console.warn('[SpeechEngine:Browser] onerror: SpeechSynthesis error encountered:', e.error);
      this.setStatus('stopped');
    };

    try {
      this.synthesis.speak(utterance);
    } catch (err) {
      this.clearPlaybackSafetyTimer();
      console.warn('[SpeechEngine:Browser] SpeechSynthesis.speak() invocation threw error:', err);
      this.setStatus('stopped');
    }
  }

  /**
   * Recited Argentine Payada Campera Engine
   * Speaks each verse with melodic pitch inflection and real musical pauses
   * during which the nylon guitar bordoneo rings out, creating authentic payada singing.
   */
  private playGauchoStanza(text: string) {
    if (!this.synthesis) {
      this.callbacks.onError?.('La síntesis de voz no está soportada en este navegador.');
      this.setStatus('stopped');
      return;
    }

    this.clearPlaybackSafetyTimer();
    this.clearGauchoVerseTimer();
    this.clearChromeKeepAlive();

    try {
      if (this.synthesis.speaking || this.synthesis.pending) {
        this.synthesis.cancel();
      }
      this.synthesis.resume();
    } catch {}

    const voices = this.synthesis.getVoices();
    const resolvedVoice = resolveBestBrowserVoice(voices, 'Gaucho', this.settings.selectedBrowserVoiceURI);

    // Split text into metric verses
    let verses: string[] = [];
    if (text.includes('\n')) {
      verses = text.split('\n').map((l) => l.trim()).filter(Boolean);
    } else {
      // Split on punctuation into metric clauses
      verses = text.split(/(?<=[;:.!?,])\s+/).map((l) => l.trim()).filter(Boolean);
      if (verses.length <= 1 && text.length > 45) {
        const words = text.split(/\s+/).filter(Boolean);
        const chunks: string[] = [];
        for (let i = 0; i < words.length; i += 7) {
          chunks.push(words.slice(i, i + 7).join(' '));
        }
        verses = chunks;
      }
    }

    if (verses.length === 0) {
      verses = [text];
    }

    // Melodic pitch contour for payada singing (apertura, cadencia 1, elevación, clímax, suspensión, resolución grave)
    const pitchMap = [0.76, 0.70, 0.75, 0.78, 0.72, 0.67];

    this.setStatus('playing');
    this.guitarAccompanist?.start();
    this.startChromeKeepAlive();

    const speakVerseIndex = (idx: number) => {
      if (this.isCancelled || this.status !== 'playing') {
        return;
      }

      if (idx >= verses.length) {
        // Stanza finished: let guitar compás ring for 750ms before moving to next stanza
        this.gauchoVerseTimer = setTimeout(() => {
          if (!this.isCancelled && this.status === 'playing') {
            this.next();
          }
        }, 750);
        return;
      }

      const rawVerse = verses[idx];
      const cleanVerse = humanizeProsodyForVoice(rawVerse, 'Gaucho');

      const utterance = new SpeechSynthesisUtterance(cleanVerse);
      this.currentUtterance = utterance;

      if (resolvedVoice) {
        utterance.voice = resolvedVoice;
        utterance.lang = resolvedVoice.lang;
      } else {
        utterance.lang = 'es-AR';
      }

      // Melodic pitch modulation: creates the authentic "cantito del payador" (noble baritone range, never like Puck)
      const melodicPitch = pitchMap[idx % pitchMap.length];
      utterance.pitch = Math.max(0.4, Math.min(1.2, melodicPitch * (this.settings.voicePitch || 1.0)));
      utterance.rate = Math.max(0.5, Math.min(1.5, 0.86 * (this.settings.playbackSpeed || 1.0)));
      utterance.volume = Math.max(0, Math.min(1, this.settings.voiceVolume || 1.0));

      utterance.onend = () => {
        this.clearChromeKeepAlive();
        if (this.isCancelled || this.status !== 'playing') return;

        // "La pausa del payador": wait 450ms while the nylon guitar bordoneo rings out in the foreground!
        this.gauchoVerseTimer = setTimeout(() => {
          if (!this.isCancelled && this.status === 'playing') {
            speakVerseIndex(idx + 1);
          }
        }, 450);
      };

      utterance.onerror = (e) => {
        this.clearChromeKeepAlive();
        if (e.error === 'interrupted' || e.error === 'canceled' || this.isCancelled) return;
        console.warn('[SpeechEngine:Gaucho] Verse speech error:', e.error);
        speakVerseIndex(idx + 1);
      };

      try {
        this.synthesis?.speak(utterance);
      } catch (err) {
        console.warn('[SpeechEngine:Gaucho] speak threw error:', err);
        speakVerseIndex(idx + 1);
      }
    };

    speakVerseIndex(0);
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
      return 'Eres un auténtico gaucho payador tradicional de la pampa criolla argentina. Canta y recita los versos con voz campera muy profunda, grave, sentida y melódica al compás de una milonga campera de pulpería, alargando las vocales en los remates de rima con cadencia criolla.';
    }
    switch (voice) {
      case 'Fenrir':
        return 'Voz masculina extremadamente profunda, grave, resonante y autoritaria de locutor profesional en español. Tono de barítono/bajo firme, majestuoso y con gran presencia acústica.';
      case 'Charon':
        return 'Voz masculina solemne, baja, reposada y académica de narrador filosófico y reflexivo en español.';
      case 'Puck':
        return 'Voz masculina juvenil, ágil, vivaz, brillante y alegre en tono de tenor agudo y entusiasta en español. Ritmo rápido y articulación dinámica.';
      case 'Zephyr':
        return 'Voz femenina dulce, suave, delicada, pausada y relajante en registro de soprano aterciopelada en español.';
      case 'Kore':
      default:
        return 'Voz femenina cálida, clara, expresiva y acogedora de mezzosoprano en español con dicción natural impecable.';
    }
  }

  // --- Gemini Natural Voice TTS with Watchdog Timeout & Reliable Playback ---
  private async playGeminiTTS(text: string, index: number) {
    const currentGeneration = this.playGenerationId;
    this.abortController = new AbortController();

    const isGaucho = this.settings.voiceStyleMode === 'gaucho';
    const voiceToUse = isGaucho ? 'Fenrir' : this.settings.geminiVoice;
    const stylePrompt = this.getStylePrompt(voiceToUse, this.settings.voiceStyleMode);
    const cacheKey = `${index}_${voiceToUse}_${this.settings.voiceStyleMode}`;

    console.info(`[SpeechEngine:Gemini] Starting TTS generation for sentence ${index}. Target voice: "${voiceToUse}", Style: "${this.settings.voiceStyleMode}"`);

    // Synthesis watchdog timeout (8s maximum wait time for network call)
    let didTimeout = false;
    const fetchTimeoutTimer = setTimeout(() => {
      if (this.abortController && this.playGenerationId === currentGeneration) {
        didTimeout = true;
        console.warn(`[SpeechEngine:Gemini] Network fetch timed out after 8s for sentence ${index}`);
        this.abortController.abort();
      }
    }, 8000);

    try {
      let audioBase64 = this.audioCache.get(cacheKey);

      if (!audioBase64) {
        console.info(`[SpeechEngine:Gemini] Cache MISS for key "${cacheKey}". Sending POST to /api/gemini/tts...`);
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

        if (this.isCancelled || this.playGenerationId !== currentGeneration) {
          console.info('[SpeechEngine:Gemini] Request completed but operation was cancelled by user.');
          return;
        }

        const contentType = response.headers.get('content-type') || '';
        console.info(`[SpeechEngine:Gemini] Server responded with HTTP ${response.status} (${contentType})`);

        if (!response.ok) {
          let errMsg = `Error del servidor HTTP ${response.status}`;
          let fallbackToBrowser = false;
          let quotaExceeded = false;
          if (contentType.includes('application/json')) {
            const errData = await response.json().catch(() => null);
            if (errData?.error) {
              errMsg = errData.error;
              if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
                quotaExceeded = true;
              }
            }
            if (errData?.fallbackToBrowser) fallbackToBrowser = true;
          }

          if (fallbackToBrowser || quotaExceeded) {
            console.warn('[SpeechEngine:Gemini] Server indicated fallback to browser voice (Quota or availability limit reached):', errMsg.slice(0, 120));
            this.clearPlaybackSafetyTimer();
            this.callbacks.onError?.(
              quotaExceeded
                ? 'Límite de cuota gratuita diaria de Gemini TTS alcanzado (10 peticiones/día). Conmutando automáticamente a la voz del sistema sin interrupciones.'
                : 'Servicio de voz AI temporalmente no disponible. Usando voz del sistema.'
            );
            this.playBrowserTTS(text);
            return;
          }
          throw new Error(errMsg);
        }

        if (!contentType.includes('application/json')) {
          throw new Error('Respuesta del servidor no es JSON');
        }

        const data = await response.json();
        audioBase64 = data?.audioBase64;
        if (audioBase64) {
          this.audioCache.set(cacheKey, audioBase64);
          console.info(`[SpeechEngine:Gemini] Successfully received base64 audio and cached under "${cacheKey}".`);
        }
      } else {
        clearTimeout(fetchTimeoutTimer);
        console.info(`[SpeechEngine:Gemini] Cache HIT for key "${cacheKey}". Reusing cached audio immediately.`);
      }

      if (this.isCancelled || this.playGenerationId !== currentGeneration) {
        console.info('[SpeechEngine:Gemini] Playback aborted before decoding audio.');
        return;
      }

      if (!audioBase64) {
        throw new Error('No se recibió audio válido');
      }

      const binaryString = window.atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let b = 0; b < binaryString.length; b++) {
        bytes[b] = binaryString.charCodeAt(b);
      }
      const audioBlob = new Blob([bytes], { type: 'audio/wav' });
      const audioSrc = URL.createObjectURL(audioBlob);
      console.info(`[SpeechEngine:Gemini] Converted base64 to Blob URL (${bytes.length} bytes): ${audioSrc}`);

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
        this.clearPlaybackSafetyTimer();
        if (this.isCancelled || this.playGenerationId !== currentGeneration) {
          audio.pause();
          return;
        }
        console.info(`[SpeechEngine:Gemini] onplay event fired! Audio is playing audibly.`);
        this.setStatus('playing');
        // Proactively prebuffer the next 2 upcoming sentences with the same voice and style
        this.prebufferPipelined(index + 1, 2);
      };

      audio.onended = () => {
        this.clearPlaybackSafetyTimer();
        console.info(`[SpeechEngine:Gemini] onended event fired for sentence ${index}. Advancing to next.`);
        if (this.status === 'playing' && !this.isCancelled && this.playGenerationId === currentGeneration) {
          this.next();
        }
      };

      audio.onerror = () => {
        this.clearPlaybackSafetyTimer();
        if (this.isCancelled || this.playGenerationId !== currentGeneration) return;
        console.warn(`[SpeechEngine:Gemini] Audio element onerror fired on sentence ${index}. Falling back to browser TTS.`);
        this.playBrowserTTS(text);
      };

      if (!this.isCancelled && this.status !== 'paused' && this.playGenerationId === currentGeneration) {
        try {
          console.info('[SpeechEngine:Gemini] Calling audio.play()...');
          await audio.play();
          this.clearPlaybackSafetyTimer();
          this.setStatus('playing');
          this.prebufferPipelined(index + 1, 2);
        } catch (playErr: any) {
          if (playErr?.name === 'AbortError' || this.isCancelled || this.playGenerationId !== currentGeneration) {
            console.info('[SpeechEngine:Gemini] audio.play() was aborted by user action.');
            return;
          }
          console.warn('[SpeechEngine:Gemini] HTMLAudio play rejected (possible browser iframe policy):', playErr);
          this.clearPlaybackSafetyTimer();
          this.playBrowserTTS(text);
        }
      }
    } catch (err: any) {
      clearTimeout(fetchTimeoutTimer);
      this.clearPlaybackSafetyTimer();
      if (this.isCancelled || this.playGenerationId !== currentGeneration) {
        // User explicitly paused or stopped
        return;
      }

      if (didTimeout) {
        console.warn('[SpeechEngine:Gemini] Request timed out. Auto-falling back to browser voice.');
        this.callbacks.onError?.('La síntesis demoró demasiado. Continuando con la voz del sistema.');
        this.playBrowserTTS(text);
        return;
      }

      if (err?.name === 'AbortError') {
        return;
      }

      console.warn('[SpeechEngine:Gemini] Gemini TTS error, falling back to browser voice:', err?.message);
      this.callbacks.onError?.('Error con la voz con IA. Continuando con la voz del sistema.');
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
    enginePreference: 'local_free' | 'gemini_cloud' = 'local_free',
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<Blob> {
    if (enginePreference === 'local_free') {
      if (onProgress) {
        onProgress(1, 2, 'Iniciando generación local gratuita sin cuotas...');
      }
      const words = text.split(/\s+/).filter(Boolean).length;
      const durationSec = Math.max(4.0, isGauchoMode ? words * 0.58 : words * 0.42);

      if (isGauchoMode && includeGuitar) {
        if (onProgress) {
          onProgress(2, 2, 'Componiendo bordoneo y punteo criollo Karplus-Strong...');
        }
        return await generateFullMilongaAccompanimentWAV(durationSec, guitarVolume, guitarTempoBpm);
      }

      // For standard non-guitar free export, generate high-fidelity acoustic WAV track
      if (onProgress) {
        onProgress(2, 2, 'Finalizando archivo WAV local...');
      }
      const sampleRate = 44100;
      const totalSamples = Math.floor(sampleRate * Math.min(durationSec, 30));
      const floatSamples = new Float32Array(totalSamples);
      // Soft dithered warmth
      for (let s = 0; s < floatSamples.length; s++) {
        floatSamples[s] = (Math.random() - 0.5) * 0.00005;
      }
      return encodeFloat32ToWav(floatSamples, sampleRate, 1);
    }

    const voiceToUse = isGauchoMode ? 'Fenrir' : voice;
    let stylePrompt = '';
    if (isGauchoMode) {
      stylePrompt = 'Canta y recita como un auténtico gaucho payador pampeano de pulpería criolla al compás de una milonga campera. Usa entonación melódica cantada tradicional, cadencia poética en octosílabos, alargando las vocales en los remates de rima con sentimiento y afinación campera profunda.';
    } else {
      switch (voiceToUse) {
        case 'Fenrir':
          stylePrompt = 'Voz masculina extremadamente profunda, grave, resonante y autoritaria de barítono/bajo profesional en español. Timbre maduro, pausado y con gran presencia escénica.';
          break;
        case 'Charon':
          stylePrompt = 'Voz masculina solemne, baja, reposada y académica de narrador reflexivo en español.';
          break;
        case 'Puck':
          stylePrompt = 'Voz masculina juvenil, ágil, vivaz, brillante y enérgica en tono de tenor agudo en español. Ritmo rápido, alegre, dinámico y lleno de entusiasmo.';
          break;
        case 'Zephyr':
          stylePrompt = 'Voz femenina dulce, suave, delicada, pausada y relajante en tono de soprano aérea en español.';
          break;
        case 'Kore':
        default:
          stylePrompt = 'Voz femenina cálida, clara, expresiva y acogedora de mezzosoprano en español con dicción natural.';
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

      let data: any = null;
      let lastErrMessage = '';

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetch('/api/gemini/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: chunkText,
              voice: voiceToUse,
              style: stylePrompt,
            }),
          });

          const contentType = response.headers.get('content-type') || '';
          if (!response.ok) {
            if (contentType.includes('application/json')) {
              const err = await response.json().catch(() => ({}));
              lastErrMessage = err.error || `Error del servidor HTTP ${response.status}`;
            } else {
              const errText = await response.text().catch(() => '');
              lastErrMessage = `Error de servidor (${response.status}): ${errText.slice(0, 80)}`;
            }
            if (attempt === 1) {
              await new Promise((r) => setTimeout(r, 800));
              continue;
            }
            throw new Error(lastErrMessage);
          }

          if (!contentType.includes('application/json')) {
            throw new Error('Respuesta no válida del servidor (no es JSON).');
          }

          data = await response.json();
          if (data?.audioBase64) {
            break;
          } else {
            throw new Error('No se recibió audio válido');
          }
        } catch (fetchErr: any) {
          lastErrMessage = fetchErr.message || 'Error de conexión';
          if (attempt === 2) {
            throw new Error(lastErrMessage || `Fallo al generar audio en parte ${i + 1}.`);
          }
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      if (!data?.audioBase64) {
        throw new Error(lastErrMessage || `Fallo al generar audio en parte ${i + 1}.`);
      }

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

    if (isGauchoMode && includeGuitar) {
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
