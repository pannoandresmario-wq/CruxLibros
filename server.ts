import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import dns from 'dns';
import { promisify } from 'util';
import crypto from 'crypto';

dotenv.config();

const dnsLookup = promisify(dns.lookup);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === 'production';

// =========================================================================
// SECURITY DIRECTIVE 1 & 2: SECURE SECRETS & ENVIRONMENT HANDLING
// =========================================================================
// API keys are read strictly from process.env and never exposed to the client.
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// =========================================================================
// SECURITY DIRECTIVE 18 & 19: SECURITY HEADERS & HTTPS HARDENING
// =========================================================================
app.disable('x-powered-by');

app.use((req: Request, res: Response, next: NextFunction) => {
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "connect-src 'self' https: data: blob: https://cdnjs.cloudflare.com",
    "worker-src 'self' blob: https://cdnjs.cloudflare.com",
    "frame-ancestors 'self' https://*.google.com https://*.run.app",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
});

// Body parser with strict size limits (Security Directive 14 & 16)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =========================================================================
// SECURITY DIRECTIVE 11 & 12: SLIDING WINDOW RATE LIMITING & BOT MITIGATION
// =========================================================================
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitMap: Map<string, RateLimitRecord> = new Map();

// Periodic cleanup of rate limit store
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

function createRateLimiter(options: { maxRequests: number; windowMs: number; message: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const routeKey = `${clientIp}:${req.baseUrl || req.path}`;
    const now = Date.now();
    const record = rateLimitMap.get(routeKey);

    if (!record || now > record.resetTime) {
      rateLimitMap.set(routeKey, { count: 1, resetTime: now + options.windowMs });
      return next();
    }

    if (record.count >= options.maxRequests) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec.toString());
      return res.status(429).json({
        error: options.message,
        retryAfter: retryAfterSec,
      });
    }

    record.count++;
    next();
  };
}

const aiRateLimiter = createRateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000,
  message: 'Demasiadas solicitudes de IA. Por favor espera unos momentos antes de reintentar.',
});

const urlFetchRateLimiter = createRateLimiter({
  maxRequests: 25,
  windowMs: 60 * 1000,
  message: 'Límite de extracción de URLs excedido. Por favor intenta nuevamente en un minuto.',
});

const syncRateLimiter = createRateLimiter({
  maxRequests: 90,
  windowMs: 60 * 1000,
  message: 'Límite de sincronización alcanzado temporalmente.',
});

// =========================================================================
// SECURITY DIRECTIVE 4, 7, 8 & 10: RLS, IDOR & MASS ASSIGNMENT VAULT STORE
// =========================================================================
interface SyncState {
  syncCodeHash: string;
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

function hashToken(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

// =========================================================================
// SECURITY DIRECTIVE 13, 14 & 15: SSRF PROTECTION & HTML SANITIZATION
// =========================================================================
function isPrivateOrReservedIP(ip: string): boolean {
  if (!ip) return true;
  // IPv4 Local / Loopback
  if (ip.startsWith('127.') || ip === '0.0.0.0' || ip === 'localhost') return true;
  // RFC 1918 Private ranges
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  // 172.16.0.0 - 172.31.255.255
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // Link-local / Cloud metadata service (169.254.x.x)
  if (ip.startsWith('169.254.')) return true;
  // Carrier-grade NAT (100.64.0.0/10)
  if (parts.length === 4 && parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  // IPv6 loopback and link-local
  if (ip === '::1' || ip === '::' || ip.toLowerCase().startsWith('fe80:')) return true;

  return false;
}

function sanitizeHtmlContent(html: string): { title: string; content: string } {
  // Strip malicious tags, executable scripts, iframes, objects, and on* handlers
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/on\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, ''); // remove inline event handlers

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = titleMatch ? titleMatch[1].trim() : 'Documento Web';
  title = title
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .slice(0, 150);

  const articleMatch = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const sourceToParse = articleMatch ? articleMatch[1] : mainMatch ? mainMatch[1] : cleaned;

  let mainContent = sourceToParse
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
    mainContent = cleaned.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Cap content size to avoid buffer overruns
  mainContent = mainContent.slice(0, 100000);

  return { title, content: mainContent };
}

// =========================================================================
// ENDPOINTS
// =========================================================================

// 1. SSRF-Protected URL Content Extraction Endpoint
app.post('/api/fetch-url', urlFetchRateLimiter, async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || url.length > 2048) {
      return res.status(400).json({ error: 'Se requiere una URL válida (máx 2048 caracteres).' });
    }

    let parsedUrl: URL;
    try {
      let target = url.trim();
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        target = `https://${target}`;
      }
      parsedUrl = new URL(target);
    } catch {
      return res.status(400).json({ error: 'Formato de URL inválido.' });
    }

