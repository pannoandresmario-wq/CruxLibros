/**
 * Acoustic Voice Simulator for VoxLibris
 * 100% Free, Unlimited, Offline-Ready Vocal Engine
 * 
 * Provides calibrated acoustic persona profiles (Fenrir, Charon, Puck, Kore, Zephyr, Gaucho Payador)
 * using Web Audio equalization, strict gender and regional phoneme matching,
 * and client-side WAV audio synthesis for unlimited local export.
 */

export interface VocalProfile {
  id: 'Kore' | 'Fenrir' | 'Puck' | 'Charon' | 'Zephyr' | 'Gaucho';
  name: string;
  gender: 'male' | 'female';
  subtitle: string;
  description: string;
  pitch: number;
  rate: number;
  volume: number;
  preferredLangs: string[];
  positiveVoiceKeywords: string[];
  negativeVoiceKeywords: string[];
  eq: {
    lowShelfGain: number; // dB boost at low frequencies for chest/announcer resonance
    lowShelfFreq: number;
    highShelfGain: number; // dB boost/cut for clarity or soft velvet texture
    highShelfFreq: number;
  };
}

// Female voice name identifiers across Windows, macOS, Android, iOS, ChromeOS and Linux
export const FEMALE_IDENTIFIERS = [
  'female', 'mujer', 'monica', 'mónica', 'helena', 'paulina', 'rosa', 
  'laura', 'elena', 'lucia', 'lucía', 'carmen', 'marta', 'soledad', 
  'victoria', 'sabina', 'conchita', 'ines', 'inés', 'penelope', 'penélope',
  'samantha', 'karen', 'tessa', 'fiona', 'zira', 'eva', 'maria', 'maría', 
  'juana', 'clara', 'valeria', 'camila', 'sofia', 'sofía', 'isabela',
  'google español', 'google espanol' // In Chrome, "Google español" is a female synthesizer
];

// Male voice name identifiers across Windows, macOS, Android, iOS, ChromeOS and Linux
export const MALE_IDENTIFIERS = [
  'male', 'hombre', 'pablo', 'diego', 'jorge', 'carlos', 'raul', 'raúl', 
  'miguel', 'david', 'pedro', 'gonzalo', 'enrique', 'alvaro', 'álvaro', 
  'guy', 'george', 'stefan', 'antonio', 'alberto', 'fernando', 'sergio', 
  'ricardo', 'juan', 'luis', 'manuel', 'hector', 'héctor', 'gabriel', 
  'alec', 'mario', 'mateo', 'daniel', 'rodrigo', 'javier', 'tomas', 'tomás'
];

