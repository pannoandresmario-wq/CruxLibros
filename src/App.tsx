import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ReaderView } from './components/ReaderView';
import { AudioPlayerDock } from './components/AudioPlayerDock';
import { ImportModal } from './components/ImportModal';
import { AISummaryModal } from './components/AISummaryModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { ExportModal } from './components/ExportModal';
import { AudioDownloadModal } from './components/AudioDownloadModal';
import { DocumentItem, ReaderSettings, CloudSyncVault, ReadingTheme } from './types';
import { INITIAL_SAMPLE_DOCS } from './data/sampleDocuments';
import { 
  loadLocalDocuments, 
  saveLocalDocuments, 
  loadLocalActiveDocId, 
  saveLocalActiveDocId, 
  loadLocalSettings, 
  saveLocalSettings,
  getStoredSyncCode,
  setStoredSyncCode,
  pushToCloudVault,
  pullFromCloudVault
} from './utils/cloudSync';
import { SpeechEngine, SpeechStatus } from './utils/speechEngine';
import { buildDocumentSentences } from './utils/sentenceSegmenter';
import { repairDocumentText, splitIntoCleanParagraphs } from './utils/textRepair';
import { BookOpen, Plus, Sparkles, FolderUp } from 'lucide-react';

const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'light',
  fontFamily: 'serif',
  fontSize: 18,
  lineHeight: 1.75,
  pageWidth: 'medium',
  autoScroll: true,
  playbackSpeed: 1,
  voicePitch: 1,
  voiceVolume: 1,
  voiceEngine: 'gemini',
  geminiVoice: 'Kore',
  language: 'es',
  voiceStyleMode: 'standard',
  guitarAccompaniment: false,
  guitarVolume: 0.35,
  guitarTempo: 70,
  readingGranularity: 'sentence',
};