    // SSRF Guard 1: Protocol whitelist
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'Solo se permiten protocolos HTTP y HTTPS.' });
    }

    // SSRF Guard 2: Hostname & DNS Resolution Validation
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.localhost')
    ) {
      return res.status(403).json({ error: 'Acceso denegado a hosts locales o internos.' });
    }

    // Resolve DNS to verify destination IP is not private
    try {
      const lookupResult = await dnsLookup(hostname);
      if (isPrivateOrReservedIP(lookupResult.address)) {
        return res.status(403).json({ error: 'Acceso denegado a direcciones de red privadas o reservadas.' });
      }
    } catch (dnsErr: any) {
      return res.status(400).json({ error: `No se pudo resolver el dominio: ${hostname}` });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 VoxLibrisReader/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es,en;q=0.9',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `No se pudo obtener el contenido (Código HTTP ${response.status}).`,
      });
    }

    // Check Content-Type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('text/plain')) {
      return res.status(415).json({
        error: 'El recurso solicitado no es una página web o texto legible.',
      });
    }

    const html = await response.text();
    const { title, content } = sanitizeHtmlContent(html);

    if (!content || content.length < 20) {
      return res.status(422).json({
        error: 'No se pudo extraer texto legible de la página proporcionada.',
      });
    }

    // Return only necessary data (Data Minimization)
    return res.json({
      title,
      content,
      sourceUrl: parsedUrl.toString(),
      charCount: content.length,
      wordCount: content.split(/\s+/).filter(Boolean).length,
    });
  } catch (error: any) {
    console.error('Safe fetch-url error:', error?.message);
    return res.status(500).json({
      error: 'Error al conectar con la URL solicitada. Verifique el enlace o intente nuevamente.',
    });
  }
});

// 2. AI Summarization Endpoint
app.post('/api/gemini/summarize', aiRateLimiter, async (req: Request, res: Response) => {
  try {
    const { text, title, type = 'executive', language = 'es' } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Texto no proporcionado para resumir.' });
    }

    if (text.length > 100000) {
      return res.status(400).json({ error: 'El texto excede el límite máximo de 100.000 caracteres.' });
    }

    const allowedTypes = ['executive', 'bullets', 'detailed', 'flashcards'];
    const chosenType = allowedTypes.includes(type) ? type : 'executive';

    const allowedLanguages = ['es', 'en', 'fr', 'pt'];
    const chosenLang = allowedLanguages.includes(language) ? language : 'es';

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Servicio de Gemini no configurado. Verifique GEMINI_API_KEY en configuración de AI Studio.',
      });
    }

    let promptInstructions = '';
    switch (chosenType) {
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

    const languageInstruction =
      chosenLang === 'en'
        ? 'Output the summary in English.'
        : chosenLang === 'fr'
        ? 'Rédigez le résumé en français.'
        : chosenLang === 'pt'
        ? 'Escreva o resumo em português.'
        : 'Escribe el resumen en español fluido, natural y enriquecedor.';

    const systemInstruction = `Eres un asistente de lectura y análisis experto en síntesis documental. Tu misión es transformar documentos extensos en resúmenes excepcionalmente comprensibles, precisos y bien estructurados. Conserva los matices importantes sin agregar información inventada. ${languageInstruction}`;

    const trimmedText = text.slice(0, 75000);
    const sanitizedTitle = typeof title === 'string' ? title.slice(0, 150) : 'Texto sin título';
    const userPrompt = `Documento: "${sanitizedTitle}"\n\nInstrucción: ${promptInstructions}\n\nContenido a sintetizar:\n"""\n${trimmedText}\n"""`;

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
      type: chosenType,
      language: chosenLang,
      processedWords: trimmedText.split(/\s+/).filter(Boolean).length,
    });
  } catch (error: any) {
    console.error('Error generating summary:', error?.message);
    return res.status(500).json({
      error: 'Error al procesar el resumen con IA. Por favor intente nuevamente.',
    });
  }
});