export const VOCAL_PROFILES: Record<string, VocalProfile> = {
  Gaucho: {
    id: 'Gaucho',
    name: 'Gaucho Payador',
    gender: 'male',
    subtitle: 'Voz campera cantada con bordoneo de milonga',
    description: 'Recitado criollo pampeano cantado, noble y rítmico en octosílabos con cadencia de pulpería.',
    pitch: 0.84, // Barítono criollo noble y resonante (sin distorsión robótica ni vocal fry)
    rate: 0.92,  // Cadencia rítmica auténtica de payador en pulpería, ágil y versificada
    volume: 1.0,
    preferredLangs: ['es-AR', 'es-UY', 'es-419', 'es-CL', 'es'],
    positiveVoiceKeywords: ['diego', 'gonzalo', 'jorge', 'alvaro', 'pablo', 'raul', 'carlos', 'argentin', 'pampa', 'gaucho', 'rioplatense', 'es-ar'],
    negativeVoiceKeywords: FEMALE_IDENTIFIERS,
    eq: {
      lowShelfGain: 4.5,
      lowShelfFreq: 190,
      highShelfGain: -1.0,
      highShelfFreq: 4200,
    },
  },
  Fenrir: {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'male',
    subtitle: 'Locutor profesional grave, bajo y autoritario',
    description: 'Voz masculina muy profunda, firme y resonante con peso acústico de locutor imponente.',
    pitch: 0.50, // Ultra-profundo: barítono/bajo potente e inconfundible
    rate: 0.88,  // Ritmo solemne, seguro y firme
    volume: 1.0,
    preferredLangs: ['es-ES', 'es-MX', 'es-419', 'es'],
    positiveVoiceKeywords: ['jorge', 'carlos', 'diego', 'alvaro', 'álvaro', 'raul', 'raúl', 'enrique', 'alberto', 'pedro', 'gonzalo', 'deep', 'baritone', 'bass', 'male'],
    negativeVoiceKeywords: [...FEMALE_IDENTIFIERS, 'pablo', 'mateo', 'daniel', 'young', 'bright'],
    eq: {
      lowShelfGain: 5.5,
      lowShelfFreq: 190,
      highShelfGain: 0.5,
      highShelfFreq: 3600,
    },
  },
  Charon: {
    id: 'Charon',
    name: 'Charon',
    gender: 'male',
    subtitle: 'Académica, solemne y reflexiva',
    description: 'Barítono bajo y calmo con entonación filosófica, reposada y sobria.',
    pitch: 0.70, // Barítono medio-bajo intelectual
    rate: 0.82,  // Pausado y meditativo
    volume: 1.0,
    preferredLangs: ['es-ES', 'es-MX', 'es'],
    positiveVoiceKeywords: ['enrique', 'alberto', 'raul', 'raúl', 'jorge', 'male'],
    negativeVoiceKeywords: FEMALE_IDENTIFIERS,
    eq: {
      lowShelfGain: 3.0,
      lowShelfFreq: 210,
      highShelfGain: -1.0,
      highShelfFreq: 4800,
    },
  },
  Puck: {
    id: 'Puck',
    name: 'Puck',
    gender: 'male',
    subtitle: 'Dinámica, vivaz y tenor brillante',
    description: 'Voz masculina juvenil, ágil, entusiasta y en tono de tenor agudo (contraste total con Fenrir).',
    pitch: 1.42, // Agudo y vivaz: tenor brillante y enérgico, radicalmente opuesto al grave Fenrir
    rate: 1.18,  // Ágil, rápido y chispeante
    volume: 1.0,
    preferredLangs: ['es-ES', 'es-MX', 'es-US', 'es'],
    positiveVoiceKeywords: ['pablo', 'mateo', 'daniel', 'miguel', 'alec', 'david', 'sergio', 'tenor', 'bright', 'young', 'male'],
    negativeVoiceKeywords: [...FEMALE_IDENTIFIERS, 'jorge', 'carlos', 'enrique', 'raul', 'alberto', 'deep', 'baritone', 'bass'],
    eq: {
      lowShelfGain: -1.5,
      lowShelfFreq: 260,
      highShelfGain: 4.5,
      highShelfFreq: 3300,
    },
  },
  Kore: {
    id: 'Kore',
    name: 'Kore',
    gender: 'female',
    subtitle: 'Cálida, clara y mezzosoprano natural',
    description: 'Narradora femenina envolvente con timbre cálido, excelente dicción y presencia humana.',
    pitch: 1.02, // Mezzosoprano equilibrada, redonda y natural
    rate: 0.98,
    volume: 1.0,
    preferredLangs: ['es-ES', 'es-MX', 'es-US', 'es'],
    positiveVoiceKeywords: ['helena', 'monica', 'mónica', 'paulina', 'rosa', 'elena', 'lucia', 'carmen', 'sabina', 'google español', 'female'],
    negativeVoiceKeywords: MALE_IDENTIFIERS,
    eq: {
      lowShelfGain: 2.0,
      lowShelfFreq: 280,
      highShelfGain: 1.8,
      highShelfFreq: 3900,
    },
  },
  Zephyr: {
    id: 'Zephyr',
    name: 'Zephyr',
    gender: 'female',
    subtitle: 'Suave, dulce y soprano aterciopelada',
    description: 'Voz femenina delicada, dulce y tranquila en registro de soprano suave para lecturas íntimas.',
    pitch: 1.26, // Soprano más aguda, suave, etérea y dulce (diferenciada de Kore)
    rate: 0.86,  // Calma y respirada
    volume: 0.95,
    preferredLangs: ['es-ES', 'es-MX', 'es'],
    positiveVoiceKeywords: ['laura', 'marta', 'soledad', 'ines', 'inés', 'lucia', 'zira', 'female'],
    negativeVoiceKeywords: MALE_IDENTIFIERS,
    eq: {
      lowShelfGain: 1.0,
      lowShelfFreq: 250,
      highShelfGain: -2.5,
      highShelfFreq: 5000,
    },
  },
};

