import { jsPDF } from 'jspdf';
import { DocumentItem } from '../types';
import { SpeechEngine } from './speechEngine';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSummaryAsText(docTitle: string, summaryText: string, typeName: string = 'Resumen') {
  const content = `=====================================================
${docTitle.toUpperCase()} - ${typeName.toUpperCase()}
Generado con VoxLibris AI Reader
Fecha: ${new Date().toLocaleDateString('es-ES', { dateStyle: 'full' })}
=====================================================

${summaryText}

-----------------------------------------------------
Exportado desde VoxLibris Reader.
`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const sanitizedTitle = docTitle.replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
  downloadBlob(blob, `${sanitizedTitle}_${typeName.toLowerCase()}.txt`);
}

export async function exportSummaryAsAudio(
  docTitle: string,
  summaryText: string,
  voice: string = 'Kore',
  onProgress?: (msg: string) => void
): Promise<void> {
  onProgress?.('Generando audio de alta fidelidad con voz natural...');
  const blob = await SpeechEngine.generateFullAudioWAV(summaryText, voice);
  const sanitizedTitle = docTitle.replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
  downloadBlob(blob, `${sanitizedTitle}_resumen_audio.wav`);
}

export function exportProjectAsMarkdown(doc: DocumentItem) {
  let md = `# ${doc.title}\n\n`;
  md += `> **Fuente:** ${doc.sourceType.toUpperCase()} ${doc.sourceUrl ? `(${doc.sourceUrl})` : ''}  \n`;
  md += `> **Palabras:** ${doc.wordCount} | **Tiempo estimado de lectura:** ~${doc.readingTimeMinutes} min  \n`;
  md += `> **Progreso de lectura:** ${doc.percentRead}% (Párrafo ${doc.currentParagraphIndex + 1} de ${doc.paragraphs.length})  \n`;
  md += `> **Fecha:** ${new Date(doc.updatedAt).toLocaleDateString('es-ES')}  \n\n`;

  if (doc.summaries?.executive || doc.summaries?.bullets || doc.summaries?.detailed || doc.summaries?.flashcards) {
    md += `## 🧠 Resúmenes con Inteligencia Artificial\n\n`;

    if (doc.summaries.executive) {
      md += `### Resumen Ejecutivo\n\n${doc.summaries.executive}\n\n`;
    }
    if (doc.summaries.bullets) {
      md += `### Puntos Clave de Repaso Rápido\n\n${doc.summaries.bullets}\n\n`;
    }
    if (doc.summaries.detailed) {
      md += `### Resumen Analítico\n\n${doc.summaries.detailed}\n\n`;
    }
    if (doc.summaries.flashcards) {
      md += `### Tarjetas de Estudio\n\n${doc.summaries.flashcards}\n\n`;
    }
    md += `---\n\n`;
  }

  if (doc.notes) {
    md += `## 📝 Notas del Lector\n\n${doc.notes}\n\n---\n\n`;
  }

  md += `## 📖 Contenido Completo del Documento\n\n`;
  doc.paragraphs.forEach((p, idx) => {
    const isBookmarked = doc.bookmarks.includes(idx);
    const prefix = isBookmarked ? `🔖 ` : '';
    md += `${prefix}${p}\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const sanitizedTitle = doc.title.replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
  downloadBlob(blob, `${sanitizedTitle}.md`);
}

export function exportProjectAsPDF(doc: DocumentItem) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = 25;

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - margin) {
      pdf.addPage();
      cursorY = margin;
      return true;
    }
    return false;
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(28, 25, 23);
  const titleLines = pdf.splitTextToSize(doc.title, contentWidth);
  pdf.text(titleLines, margin, cursorY);
  cursorY += titleLines.length * 8 + 4;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(120, 113, 108);
  const metaText = `VoxLibris Reader • Fuente: ${doc.sourceType.toUpperCase()} • ${doc.wordCount} palabras • Progreso: ${doc.percentRead}% • ${new Date().toLocaleDateString('es-ES')}`;
  pdf.text(metaText, margin, cursorY);
  cursorY += 8;

  pdf.setDrawColor(220, 215, 210);
  pdf.setLineWidth(0.5);
  pdf.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 10;

  const hasSummary = doc.summaries?.executive || doc.summaries?.bullets || doc.summaries?.detailed;
  if (hasSummary) {
    checkPageBreak(30);
    pdf.setFillColor(245, 243, 240);
    pdf.rect(margin, cursorY, contentWidth, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(180, 83, 9);
    pdf.text('RESUMEN CON INTELIGENCIA ARTIFICIAL', margin + 3, cursorY + 5.5);
    cursorY += 13;

    const summaryToPrint = doc.summaries?.executive || doc.summaries?.bullets || doc.summaries?.detailed || '';
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(40, 40, 40);
    const summaryLines = pdf.splitTextToSize(summaryToPrint, contentWidth);

    for (const line of summaryLines) {
      checkPageBreak(6);
      pdf.text(line, margin, cursorY);
      cursorY += 5.5;
    }

    cursorY += 8;
    checkPageBreak(15);
    pdf.setDrawColor(220, 215, 210);
    pdf.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 10;
  }

  checkPageBreak(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(28, 25, 23);
  pdf.text('CONTENIDO DEL DOCUMENTO', margin, cursorY);
  cursorY += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(50, 50, 50);

  doc.paragraphs.forEach((p, idx) => {
    checkPageBreak(12);
    const isBookmarked = doc.bookmarks.includes(idx);
    const prefix = isBookmarked ? '[Marcador] ' : '';
    const textLines = pdf.splitTextToSize(prefix + p, contentWidth);

    for (const line of textLines) {
      checkPageBreak(5.5);
      pdf.text(line, margin, cursorY);
      cursorY += 5.2;
    }
    cursorY += 4;
  });

  const totalPages = pdf.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Página ${i} de ${totalPages} • VoxLibris`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  const sanitizedTitle = doc.title.replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
  pdf.save(`${sanitizedTitle}.pdf`);
}