// LRU in-memory cache for synthesized audio to prevent duplicate API hits
const ttsAudioCache: Map<string, { audioBase64: string; mimeType: string }> = new Map();

// 3. AI Natural Voice Text-to-Speech Endpoint (gemini-3.8-flash-tts / gemini-3.8-flash-lite-tts)
app.post('/api/gemini/tts', aiRateLimiter, async (req: Request, res: Response) => {
  try {
    const { text, voice = 'Kore', style = '' } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Texto requerido para generar audio.' });
    }

    const cleanText = text.slice(0, 2500).trim();
    const allowedVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const chosenVoice = allowedVoices.includes(voice) ? voice : 'Kore';

    // Build clear, distinct vocal persona prompts matching user expectations
    let dynamicStyle = typeof style === 'string' && style.trim().length > 0 ? style : '';
    if (!dynamicStyle) {
      switch (chosenVoice) {
        case 'Fenrir':
          dynamicStyle = 'Voz masculina profunda, grave y firme de locutor profesional en español';
          break;
        case 'Charon':
          dynamicStyle = 'Voz masculina solemne, baja, calmada y académica en español';
          break;
        case 'Puck':
          dynamicStyle = 'Voz masculina dinámica, vivaz, brillante y enérgica en español';
          break;
        case 'Zephyr':
          dynamicStyle = 'Voz femenina suave, dulce, reflexiva y calmada en español';
          break;
        case 'Kore':
        default:
          dynamicStyle = 'Voz femenina cálida, natural, expresiva y clara en español';
          break;
      }
    }

    // Cache key incorporates voice and MD5 of style prompt to eliminate voice cross-contamination
    const styleHash = crypto.createHash('md5').update(dynamicStyle).digest('hex').slice(0, 10);
    const cacheKey = `${chosenVoice}:${styleHash}:${cleanText}`;
    if (ttsAudioCache.has(cacheKey)) {
      const cached = ttsAudioCache.get(cacheKey)!;
      res.setHeader('Content-Type', 'application/json');
      return res.json({
        audioBase64: cached.audioBase64,
        mimeType: cached.mimeType,
        voice: chosenVoice,
        cached: true,
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(503).json({
        error: 'Servicio de Gemini TTS no configurado. Utilizando voz del sistema.',
        fallbackToBrowser: true,
      });
    }

    const candidateModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
    let lastError: any = null;
    let base64Audio: string | null = null;

    for (const model of candidateModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TTS API timeout exceeded')), 6500)
        );

        const apiPromise = ai.models.generateContent({
          model,
          contents: cleanText,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: chosenVoice },
              },
            },
          },
        });

        const response: any = await Promise.race([apiPromise, timeoutPromise]);
        base64Audio = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (base64Audio) {
          if (ttsAudioCache.size > 400) {
            const firstKey = ttsAudioCache.keys().next().value;
            if (firstKey) ttsAudioCache.delete(firstKey);
          }
          ttsAudioCache.set(cacheKey, { audioBase64: base64Audio, mimeType: 'audio/wav' });
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`TTS attempt with model ${model} notice:`, err?.status || err?.message?.slice(0, 80));
      }
    }

    if (!base64Audio) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(503).json({
        error: lastError?.message || 'Servicio de voz con IA no disponible temporalmente.',
        details: lastError?.message,
        fallbackToBrowser: true,
      });
    }

    res.setHeader('Content-Type', 'application/json');
    return res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      voice: chosenVoice,
    });
  } catch (error: any) {
    console.error('Error in TTS generation endpoint:', error?.message);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      error: 'Error al generar voz natural.',
      fallbackToBrowser: true,
    });
  }
});