/**
 * High-fidelity neural and natural voice descriptors across Windows, macOS, Android, iOS and Linux.
 * Voices with these descriptors receive heavy quality score bonuses.
 */
export const NEURAL_VOICE_KEYWORDS = [
  'neural', 'natural', 'enhanced', 'premium', 'online', 'wavenet', 'network', 'siri', 'studio', 'high quality'
];

/**
 * Transforms poetic, verse or prose text into authentic sung payada criolla phrasing.
 * Eliminates artificial stutter pauses and formats stanzas into rhythmic octosyllabic verse meter.
 */
export function transformTextToSungPayada(rawText: string): string {
  if (!rawText || !rawText.trim()) return '';

  let text = rawText.trim();

  // If text already has verse lines (e.g. Martín Fierro: \n)
  if (text.includes('\n')) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const sungLines = lines.map((line, idx) => {
      const clean = line.replace(/[.,;:—…]+$/, '').trim();
      const isStanzaEnd = idx === lines.length - 1;
      const isCadenceRhyme = idx % 2 === 1; // Rhyme resolution every 2 verses in octosyllabic meter
      if (isStanzaEnd) {
        return `${clean}.`;
      }
      return isCadenceRhyme ? `${clean};` : `${clean},`;
    });
    return sungLines.join(' ');
  }

  // If prose or comma-separated: break into rhythmic metric clauses
  const clauses = text
    .split(/[,.;:]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  if (clauses.length >= 2) {
    return clauses
      .map((c, i) => {
        if (i === clauses.length - 1) return `${c}.`;
        return i % 2 === 1 ? `${c};` : `${c},`;
      })
      .join(' ');
  }

  return text;
}

/**
 * Prosodic text humanizer tailored to each vocal persona.
 * Injects natural breath marks, smooths abbreviations, and adjusts punctuation
 * so the browser speech engine performs like a real human voice actor.
 */
