import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Volume2, 
  Music, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  FileText,
  Sliders
} from 'lucide-react';
import { DocumentItem, ReaderSettings, SentenceItem } from '../types';
import { SpeechEngine } from '../utils/speechEngine';

interface AudioDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentItem;
  sentences: SentenceItem[];
  currentSentenceIndex: number;
  settings: ReaderSettings;
}

export const AudioDownloadModal: React.FC<AudioDownloadModalProps> = ({
  isOpen,
  onClose,
  document,
  sentences,
  currentSentenceIndex,
  settings,
}) => {
  const [scope, setScope] = useState<'sentence' | 'paragraph' | 'selected' | 'summary' | 'full'>('sentence');
  const [selectedVoice, setSelectedVoice] = useState<'Kore' | 'Fenrir' | 'Puck' | 'Charon' | 'Zephyr'>(settings.geminiVoice);
  const [isGauchoMode, setIsGauchoMode] = useState<boolean>(settings.voiceStyleMode === 'gaucho');
  const [includeGuitar, setIncludeGuitar] = useState<boolean>(settings.guitarAccompaniment || settings.voiceStyleMode === 'gaucho');
  const [guitarVolume, setGuitarVolume] = useState<number>(settings.guitarVolume || 0.35);
  const [guitarTempo, setGuitarTempo] = useState<number>(settings.guitarTempo || 70);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state with current reader settings when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedVoice(settings.geminiVoice);
      setIsGauchoMode(settings.voiceStyleMode === 'gaucho');
      setIncludeGuitar(settings.guitarAccompaniment || settings.voiceStyleMode === 'gaucho');
      setGuitarVolume(settings.guitarVolume || 0.35);
      setGuitarTempo(settings.guitarTempo || 70);
      setErrorMsg(null);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const currentSentence = sentences[currentSentenceIndex];
  const currentParagraph = document.paragraphs[document.currentParagraphIndex] || '';
  const currentSummary = document.summaries?.executive || document.summaries?.bullets || document.summaries?.detailed || '';
  const selectedSentencesText = sentences.filter((s) => !s.excluded).map((s) => s.text).join(' ');

  // Determine text to download based on selected scope
  const getTextToExport = () => {
    switch (scope) {
      case 'sentence':
        return currentSentence ? currentSentence.text : currentParagraph;
      case 'paragraph':
        return currentParagraph;
      case 'selected':
        return selectedSentencesText || currentSentence?.text || currentParagraph;
      case 'summary':
        return currentSummary || currentParagraph;
      case 'full':
      default:
        // Export the complete, unbroken document text
        return document.content;
    }
  };

  const textToExport = getTextToExport();

  const handleDownload = async () => {
    if (!textToExport || !textToExport.trim()) {
      setErrorMsg('No hay texto disponible para generar audio.');
      return;
    }

    setErrorMsg(null);
    setIsGenerating(true);
    setProgressMsg('Iniciando síntesis de locución...');

    try {
      const blob = await SpeechEngine.generateFullAudioWAV(
        textToExport,
        selectedVoice,
        isGauchoMode,
        isGauchoMode && includeGuitar,
        guitarVolume,
        guitarTempo,
        (_current, _total, msg) => {
          setProgressMsg(msg);
        }
      );

      setProgressMsg('Preparando archivo para descarga...');

      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      const sanitizedDocTitle = document.title.replace(/[^a-z0-9_-]/gi, '_').slice(0, 30);
      const modeLabel = isGauchoMode ? 'gaucho_payador' : selectedVoice.toLowerCase();
      const scopeLabel = scope === 'sentence' ? `oracion_${currentSentenceIndex + 1}` : scope;

      a.download = `${sanitizedDocTitle}_${scopeLabel}_${modeLabel}.wav`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      onClose();
    } catch (err: any) {
      console.error('Audio download error:', err);
      setErrorMsg(err.message || 'Error al generar y descargar el audio.');
    } finally {
      setIsGenerating(false);
      setProgressMsg(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 font-reader-serif">
                Descargar Audio
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Exporta la locución en formato WAV con voz natural y guitarra
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* 1. Selection Scope */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
              ¿Qué parte deseas descargar?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              <button
                type="button"
                onClick={() => setScope('sentence')}
                className={`py-2 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-0.5 cursor-pointer transition-all ${
                  scope === 'sentence'
                    ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/50'
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 text-stone-600 dark:text-stone-400'
                }`}
              >
                <span>Oración actual</span>
                <span className="text-[10px] font-mono text-stone-400">#{currentSentenceIndex + 1}</span>
              </button>

              <button
                type="button"
                onClick={() => setScope('selected')}
                className={`py-2 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-0.5 cursor-pointer transition-all ${
                  scope === 'selected'
                    ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/50'
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 text-stone-600 dark:text-stone-400'
                }`}
              >
                <span>Seleccionadas</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Mi resumen</span>
              </button>

              <button
                type="button"
                onClick={() => setScope('paragraph')}
                className={`py-2 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-0.5 cursor-pointer transition-all ${
                  scope === 'paragraph'
                    ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/50'
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 text-stone-600 dark:text-stone-400'
                }`}
              >
                <span>Párrafo actual</span>
                <span className="text-[10px] font-mono text-stone-400">Pág {document.currentParagraphIndex + 1}</span>
              </button>

              <button
                type="button"
                onClick={() => setScope('summary')}
                disabled={!currentSummary}
                className={`py-2 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-0.5 cursor-pointer transition-all disabled:opacity-40 ${
                  scope === 'summary'
                    ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/50'
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 text-stone-600 dark:text-stone-400'
                }`}
              >
                <span>Resumen IA</span>
                <span className="text-[10px] text-stone-400">{currentSummary ? 'Listo' : 'Sin resumen'}</span>
              </button>

              <button
                type="button"
                onClick={() => setScope('full')}
                className={`py-2 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-0.5 cursor-pointer transition-all ${
                  scope === 'full'
                    ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/50'
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 text-stone-600 dark:text-stone-400'
                }`}
              >
                <span>Capítulo</span>
                <span className="text-[10px] text-stone-400">Completo</span>
              </button>
            </div>
          </div>

          {/* 2. Style / Voice Mode Selection */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
              Voz y Modo de Locución
            </label>

            {/* Gaucho Payador Mode Card */}
            <div 
              onClick={() => {
                setIsGauchoMode(!isGauchoMode);
                if (!isGauchoMode) {
                  setIncludeGuitar(true);
                }
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                isGauchoMode
                  ? 'border-amber-500 bg-amber-500/10 text-stone-900 dark:text-stone-100 ring-1 ring-amber-500/40'
                  : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 text-stone-600 dark:text-stone-300'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <span className="text-lg">🤠</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                    Modo Gaucho Payador Criollo
                  </span>
                  <input
                    type="checkbox"
                    checked={isGauchoMode}
                    onChange={() => {}}
                    className="accent-amber-500 w-4 h-4 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  Simula el canto o recitado de versos al estilo gaucho con cadencia campera y entonación de payada criolla.
                </p>
              </div>
            </div>

            {/* If not Gaucho Mode, standard voice selector */}
            {!isGauchoMode && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
                {(['Kore', 'Fenrir', 'Puck', 'Charon', 'Zephyr'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSelectedVoice(v)}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedVoice === v
                        ? 'border-amber-500 bg-amber-500/20 text-amber-900 dark:text-amber-200 font-bold'
                        : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    <div className="text-xs">{v}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Guitar Accompaniment Setting (Strictly for Gaucho Mode) */}
          {isGauchoMode ? (
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
              <div className="flex items-center justify-between">
                <label 
                  htmlFor="guitar-toggle" 
                  className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200 cursor-pointer"
                >
                  <Music className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Punteo de Guitarra Criolla (Bordoneo Gaucho)</span>
                </label>
                <input
                  id="guitar-toggle"
                  type="checkbox"
                  checked={includeGuitar}
                  onChange={(e) => setIncludeGuitar(e.target.checked)}
                  className="accent-amber-500 w-4 h-4 cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-stone-600 dark:text-stone-300">
                Añade el clásico bordoneo arpegiado de milonga pampeana sincronizado debajo de la voz.
              </p>

              {includeGuitar && (
                <div className="pt-2 border-t border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-[11px] text-stone-500 dark:text-stone-400">Volumen Guitarra:</span>
                    <input
                      type="range"
                      min="0.1"
                      max="0.8"
                      step="0.05"
                      value={guitarVolume}
                      onChange={(e) => setGuitarVolume(parseFloat(e.target.value))}
                      className="accent-amber-500 flex-1 cursor-pointer"
                    />
                    <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-bold w-10 text-right">
                      {Math.round(guitarVolume * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs pt-1 border-t border-amber-500/15">
                    <span className="text-[11px] text-stone-500 dark:text-stone-400">Ritmo / Tempo:</span>
                    <input
                      type="range"
                      min="45"
                      max="115"
                      step="5"
                      value={guitarTempo}
                      onChange={(e) => setGuitarTempo(parseInt(e.target.value, 10))}
                      className="accent-amber-500 flex-1 cursor-pointer"
                    />
                    <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-bold w-16 text-right">
                      {guitarTempo} BPM
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 text-xs text-stone-500 dark:text-stone-400">
              * El punteo de guitarra criolla solo se activa en <strong>Modo Gaucho Payador</strong>. Activa el modo arriba si deseas exportar el audio con guitarra.
            </div>
          )}

          {/* Text preview snippet */}
          <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 space-y-1">
            <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Vista previa del texto a sintetizar:
            </div>
            <p className="text-xs text-stone-800 dark:text-stone-200 font-reader-serif italic line-clamp-3">
              "{textToExport}"
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
          >
            Cancelar
          </button>

          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-bold text-xs sm:text-sm shadow transition-colors cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{progressMsg || 'Generando archivo...'}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Generar y Descargar (.wav)</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
