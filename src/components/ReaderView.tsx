import React, { useRef, useEffect, useMemo, useState } from 'react';
import { 
  Play, 
  Volume2, 
  Bookmark, 
  BookmarkCheck, 
  Sparkles, 
  Share2, 
  ArrowUpDown,
  Download,
  Music,
  Edit3,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  Filter,
  CheckCheck,
  Scissors,
  Link2
} from 'lucide-react';
import { DocumentItem, ReaderSettings, SentenceItem } from '../types';
import { EditDocumentModal } from './EditDocumentModal';

interface ReaderViewProps {
  document: DocumentItem;
  sentences: SentenceItem[];
  currentSentenceIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  onSentenceClick: (globalIndex: number) => void;
  onToggleBookmark: (paragraphIndex: number) => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
  onOpenSummaryModal: () => void;
  onOpenExportModal: () => void;
  onOpenAudioDownloadModal: () => void;
  onSaveEditedDocument: (title: string, content: string) => void;
  onToggleExcludeSentence: (sentenceId: string) => void;
  onBatchExcludeSentences: (sentenceIds: string[]) => void;
  onCreateCustomSummaryFromSelected?: () => void;
  onPlayFromSaved?: () => void;
  onRestartFromBeginning?: () => void;
  onMergeParagraphWithNext?: (paragraphIndex: number) => void;
  onSplitParagraph?: (paragraphIndex: number, sentenceText: string) => void;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  document,
  sentences,
  currentSentenceIndex,
  isPlaying,
  isBuffering,
  onSentenceClick,
  onToggleBookmark,
  settings,
  onUpdateSettings,
  onOpenSummaryModal,
  onOpenExportModal,
  onOpenAudioDownloadModal,
  onSaveEditedDocument,
  onToggleExcludeSentence,
  onBatchExcludeSentences,
  onCreateCustomSummaryFromSelected,
  onPlayFromSaved,
  onRestartFromBeginning,
  onMergeParagraphWithNext,
  onSplitParagraph,
}) => {
  const activeSentenceRef = useRef<HTMLSpanElement | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Auto-scroll when active sentence changes or document loads
  useEffect(() => {
    if (activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentSentenceIndex, document.id, settings.autoScroll]);

  // Map paragraphs to their sentence items
  const paragraphSentencesMap = useMemo(() => {
    const map = new Map<number, SentenceItem[]>();
    sentences.forEach((s) => {
      const list = map.get(s.paragraphIndex) || [];
      list.push(s);
      map.set(s.paragraphIndex, list);
    });
    return map;
  }, [sentences]);

  const activeSentencesCount = sentences.filter((s) => !s.excluded).length;
  const excludedSentencesCount = sentences.length - activeSentencesCount;

  const handleSelectAll = () => {
    onBatchExcludeSentences([]);
  };

  const handleOmitAll = () => {
    const allIds = sentences.map((s) => s.id);
    onBatchExcludeSentences(allIds);
  };

  const handleInvertSelection = () => {
    const nextExcluded = sentences.filter((s) => !s.excluded).map((s) => s.id);
    onBatchExcludeSentences(nextExcluded);
  };

  const getFontClass = () => {
    switch (settings.fontFamily) {
      case 'sans':
        return 'font-reader-sans';
      case 'display':
        return 'font-reader-display';
      case 'serif':
      default:
        return 'font-reader-serif';
    }
  };

  const getWidthClass = () => {
    switch (settings.pageWidth) {
      case 'narrow':
        return 'max-w-xl';
      case 'wide':
        return 'max-w-4xl';
      case 'medium':
      default:
        return 'max-w-2xl';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto pb-44">
      
      {/* Top Document Header Bar */}
      {/* Top Document Header Bar (2-Tier Clean Layout: Zero Text Overlap) */}
      <div className="sticky top-0 z-20 bg-stone-50/95 dark:bg-stone-950/95 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800/80 px-4 py-2.5 sm:px-8 shadow-xs">
        <div className={`mx-auto ${getWidthClass()} flex flex-col gap-1.5`}>
          
          {/* Row 1: Document Title & Main Actions */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 
                className="text-sm sm:text-base font-bold truncate text-stone-900 dark:text-stone-100 font-reader-serif tracking-tight"
                title={document.title}
              >
                {document.title}
              </h1>
            </div>

            {/* Quick Reader Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              
              {/* Edit Document Button */}
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-stone-200/70 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Editar el título o texto del documento, reparar párrafos y saltos de línea"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline text-[11px]">Editar Cortes</span>
              </button>

              {/* Quick Download Audio button */}
              <button
                onClick={onOpenAudioDownloadModal}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Descargar audio con voz seleccionada o modo gaucho con guitarra"
              >
                <Download className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline text-[11px]">Bajar Audio</span>
              </button>

              {/* Auto-scroll toggle */}
              <button
                onClick={() => onUpdateSettings({ autoScroll: !settings.autoScroll })}
                className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                  settings.autoScroll
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                    : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500'
                }`}
                title={settings.autoScroll ? 'Auto-scroll activo en cada avance' : 'Auto-scroll desactivado'}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>

              {/* Font Size controls */}
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-stone-200/60 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold">
                <button
                  onClick={() => onUpdateSettings({ fontSize: Math.max(14, settings.fontSize - 1) })}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-white dark:hover:bg-stone-700 cursor-pointer"
                  title="Disminuir texto"
                >
                  A-
                </button>
                <span className="text-[11px] w-4 text-center font-mono">{settings.fontSize}</span>
                <button
                  onClick={() => onUpdateSettings({ fontSize: Math.min(26, settings.fontSize + 1) })}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-white dark:hover:bg-stone-700 cursor-pointer"
                  title="Aumentar texto"
                >
                  A+
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Reading Granularity & Document Stats Bar */}
          <div className="pt-2 border-t border-stone-200/60 dark:border-stone-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            
            {/* Left: Granularity Selector & Fluency Option */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Reading Granularity Selector: Párrafos vs Oraciones */}
              <div className="flex items-center p-0.5 rounded-xl bg-stone-200/80 dark:bg-stone-800 border border-stone-300/70 dark:border-stone-700 text-xs">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ readingGranularity: 'paragraph' })}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    settings.readingGranularity === 'paragraph'
                      ? 'bg-amber-500 text-stone-950 shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                  title="Corte por Párrafos: Lee párrafos completos continuos sin pausas artificiales (máxima fluidez y naturalidad)"
                >
                  <span>📖</span>
                  <span>Párrafos (Continuo)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateSettings({ readingGranularity: 'sentence' })}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    settings.readingGranularity !== 'paragraph'
                      ? 'bg-amber-500 text-stone-950 shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                  title="Corte por Oraciones: Resalta y reproduce frase por frase"
                >
                  <span>🔤</span>
                  <span>Por Oraciones</span>
                </button>
              </div>

              {/* Smart Short-Sentence Merge Switch (when reading by sentences) */}
              {settings.readingGranularity !== 'paragraph' && (
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ mergeShortSentences: !settings.mergeShortSentences })}
                  className={`px-2.5 py-1 rounded-xl border text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                    settings.mergeShortSentences
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-900 dark:text-amber-200 font-bold'
                      : 'bg-stone-100 dark:bg-stone-850 border-stone-200 dark:border-stone-750 text-stone-500 hover:text-stone-700'
                  }`}
                  title={
                    settings.mergeShortSentences
                      ? 'Fusión activa: Las oraciones muy cortas se unen para evitar pausas constantes y lecturas entrecortadas'
                      : 'Fusión inactiva: Cada punto genera un corte independiente'
                  }
                >
                  <span>⚡</span>
                  <span className="text-[11px]">
                    {settings.mergeShortSentences ? 'Frases fluidas (Activo)' : 'Unir frases cortas'}
                  </span>
                </button>
              )}

              {/* Selection / Exclude Mode Toggle */}
              <button
                onClick={() => setIsSelectionMode(!isSelectionMode)}
                className={`p-1 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isSelectionMode
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/40'
                    : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200/60'
                }`}
                title="Modo para seleccionar u omitir oraciones específicas de la lectura"
              >
                <Filter className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11px]">
                  {isSelectionMode ? 'Listo (Modo Omitir)' : 'Omitir partes'}
                </span>
              </button>
            </div>

            {/* Right: Document Reading Stats */}
            <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400 font-medium">
              <span>{sentences.length} oraciones</span>
              <span>•</span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                {activeSentencesCount} activas
                {excludedSentencesCount > 0 ? ` (${excludedSentencesCount} omitidas)` : ''}
              </span>
              <span>•</span>
              <span>{document.wordCount.toLocaleString()} palabras</span>
            </div>

          </div>

        </div>
      </div>

      {/* Interactive Selection Mode Banner */}
      {isSelectionMode && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 sm:px-8">
          <div className={`mx-auto ${getWidthClass()} flex flex-wrap items-center justify-between gap-2 text-xs`}>
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-stone-900 dark:text-stone-100">
                Modo Selección y Omisión Activo:
              </span>
              <span className="text-stone-600 dark:text-stone-300">
                Haz clic en cualquier oración para activarla o saltarla.
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={handleSelectAll}
                className="px-2 py-0.5 rounded bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium border border-stone-300 dark:border-stone-700 cursor-pointer"
              >
                Leer Todas
              </button>
              <button
                onClick={handleInvertSelection}
                className="px-2 py-0.5 rounded bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium border border-stone-300 dark:border-stone-700 cursor-pointer"
              >
                Invertir
              </button>
              <button
                onClick={handleOmitAll}
                className="px-2 py-0.5 rounded bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium border border-stone-300 dark:border-stone-700 cursor-pointer"
              >
                Omitir Todas
              </button>
              <button
                onClick={() => {
                  setIsSelectionMode(false);
                  onOpenSummaryModal();
                }}
                className="px-2.5 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Crear Resumen de Selección</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Document Reading Surface */}
      <div className={`mx-auto ${getWidthClass()} w-full px-4 sm:px-8 py-8 transition-all`}>
        
        {/* Document Title Header */}
        <div className="mb-8 pb-6 border-b border-stone-200/60 dark:border-stone-800/60 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <span className="text-[10px] uppercase font-bold tracking-widest text-amber-700 dark:text-amber-400">
              {document.sourceType.toUpperCase()}
            </span>
            {settings.voiceStyleMode === 'gaucho' && (
              <span className="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <span>🤠</span> Modo Gaucho & Punteo de Guitarra Activo
              </span>
            )}
            {excludedSentencesCount > 0 && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                {excludedSentencesCount} oraciones omitidas
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 mt-1.5">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100 font-reader-serif leading-snug">
              {document.title}
            </h2>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="p-1.5 rounded-lg text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-stone-100 dark:hover:bg-stone-850 cursor-pointer shrink-0"
              title="Editar título o texto"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-stone-500 mt-2">
            💡 <strong>Toca cualquier oración</strong> para comenzar a escuchar exactamente desde allí. Usa el botón "Seleccionar / Omitir" para saltearte partes o crear tu propio resumen.
          </p>
        </div>

        {/* Reading Memory Banner: Shows saved position and allows instant continuation */}
        {((document.currentSentenceIndex ?? 0) > 0 || document.percentRead > 0) && (
          <div className="mb-6 p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <BookmarkCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-200">
                    Memoria de Lectura Guardada
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold">
                    Párrafo {(document.currentParagraphIndex ?? 0) + 1} de {document.paragraphs.length} ({document.percentRead}% completado)
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 dark:text-stone-300 mt-0.5">
                  {isPlaying 
                    ? 'Lectura en curso en esta posición.' 
                    : 'La lectura se guardó aquí. Pulsa Continuar para seguir exactamente donde te quedaste sin repetir nada.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isPlaying && onPlayFromSaved && (
                <button
                  onClick={() => onPlayFromSaved()}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer transition-all active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Continuar Aquí</span>
                </button>
              )}
              {onRestartFromBeginning && (
                <button
                  onClick={onRestartFromBeginning}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-200/70 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-semibold text-xs cursor-pointer transition-colors"
                  title="Reiniciar lectura desde el Párrafo 1"
                >
                  Reiniciar al Inicio
                </button>
              )}
            </div>
          </div>
        )}

        {/* Paragraphs and Sentence Splitting List */}
        <div 
          className={`space-y-6 ${getFontClass()}`}
          style={{ 
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
          }}
        >
          {document.paragraphs.map((paragraph, pIdx) => {
            const isBookmarked = document.bookmarks.includes(pIdx);
            const paragraphSentences = paragraphSentencesMap.get(pIdx) || [];
            const hasActiveSentenceInParagraph = paragraphSentences.some(
              (s) => s.globalIndex === currentSentenceIndex
            );
            const isSavedParagraph = pIdx === (document.currentParagraphIndex ?? 0);

            return (
              <div
                key={pIdx}
                className={`group relative p-3.5 sm:p-5 rounded-2xl transition-all select-text border-l-4 ${
                  hasActiveSentenceInParagraph
                    ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 shadow-sm ring-1 ring-amber-500/20'
                    : isSavedParagraph && !isPlaying
                    ? 'border-amber-500/60 bg-amber-500/5 dark:bg-amber-500/10'
                    : 'border-transparent hover:bg-stone-200/25 dark:hover:bg-stone-800/25'
                }`}
              >
                {/* Paragraph Header: Clear tracking of which paragraph is being read */}
                <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-stone-200/50 dark:border-stone-800/50 text-xs select-none">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                      hasActiveSentenceInParagraph
                        ? 'bg-amber-500 text-stone-950 shadow-xs'
                        : isSavedParagraph
                        ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40'
                        : 'bg-stone-200/70 dark:bg-stone-800 text-stone-500 dark:text-stone-400'
                    }`}>
                      Párrafo {pIdx + 1} de {document.paragraphs.length}
                    </span>

                    {hasActiveSentenceInParagraph && (
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        {isPlaying ? 'Leyendo ahora' : 'Pausado en este punto'}
                      </span>
                    )}

                    {!hasActiveSentenceInParagraph && isSavedParagraph && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                        <span>📌</span> Punto de lectura guardado
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Merge with next paragraph button */}
                    {onMergeParagraphWithNext && pIdx < document.paragraphs.length - 1 && (
                      <button
                        onClick={() => onMergeParagraphWithNext(pIdx)}
                        className="px-2 py-0.5 rounded text-[11px] font-medium text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/80 dark:hover:bg-stone-800 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Unir este párrafo con el siguiente para una lectura más continua y sin cortes"
                      >
                        <Link2 className="w-3 h-3 text-amber-500" />
                        <span className="hidden sm:inline">Unir con siguiente</span>
                      </button>
                    )}

                    <button
                      onClick={() => onToggleBookmark(pIdx)}
                      className={`p-1 rounded cursor-pointer ${
                        isBookmarked
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                      }`}
                      title={isBookmarked ? 'Quitar marcador' : 'Marcar este párrafo'}
                    >
                      {isBookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Sentences inside paragraph */}
                <p className="leading-relaxed">
                  {paragraphSentences.map((sentence) => {
                    const isCurrent = sentence.globalIndex === currentSentenceIndex;
                    const isExcluded = !!sentence.excluded;

                    return (
                      <span
                        key={sentence.id}
                        ref={isCurrent ? activeSentenceRef : null}
                        onClick={() => {
                          if (isSelectionMode) {
                            onToggleExcludeSentence(sentence.id);
                          } else {
                            if (isExcluded) {
                              onToggleExcludeSentence(sentence.id);
                            }
                            onSentenceClick(sentence.globalIndex);
                          }
                        }}
                        className={`group/sentence relative inline transition-all cursor-pointer rounded px-1 py-0.5 mr-1 ${
                          isExcluded
                            ? 'line-through opacity-45 bg-stone-200/50 dark:bg-stone-850/50 text-stone-400 dark:text-stone-500 hover:opacity-80'
                            : isCurrent
                            ? 'bg-amber-400/25 dark:bg-amber-400/30 text-stone-950 dark:text-amber-100 font-semibold shadow-xs ring-1 ring-amber-500/50'
                            : 'hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-200 text-stone-800 dark:text-stone-300'
                        }`}
                        title={
                          isSelectionMode
                            ? isExcluded ? 'Toca para incluir en la lectura' : 'Toca para omitir de la lectura'
                            : isExcluded
                            ? 'Oración omitida (toca para reproducir e incluir)'
                            : settings.readingGranularity === 'paragraph'
                            ? 'Toca para escuchar este párrafo completo'
                            : 'Toca para escuchar desde esta frase'
                        }
                      >
                        {/* Checkbox badge when in selection mode */}
                        {isSelectionMode && (
                          <span className="inline-block mr-1 align-middle">
                            {isExcluded ? (
                              <Square className="w-3.5 h-3.5 text-stone-400 inline" />
                            ) : (
                              <CheckSquare className="w-3.5 h-3.5 text-amber-500 inline" />
                            )}
                          </span>
                        )}

                        {sentence.text}

                        {/* Quick hover action: Split paragraph at this sentence */}
                        {!isSelectionMode && onSplitParagraph && paragraphSentences.length > 1 && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onSplitParagraph(pIdx, sentence.text);
                            }}
                            className="hidden group-hover/sentence:inline-flex items-center ml-1 p-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer align-middle"
                            title="Dividir el párrafo en dos a partir de esta frase"
                          >
                            <Scissors className="w-3 h-3" />
                          </span>
                        )}

                        {/* Quick hover exclude toggle button (visible on hover) */}
                        {!isSelectionMode && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleExcludeSentence(sentence.id);
                            }}
                            className="hidden group-hover/sentence:inline-flex items-center ml-1 p-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer align-middle"
                            title={isExcluded ? 'Reactivar oración' : 'Omitir oración'}
                          >
                            {isExcluded ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </p>

                {/* Active Sentence status indicator bar */}
                {hasActiveSentenceInParagraph && (
                  <div className="mt-2.5 flex items-center gap-2 text-xs font-sans text-amber-700 dark:text-amber-400">
                    <div className="flex items-center gap-0.5">
                      <span className="w-1.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-3.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[11px] font-medium">
                      {isBuffering
                        ? 'Sintetizando locución...'
                        : isPlaying
                        ? settings.voiceStyleMode === 'gaucho'
                          ? 'Gaucho Payador cantando versos con guitarra criolla...'
                          : 'Leyendo oración...'
                        : 'Pausado'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Document End indicator */}
        <div className="mt-16 pt-8 border-t border-stone-200 dark:border-stone-800 text-center space-y-3">
          <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
            Fin del Documento
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={onOpenAudioDownloadModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs hover:bg-amber-600 transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Audio de esta Lectura</span>
            </button>
            <button
              onClick={onOpenSummaryModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Ver Resumen con IA</span>
            </button>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-200/70 dark:bg-stone-800 hover:bg-stone-300/70 text-stone-800 dark:text-stone-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Edit3 className="w-4 h-4 text-amber-500" />
              <span>Editar Texto / Corregir</span>
            </button>
            <button
              onClick={onOpenExportModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-200/70 dark:bg-stone-800 hover:bg-stone-300/70 text-stone-800 dark:text-stone-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Exportar PDF / Markdown</span>
            </button>
          </div>
        </div>

      </div>

      {/* Edit Document Modal */}
      <EditDocumentModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        document={document}
        onSave={onSaveEditedDocument}
      />
    </div>
  );
};
