# Persistencia de Voz Continua e Ininterrumpida en VoxLibris

Plan de arquitectura y experiencia de usuario para garantizar que una misma voz elegida (ya sea el Gaucho payador con guitarra o cualquier narrador seleccionado) lea la totalidad del documento de principio a fin sin cambios abruptos, sin silencios y con máxima estabilidad.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Decisión de Consistencia de Voz**:
> Para evitar que la voz cambie a mitad de un libro por límites externos de cuota diaria de la IA (10 peticiones/día en el nivel gratuito), se implementará un control de **Modo de Voz Estricto**:
> 1. **Voz del Sistema Optimizada (Ilimitada)**: La voz nativa del dispositivo calibrada acústicamente (Gaucho barítono profundo a pitch 0.56, velocidad 0.80 y bordoneo de guitarra criolla) leerá el 100% del documento sin cortes, con 0 ms de latencia y sin depender de servidores externos.
> 2. **Voz con IA (Gemini)**: Si se activa, se sintetiza con IA. Si la cuota diaria se agota, el sistema **no cambiará silenciosamente**, sino que mostrará un banner elegante preguntando: *"Límite de cuota IA alcanzado. ¿Deseas continuar con la Voz Gaucha del Sistema?"*, preservando la decisión del usuario.

---

### 1. Overview & Core Concept

- **El Problema**: Los usuarios experimentaban cambios inesperados de timbre vocal a mitad de la lectura debido a que las peticiones a la nube alcanzaban la cuota diaria del proveedor de IA o sufrían micro-cortes entre oraciones.
- **La Solución**: VoxLibris garantizará la **identidad vocal continua**:
  - Un modo de **Lectura Ilimitada y Estable** que garantiza que la voz nunca mute durante la sesión.
  - Alerta transparente con confirmación en lugar de conmutaciones automáticas sorpresivas.
  - Lectura en bloques continuos por párrafos para maximizar la naturalidad auditiva.
- **Público Objetivo**: Lectores que escuchan audiolibros largos, artículos extensos o versos gauchescos y requieren una narración homogénea, relajante y sin sobresaltos.

---

### 2. User Experience & Visual Design

- **Selector Rápido de Fidelidad en el Dock de Audio**:
  - En el panel desplegable de voz, se añade un selector de modo:
    - **Modo Continuo Ilimitado (Recomendado)**: Indicador verde *"Voz 100% Estable & Sin Límite"*.
    - **Modo IA en la Nube**: Indicador ámbar *"Alta Definición (Sujeto a cuota diaria)"*.
- **Modal de Transición Inteligente**:
  - Si el usuario está en Modo IA y el servidor retorna cuota agotada (HTTP 429), la reproducción se pausa suavemente y aparece un diálogo no invasivo:
    - *"Has alcanzado la cuota de IA para este documento. ¿Continuar con la voz nativa de Payador Gaucho?"*
    - Botón primario: **"Continuar sin pausas"**
    - Botón secundario: **"Pausar lectura"**
- **Sincronización de Identidad Vocal por Libro**:
  - La voz y el acompañamiento elegidos quedan asociados al documento en el almacenamiento local y sincronizados en la nube. Al reabrir el libro, se retoma con la misma voz exacta.

---

### 3. Key Product Decisions & Trade-Offs

- **Decisión 1: Prevención de Mutación Vocal Silenciosa**:
  - *Enfoque*: Ningún cambio de motor se realizará en segundo plano sin consentimiento del usuario.
  - *Por qué*: El cambio repentino de una voz de IA a una voz del sistema confunde y degrada la experiencia de inmersión.
  - *Alternativa descartada*: Conmutar en silencio (provocaba la queja de que "cambió de voz de repente").

- **Decisión 2: Pre-afinación de la Voz Gaucha del Sistema**:
  - *Enfoque*: Calibrar la voz offline con afinación rítmica nativa (`es-AR`), pitch grave `0.56` y tempo `0.80` con síntesis de guitarra Karplus-Strong en vivo.
  - *Por qué*: Ofrece una experiencia teatral de payada campera de alta calidad sin costo de API ni dependencia de conexión a internet.

- **Decisión 3: Lectura por Bloques de Párrafos**:
  - *Enfoque*: Promover la lectura en modo párrafo continuo, lo cual elimina los cortes entre frases y multiplica por 5 la duración de cualquier cuota disponible.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                              VoxLibris UI                              │
│                                                                        │
│   ┌───────────────────────────┐      ┌─────────────────────────────┐   │
│   │    ReaderView Component   │      │    AudioPlayerDock Panel    │   │
│   │   - Párrafos & Oraciones  │      │   - Play / Pause / Seek     │   │
│   │   - Resaltado en vivo     │      │   - Selector Modo Ilimitado │   │
│   └─────────────┬─────────────┘      └──────────────┬──────────────┘   │
└─────────────────┼───────────────────────────────────┼──────────────────┘
                  │                                   │
                  ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             SpeechEngine                               │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │  Politica de Voz: "strict_continuous" | "ai_with_prompt"       │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│         ┌─────────────────────────┴─────────────────────────┐          │
│         ▼                                                   ▼          │
│  [Ruta A: Voz del Sistema]                         [Ruta B: Gemini IA] │
│  - Prioridad: es-AR (Rioplatense)                  - API /api/gemini   │
│  - Pitch: 0.56 | Rate: 0.80                        - Prebuffer 2 fras. │
│  - Guitarra Karplus-Strong                         - Si 429: Notifica  │
│  - Ilimitada & 100% Homogénea                      - No conmuta a cie. │
└────────────────────────────────────────────────────────────────────────┘
```

- **Estado y Persistencia**:
  - En `ReaderSettings`, se agrega el atributo `voicePersistenceMode: 'system_unlimited' | 'ai_prompt_on_limit'`.
  - Los documentos memorizan el último timbre vocal utilizado en su metadata.
