import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  FileText, 
  Download, 
  Volume2, 
  FileCheck, 
  FileCode,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { DocumentItem } from '../types';
import { 
  exportProjectAsPDF, 
  exportProjectAsMarkdown, 
  exportSummaryAsAudio, 
  exportSummaryAsText 
} from '../utils/exporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentItem;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  document,
}) => {
  const [isExportingAudio, setIsExportingAudio] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExportPDF = () => {
    exportProjectAsPDF(document);
    setSuccessMsg('¡Documento PDF exportado exitosamente!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleExportMarkdown = () => {
    exportProjectAsMarkdown(document);
    setSuccessMsg('¡Archivo Markdown (.md) exportado exitosamente!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleExportSummaryText = () => {
    const summary = document.summaries?.executive || document.summaries?.bullets || document.summaries?.detailed;
    if (!summary) {
      alert('Primero genera un resumen con IA para exportarlo en texto.');
      return;
    }
    exportSummaryAsText(document.title, summary, 'Resumen');
    setSuccessMsg('¡Resumen de texto (.txt) exportado exitosamente!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleExportSummaryAudio = async () => {
    const summary = document.summaries?.executive || document.summaries?.bullets || document.summaries?.detailed;
    if (!summary) {
      alert('Primero genera un resumen con IA para exportarlo en audio.');
      return;
    }

    setIsExportingAudio(true);
    try {
      await exportSummaryAsAudio(document.title, summary, 'Kore');
      setSuccessMsg('¡Audio WAV de voz natural generado y descargado!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Error al exportar audio: ${err.message}`);
    } finally {
      setIsExportingAudio(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 font-reader-serif">
                Exportar Proyecto
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Descarga en formato PDF, Markdown, Audio o Texto
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
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800/60 text-xs text-stone-600 dark:text-stone-300">
            <div className="font-semibold text-stone-900 dark:text-stone-100 font-reader-serif">
              {document.title}
            </div>
            <div className="text-[11px] text-stone-400 mt-0.5">
              {document.wordCount} palabras • {document.paragraphs.length} párrafos • {document.percentRead}% leído
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            
            {/* 1. PDF Export */}
            <button
              onClick={handleExportPDF}
              className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 hover:border-amber-500/60 hover:bg-white dark:hover:bg-stone-800 text-left transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <FileCheck className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                Documento PDF (.pdf)
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 leading-snug">
                Maquetación limpia lista para imprimir o compartir, con resúmenes incluidos.
              </p>
            </button>

            {/* 2. Markdown Export */}
            <button
              onClick={handleExportMarkdown}
              className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 hover:border-amber-500/60 hover:bg-white dark:hover:bg-stone-800 text-left transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <FileCode className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                Markdown (.md)
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 leading-snug">
                Ideal para Obsidian, Notion o editores de texto técnico con marcadores y notas.
              </p>
            </button>

            {/* 3. Audio Export */}
            <button
              onClick={handleExportSummaryAudio}
              disabled={isExportingAudio}
              className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 hover:border-amber-500/60 hover:bg-white dark:hover:bg-stone-800 text-left transition-all cursor-pointer group disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                {isExportingAudio ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </div>
              <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                Audio del Resumen (.wav)
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 leading-snug">
                {isExportingAudio ? 'Sintetizando archivo de audio...' : 'Audio con voz natural generado por Gemini para escuchar en cualquier lugar.'}
              </p>
            </button>

            {/* 4. Text Export */}
            <button
              onClick={handleExportSummaryText}
              className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 hover:border-amber-500/60 hover:bg-white dark:hover:bg-stone-800 text-left transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <FileText className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                Resumen de Texto (.txt)
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 leading-snug">
                Extracto en texto plano para lectura rápida y notas rápidas.
              </p>
            </button>

          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-200/80 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-semibold hover:bg-stone-300 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
