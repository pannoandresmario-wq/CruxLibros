import React, { useState, useEffect } from 'react';
import { X, Edit3, Wand2, Check, AlertCircle } from 'lucide-react';
import { DocumentItem } from '../types';
import { repairDocumentText, splitIntoCleanParagraphs } from '../utils/textRepair';

interface EditDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentItem;
  onSave: (newTitle: string, newContent: string) => void;
}

export const EditDocumentModal: React.FC<EditDocumentModalProps> = ({
  isOpen,
  onClose,
  document,
  onSave,
}) => {
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content);
  const [hasRepaired, setHasRepaired] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(document.title);
      setContent(document.content);
      setHasRepaired(false);
    }
  }, [isOpen, document]);

  if (!isOpen) return null;

  const handleRepairText = () => {
    const repaired = repairDocumentText(content);
    setContent(repaired);
    setHasRepaired(true);
    setTimeout(() => setHasRepaired(false), 3000);
  };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) return;
    onSave(title.trim(), content.trim());
    onClose();
  };

  const currentWordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const currentParagraphCount = splitIntoCleanParagraphs(content).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 font-reader-serif">
                Editar Documento
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Corrige errores ortográficos, ajusta el texto o repara guiones de corte
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
          
          {/* Document Title input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
              Título del Documento
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:border-amber-500 font-medium"
              placeholder="Título del documento..."
            />
          </div>

          {/* Quick Repair & Cut Adjustment Toolbar */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-stone-800 dark:text-stone-200">
                <Wand2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Ajuste automático de cortes y párrafos:</span>
              </div>
              {hasRepaired && (
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  ¡Ajustes aplicados correctamente!
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleRepairText}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold transition-all cursor-pointer shadow-xs"
                title="Une palabras partidas por guiones de fin de línea en PDFs y elimina caracteres invisibles"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Corregir Guiones y Salto PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  // Merge overly short single-line paragraphs into natural paragraphs
                  const rawParagraphs = content.split(/\n\s*\n/);
                  const mergedParagraphs: string[] = [];
                  let currentP = '';

                  for (const p of rawParagraphs) {
                    const trimmed = p.trim();
                    if (!trimmed) continue;
                    if (!currentP) {
                      currentP = trimmed;
                    } else if (currentP.length < 180 || currentP.split(/\s+/).length < 25) {
                      // Join short preceding paragraph
                      currentP = `${currentP} ${trimmed}`;
                    } else {
                      mergedParagraphs.push(currentP);
                      currentP = trimmed;
                    }
                  }
                  if (currentP) mergedParagraphs.push(currentP);

                  setContent(mergedParagraphs.join('\n\n'));
                  setHasRepaired(true);
                  setTimeout(() => setHasRepaired(false), 3000);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium transition-all cursor-pointer border border-stone-300 dark:border-stone-700"
                title="Combina párrafos de 1 o 2 líneas en bloques continuos para que la voz no se corte"
              >
                <span>🔗 Unir párrafos muy cortos</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  // Normalize double line breaks
                  const normalized = content
                    .replace(/\r\n/g, '\n')
                    .replace(/\n{3,}/g, '\n\n')
                    .replace(/([^\n])\n([^\n])/g, '$1 $2') // fix broken soft wraps
                    .trim();
                  setContent(normalized);
                  setHasRepaired(true);
                  setTimeout(() => setHasRepaired(false), 3000);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium transition-all cursor-pointer border border-stone-300 dark:border-stone-700"
                title="Limpia saltos de línea irregulares para una lectura totalmente fluida"
              >
                <span>Limpiar saltos de línea</span>
              </button>
            </div>
          </div>

          {/* Content Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400">
              <label className="font-semibold">Contenido del Documento</label>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span>{currentWordCount.toLocaleString()} palabras</span>
                <span>•</span>
                <span>{currentParagraphCount} párrafos</span>
              </div>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="w-full p-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:border-amber-500 font-reader-serif leading-relaxed"
              placeholder="Escribe o pega el texto aquí..."
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            disabled={!title.trim() || !content.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-stone-950 font-bold text-xs sm:text-sm shadow transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Guardar Cambios</span>
          </button>
        </div>

      </div>
    </div>
  );
};