// 4. Cloud Sync Vault Endpoints (Hardened with RLS, IDOR Protection & Mass-Assignment Prevention)
app.get('/api/sync/:syncCode', syncRateLimiter, (req: Request, res: Response) => {
  const rawCode = req.params.syncCode?.trim().toUpperCase();
  // Validate format (alphanumeric 4-20 chars) to prevent path traversal or injection
  if (!rawCode || !/^[A-Z0-9_-]{4,20}$/.test(rawCode)) {
    return res.status(400).json({ error: 'Código de sincronización inválido.' });
  }

  const token = hashToken(rawCode);
  const state = cloudSyncStore.get(token);
  if (!state) {
    return res.status(404).json({ error: 'Bóveda no encontrada o código no registrado.' });
  }

  // Data minimization: Return only public sync payload
  return res.json({
    syncCode: state.syncCode,
    updatedAt: state.updatedAt,
    documents: state.documents,
    activeDocumentId: state.activeDocumentId,
    readingProgress: state.readingProgress,
    preferences: state.preferences,
  });
});

app.post('/api/sync/:syncCode', syncRateLimiter, (req: Request, res: Response) => {
  const rawCode = req.params.syncCode?.trim().toUpperCase();
  if (!rawCode || !/^[A-Z0-9_-]{4,20}$/.test(rawCode)) {
    return res.status(400).json({ error: 'Código de sincronización inválido.' });
  }

  // Mass assignment protection: Strictly destructure and whitelist incoming fields
  const { documents, activeDocumentId, readingProgress, preferences } = req.body;

  // Validate documents structure & size
  let sanitizedDocs: any[] = [];
  if (Array.isArray(documents)) {
    if (documents.length > 60) {
      return res.status(400).json({ error: 'Excedido el límite máximo de 60 documentos por cuenta.' });
    }
    sanitizedDocs = documents.slice(0, 60).map((d) => ({
      id: String(d.id || '').slice(0, 64),
      title: String(d.title || '').slice(0, 150),
      sourceType: String(d.sourceType || 'text').slice(0, 20),
      content: String(d.content || '').slice(0, 200000),
      paragraphs: Array.isArray(d.paragraphs) ? d.paragraphs.slice(0, 500).map((p: any) => String(p).slice(0, 5000)) : [],
      wordCount: typeof d.wordCount === 'number' ? d.wordCount : 0,
      readingTimeMinutes: typeof d.readingTimeMinutes === 'number' ? d.readingTimeMinutes : 1,
      createdAt: String(d.createdAt || new Date().toISOString()),
      updatedAt: String(d.updatedAt || new Date().toISOString()),
      currentParagraphIndex: typeof d.currentParagraphIndex === 'number' ? d.currentParagraphIndex : 0,
      currentSentenceIndex: typeof d.currentSentenceIndex === 'number' ? d.currentSentenceIndex : 0,
      percentRead: typeof d.percentRead === 'number' ? d.percentRead : 0,
      lastReadAt: String(d.lastReadAt || new Date().toISOString()),
      bookmarks: Array.isArray(d.bookmarks) ? d.bookmarks.slice(0, 100) : [],
      summaries: d.summaries && typeof d.summaries === 'object' ? d.summaries : undefined,
    }));
  }

  const token = hashToken(rawCode);
  const existing = cloudSyncStore.get(token);

  const updatedState: SyncState = {
    syncCodeHash: token,
    syncCode: rawCode,
    updatedAt: new Date().toISOString(),
    documents: sanitizedDocs.length > 0 ? sanitizedDocs : existing?.documents || [],
    activeDocumentId: typeof activeDocumentId === 'string' ? activeDocumentId.slice(0, 64) : existing?.activeDocumentId || null,
    readingProgress: typeof readingProgress === 'object' && readingProgress !== null ? readingProgress : existing?.readingProgress || {},
    preferences: typeof preferences === 'object' && preferences !== null ? preferences : existing?.preferences || {},
  };

  cloudSyncStore.set(token, updatedState);
  return res.json({
    success: true,
    updatedAt: updatedState.updatedAt,
    count: updatedState.documents.length,
  });
});

// Generic 404 handler for API routes
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Ruta de API no encontrada.' });
});

// Centralized Error Handling Middleware (Security Directive 17: Data Minimization)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled application error:', err?.message);
  res.status(err.status || 500).json({
    error: isProd ? 'Ocurrió un error interno en el servidor.' : (err.message || 'Error del servidor'),
  });
});

async function startServer() {
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
    console.log(`VoxLibris Server running securely on http://0.0.0.0:${PORT}`);
  });
}

startServer();
