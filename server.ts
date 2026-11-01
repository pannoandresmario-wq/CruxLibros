import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy init Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory Cloud Sync Vault for multi-device sync
interface SyncState {
  syncCode: string;
  updatedAt: string;
  documents: any[];
  activeDocumentId: string | null;
  readingProgress: Record<string, {
    paragraphIndex: number;
    percent: number;
    updatedAt: string;
  }>;
  preferences: Record<string, any>;
}

const cloudSyncStore: Map<string, SyncState> = new Map();

// Helper to sanitize extracted HTML to clean readable text
function extractArticleText(html: string): { title: string; content: string } {
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = titleMatch ? titleMatch[1].trim() : 'Documento Web';
  title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

  let mainContent = '';
  const articleMatch = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  
  const sourceToParse = articleMatch ? articleMatch[1] : (mainMatch ? mainMatch[1] : cleaned);

  mainContent = sourceToParse
    .replace(/<p\b[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<h[1-6]\b[^>]*>/gi, '\n\n### ')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\n\s+\n/g, '\n\n')
    .trim();

  if (mainContent.length < 150) {
    mainContent = cleaned
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return { title, content: mainContent };
}

// 1. URL Content Extraction Endpoint
app.post('/api/fetch-url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Se requiere una URL válida.' });
    }

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es,en;q=0.9',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `No se pudo obtener la URL (Código HTTP ${response.status}).`,
      });
    }

    const html = await response.text();
    const { title, content } = extractArticleText(html);

    if (!content || content.length < 20) {
      return res.status(422).json({
        error: 'No se pudo extraer texto legible de la página proporcionada.',
      });
    }

    return res.json({
      title,
      content,
      sourceUrl: targetUrl,
      charCount: content.length,
      wordCount: content.split(/\s+/).filter(Boolean).length,
    });
  } catch (error: any) {
    console.error('Error fetching URL:', error);
    return res.status(500).json({
      error: `Error al conectar con la URL: ${error?.message || 'Tiempo de espera agotado'}`,
    });
  }
});

// 2. AI Summarization Endpoint
app.post('/api/gemini/summarize', async (req: Request, res: Response) => {
  try {
    const { text, title, type = 'executive', language = 'es' } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Texto no proporcionado para resumir.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Servicio de Gemini no configurado. Verifique GEMINI_API_KEY en configuración.',
      });
    }

    let promptInstructions = '';
    switch (type) {
      case 'bullets':
        promptInstructions = `Elabora un resumen de repaso rápido estructurado con viñetas claras y concisas, destacando conceptos primordiales, datos cruciales y conclusiones prácticas para estudio o memorización.`;
        break;
      case 'detailed':
        promptInstructions = `Elabora un resumen analítico detallado y estructurado con subtítulos por sección, cubriendo introducción, argumentos centrales, metodología o desarrollo, y lecciones clave.`;
        break;
      case 'flashcards':
        promptInstructions = `Elabora un set de preguntas y respuestas de alta retención (formato Tarjeta de Estudio: Pregunta / Respuesta clave) para repasar el contenido de forma activa.`;
        break;
      case 'executive':
      default:
        promptInstructions = `Elabora un resumen ejecutivo de alto impacto. Comienza con una síntesis general (en 2-3 párrafos claros), seguida de los 5 puntos más importantes y las conclusiones principales.`;
        break;
    }

    const languageInstruction = language === 'en' 
      ? 'Output the summary in English.'
      : language === 'fr'
      ? 'Rédigez le résumé en français.'
      : language === 'pt'
      ? 'Escreva o resumo em português.'
      : 'Escribe el resumen en español fluido, natural y enriquecedor.';

    const systemInstruction = `Eres un asistente de lectura y análisis experto en síntesis documental. Tu misión es transformar documentos extensos en resúmenes excepcionalmente comprensibles, precisos y bien estructurados. Conserva los matices importantes sin agregar información inventada. ${languageInstruction}`;

    const trimmedText = text.slice(0, 75000);
    const userPrompt = `Documento: ${title ? `"${title}"` : 'Texto sin título'}\n\nInstrucción: ${promptInstructions}\n\nContenido a sintetizar:\n"""\n${trimmedText}\n"""`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
      },
    });

    const summaryText = response.text || 'No se pudo generar el resumen.';

    return res.json({
      summary: summaryText,
      type,
      language,
      processedWords: trimmedText.split(/\s+/).filter(Boolean).length,
    });
  } catch (error: any) {
    console.error('Error generating summary:', error);
    return res.status(500).json({
      error: `Error al procesar el resumen con IA: ${error?.message || 'Error del servidor'}`,
    });
  }
});

// 3. AI Natural Voice Text-to-Speech Endpoint (gemini-3.8-flash-lite-tts)
app.post('/api/gemini/tts', async (req: Request, res: Response) => {
  try {
    const { text, voice = 'Kore', style = 'Natural, clear and engaging narrator' } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Texto requerido para generar audio.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Servicio de Gemini TTS no disponible. Puede usar la voz offline del navegador.',
      });
    }

    const cleanText = text.slice(0, 1500).trim();
    const allowedVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const chosenVoice = allowedVoices.includes(voice) ? voice : 'Kore';

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: cleanText,
              speechMetadata: {
                style,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: chosenVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res.status(500).json({
        error: 'No se generaron datos de audio. Por favor intente de nuevo.',
      });
    }

    return res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      voice: chosenVoice,
    });
  } catch (error: any) {
    console.error('Error in TTS generation:', error);
    return res.status(500).json({
      error: `Error al generar voz natural: ${error?.message || 'Error del servicio de audio'}`,
    });
  }
});

// 4. Cloud Sync Vault Endpoints
app.get('/api/sync/:syncCode', (req: Request, res: Response) => {
  const syncCode = req.params.syncCode.trim().toUpperCase();
  const state = cloudSyncStore.get(syncCode);
  if (!state) {
    return res.status(404).json({ error: 'Código de sincronización no encontrado en la nube.' });
  }
  return res.json(state);
});

app.post('/api/sync/:syncCode', (req: Request, res: Response) => {
  const syncCode = req.params.syncCode.trim().toUpperCase();
  const { documents, activeDocumentId, readingProgress, preferences } = req.body;

  const existing = cloudSyncStore.get(syncCode);
  const updatedState: SyncState = {
    syncCode,
    updatedAt: new Date().toISOString(),
    documents: documents || existing?.documents || [],
    activeDocumentId: activeDocumentId !== undefined ? activeDocumentId : existing?.activeDocumentId || null,
    readingProgress: {
      ...(existing?.readingProgress || {}),
      ...(readingProgress || {}),
    },
    preferences: {
      ...(existing?.preferences || {}),
      ...(preferences || {}),
    },
  };

  cloudSyncStore.set(syncCode, updatedState);
  return res.json({ success: true, updatedAt: updatedState.updatedAt, count: updatedState.documents.length });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VoxLibris Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