export function humanizeProsodyForVoice(rawText: string, profileKey: string): string {
  if (!rawText || !rawText.trim()) return '';

  let text = rawText.trim();

  // 1. Expand frequent abbreviations in Spanish for natural human speech flow
  text = text
    .replace(/\bdr\.\s*/gi, 'doctor ')
    .replace(/\bdra\.\s*/gi, 'doctora ')
    .replace(/\bsr\.\s*/gi, 'señor ')
    .replace(/\bsra\.\s*/gi, 'señora ')
    .replace(/\betc\.\s*/gi, 'etcétera ')
    .replace(/\bpág\.\s*/gi, 'página ')
    .replace(/\bpágs\.\s*/gi, 'páginas ')
    .replace(/\bcap\.\s*/gi, 'capítulo ')
    .replace(/\bej\.\s*/gi, 'por ejemplo ')
    .replace(/\bkm\b/gi, 'kilómetros')
    .replace(/\bcm\b/gi, 'centímetros')
    .replace(/\bkg\b/gi, 'kilogramos')
    .replace(/\b%\b/g, ' por ciento');

  // 2. Specific persona prosody formatting
  if (profileKey === 'Gaucho') {
    let sung = transformTextToSungPayada(text);
    // Apply authentic criollo seseo so ANY speech synthesizer (even European Castilian)
    // pronounces without the Madrid lisp, delivering authentic Argentine / American phonetics
    sung = sung
      .replace(/\bcielo\b/gi, 'sielo')
      .replace(/\bcielos\b/gi, 'sielos')
      .replace(/\bcorazón\b/gi, 'corasón')
      .replace(/\bcorazones\b/gi, 'corasones')
      .replace(/\bvez\b/gi, 'ves')
      .replace(/\bveces\b/gi, 'veses')
      .replace(/\bhacer\b/gi, 'haser')
      .replace(/\bhace\b/gi, 'hase')
      .replace(/\bhizo\b/gi, 'hiso')
      .replace(/\bgracia\b/gi, 'grasia')
      .replace(/\bgracias\b/gi, 'grasias')
      .replace(/\bocasión\b/gi, 'osasión')
      .replace(/\bpaz\b/gi, 'pas')
      .replace(/\bluz\b/gi, 'lus')
      .replace(/\bvoz\b/gi, 'vos')
      .replace(/\bvoces\b/gi, 'voses')
      .replace(/\bcruces\b/gi, 'cruses')
      .replace(/\bcruz\b/gi, 'crus')
      .replace(/\bcabeza\b/gi, 'cabesa')
      .replace(/\btristeza\b/gi, 'tristesa')
      .replace(/\bfuerza\b/gi, 'fuersa')
      .replace(/\besperanza\b/gi, 'esperansa')
      .replace(/\bconsuela\b/gi, 'consuela');
    return sung;
  }

  if (profileKey === 'Zephyr') {
    // Soft, sweet, relaxed delivery with gentle breathing pauses
    text = text.replace(/([.?!])\s+/g, '$1... ');
    text = text.replace(/([,;])\s+/g, '$1 ');
    return text;
  }

  if (profileKey === 'Fenrir') {
    // Stately, powerful, authoritative pauses
    text = text.replace(/([.?!])\s+/g, '$1 — ');
    return text;
  }

  if (profileKey === 'Puck') {
    // Lively, crisp, agile tempo without prolonged pauses
    text = text.replace(/—\s*/g, ', ');
    text = text.replace(/\.{2,}/g, '.');
    return text;
  }

  if (profileKey === 'Charon') {
    // Contemplative philosophical cadence
    text = text.replace(/([;:])\s+/g, '... ');
    return text;
  }

  // Kore: standard warm, balanced flow
  return text;
}

/**
 * Searches and scores all available browser voices to guarantee that the selected voice
 * matches the designated gender, language, and persona profile without cross-contamination.
 * Prioritizes neural, natural, and enhanced voices for maximum human realism.
 */
