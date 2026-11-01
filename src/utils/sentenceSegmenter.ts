import { SentenceItem } from '../types';
import { repairDocumentText } from './textRepair';

const ABBREVIATIONS = new Set([
  'dr', 'dra', 'sr', 'sra', 'srta', 'prof', 'ing', 'lic', 'etc',
  'pag', 'pág', 'art', 'cap', 'vs', 'ej', 'num', 'núm', 'av', 'avda',
  'gral', 'tte', 'cmte', 'pte', 'cia', 'mr', 'mrs', 'ms', 'st',
]);

/**
 * Splits text into clean sentences while preserving abbreviations and quotes.
 */
export function splitParagraphIntoSentences(paragraph: string): string[] {
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

  const sentences: string[] = [];
  for (const raw of rawSentences) {
    const restored = raw.replace(/__DOT__/g, '.').trim();
    if (restored.length > 0) {
      sentences.push(restored);
    }
  }

  return sentences.length > 0 ? sentences : [cleaned];
}

/**
 * Builds the complete list of SentenceItems across all paragraphs of a document.
 */
export function buildDocumentSentences(paragraphs: string[], excludedSentenceIds: string[] = []): SentenceItem[] {
  const excludedSet = new Set(excludedSentenceIds || []);
  const items: SentenceItem[] = [];
  let globalCount = 0;

  paragraphs.forEach((paragraph, pIndex) => {
    const sentences = splitParagraphIntoSentences(paragraph);
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
  });

  return items;
}