export default function App() {
  // 1. Documents state
  const [documents, setDocuments] = useState<DocumentItem[]>(() => {
    const local = loadLocalDocuments();
    const baseDocs = local.length > 0 ? local : INITIAL_SAMPLE_DOCS;
    return baseDocs.map(d => ({
      ...d,
      currentSentenceIndex: d.currentSentenceIndex ?? 0,
      currentParagraphIndex: d.currentParagraphIndex ?? 0,
    }));
  });

  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(() => {
    const localId = loadLocalActiveDocId();
    if (localId && documents.some(d => d.id === localId)) return localId;
    return documents.length > 0 ? documents[0].id : null;
  });

  // 2. Settings state
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    const localSettings = loadLocalSettings();
    return { ...DEFAULT_SETTINGS, ...localSettings };
  });

  // 3. Cloud Sync state
  const [syncVault, setSyncVault] = useState<CloudSyncVault>(() => ({
    syncCode: getStoredSyncCode(),
    deviceName: 'Mi Dispositivo',
    lastSyncedAt: null,
    status: 'synced',
  }));

  // 4. Online / Offline network detection
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 5. Sidebar responsive state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  });

  // 6. Modal states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [audioDownloadModalOpen, setAudioDownloadModalOpen] = useState(false);

  // 7. Active Document memo
  const activeDocument = useMemo(() => {
    return documents.find((doc) => doc.id === activeDocumentId) || null;
  }, [documents, activeDocumentId]);

  // Document Sentences Segmentation
  const sentences = useMemo(() => {
    if (!activeDocument || !activeDocument.paragraphs) return [];
    return buildDocumentSentences(activeDocument.paragraphs, activeDocument.excludedSentenceIds || []);
  }, [activeDocument]);

  const currentSentenceIndex = activeDocument?.currentSentenceIndex ?? 0;

  // 8. Speech Engine & Audio state
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('stopped');
  const speechEngineRef = useRef<SpeechEngine | null>(null);
  const handleSentenceProgressRef = useRef<(idx: number) => void>(() => {});

  // Initialize SpeechEngine
  useEffect(() => {
    const engine = new SpeechEngine(settings, {
      onStatusChange: (status) => setSpeechStatus(status),
      onSentenceChange: (idx) => {
        handleSentenceProgressRef.current(idx);
      },
      onError: (msg) => {
        console.warn('Speech engine message:', msg);
      },
    });

    speechEngineRef.current = engine;

    return () => {
      engine.stop();
    };
  }, []);

  // Synchronize callbacks on every render to eliminate stale closures
  useEffect(() => {
    if (speechEngineRef.current) {
      speechEngineRef.current.updateCallbacks({
        onStatusChange: (status) => setSpeechStatus(status),
        onSentenceChange: (idx) => handleSentenceProgressRef.current(idx),
        onError: (msg) => console.warn('Speech engine message:', msg),
      });
    }
  });

  // Update speech engine when settings change
  useEffect(() => {
    if (speechEngineRef.current) {
      speechEngineRef.current.updateSettings(settings);
    }
    saveLocalSettings(settings);
  }, [settings]);

  // Theme effect (Light, Sepia, Dark, Automatic)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'theme-sepia');

    let effectiveTheme = settings.theme;
    if (effectiveTheme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const currentHour = new Date().getHours();
      const isNight = currentHour >= 19 || currentHour < 7;
      effectiveTheme = prefersDark || isNight ? 'dark' : 'light';
    }

    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else if (effectiveTheme === 'sepia') {
      root.classList.add('theme-sepia');
    }
  }, [settings.theme]);

  // Update speech engine sentences when active document or sentences change
  useEffect(() => {
    if (activeDocument && speechEngineRef.current && sentences.length > 0) {
      const savedIndex = activeDocument.currentSentenceIndex || 0;
      speechEngineRef.current.setSentences(sentences, savedIndex);
    }
    saveLocalActiveDocId(activeDocumentId);
  }, [activeDocumentId, sentences]);

  // Save documents to local storage
  useEffect(() => {
    saveLocalDocuments(documents);
  }, [documents]);

  // Debounced Cloud Sync
  const cloudSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerCloudSyncPush = useCallback(
    (updatedDocs: DocumentItem[], activeId: string | null) => {
      if (!isOnline) return;

      if (cloudSyncTimeoutRef.current) {
        clearTimeout(cloudSyncTimeoutRef.current);
      }

      cloudSyncTimeoutRef.current = setTimeout(async () => {
        try {
          setSyncVault((prev) => ({ ...prev, status: 'syncing' }));
          const res = await pushToCloudVault(syncVault.syncCode, updatedDocs, activeId, settings);
          setSyncVault((prev) => ({
            ...prev,
            status: 'synced',
            lastSyncedAt: res.updatedAt,
          }));
        } catch (err: any) {
          console.warn('Auto cloud sync push warning:', err);
          setSyncVault((prev) => ({
            ...prev,
            status: 'error',
            errorMessage: err.message,
          }));
        }
      }, 1500);
    },
    [isOnline, syncVault.syncCode, settings]
  );

  // Update reading progress by sentence with immediate persistence and paragraph indexing
  const handleSentenceProgress = useCallback(
    (newSentenceIndex: number) => {
      if (!activeDocumentId) return;

      setDocuments((prev) => {
        const next = prev.map((doc) => {
          if (doc.id !== activeDocumentId) return doc;
          const matchingSentence = sentences[newSentenceIndex];
          const newParagraphIndex = matchingSentence ? matchingSentence.paragraphIndex : (doc.currentParagraphIndex ?? 0);
          const total = sentences.length;
          const percent = total > 0 ? Math.round(((newSentenceIndex + 1) / total) * 100) : 0;

          return {
            ...doc,
            currentSentenceIndex: newSentenceIndex,
            currentParagraphIndex: newParagraphIndex,
            percentRead: percent,
            lastReadAt: new Date().toISOString(),
          };
        });

        saveLocalDocuments(next);
        triggerCloudSyncPush(next, activeDocumentId);
        return next;
      });
    },
    [activeDocumentId, sentences, triggerCloudSyncPush]
  );

  handleSentenceProgressRef.current = handleSentenceProgress;

  // Playback control handlers: starts reading from the remembered sentence position
  const handlePlay = () => {
    if (!speechEngineRef.current || !activeDocument) return;
    speechEngineRef.current.unlockAudio();
    const targetIdx = activeDocument.currentSentenceIndex ?? 0;
    speechEngineRef.current.play(targetIdx);
  };

  const handleRestartDocument = () => {
    if (!activeDocumentId || !speechEngineRef.current) return;
    speechEngineRef.current.stop();
    handleSentenceProgress(0);
    if (sentences.length > 0) {
      speechEngineRef.current.setSentences(sentences, 0);
    }
  };

  const handleSelectVoice = (voice: ReaderSettings['geminiVoice']) => {
    const updatedSettings: ReaderSettings = {
      ...settings,
      geminiVoice: voice,
      voiceEngine: 'gemini',
      voiceStyleMode: 'standard',
    };
    setSettings(updatedSettings);
    if (speechEngineRef.current) {
      speechEngineRef.current.unlockAudio();
      speechEngineRef.current.updateSettings(updatedSettings);
      speechEngineRef.current.play(currentSentenceIndex);
    }
  };

  const handleToggleGaucho = () => {
    const nextGaucho = settings.voiceStyleMode !== 'gaucho';
    const updatedSettings: ReaderSettings = {
      ...settings,
      voiceStyleMode: nextGaucho ? 'gaucho' : 'standard',
      guitarAccompaniment: nextGaucho ? true : settings.guitarAccompaniment,
      geminiVoice: 'Fenrir',
    };
    setSettings(updatedSettings);
    if (speechEngineRef.current) {
      speechEngineRef.current.unlockAudio();
      speechEngineRef.current.updateSettings(updatedSettings);
      speechEngineRef.current.play(currentSentenceIndex);
    }
  };

  const handleSaveEditedDocument = (newTitle: string, newContent: string) => {
    if (!activeDocumentId) return;
    const cleanedParagraphs = splitIntoCleanParagraphs(newContent);
    const wordCount = newContent.trim().split(/\s+/).filter(Boolean).length;
    const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

    setDocuments((prev) => {
      const next = prev.map((doc) => {
        if (doc.id !== activeDocumentId) return doc;
        return {
          ...doc,
          title: newTitle,
          content: newContent,
          paragraphs: cleanedParagraphs,
          wordCount,
          readingTimeMinutes,
          updatedAt: new Date().toISOString(),
          currentSentenceIndex: 0,
          currentParagraphIndex: 0,
        };
      });
      triggerCloudSyncPush(next, activeDocumentId);
      return next;
    });
  };

  const handleToggleExcludeSentence = (sentenceId: string) => {
    if (!activeDocumentId) return;
    setDocuments((prev) => {
      const next = prev.map((doc) => {
        if (doc.id !== activeDocumentId) return doc;
        const current = doc.excludedSentenceIds || [];
        const exists = current.includes(sentenceId);
        const nextExcluded = exists
          ? current.filter((id) => id !== sentenceId)
          : [...current, sentenceId];
        return {
          ...doc,
          excludedSentenceIds: nextExcluded,
        };
      });
      triggerCloudSyncPush(next, activeDocumentId);
      return next;
    });
  };

  const handleBatchExcludeSentences = (sentenceIds: string[]) => {
    if (!activeDocumentId) return;
    setDocuments((prev) => {
      const next = prev.map((doc) => {
        if (doc.id !== activeDocumentId) return doc;
        return {
          ...doc,
          excludedSentenceIds: sentenceIds,
        };
      });
      triggerCloudSyncPush(next, activeDocumentId);
      return next;
    });
  };

  const handlePause = () => {
    if (speechEngineRef.current) {
      speechEngineRef.current.pause();
    }
  };

  const handleNext = () => {
    if (speechEngineRef.current) {
      speechEngineRef.current.next();
    }
  };

  const handlePrevious = () => {
    if (speechEngineRef.current) {
      speechEngineRef.current.previous();
    }
  };

  const handleSkipSeconds = (sec: number) => {
    if (speechEngineRef.current) {
      speechEngineRef.current.skipSeconds(sec);
    }
  };

  // Click on ANY sentence in the text
  const handleSentenceClick = (globalIndex: number) => {
    if (!activeDocument) return;
    handleSentenceProgress(globalIndex);
    if (speechEngineRef.current) {
      speechEngineRef.current.play(globalIndex);
    }
  };

  const handleToggleBookmark = (paragraphIndex: number) => {
    if (!activeDocumentId) return;
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id !== activeDocumentId) return doc;
        const exists = doc.bookmarks.includes(paragraphIndex);
        const bookmarks = exists
          ? doc.bookmarks.filter((b) => b !== paragraphIndex)
          : [...doc.bookmarks, paragraphIndex].sort((a, b) => a - b);
        return { ...doc, bookmarks };
      })
    );
  };

  const handleSelectDocument = (id: string) => {
    if (speechEngineRef.current) {
      speechEngineRef.current.stop();
    }
    setActiveDocumentId(id);
  };

  const handleDeleteDocument = (id: string) => {
    if (speechEngineRef.current && activeDocumentId === id) {
      speechEngineRef.current.stop();
    }
    const filtered = documents.filter((doc) => doc.id !== id);
    setDocuments(filtered);
    if (activeDocumentId === id) {
      setActiveDocumentId(filtered.length > 0 ? filtered[0].id : null);
    }
  };

  const handleDocumentCreated = (newDoc: DocumentItem) => {
    const formatted = {
      ...newDoc,
      currentSentenceIndex: 0,
      currentParagraphIndex: 0,
    };
    setDocuments((prev) => [formatted, ...prev]);
    setActiveDocumentId(formatted.id);
    triggerCloudSyncPush([formatted, ...documents], formatted.id);
  };

  const handleUpdateDocumentSummaries = (summaries: DocumentItem['summaries']) => {
    if (!activeDocumentId) return;
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id !== activeDocumentId) return doc;
        return { ...doc, summaries };
      })
    );
  };

  const handlePlayTextInVoice = (text: string) => {
    if (speechEngineRef.current) {
      speechEngineRef.current.stop();
      speechEngineRef.current.setSentences([
        {
          id: 'temp-0',
          globalIndex: 0,
          paragraphIndex: 0,
          sentenceInParagraphIndex: 0,
          text,
        },
      ], 0);
      speechEngineRef.current.play(0);
    }
  };

  const handleSyncNow = async () => {
    setSyncVault((prev) => ({ ...prev, status: 'syncing' }));
    const res = await pushToCloudVault(syncVault.syncCode, documents, activeDocumentId, settings);
    setSyncVault((prev) => ({
      ...prev,
      status: 'synced',
      lastSyncedAt: res.updatedAt,
    }));
  };

  const handleLinkDeviceCode = async (newCode: string) => {
    setSyncVault((prev) => ({ ...prev, status: 'syncing' }));
    const cloudData = await pullFromCloudVault(newCode);

    setStoredSyncCode(newCode);
    setDocuments(cloudData.documents.map(d => ({
      ...d,
      currentSentenceIndex: d.currentSentenceIndex ?? 0,
    })));
    if (cloudData.activeDocumentId) {
      setActiveDocumentId(cloudData.activeDocumentId);
    }
    if (cloudData.preferences) {
      setSettings((prev) => ({ ...prev, ...cloudData.preferences }));
    }

    setSyncVault({
      syncCode: newCode,
      deviceName: 'Mi Dispositivo',
      lastSyncedAt: cloudData.updatedAt,
      status: 'synced',
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100 transition-colors">
      
      {/* 1. Header */}
      <Header
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        theme={settings.theme}
        setTheme={(theme: ReadingTheme) => setSettings((s) => ({ ...s, theme }))}
        syncVault={syncVault}
        onOpenSyncModal={() => setSyncModalOpen(true)}
        onOpenImportModal={() => setImportModalOpen(true)}
        onOpenSummaryModal={() => setSummaryModalOpen(true)}
        onOpenExportModal={() => setExportModalOpen(true)}
        isOnline={isOnline}
        hasActiveDocument={!!activeDocument}
      />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          documents={documents}
          activeDocumentId={activeDocumentId}
          onSelectDocument={handleSelectDocument}
          onDeleteDocument={handleDeleteDocument}
          onOpenImportModal={() => setImportModalOpen(true)}
        />

        {/* Reader Center Screen with Sentence Breakdown */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-stone-50 dark:bg-stone-950">
          {activeDocument ? (
            <ReaderView
              document={activeDocument}
              sentences={sentences}
              currentSentenceIndex={currentSentenceIndex}
              isPlaying={speechStatus === 'playing'}
              isBuffering={speechStatus === 'buffering'}
              onSentenceClick={handleSentenceClick}
              onToggleBookmark={handleToggleBookmark}
              settings={settings}
              onUpdateSettings={(newSettings) => setSettings((s) => ({ ...s, ...newSettings }))}
              onOpenSummaryModal={() => setSummaryModalOpen(true)}
              onOpenExportModal={() => setExportModalOpen(true)}
              onOpenAudioDownloadModal={() => setAudioDownloadModalOpen(true)}
              onSaveEditedDocument={handleSaveEditedDocument}
              onToggleExcludeSentence={handleToggleExcludeSentence}
              onBatchExcludeSentences={handleBatchExcludeSentences}
              onPlayFromSaved={handlePlay}
              onRestartFromBeginning={handleRestartDocument}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold font-reader-serif text-stone-900 dark:text-stone-100 mb-2">
                Tu Biblioteca está lista
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-6 leading-relaxed">
                Carga un archivo PDF, una URL o introduce un texto para comenzar a escuchar oración por oración o con el estilo gaucho y guitarra criolla.
              </p>
              <button
                onClick={() => setImportModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Cargar Documento o URL</span>
              </button>
            </div>
          )}
        </main>

      </div>

      {/* 3. Audio Player Bottom Dock */}
      {activeDocument && (
        <AudioPlayerDock
          isPlaying={speechStatus === 'playing'}
          isBuffering={speechStatus === 'buffering'}
          currentSentenceIndex={currentSentenceIndex}
          totalSentences={sentences.length}
          currentParagraphIndex={activeDocument.currentParagraphIndex ?? 0}
          totalParagraphs={activeDocument.paragraphs?.length ?? 1}
          onPlay={handlePlay}
          onPause={handlePause}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSkipSeconds={handleSkipSeconds}
          onSeekSentence={handleSentenceClick}
          settings={settings}
          onUpdateSettings={(newSettings) => setSettings((s) => ({ ...s, ...newSettings }))}
          onOpenAudioDownloadModal={() => setAudioDownloadModalOpen(true)}
          isOnline={isOnline}
          onSelectVoice={handleSelectVoice}
          onToggleGaucho={handleToggleGaucho}
        />
      )}

      {/* 4. Modals */}
      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onDocumentCreated={handleDocumentCreated}
        isOnline={isOnline}
      />

      {activeDocument && (
        <AISummaryModal
          isOpen={summaryModalOpen}
          onClose={() => setSummaryModalOpen(false)}
          document={activeDocument}
          onUpdateDocumentSummaries={handleUpdateDocumentSummaries}
          onPlayTextInVoice={handlePlayTextInVoice}
          isOnline={isOnline}
        />
      )}

      <CloudSyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        syncVault={syncVault}
        onSyncNow={handleSyncNow}
        onLinkDeviceCode={handleLinkDeviceCode}
        documents={documents}
        activeDocument={activeDocument}
        isOnline={isOnline}
      />

      {activeDocument && (
        <ExportModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          document={activeDocument}
        />
      )}

      {activeDocument && (
        <AudioDownloadModal
          isOpen={audioDownloadModalOpen}
          onClose={() => setAudioDownloadModalOpen(false)}
          document={activeDocument}
          sentences={sentences}
          currentSentenceIndex={currentSentenceIndex}
          settings={settings}
        />
      )}

    </div>
  );
}
