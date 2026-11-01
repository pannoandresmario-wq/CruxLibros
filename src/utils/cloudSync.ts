import { DocumentItem, ReaderSettings } from '../types';

const SYNC_CODE_KEY = 'voxlibris_sync_code';
const LOCAL_DOCS_KEY = 'voxlibris_documents';
const LOCAL_SETTINGS_KEY = 'voxlibris_settings';
const ACTIVE_DOC_ID_KEY = 'voxlibris_active_doc_id';

export function generateSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'VOX-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getStoredSyncCode(): string {
  let code = localStorage.getItem(SYNC_CODE_KEY);
  if (!code) {
    code = generateSyncCode();
    localStorage.setItem(SYNC_CODE_KEY, code);
  }
  return code;
}

export function setStoredSyncCode(code: string) {
  localStorage.setItem(SYNC_CODE_KEY, code.trim().toUpperCase());
}

export function loadLocalDocuments(): DocumentItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_DOCS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error loading local documents:', e);
    return [];
  }
}

export function saveLocalDocuments(docs: DocumentItem[]) {
  try {
    localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(docs));
  } catch (e) {
    console.error('Error saving local documents:', e);
  }
}

export function loadLocalActiveDocId(): string | null {
  return localStorage.getItem(ACTIVE_DOC_ID_KEY);
}

export function saveLocalActiveDocId(id: string | null) {
  if (id) {
    localStorage.setItem(ACTIVE_DOC_ID_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_DOC_ID_KEY);
  }
}

export function loadLocalSettings(): Partial<ReaderSettings> {
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalSettings(settings: ReaderSettings) {
  try {
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving settings:', e);
  }
}

export async function pushToCloudVault(
  syncCode: string,
  documents: DocumentItem[],
  activeDocumentId: string | null,
  preferences: ReaderSettings
): Promise<{ success: boolean; updatedAt: string }> {
  const readingProgress: Record<string, any> = {};
  for (const doc of documents) {
    readingProgress[doc.id] = {
      paragraphIndex: doc.currentParagraphIndex,
      percent: doc.percentRead,
      updatedAt: doc.lastReadAt,
    };
  }

  const cleanCode = encodeURIComponent(syncCode.trim().toUpperCase());
  const response = await fetch(`/api/sync/${cleanCode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documents,
      activeDocumentId,
      readingProgress,
      preferences,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Error al sincronizar con la nube (HTTP ${response.status})`);
  }

  return response.json();
}

export async function pullFromCloudVault(
  syncCode: string
): Promise<{
  documents: DocumentItem[];
  activeDocumentId: string | null;
  preferences: Partial<ReaderSettings>;
  updatedAt: string;
}> {
  const cleanCode = encodeURIComponent(syncCode.trim().toUpperCase());
  const response = await fetch(`/api/sync/${cleanCode}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'No se encontró la bóveda en la nube con este código.');
  }

  const data = await response.json();
  return {
    documents: data.documents || [],
    activeDocumentId: data.activeDocumentId || null,
    preferences: data.preferences || {},
    updatedAt: data.updatedAt,
  };
}
