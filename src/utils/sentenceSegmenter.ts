import { SentenceItem } from '../types';
import { repairDocumentText } from './textRepair';

const ABBREVIATIONS = new Set([
  'dr', 'dra', 'sr', 'sra', 'srta', 'prof', 'ing', 'lic', 'etc',
  'pag', 'pág', 'art', 'cap', 'vs', 'ej', 'num', 'núm', 'av', 'avda',
  'gral', 'tte', 'cmte', 'pte', 'cia', 'mr', 'mrs', 'ms', 'st',
]);

/**
 * Splits text into clean sentences while preserving abbreviations and quotes.
 * If mergeShort is true, excessively short sentences (< minCharThreshold) are combined
 * with the adjacent sentence to avoid fragmented, robotic cuts and excessive pauses.
 */
export function splitParagraphIntoSentences(
  paragraph: string,
  mergeShort: boolean = true,
  minCharThreshold: number = 65
): string[] {
  const cleaned = repairDocumentText(paragraph);
  if (!cleaned) return [];

  // Protect abbreviations with temporary placeholder
  let protectedText = cleaned;
  
  // Protect numbers with decimals (e.g., 3.14 or 1.5)
  protectedText = protectedText.replace(/(\d+)\.(\d+)/g, '$1__DOT__$2');

  // Protect abbreviations followed by dot
  protectedText = protectedText.replace(/\b([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)\./g, (match, word) => {
    if (ABBREVIATIONS.has(word.toLowerCase())) {
      return `${word}__DOT__`;
    }
    return match;
  });

  // Split on sentence boundaries: (. ! ? …) followed by space or quote
  const rawSentences = protectedText.split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"«'0-9])/);

  const rawList: string[] = [];
  for (const raw of rawSentences) {
    const restored = raw.replace(/__DOT__/g, '.').trim();
    if (restored.length > 0) {
      rawList.push(restored);
    }
  }

  if (rawList.length <= 1 || !mergeShort) {
    return rawList.length > 0 ? rawList : [cleaned];
  }

  // Merge short sentences (< minCharThreshold or < 9 words) with the next sentence
  const merged: string[] = [];
  let buffer = '';

  for (let i = 0; i < rawList.length; i++) {
    const s = rawList[i];
    if (buffer) {
      buffer = `${buffer} ${s}`;
    } else {
      buffer = s;
    }

    const wordCount = buffer.split(/\s+/).filter(Boolean).length;
    const isLast = i === rawList.length - 1;

    // If buffer is long enough or it's the last sentence in the paragraph, commit it
    if (buffer.length >= minCharThreshold || wordCount >= 9 || isLast) {
      merged.push(buffer.trim());
      buffer = '';
    }
  }

  if (buffer.trim()) {
    if (merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${buffer.trim()}`;
    } else {
      merged.push(buffer.trim());
    }
  }

  return merged.length > 0 ? merged : [cleaned];
}

/**
 * Builds the complete list of SentenceItems across all paragraphs of a document.
 * Supports both:
 * - 'sentence': phrase-by-phrase with optional smart short sentence merging
 * - 'paragraph': full paragraph reading blocks for uninterrupted, completely natural flow
 */
export function buildDocumentSentences(
  paragraphs: string[],
  excludedSentenceIds: string[] = [],
  granularity: 'sentence' | 'paragraph' = 'sentence',
  mergeShortSentences: boolean = true
): SentenceItem[] {
  const excludedSet = new Set(excludedSentenceIds || []);
  const items: SentenceItem[] = [];
  let globalCount = 0;

  paragraphs.forEach((paragraph, pIndex) => {
    const cleanParagraph = paragraph.trim();
    if (!cleanParagraph) return;

    if (granularity === 'paragraph') {
      const id = `p${pIndex}`;
      items.push({
        id,
        globalIndex: globalCount++,
        paragraphIndex: pIndex,
        sentenceInParagraphIndex: 0,
        text: cleanParagraph,
        excluded: excludedSet.has(id),
      });
    } else {
      const sentences = splitParagraphIntoSentences(cleanParagraph, mergeShortSentences);
      sentences.forEach((sentenceText, sIndex) => {
        const id = `p${pIndex}-s${sIndex}`;
        items.push({
          id,
          globalIndex: globalCount++,
          paragraphIndex: pIndex,
          sentenceInParagraphIndex: sIndex,
          text: sentenceText,
          excluded: excludedSet.has(id),
        });
      });
    }
  });

  return items;
}
