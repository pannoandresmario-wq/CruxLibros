import React, { useState } from 'react';
import { 
  FileText, 
  Globe, 
  FileUp, 
  Trash2, 
  Search, 
  Clock, 
  CheckCircle2, 
  ExternalLink,
  BookOpen,
  FolderOpen,
  Plus
} from 'lucide-react';
import { DocumentItem } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentItem[];
  activeDocumentId: string | null;
  onSelectDocument: (id: string) => void;
  onDeleteDocument: (id: string) => void;
  onOpenImportModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  documents,
  activeDocumentId,
  onSelectDocument,
  onDeleteDocument,
  onOpenImportModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDocs = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.sourceUrl && doc.sourceUrl.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getSourceIcon = (sourceType: DocumentItem['sourceType']) => {
    switch (sourceType) {
      case 'pdf':
        return <FileUp className="w-3.5 h-3.5 text-rose-500" />;
      case 'url':
        return <Globe className="w-3.5 h-3.5 text-sky-500" />;
      case 'gdrive':
        return <FolderOpen className="w-3.5 h-3.5 text-amber-500" />;
      case 'dropbox':
        return <FolderOpen className="w-3.5 h-3.5 text-blue-500" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-emerald-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile/Tablet Overlay Backdrop */}
      <div 
        className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-30 lg:hidden"
        onClick={onClose}
      />

      <aside className="fixed lg:static top-[57px] bottom-0 left-0 z-40 w-80 max-w-[85vw] flex flex-col bg-stone-100/95 dark:bg-stone-900/95 border-r border-stone-200 dark:border-stone-800 backdrop-blur-md transition-all shadow-xl lg:shadow-none">
        {/* Header: Search & Document Count */}
        <div className="p-3.5 border-b border-stone-200 dark:border-stone-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Biblioteca ({documents.length})
            </span>
            <button
              onClick={onOpenImportModal}
              className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar en biblioteca..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Documents List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredDocs.length === 0 ? (
            <div className="py-12 text-center px-4">
              <BookOpen className="w-8 h-8 mx-auto text-stone-300 dark:text-stone-600 mb-2" />
              <p className="text-xs font-medium text-stone-600 dark:text-stone-300">
                {searchQuery ? 'No se encontraron documentos.' : 'No tienes documentos guardados.'}
              </p>
              <button
                onClick={onOpenImportModal}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-stone-950 hover:bg-amber-600 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cargar primer documento</span>
              </button>
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const isActive = doc.id === activeDocumentId;
              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    onSelectDocument(doc.id);
                    if (window.innerWidth < 1024) onClose();
                  }}
                  className={`group relative p-3 rounded-xl transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/40 text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'bg-white/80 dark:bg-stone-800/80 hover:bg-stone-200/50 dark:hover:bg-stone-800 border-stone-200/80 dark:border-stone-700/80 text-stone-700 dark:text-stone-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {getSourceIcon(doc.sourceType)}
                      <h4 className="font-medium text-xs truncate leading-snug">
                        {doc.title}
                      </h4>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`¿Eliminar "${doc.title}" de tu biblioteca?`)) {
                          onDeleteDocument(doc.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-rose-500 transition-opacity rounded cursor-pointer"
                      title="Eliminar documento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Metadata and Reading Progress */}
                  <div className="mt-2 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                    <span className="flex items-center gap-1 font-mono text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      <span>Párrafo {(doc.currentParagraphIndex ?? 0) + 1}/{doc.paragraphs?.length || 1}</span>
                    </span>
                    <span className="font-mono">
                      {doc.percentRead}% leído
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-1.5 h-1 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(3, doc.percentRead))}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Bar: Tablet friendly info & Cloud reminder */}
        <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Sincronización activa</span>
          </div>
          <span className="text-stone-400">Optimizado para Tablet</span>
        </div>
      </aside>
    </>
  );
};
