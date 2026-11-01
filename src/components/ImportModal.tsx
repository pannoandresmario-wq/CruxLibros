import React, { useState } from 'react';
import { 
  X, 
  FileUp, 
  Globe, 
  FileText, 
  FolderOpen, 
  Loader2, 
  Check, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { DocumentItem } from '../types';
import { extractTextFromPDF } from '../utils/pdfExtractor';
import { repairDocumentText, splitIntoCleanParagraphs } from '../utils/textRepair';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentCreated: (doc: DocumentItem) => void;
  isOnline: boolean;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onDocumentCreated,
  isOnline,
}) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'url' | 'cloud' | 'text'>('pdf');

  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);

  // URL state
  const [urlInput, setUrlInput] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  // Cloud (Google Drive / Dropbox) state
  const [cloudService, setCloudService] = useState<'gdrive' | 'dropbox'>('gdrive');
  const [cloudUrl, setCloudUrl] = useState('');
  const [isFetchingCloud, setIsFetchingCloud] = useState(false);

  // Direct Text state
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');

  // General error/success message
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Process PDF
  const handlePDFUpload = async (file: File) => {
    setErrorMessage(null);

    // Security Directive 16: Validate MIME type and extension
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Solo se admiten archivos con formato PDF válido.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('El archivo excede el tamaño máximo permitido de 25 MB.');
      return;
    }

    setIsProcessingPdf(true);
    setPdfFile(file);

    try {
      const extracted = await extractTextFromPDF(file, (current, total) => {
        setPdfProgress({ current, total });
      });

      const newDoc: DocumentItem = {
        id: `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: extracted.title || file.name.replace(/\.pdf$/i, ''),
        sourceType: 'pdf',
        originalFileName: file.name,
        content: extracted.fullText,
        paragraphs: extracted.paragraphs,
        wordCount: extracted.wordCount,
        readingTimeMinutes: Math.max(1, Math.ceil(extracted.wordCount / 180)),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentParagraphIndex: 0,
        currentSentenceIndex: 0,
        percentRead: 0,
        lastReadAt: new Date().toISOString(),
        bookmarks: [],
      };

      onDocumentCreated(newDoc);
      onClose();
    } catch (err: any) {
      console.error('Error parsing PDF:', err);
      setErrorMessage(`Error al extraer texto del PDF: ${err.message || 'El archivo puede estar protegido o dañado.'}`);
    } finally {
      setIsProcessingPdf(false);
      setPdfProgress(null);
    }
  };

  // Process URL
  const handleFetchUrl = async () => {
    if (!urlInput.trim()) {
      setErrorMessage('Por favor ingresa una URL.');
      return;
    }

    setErrorMessage(null);
    setIsFetchingUrl(true);

    try {
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al descargar la página.');
      }

      const cleanedContent = repairDocumentText(data.content);
      const paragraphs = splitIntoCleanParagraphs(cleanedContent);

      const newDoc: DocumentItem = {
        id: `url-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: data.title || 'Artículo Web',
        sourceType: 'url',
        sourceUrl: data.sourceUrl,
        content: cleanedContent,
        paragraphs: paragraphs.length > 0 ? paragraphs : [cleanedContent],
        wordCount: cleanedContent.split(/\s+/).filter(Boolean).length,
        readingTimeMinutes: Math.max(1, Math.ceil(cleanedContent.split(/\s+/).filter(Boolean).length / 180)),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentParagraphIndex: 0,
        currentSentenceIndex: 0,
        percentRead: 0,
        lastReadAt: new Date().toISOString(),
        bookmarks: [],
      };

      onDocumentCreated(newDoc);
      onClose();
    } catch (err: any) {
      console.error('URL extraction error:', err);
      setErrorMessage(err.message || 'No se pudo extraer texto de la URL.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // Process Google Drive or Dropbox file link
  const handleFetchCloud = async () => {
    if (!cloudUrl.trim()) {
      setErrorMessage('Por favor introduce el enlace de Google Drive o Dropbox.');
      return;
    }

    setErrorMessage(null);
    setIsFetchingCloud(true);

    try {
      let directUrl = cloudUrl.trim();

      // Convert Google Drive share link to direct export/download link
      if (cloudService === 'gdrive' || directUrl.includes('drive.google.com')) {
        const idMatch = directUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
          directUrl = `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
        }
      } else if (cloudService === 'dropbox' || directUrl.includes('dropbox.com')) {
        // Convert dropbox www link to dl.dropboxusercontent.com
        directUrl = directUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/[?&]dl=[01]/, '');
      }

      // Check if it's a PDF link or Web Page
      if (directUrl.toLowerCase().endsWith('.pdf') || directUrl.includes('export=download')) {
        // Attempt to fetch file blob
        const fileRes = await fetch(directUrl);
        if (!fileRes.ok) {
          throw new Error('No se pudo acceder al archivo. Asegúrese de que el enlace tenga permiso público "Cualquier persona con el enlace".');
        }
        const buffer = await fileRes.arrayBuffer();
        const extracted = await extractTextFromPDF(buffer);

        const newDoc: DocumentItem = {
          id: `cloud-${Date.now()}`,
          title: extracted.title || `${cloudService === 'gdrive' ? 'Google Drive' : 'Dropbox'} Documento`,
          sourceType: cloudService,
          sourceUrl: cloudUrl,
          content: extracted.fullText,
          paragraphs: extracted.paragraphs,
          wordCount: extracted.wordCount,
          readingTimeMinutes: Math.max(1, Math.ceil(extracted.wordCount / 180)),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentParagraphIndex: 0,
          currentSentenceIndex: 0,
          percentRead: 0,
          lastReadAt: new Date().toISOString(),
          bookmarks: [],
        };
        onDocumentCreated(newDoc);
        onClose();
        return;
      }

      // Fallback: fetch via article extractor
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: directUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener archivo en la nube.');

      const cleanedContent = repairDocumentText(data.content);
      const paragraphs = splitIntoCleanParagraphs(cleanedContent);
      const newDoc: DocumentItem = {
        id: `cloud-${Date.now()}`,
        title: data.title || `${cloudService === 'gdrive' ? 'Google Drive' : 'Dropbox'} Documento`,
        sourceType: cloudService,
        sourceUrl: cloudUrl,
        content: cleanedContent,
        paragraphs: paragraphs.length > 0 ? paragraphs : [cleanedContent],
        wordCount: cleanedContent.split(/\s+/).filter(Boolean).length,
        readingTimeMinutes: Math.max(1, Math.ceil(cleanedContent.split(/\s+/).filter(Boolean).length / 180)),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentParagraphIndex: 0,
        currentSentenceIndex: 0,
        percentRead: 0,
        lastReadAt: new Date().toISOString(),
        bookmarks: [],
      };
      onDocumentCreated(newDoc);
      onClose();
    } catch (err: any) {
      console.error('Cloud storage fetch error:', err);
      setErrorMessage(`No se pudo importar desde ${cloudService === 'gdrive' ? 'Google Drive' : 'Dropbox'}: ${err.message}. Asegúrate de que el archivo esté configurado como público.`);
    } finally {
      setIsFetchingCloud(false);
    }
  };

  // Process Direct Text
  const handleSaveText = () => {
    if (!textContent.trim()) {
      setErrorMessage('Por favor escribe o pega el contenido del texto.');
      return;
    }

    if (textContent.length > 250000) {
      setErrorMessage('El texto es demasiado extenso (máximo 250.000 caracteres por documento).');
      return;
    }

    const title = textTitle.trim().slice(0, 150) || 'Texto sin título';
    const cleanedContent = repairDocumentText(textContent.slice(0, 250000));
    const paragraphs = splitIntoCleanParagraphs(cleanedContent);
    const wordCount = cleanedContent.split(/\s+/).filter(Boolean).length;

    const newDoc: DocumentItem = {
      id: `text-${Date.now()}`,
      title,
      sourceType: 'text',
      content: cleanedContent,
      paragraphs: paragraphs.length > 0 ? paragraphs : [cleanedContent],
      wordCount,
      readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 180)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentParagraphIndex: 0,
      currentSentenceIndex: 0,
      percentRead: 0,
      lastReadAt: new Date().toISOString(),
      bookmarks: [],
    };

    onDocumentCreated(newDoc);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
          <div>
            <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 font-reader-serif">
              Cargar Nuevo Documento
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              PDF, Artículos URL, Google Drive, Dropbox o texto libre
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/50 px-3 pt-2 gap-1 overflow-x-auto">
          <button
            onClick={() => { setActiveTab('pdf'); setErrorMessage(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all cursor-pointer border-b-2 ${
              activeTab === 'pdf'
                ? 'border-amber-500 text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-900 shadow-xs'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <FileUp className="w-3.5 h-3.5 text-rose-500" />
            <span>Archivo PDF</span>
          </button>

          <button
            onClick={() => { setActiveTab('url'); setErrorMessage(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all cursor-pointer border-b-2 ${
              activeTab === 'url'
                ? 'border-amber-500 text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-900 shadow-xs'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-sky-500" />
            <span>Desde URL</span>
          </button>

          <button
            onClick={() => { setActiveTab('cloud'); setErrorMessage(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all cursor-pointer border-b-2 ${
              activeTab === 'cloud'
                ? 'border-amber-500 text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-900 shadow-xs'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Drive / Dropbox</span>
          </button>

          <button
            onClick={() => { setActiveTab('text'); setErrorMessage(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all cursor-pointer border-b-2 ${
              activeTab === 'text'
                ? 'border-amber-500 text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-900 shadow-xs'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-500" />
            <span>Pegar Texto</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: PDF */}
          {activeTab === 'pdf' && (
            <div className="space-y-4">
              <label 
                htmlFor="pdf-upload"
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-2xl hover:border-amber-500 dark:hover:border-amber-500 bg-stone-50/50 dark:bg-stone-950/50 transition-colors cursor-pointer text-center group"
              >
                <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <FileUp className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                  {pdfFile ? pdfFile.name : 'Haz clic para seleccionar o arrastra tu PDF'}
                </span>
                <span className="text-xs text-stone-500 mt-1">
                  Compatible con documentos extensos, libros y papers académicos (PDF)
                </span>
                <input
                  id="pdf-upload"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePDFUpload(file);
                  }}
                  disabled={isProcessingPdf}
                />
              </label>

              {isProcessingPdf && (
                <div className="p-4 rounded-xl bg-stone-100 dark:bg-stone-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-300 font-medium">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                      Procesando documento...
                    </span>
                    {pdfProgress && (
                      <span>Página {pdfProgress.current} de {pdfProgress.total}</span>
                    )}
                  </div>
                  {pdfProgress && (
                    <div className="h-1.5 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 transition-all duration-200"
                        style={{ width: `${(pdfProgress.current / pdfProgress.total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: URL */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  Dirección web (URL) del artículo o documento
                </label>
                <input
                  type="url"
                  placeholder="https://es.wikipedia.org/wiki/... o enlace a blog/noticia"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={isFetchingUrl}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800/60 text-xs text-stone-500 dark:text-stone-400 space-y-1">
                <p className="font-medium text-stone-700 dark:text-stone-300">
                  ⚡ Extracción Limpia Inteligente
                </p>
                <p>
                  Elimina automáticamente anuncios, barras de navegación y menús molestos para dejar el texto limpio listo para lectura y resumen.
                </p>
              </div>

              <button
                onClick={handleFetchUrl}
                disabled={isFetchingUrl || !urlInput.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isFetchingUrl ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extrayendo artículo...</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    <span>Importar Texto desde URL</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 3: Google Drive & Dropbox */}
          {activeTab === 'cloud' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCloudService('gdrive')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    cloudService === 'gdrive'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                      : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                  }`}
                >
                  <FolderOpen className="w-4 h-4 text-amber-500" />
                  <span>Google Drive</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCloudService('dropbox')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    cloudService === 'dropbox'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-800 dark:text-blue-300'
                      : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                  }`}
                >
                  <FolderOpen className="w-4 h-4 text-blue-500" />
                  <span>Dropbox</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  Enlace compartido del archivo ({cloudService === 'gdrive' ? 'Google Drive' : 'Dropbox'})
                </label>
                <input
                  type="url"
                  placeholder={
                    cloudService === 'gdrive'
                      ? 'https://drive.google.com/file/d/.../view?usp=sharing'
                      : 'https://www.dropbox.com/s/.../archivo.pdf'
                  }
                  value={cloudUrl}
                  onChange={(e) => setCloudUrl(e.target.value)}
                  disabled={isFetchingCloud}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-semibold">💡 Instrucciones de acceso:</p>
                <p>
                  En {cloudService === 'gdrive' ? 'Google Drive' : 'Dropbox'}, haz clic en "Compartir" y selecciona <strong>"Cualquier persona con el enlace puede ver"</strong>. VoxLibris descargará y procesará el archivo directamente.
                </p>
              </div>

              <button
                onClick={handleFetchCloud}
                disabled={isFetchingCloud || !cloudUrl.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isFetchingCloud ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Conectando con almacenamiento...</span>
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-4 h-4" />
                    <span>Importar desde {cloudService === 'gdrive' ? 'Drive' : 'Dropbox'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 4: Text Direct */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Título del Documento
                </label>
                <input
                  type="text"
                  placeholder="Ej: Resumen de Biología / Capítulo 3"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Texto o Contenido
                </label>
                <textarea
                  rows={8}
                  placeholder="Pega aquí el texto que deseas leer o resumir..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className="w-full p-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none font-reader-serif leading-relaxed"
                />
              </div>

              <button
                onClick={handleSaveText}
                disabled={!textContent.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Guardar y Comenzar Lectura</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
