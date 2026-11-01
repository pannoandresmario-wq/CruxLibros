/**
 * Utilities for cleaning, repairing hyphenation, and removing broken spacing
 * from PDFs, OCR, and scraped web documents.
 */

export function repairDocumentText(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // 1. Remove soft hyphens (\u00AD), zero-width spaces (\u200B, \u200C, \u200D, \uFEFF)
  text = text.replace(/[\u00AD\u200B\u200C\u200D\uFEFF]/g, '');

  // 2. Fix hyphenation at line breaks (e.g., "informa-\nción" -> "información")
  // Handles standard hyphen, en-dash, em-dash, minus
  text = text.replace(/([\p{L}\d]+)[-–—]\s*\r?\n\s*([\p{L}\d]+)/gu, '$1$2');

  // 3. Fix hyphen followed by space within a line (e.g., "dispo- sitivos" -> "dispositivos")
  text = text.replace(/([\p{L}]{2,})[-–—]\s+([\p{L}]{2,})/gu, (match, p1, p2) => {
    // If second word is lowercase, it was almost certainly a split word
    if (p2.toLowerCase() === p2) {
      return `${p1}${p2}`;
    }
    return match;
  });

  // 4. Fix words split by line breaks without a hyphen if within a single sentence
  // E.g., single newline between lowercase words: "de la\nmisma" -> "de la misma"
  text = text.replace(/([\p{L},;])\s*\r?\n\s*([\p{L}])/gu, '$1 $2');

  // 5. Fix common broken Spanish/accented characters and ligatures
  text = text
    .replace(/´\s*([aeiouAEIOU])/g, (m, v) => {
      const accents: Record<string, string> = {
        a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú',
        A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú',
      };
      return accents[v] || m;
    })
    .replace(/¨\s*([uU])/g, (m, v) => (v === 'u' ? 'ü' : 'Ü'))
    .replace(/˜\s*([nN])/g, (m, v) => (v === 'n' ? 'ñ' : 'Ñ'));

  // 6. Fix ligature artifacts: ﬁ -> fi, ﬂ -> fl, ﬀ -> ff, ﬃ -> ffi, ﬄ -> ffl
  text = text
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl');

  // 7. Normalize repeated spaces and tabs into single space
  text = text.replace(/[ \t]+/g, ' ');

  // 8. Normalize paragraph breaks (max 2 consecutive newlines)
  text = text.replace(/\r?\n\s*\r?\n+/g, '\n\n');

  return text.trim();
}

/**
 * Splits cleaned text into natural reading paragraphs,
 * ensuring each paragraph is a coherent chunk for speech synthesis.
 */
export function splitIntoCleanParagraphs(text: string): string[] {
  const repaired = repairDocumentText(text);

  return repaired
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);
}
