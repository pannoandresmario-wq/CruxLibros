import * as pdfjsLib from 'pdfjs-dist';
import { repairDocumentText, splitIntoCleanParagraphs } from './textRepair';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

export interface ExtractedPDF {
  title: string;
  fullText: string;
  paragraphs: string[];
  totalPages: number;
  wordCount: number;
}

export async function extractTextFromPDF(
  fileOrBuffer: File | ArrayBuffer,
  onProgress?: (progress: number, total: number) => void
): Promise<ExtractedPDF> {
  let arrayBuffer: ArrayBuffer;

  if (fileOrBuffer instanceof File) {
    // Security Directive 16: Max file size 25MB
    const MAX_SIZE_BYTES = 25 * 1024 * 1024;
    if (fileOrBuffer.size > MAX_SIZE_BYTES) {
      throw new Error('El archivo excede el tamaño máximo permitido de 25 MB.');
    }
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }

  // Security Directive 16: Magic Bytes Validation (%PDF- = 0x25, 0x50, 0x44, 0x46, 0x2D)
  const headerBytes = new Uint8Array(arrayBuffer.slice(0, 5));
  const isPdfMagic =
    headerBytes[0] === 0x25 &&
    headerBytes[1] === 0x50 &&
    headerBytes[2] === 0x44 &&
    headerBytes[3] === 0x46 &&
    headerBytes[4] === 0x2d;

  if (!isPdfMagic) {
    throw new Error('El archivo no tiene una cabecera PDF válida (%PDF-). Formato no admitido.');
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    let lastY: number | null = null;
    let lastX: number | null = null;
    let lastWidth: number = 0;
    let pageStr = '';

    for (const rawItem of textContent.items) {
      if ('str' in rawItem) {
        const item = rawItem as { 
          str: string; 
          transform: number[]; 
          width?: number;
          hasEOL?: boolean;
        };
        const currentX = item.transform[4];
        const currentY = item.transform[5];
        const itemWidth = item.width || 0;

        if (lastY !== null && Math.abs(currentY - lastY) > 6) {
          // Newline detected
          pageStr += '\n';
        } else if (lastX !== null && lastY !== null) {
          // Same line: check horizontal gap between items
          const expectedNextX = lastX + lastWidth;
          const gap = currentX - expectedNextX;

          // If there's an actual space between items, add a space
          // If items are immediately adjacent or overlap (ligatures/kerning), do NOT add space
          if (gap > 2.5 && !pageStr.endsWith(' ') && !pageStr.endsWith('\n')) {
            pageStr += ' ';
          }
        }

        pageStr += item.str;
        lastX = currentX;
        lastY = currentY;
        lastWidth = itemWidth;
      }
    }

    pageTexts.push(pageStr);
    if (onProgress) {
      onProgress(pageNum, totalPages);
    }
  }

  const rawFullText = pageTexts.filter(Boolean).join('\n\n');

  // Apply intelligent text repair to eliminate word splitting and hyphenation
  const cleanFullText = repairDocumentText(rawFullText);
  const paragraphs = splitIntoCleanParagraphs(cleanFullText);

  let title = 'Documento PDF';
  if (fileOrBuffer instanceof File) {
    title = fileOrBuffer.name.replace(/\.pdf$/i, '');
  } else if (paragraphs.length > 0) {
    title = paragraphs[0].slice(0, 80);
  }

  const wordCount = cleanFullText.split(/\s+/).filter(Boolean).length;

  return {
    title,
    fullText: cleanFullText,
    paragraphs: paragraphs.length > 0 ? paragraphs : ['[Documento sin texto legible o protegido]'],
    totalPages,
    wordCount,
  };
}