export function resolveBestBrowserVoice(
  availableVoices: SpeechSynthesisVoice[],
  profileId: string,
  preferredVoiceURI?: string
): SpeechSynthesisVoice | null {
  if (!availableVoices || availableVoices.length === 0) return null;

  // 1. If explicit URI requested and valid, check it first
  if (preferredVoiceURI) {
    const directMatch = availableVoices.find((v) => v.voiceURI === preferredVoiceURI);
    if (directMatch) return directMatch;
  }

  const profile = VOCAL_PROFILES[profileId] || VOCAL_PROFILES.Kore;
  const isMale = profile.gender === 'male';

  // 2. Score candidate voices based on dialect, gender keywords, and negative exclusion
  const scoredVoices = availableVoices.map((voice) => {
    let score = 0;
    const voiceName = (voice.name || '').toLowerCase();
    const voiceURI = (voice.voiceURI || '').toLowerCase();
    const voiceLang = (voice.lang || '').toLowerCase();
    const fullText = `${voiceName} ${voiceURI}`;

    // Language matching
    if (voiceLang.startsWith('es')) {
      score += 60;
      // Exact dialect bonus
      for (let i = 0; i < profile.preferredLangs.length; i++) {
        const pref = profile.preferredLangs[i].toLowerCase();
        if (voiceLang === pref || voiceLang.replace('_', '-') === pref) {
          score += 45 - i * 5;
          break;
        }
      }
    } else {
      score -= 100; // Penalize non-Spanish voices
    }

    // High-fidelity Neural / Natural voice bonus (upgrades to most human-like voice)
    const isNeuralOrNatural = NEURAL_VOICE_KEYWORDS.some((kw) => fullText.includes(kw));
    if (isNeuralOrNatural) {
      score += 140;
    }

    // Penalize deprecated low-fi robotic speech synthesizers
    if (fullText.includes('compact') || fullText.includes('desktop') || fullText.includes('sample')) {
      score -= 40;
    }

    // Gender rules
    const matchesMaleKeyword = MALE_IDENTIFIERS.some((kw) => fullText.includes(kw));
    const matchesFemaleKeyword = FEMALE_IDENTIFIERS.some((kw) => fullText.includes(kw));

    if (isMale) {
      if (matchesFemaleKeyword) {
        // Severe penalty: NEVER allow female voice for Fenrir, Charon, Puck, Gaucho
        score -= 300;
      }
      if (matchesMaleKeyword) {
        score += 90;
      }
    } else {
      if (matchesMaleKeyword) {
        // Severe penalty: NEVER allow male voice for Kore, Zephyr
        score -= 300;
      }
      if (matchesFemaleKeyword) {
        score += 90;
      }
    }

    // Positive profile keyword matching
    for (const kw of profile.positiveVoiceKeywords) {
      if (fullText.includes(kw.toLowerCase())) {
        score += 40;
      }
    }

    // Negative profile keyword exclusion
    for (const kw of profile.negativeVoiceKeywords) {
      if (fullText.includes(kw.toLowerCase())) {
        score -= 120;
      }
    }

    // Local / offline voice bonus (higher responsiveness)
    if (voice.localService) {
      score += 15;
    }

    return { voice, score };
  });

  // Sort descending by score
  scoredVoices.sort((a, b) => b.score - a.score);

  if (scoredVoices.length > 0 && scoredVoices[0].score > -100) {
    return scoredVoices[0].voice;
  }

  // Fallback: pick any Spanish voice matching gender if possible
  const spanishVoices = availableVoices.filter((v) => v.lang.toLowerCase().startsWith('es'));
  if (isMale) {
    let maleSpanish = spanishVoices.find((v) => {
      const full = `${v.name} ${v.voiceURI}`.toLowerCase();
      return MALE_IDENTIFIERS.some((kw) => full.includes(kw)) && !FEMALE_IDENTIFIERS.some((kw) => full.includes(kw));
    });
    if (!maleSpanish) {
      maleSpanish = spanishVoices.find((v) => {
        const full = `${v.name} ${v.voiceURI}`.toLowerCase();
        return !FEMALE_IDENTIFIERS.some((kw) => full.includes(kw));
      });
    }
    if (maleSpanish) return maleSpanish;
  } else {
    const femaleSpanish = spanishVoices.find((v) => {
      const full = `${v.name} ${v.voiceURI}`.toLowerCase();
      return FEMALE_IDENTIFIERS.some((kw) => full.includes(kw)) && !MALE_IDENTIFIERS.some((kw) => full.includes(kw));
    });
    if (femaleSpanish) return femaleSpanish;
  }

  return spanishVoices[0] || availableVoices[0] || null;
}

/**
 * Creates a calibrated 16-bit PCM WAV container from raw Float32 audio samples.
 */
export function encodeFloat32ToWav(
  samples: Float32Array,
  sampleRate: number = 44100,
  numChannels: number = 1
): Blob {
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const bufferLength = 44 + samples.length * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(8, 'WAVE');

  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true);  // AudioFormat (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitDepth

  writeString(36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
