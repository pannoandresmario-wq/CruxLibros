import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  Sliders, 
  Sparkles, 
  WifiOff, 
  ChevronUp, 
  ChevronDown,
  Loader2,
  Zap,
  Music,
  Download,
  ShieldCheck,
  X
} from 'lucide-react';
import { ReaderSettings } from '../types';

interface AudioPlayerDockProps {
  isPlaying: boolean;
  isBuffering: boolean;
  currentSentenceIndex: number;
  totalSentences: number;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSkipSeconds: (sec: number) => void;
  onSeekSentence: (index: number) => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
  onOpenAudioDownloadModal: () => void;
  isOnline: boolean;
  onSelectVoice?: (voice: ReaderSettings['geminiVoice']) => void;
  onToggleGaucho?: () => void;
  onOpenQuotaModal?: () => void;
  currentParagraphIndex?: number;
  totalParagraphs?: number;
}

export const AudioPlayerDock: React.FC<AudioPlayerDockProps> = ({
  isPlaying,
  isBuffering,
  currentSentenceIndex,
  totalSentences,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onSkipSeconds,
  onSeekSentence,
  settings,
  onUpdateSettings,
  onOpenAudioDownloadModal,
  isOnline,
  onSelectVoice,
  onToggleGaucho,
  onOpenQuotaModal,
  currentParagraphIndex,
  totalParagraphs,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [availableBrowserVoices, setAvailableBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          setAvailableBrowserVoices(voices);
        }
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
      const timer = setTimeout(loadVoices, 300);
      return () => clearTimeout(timer);
    }
  }, []);

  const sortedBrowserVoices = useMemo(() => {
    return [...availableBrowserVoices].sort((a, b) => {
      const aEs = a.lang.toLowerCase().startsWith('es');
      const bEs = b.lang.toLowerCase().startsWith('es');
      if (aEs && !bEs) return -1;
      if (!aEs && bEs) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [availableBrowserVoices]);

  const geminiVoices: Array<{ id: ReaderSettings['geminiVoice']; name: string; desc: string; gender: string }> = [
    { id: 'Fenrir', name: 'Fenrir', desc: 'Profunda, grave y firme', gender: 'Masculina' },
    { id: 'Charon', name: 'Charon', desc: 'Baja, solemne y académica', gender: 'Masculina' },
    { id: 'Puck', name: 'Puck', desc: 'Enérgica, dinámica y vivaz', gender: 'Masculina' },
    { id: 'Kore', name: 'Kore', desc: 'Cálida, clara y natural', gender: 'Femenina' },
    { id: 'Zephyr', name: 'Zephyr', desc: 'Suave, dulce y reflexiva', gender: 'Femenina' },
  ];

  const progressPercent = totalSentences > 0 
    ? Math.round(((currentSentenceIndex + 1) / totalSentences) * 100) 
    : 0;

  const currentVolumePercent = Math.round(settings.voiceVolume * 100);

  return (
    <>
      {/* Backdrop overlay: clicking anywhere on the screen/book closes the drawer */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-35 bg-stone-950/60 backdrop-blur-xs transition-opacity cursor-pointer pointer-events-auto"
          onClick={() => setIsExpanded(false)}
          title="Toca para cerrar el menú de configuración"
          aria-label="Cerrar menú de configuración"
        />
      )}

      <div className={`fixed bottom-0 left-0 right-0 ${isExpanded ? 'z-40' : 'z-30'} pointer-events-none p-2 sm:p-4`}>
        <div className="max-w-3xl mx-auto bg-stone-900/98 text-stone-100 rounded-2xl shadow-2xl border border-stone-800 backdrop-blur-xl pointer-events-auto transition-all overflow-hidden flex flex-col">
        
        {/* Progress Bar (Clickable & Scrubbable by sentences) */}
        <div 
          className="relative h-2 w-full bg-stone-800 cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, clickX / rect.width));
            const targetIndex = Math.floor(ratio * totalSentences);
            onSeekSentence(targetIndex);
          }}
          title={`Progreso: Oración ${currentSentenceIndex + 1} de ${totalSentences}`}
        >
          <div 
            className="h-full bg-amber-500 group-hover:bg-amber-400 transition-all duration-150"
            style={{ width: `${progressPercent}%` }}
          />
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-amber-400 rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity"
            style={{ left: `calc(${progressPercent}% - 7px)` }}
          />
        </div>

        {/* Primary Controls Row */}
        <div className="p-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Left: Sentence info & Active Voice badge */}
          <div className="flex items-center gap-2 min-w-0 max-w-[150px] sm:max-w-xs">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 cursor-pointer transition-colors"
              title={isExpanded ? 'Ocultar ajustes' : 'Abrir ajustes de voz, gaucho y punteo'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold font-mono text-amber-400">
                  {totalParagraphs && totalParagraphs > 0 ? (
                    <span className="text-stone-300">Párrafo <span className="text-amber-300 font-bold">{(currentParagraphIndex ?? 0) + 1}</span>/{totalParagraphs} • </span>
                  ) : null}
                  Oración {currentSentenceIndex + 1}/{totalSentences}
                </span>

                {settings.voiceStyleMode === 'gaucho' ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-0.5">
                    <span>🤠</span> Gaucho
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700 truncate">
                    {settings.voiceEngine === 'gemini' ? settings.geminiVoice : 'Offline'}
                  </span>
                )}

                {(settings.guitarAccompaniment || settings.voiceStyleMode === 'gaucho') && (
                  <span className="text-[10px] text-amber-400 flex items-center" title="Punteo de guitarra criolla activo">
                    <Music className="w-3 h-3 stroke-[2.5]" />
                  </span>
                )}
              </div>
              <p className="text-[10px] text-stone-400 truncate flex items-center gap-1 mt-0.5">
                <span>{progressPercent}% leído</span>
                {settings.voiceVolume > 1 && (
                  <span className="text-amber-400 font-bold flex items-center text-[9px] bg-amber-500/20 px-1 rounded">
                    <Zap className="w-2.5 h-2.5 mr-0.5 fill-current" />
                    {currentVolumePercent}%
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Center: Playback Controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onSkipSeconds(-10)}
              className="p-2 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
              title="Rebobinar 10 segundos"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Previous Sentence */}
            <button
              onClick={onPrevious}
              disabled={currentSentenceIndex <= 0}
              className="p-2 text-stone-400 hover:text-stone-100 disabled:opacity-30 hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
              title="Oración anterior"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Main Play / Pause Button */}
            <button
              onClick={isPlaying || isBuffering ? onPause : () => onPlay()}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center font-bold shadow-lg transition-transform active:scale-95 cursor-pointer"
              title={isPlaying || isBuffering ? 'Pausar o cancelar lectura' : 'Reproducir lectura'}
            >
              {isBuffering ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Next Sentence */}
            <button
              onClick={onNext}
              disabled={currentSentenceIndex >= totalSentences - 1}
              className="p-2 text-stone-400 hover:text-stone-100 disabled:opacity-30 hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
              title="Siguiente oración"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              onClick={() => onSkipSeconds(10)}
              className="p-2 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
              title="Avanzar 10 segundos"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Download Audio Button & Quick Settings */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* Quick Granularity Toggle (Párrafos vs Oraciones) */}
            <button
              onClick={() => onUpdateSettings({ readingGranularity: settings.readingGranularity === 'paragraph' ? 'sentence' : 'paragraph' })}
              className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                settings.readingGranularity === 'paragraph'
                  ? 'bg-amber-500/25 border-amber-500/50 text-amber-300 font-bold'
                  : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200'
              }`}
              title={
                settings.readingGranularity === 'paragraph'
                  ? 'Modo Párrafo Activo: Lectura continua sin pausas entre oraciones cortas (clic para cambiar a oraciones)'
                  : 'Modo Oración Activo: Frase a frase (clic para cambiar a párrafos continuos)'
              }
            >
              <span>{settings.readingGranularity === 'paragraph' ? '📖' : '🔤'}</span>
              <span className="hidden md:inline text-[11px]">
                {settings.readingGranularity === 'paragraph' ? 'Párrafos' : 'Oraciones'}
              </span>
            </button>

            {/* Quick Gaucho toggle button */}
            <button
              onClick={() => {
                if (onToggleGaucho) {
                  onToggleGaucho();
                } else {
                  const nextGaucho = settings.voiceStyleMode !== 'gaucho';
                  onUpdateSettings({ 
                    voiceStyleMode: nextGaucho ? 'gaucho' : 'standard',
                    guitarAccompaniment: nextGaucho ? true : settings.guitarAccompaniment,
                    geminiVoice: 'Fenrir',
                    voiceEngine: 'gemini',
                  });
                }
              }}
              className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                settings.voiceStyleMode === 'gaucho'
                  ? 'bg-amber-500/25 border-amber-500/60 text-amber-300 font-bold ring-1 ring-amber-500/50'
                  : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200'
              }`}
              title={settings.voiceStyleMode === 'gaucho' ? 'Modo Gaucho activo' : 'Activar Modo Gaucho Payador'}
            >
              <span className="text-sm">🤠</span>
              <span className="hidden md:inline text-[11px]">Gaucho</span>
            </button>

            {/* Direct Download Audio Button */}
            <button
              onClick={onOpenAudioDownloadModal}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
              title="Descargar audio en archivo WAV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Descargar</span>
            </button>

            {/* Expand Settings */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-2 rounded-xl border text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                isExpanded 
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' 
                  : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
              }`}
              title="Ajustes de voz, velocidad y guitarra"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Voice & Guitar Settings Panel with fixed max-height and close button */}
        {isExpanded && (
          <div className="flex flex-col max-h-[70vh] sm:max-h-[74vh] border-t border-stone-800 bg-stone-950/95 overflow-hidden">
            {/* Sticky Header with prominent close X button */}
            <div className="sticky top-0 z-10 px-4 py-2.5 bg-stone-900 border-b border-stone-800 flex items-center justify-between shadow-xs shrink-0">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span className="text-xs sm:text-sm font-bold text-stone-100">
                  Configuración de Voz, Modo Gaucho y Lectura
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                title="Cerrar menú (o toca en la pantalla del libro)"
                aria-label="Cerrar menú"
              >
                <span className="text-[11px] text-stone-400">Cerrar</span>
                <X className="w-4 h-4 text-amber-400" />
              </button>
            </div>

            {/* Scrollable Container with max height protection */}
            <div className="overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
              
              {/* 0. Voice Engine / Persistence Strategy Card */}
              <div className="p-3 sm:p-3.5 rounded-xl bg-stone-900 border border-stone-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-stone-100 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Fidelidad y Persistencia de Voz (Para todo el libro)</span>
                    </h4>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Define si prefieres una voz 100% homogénea que nunca cambie ni se corte, o la voz neuronal en la nube.
                    </p>
                  </div>
                  {onOpenQuotaModal && (
                    <button
                      type="button"
                      onClick={onOpenQuotaModal}
                      className="text-[11px] text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer shrink-0"
                    >
                      ¿Cómo ampliar cuota de IA?
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ voicePersistenceMode: 'system_unlimited', voiceEngine: 'browser' })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      settings.voicePersistenceMode !== 'ai_prefer_cloud'
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 ring-1 ring-emerald-500/40'
                        : 'bg-stone-850 border-stone-750 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5 text-xs text-stone-100">
                        <span>⚡</span> Voz Ilimitada y Homogénea
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                        Recomendado
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-400 leading-tight">
                      La misma voz lee todo el documento sin límites de cuota, sin cortes y sin cambiar de timbre jamás.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ voicePersistenceMode: 'ai_prefer_cloud', voiceEngine: 'gemini' })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      settings.voicePersistenceMode === 'ai_prefer_cloud'
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-200 ring-1 ring-amber-500/40'
                        : 'bg-stone-850 border-stone-750 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5 text-xs text-stone-100">
                        <span>✨</span> Voz IA en la Nube (Gemini)
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                        Nube
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-400 leading-tight">
                      Locución neuronal avanzada. Sujeta a la cuota diaria de Google AI Studio.
                    </p>
                  </button>
                </div>
              </div>

              {/* 1. Modo Gaucho Payador & Guitarra Criolla Section */}
              <div className="p-3 sm:p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🤠</span>
                    <div>
                      <h4 className="text-xs font-bold text-amber-300">
                        Modo Gaucho Payador Criollo & Punteo de Guitarra
                      </h4>
                      <p className="text-[11px] text-stone-300">
                        {settings.voiceStyleMode === 'gaucho'
                          ? 'Voz campera profunda con bordoneo de milonga en vivo.'
                          : 'Simula el canto y recitado de versos camperos con bordoneo de guitarra criolla en vivo.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (onToggleGaucho) {
                          onToggleGaucho();
                        } else {
                          const next = settings.voiceStyleMode !== 'gaucho';
                          onUpdateSettings({ 
                            voiceStyleMode: next ? 'gaucho' : 'standard',
                            guitarAccompaniment: next,
                            geminiVoice: 'Fenrir',
                          });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        settings.voiceStyleMode === 'gaucho'
                          ? 'bg-amber-500 text-stone-950 shadow-xs'
                          : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      {settings.voiceStyleMode === 'gaucho' ? 'Activado (Modo Gaucho)' : 'Activar Modo Gaucho'}
                    </button>
                  </div>
                </div>

                {/* Guitar volume & tempo controls - ONLY visible and active when in Gaucho mode */}
                {settings.voiceStyleMode === 'gaucho' ? (
                  <div className="pt-2 border-t border-amber-500/20 space-y-2.5 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-semibold text-amber-300">
                        <Music className="w-3.5 h-3.5 text-amber-400" />
                        <span>Punteo de Guitarra Criolla (Bordoneo de Milonga):</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-stone-400">Volumen Punteo:</span>
                        <input
                          type="range"
                          min="0.1"
                          max="0.8"
                          step="0.05"
                          value={settings.guitarVolume}
                          onChange={(e) => onUpdateSettings({ guitarVolume: parseFloat(e.target.value) })}
                          className="accent-amber-500 w-24 sm:w-32 cursor-pointer"
                        />
                        <span className="text-[11px] font-mono font-bold text-amber-400 w-8 text-right">
                          {Math.round(settings.guitarVolume * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Guitar Tempo / Rhythm (BPM) Slider */}
                    <div className="pt-2 border-t border-amber-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-amber-300 font-semibold">Ritmo / Tempo de la Guitarra:</span>
                        <span className="font-mono text-[11px] text-amber-400 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded">
                          {settings.guitarTempo || 70} BPM
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="45"
                          max="115"
                          step="5"
                          value={settings.guitarTempo || 70}
                          onChange={(e) => onUpdateSettings({ guitarTempo: parseInt(e.target.value, 10) })}
                          className="accent-amber-500 w-28 sm:w-36 cursor-pointer"
                          title="Ajustar tempo del punteo de guitarra"
                        />
                        <div className="flex items-center gap-1">
                          {[
                            { label: 'Lento (55)', bpm: 55 },
                            { label: 'Normal (70)', bpm: 70 },
                            { label: 'Vivo (95)', bpm: 95 },
                          ].map((p) => (
                            <button
                              key={p.bpm}
                              type="button"
                              onClick={() => onUpdateSettings({ guitarTempo: p.bpm })}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer ${
                                (settings.guitarTempo || 70) === p.bpm
                                  ? 'bg-amber-500 text-stone-950 font-bold'
                                  : 'bg-stone-800 text-stone-300 hover:bg-stone-750'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-stone-400 italic pt-1 border-t border-amber-500/20">
                    * El acompañamiento de guitarra criolla está reservado exclusivamente para el Modo Payador Gaucho.
                  </p>
                )}
              </div>

            {/* 2. Reading Cut & Granularity Mode Section */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-stone-900 border border-stone-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span>✂️</span>
                    <span>Modo de Corte y Fluidez de Lectura</span>
                  </h4>
                  <p className="text-[11px] text-stone-300 mt-0.5">
                    Elige entre lectura de párrafos enteros de corrido o por oraciones, evitando cortes molestos en frases breves.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-0.5 rounded-xl bg-stone-800 border border-stone-700 shrink-0">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ readingGranularity: 'paragraph' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      settings.readingGranularity === 'paragraph'
                        ? 'bg-amber-500 text-stone-950 shadow-xs'
                        : 'text-stone-300 hover:text-stone-100'
                    }`}
                  >
                    <span>📖</span>
                    <span>Párrafos (Continuo)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ readingGranularity: 'sentence' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      settings.readingGranularity !== 'paragraph'
                        ? 'bg-amber-500 text-stone-950 shadow-xs'
                        : 'text-stone-300 hover:text-stone-100'
                    }`}
                  >
                    <span>🔤</span>
                    <span>Por Oraciones</span>
                  </button>
                </div>
              </div>

              {settings.readingGranularity !== 'paragraph' && (
                <div className="pt-2 border-t border-stone-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <label htmlFor="dock-merge-short-check" className="flex items-center gap-2 text-stone-300 cursor-pointer">
                    <input
                      id="dock-merge-short-check"
                      type="checkbox"
                      checked={settings.mergeShortSentences}
                      onChange={(e) => onUpdateSettings({ mergeShortSentences: e.target.checked })}
                      className="accent-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Unir oraciones cortas automáticamente (evita pausas constantes y lecturas entrecortadas)</span>
                  </label>
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30 shrink-0">
                    Recomendado para fluidez
                  </span>
                </div>
              )}
            </div>

            {/* 3. ALL Voices: Natural Gemini Voices (ALWAYS VISIBLE) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-300">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Voces Naturales de Alta Calidad (Gemini AI):</span>
                </div>
                <span className="text-amber-400 text-[11px]">Cambio instantáneo</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {geminiVoices.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      if (onSelectVoice) {
                        onSelectVoice(v.id);
                      } else {
                        onUpdateSettings({ geminiVoice: v.id, voiceEngine: 'gemini', voiceStyleMode: 'standard', guitarAccompaniment: false });
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      settings.geminiVoice === v.id && settings.voiceEngine === 'gemini' && settings.voiceStyleMode !== 'gaucho'
                        ? 'border-amber-500 bg-amber-500/25 text-amber-200 font-semibold ring-1 ring-amber-500/50'
                        : 'border-stone-800 bg-stone-900 text-stone-300 hover:bg-stone-850'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold">{v.name}</div>
                      <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                        v.gender === 'Masculina' ? 'bg-sky-500/20 text-sky-300' : 'bg-pink-500/20 text-pink-300'
                      }`}>
                        {v.gender}
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-400 leading-tight mt-1">
                      {v.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Offline Browser System Voices Option */}
            <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <WifiOff className="w-3.5 h-3.5 text-stone-400" />
                  <span className="font-semibold text-stone-200">Voz Offline del Dispositivo (Modo sin Internet)</span>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ voiceEngine: settings.voiceEngine === 'browser' ? 'gemini' : 'browser' })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    settings.voiceEngine === 'browser'
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-750'
                  }`}
                >
                  {settings.voiceEngine === 'browser' ? 'Voz Offline Activa' : 'Usar Voz Offline'}
                </button>
              </div>

              {settings.voiceEngine === 'browser' && sortedBrowserVoices.length > 0 && (
                <div className="pt-2 border-t border-stone-800 flex flex-col sm:flex-row sm:items-center gap-2">
                  <label htmlFor="browser-voice-select" className="text-[11px] text-stone-400 shrink-0">
                    Seleccionar voz instalada:
                  </label>
                  <select
                    id="browser-voice-select"
                    value={settings.selectedBrowserVoiceURI || ''}
                    onChange={(e) => onUpdateSettings({ selectedBrowserVoiceURI: e.target.value, voiceEngine: 'browser' })}
                    className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-xs text-stone-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {sortedBrowserVoices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang}) {voice.default ? '★ Predeterminada' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 4. Speed & Volume Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              
              {/* Speed Slider */}
              <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 space-y-2">
                <div className="flex justify-between items-center text-xs text-stone-300">
                  <span className="font-semibold">Velocidad de Lectura</span>
                  <span className="font-mono text-amber-400 font-bold text-sm bg-amber-500/10 px-2 py-0.5 rounded">
                    {settings.playbackSpeed}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.25"
                  value={settings.playbackSpeed}
                  onChange={(e) => onUpdateSettings({ playbackSpeed: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                  <span>0.5x</span>
                  <span>1.0x (Normal)</span>
                  <span>1.5x</span>
                  <span>2.5x</span>
                </div>
              </div>

              {/* Volume Slider with Boost */}
              <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 space-y-2">
                <div className="flex justify-between items-center text-xs text-stone-300">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>Volumen & Amplificador</span>
                  </div>
                  <span className={`font-mono font-bold text-sm px-2 py-0.5 rounded flex items-center gap-1 ${
                    settings.voiceVolume > 1 
                      ? 'bg-amber-500 text-stone-950 shadow-xs' 
                      : 'bg-stone-800 text-amber-400'
                  }`}>
                    {settings.voiceVolume > 1 && <Zap className="w-3 h-3 fill-current" />}
                    {currentVolumePercent}%
                    {settings.voiceVolume > 1 && <span className="text-[10px] uppercase font-bold">Boost</span>}
                  </span>
                </div>

                <input
                  type="range"
                  min="0.1"
                  max="2.5"
                  step="0.1"
                  value={settings.voiceVolume}
                  onChange={(e) => onUpdateSettings({ voiceVolume: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />

                <div className="flex items-center justify-between gap-1 pt-1">
                  {[
                    { label: '100%', val: 1.0 },
                    { label: '150% ⚡', val: 1.5 },
                    { label: '200% ⚡', val: 2.0 },
                    { label: '250% 🚀', val: 2.5 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => onUpdateSettings({ voiceVolume: preset.val })}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        Math.abs(settings.voiceVolume - preset.val) < 0.05
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-stone-800 hover:bg-stone-750 text-stone-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* End of scrollable container */}
            </div>
          </div>
        )}

      </div>
    </div>
  </>
  );
};
