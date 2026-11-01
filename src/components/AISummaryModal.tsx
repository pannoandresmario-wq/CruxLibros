import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Volume2, 
  Download, 
  FileText, 
  Copy, 
  Check, 
  Loader2, 
  Layers, 
  ListOrdered, 
  HelpCircle,
  FileCheck2,
  Globe2
} from 'lucide-react';
import { DocumentItem } from '../types';
import { exportSummaryAsText, exportSummaryAsAudio } from '../utils/exporter';

interface AISummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentItem;
  onUpdateDocumentSummaries: (summaries: DocumentItem['summaries']) => void;
  onPlayTextInVoice: (text: string) => void;
  isOnline: boolean;
}

export const AISummaryModal: React.FC<AISummaryModalProps> = ({
  isOpen,
  onClose,
  document,
  onUpdateDocumentSummaries,
  onPlayTextInVoice,
  isOnline,
}) => {
  const [summaryType, setSummaryType] = useState<'executive' | 'bullets' | 'detailed' | 'flashcards'>('executive');
  const [language, setLanguage] = useState('es');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingAudio, setIsExportingAudio] = useState(false);
  const [copied, setCopied] = useState(false);
  const [audioProgressMsg, setAudioProgressMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentSummary = document.summaries?.[summaryType] || '';

  const handleGenerateSummary = async () => {
    if (!isOnline) {
      setErrorMsg('La generación de resúmenes con IA requiere conexión a internet.');
      return;
    }

    setErrorMsg(null);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: document.content,
          title: document.title,
          type: summaryType,
          language,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Error HTTP ${response.status}`);
      }

      const data = await response.json();
      const updatedSummaries = {
        ...(document.summaries || {}),
        [summaryType]: data.summary,
        generatedAt: new Date().toISOString(),
      };

      onUpdateDocumentSummaries(updatedSummaries);
    } catch (err: any) {
      console.error('Error generating summary:', err);
      setErrorMsg(err.message || 'Error al conectar con el servicio de IA.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!currentSummary) return;
    navigator.clipboard.writeText(currentSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportText = () => {
    if (!currentSummary) return;
    const typeLabel = summaryType === 'bullets' ? 'Repaso_Rapido' : summaryType === 'flashcards' ? 'Tarjetas_Estudio' : 'Resumen';
    exportSummaryAsText(document.title, currentSummary, typeLabel);
  };

  const handleExportAudio = async () => {
    if (!currentSummary) return;
    setIsExportingAudio(true);
    setAudioProgressMsg('Generando audio natural con Gemini TTS...');
    try {
      await exportSummaryAsAudio(document.title, currentSummary, 'Kore', (msg) => {
        setAudioProgressMsg(msg);
      });
    } catch (err: any) {
      console.error('Audio export error:', err);
      setErrorMsg(`Error al exportar audio: ${err.message}`);
    } finally {
      setIsExportingAudio(false);
      setAudioProgressMsg(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 font-reader-serif">
                Resumen con Inteligencia Artificial
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Gemini 3.8 Flash • Repaso rápido, tarjetas y síntesis ejecutiva
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

        {/* Mode Selector and Language Options */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-950/20 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              onClick={() => setSummaryType('executive')}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 justify-center transition-all cursor-pointer border ${
                summaryType === 'executive'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-850 text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Ejecutivo</span>
            </button>

            <button
              onClick={() => setSummaryType('bullets')}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 justify-center transition-all cursor-pointer border ${
                summaryType === 'bullets'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-850 text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Puntos Clave</span>
            </button>

            <button
              onClick={() => setSummaryType('detailed')}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 justify-center transition-all cursor-pointer border ${
                summaryType === 'detailed'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-850 text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Analítico</span>
            </button>

            <button
              onClick={() => setSummaryType('flashcards')}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 justify-center transition-all cursor-pointer border ${
                summaryType === 'flashcards'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-850 text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Tarjetas</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400">
              <Globe2 className="w-3.5 h-3.5" />
              <span>Idioma del Resumen:</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="px-2 py-1 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs focus:outline-none"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="pt">Português</option>
                <option value="de">Deutsch</option>
                <option value="it">Italiano</option>
              </select>
            </div>

            <button
              onClick={handleGenerateSummary}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-semibold text-xs transition-colors cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sintetizando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{currentSummary ? 'Regenerar Resumen' : 'Generar Resumen'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Box */}
        <div className="p-5 flex-1 overflow-y-auto">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {isGenerating ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500" />
              <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">
                La Inteligencia Artificial está procesando el documento...
              </p>
              <p className="text-xs text-stone-400">
                Extrayendo ideas maestras, relaciones y conclusiones clave.
              </p>
            </div>
          ) : currentSummary ? (
            <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm font-reader-serif leading-relaxed space-y-3 whitespace-pre-line text-stone-800 dark:text-stone-200">
              {currentSummary}
            </div>
          ) : (
            <div className="py-16 text-center space-y-3">
              <Sparkles className="w-8 h-8 mx-auto text-amber-500/50" />
              <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
                Aún no has generado un resumen en esta modalidad.
              </p>
              <p className="text-xs text-stone-400 max-w-sm mx-auto">
                Haz clic en "Generar Resumen" para obtener un extracto conciso o tarjetas de estudio con IA.
              </p>
              <button
                onClick={handleGenerateSummary}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-stone-950 font-semibold text-xs hover:bg-amber-600 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generar ahora con Gemini</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions (Export audio/text, play summary, copy) */}
        {currentSummary && (
          <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 flex flex-wrap items-center justify-between gap-2">
            
            {/* Left: Play in voice & copy */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onPlayTextInVoice(currentSummary);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors cursor-pointer"
                title="Reproducir resumen en voz alta"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Escuchar Resumen</span>
              </button>

              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 text-xs transition-colors cursor-pointer"
                title="Copiar texto del resumen"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Right: Export buttons (Audio .wav / Text .txt) */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportText}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-200/70 dark:bg-stone-800 hover:bg-stone-300/70 text-stone-800 dark:text-stone-200 text-xs font-medium transition-colors cursor-pointer"
                title="Descargar archivo de texto plano .txt"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Exportar Texto (.txt)</span>
              </button>

              <button
                onClick={handleExportAudio}
                disabled={isExportingAudio}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                title="Generar y descargar audio WAV del resumen"
              >
                {isExportingAudio ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{audioProgressMsg || 'Exportando audio...'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar Audio (.wav)</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
