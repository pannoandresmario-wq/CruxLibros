export interface SentenceItem {
  id: string;
  globalIndex: number;
  paragraphIndex: number;
  sentenceInParagraphIndex: number;
  text: string;
  excluded?: boolean;
}

export interface DocumentItem {
  id: string;
  title: string;
  sourceType: 'pdf' | 'url' | 'text' | 'gdrive' | 'dropbox';
  sourceUrl?: string;
  originalFileName?: string;
  content: string;
  paragraphs: string[];
  wordCount: number;
  readingTimeMinutes: number;
  createdAt: string;
  updatedAt: string;
  // Reading state
  currentParagraphIndex: number;
  currentSentenceIndex?: number;
  percentRead: number;
  lastReadAt: string;
  bookmarks: number[];
  // Excluded sentences (custom reading / custom summary)
  excludedSentenceIds?: string[];
  // AI Summaries
  summaries?: {
    executive?: string;
    bullets?: string;
    detailed?: string;
    flashcards?: string;
    generatedAt?: string;
  };
  notes?: string;
}

export type ReadingTheme = 'light' | 'sepia' | 'dark' | 'auto';

export interface ReaderSettings {
  theme: ReadingTheme;
  fontFamily: 'serif' | 'sans' | 'display';
  fontSize: number;
  lineHeight: number;
  pageWidth: 'narrow' | 'medium' | 'wide';
  autoScroll: boolean;
  playbackSpeed: number;
  voicePitch: number;
  voiceVolume: number;
  voiceEngine: 'gemini' | 'browser';
  voicePersistenceMode?: 'system_unlimited' | 'ai_prefer_cloud';
  geminiVoice: 'Kore' | 'Fenrir' | 'Puck' | 'Charon' | 'Zephyr';
  selectedBrowserVoiceURI?: string;
  language: string;
  // Gaucho & Guitar Accompaniment
  voiceStyleMode: 'standard' | 'gaucho';
  guitarAccompaniment: boolean;
  guitarVolume: number; // 0.0 to 1.0 (default 0.35)
  guitarTempo: number; // 45 to 110 BPM (default 70)
  readingGranularity: 'sentence' | 'paragraph';
  mergeShortSentences: boolean;
}

export interface CloudSyncVault {
  syncCode: string;
  deviceName: string;
  lastSyncedAt: string | null;
  status: 'synced' | 'syncing' | 'offline' | 'error';
  errorMessage?: string;
}
