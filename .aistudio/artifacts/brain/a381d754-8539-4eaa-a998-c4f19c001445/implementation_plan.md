# Plan de Implementación: Motor de Voces Simuladas Gratuitas & Exportación Local

Este plan detalla la arquitectura técnica para habilitar la lectura por voz y descarga de audios de forma **100% gratuita, ilimitada y sin depender de cuotas ni pagos a Google Gemini**, simulando con fidelidad los timbres de cada personaje mediante procesamiento digital de señales (DSP) en el navegador.

---

## 1. Diagnóstico y Objetivos

- **Problema actual**: El motor de voz de Gemini TTS tiene cuotas estrictas en el nivel gratuito (aproximadamente 10 peticiones/día), provocando errores HTTP 429 (`RESOURCE_EXHAUSTED`), caídas a mitad del texto y cortes en la descarga de audios completos.
- **Solución**: 
  1. Diseñar un **Motor de Simulación Acústica (`AcousticVoiceSimulator`)** que combine la síntesis nativa del navegador con filtros Web Audio API (ecualización de graves/agudos, ganancia de presencia, convolución y modulación de formantes).
  2. Implementar perfiles dedicados para cada personaje:
     - **Fenrir (Locutor Profesional)**: Perfil masculino profundo, tono grave (pitch 0.72), refuerzo de frecuencias bajas (+4dB en 200Hz) y cadencia firme (rate 0.95).
     - **Gaucho Payador**: Resonancia criolla rioplatense, tono barítono (pitch 0.58), cadencia de milonga/décima (rate 0.82) y acompañamiento rítmico sincronizado con la guitarra de cuerdas de nylon Karplus-Strong.
     - **Kore (Cálida y Expresiva)**: Perfil femenino cálido (pitch 1.05, rate 1.0) con ecualización de medios suaves.
     - **Charon (Académico y Reflexivo)**: Timbre solemne y pausado (pitch 0.68, rate 0.86), ecualización neutra balanceada.
     - **Puck (Dinámico y Vivaz)**: Timbre ágil y brillante (pitch 1.22, rate 1.10), realce de claridad en agudos (+3dB en 3.5kHz).
     - **Zephyr (Serena y Relajante)**: Timbre susurrado y calmo (pitch 0.94, rate 0.88), atenuación suave de agudos.
  3. **Descarga de Audio 100% en el Navegador**: Capturar el flujo sonoro (voz + guitarra criolla) mediante `MediaRecorder` o `OfflineAudioContext` para empaquetar y descargar el archivo de audio completo (`.wav` / `.webm`) directamente en el dispositivo del usuario, sin llamadas a servidores externos ni riesgo de cortes.
  4. **Modo Gratuito por Defecto**: La app iniciará siempre en modo de alta fidelidad gratuito, dejando disponible un conmutador discreto para quienes deseen usar su clave de Gemini de manera opcional.

---

## 2. Cambios Arquitectónicos y Archivos

### 2.1. Nuevo Módulo Acústico: `src/utils/voiceSimulator.ts`
- Creación de cadenas de procesamiento Web Audio:
  - `BiquadFilterNode` (Low-shelf para cuerpo y calidez, Peaking para inteligibilidad vocal, High-shelf para suavizado).
  - Algoritmo de mapeo estricto de voces del sistema operativo (diferenciando voces masculinas, femeninas y regionales `es-AR`, `es-ES`, `es-MX`).
  - Mantenimiento estricto del estado de la voz durante toda la lectura para evitar saltos o mezclas entre párrafos.

### 2.2. Actualización de `src/utils/speechEngine.ts`
- Adaptación para que la síntesis local use los perfiles de `AcousticVoiceSimulator`.
- Coordinación continua entre el `SpeechSynthesisUtterance` y el sintetizador de guitarra `guitarSynth.ts` en la voz de Payador.
- Watchdog de desbloqueo de `AudioContext` para evitar que el navegador pause la reproducción en segundo plano o al cambiar de párrafo.

### 2.3. Actualización de `src/components/AudioDownloadModal.tsx`
- Implementación de un sintetizador local por lotes que procesa todos los párrafos u oraciones del libro en el navegador.
- Mezcla en tiempo real o por buffers del habla y los arpegios de la guitarra de payador.
- Generación de archivo Blob descargable de inmediato con barra de progreso detallada, garantizando que el audio abarque el 100% del documento sin cortes.

### 2.4. Integración y Configuración en `src/components/AudioPlayerDock.tsx` y `src/App.tsx`
- Establecer el motor gratuito simulado como predeterminado (`activeEngine: 'simulated_free'`).
- Ofrecer selector claro en la configuración para alternar entre "Motor Gratuito Ilimitado (Recomendado)" y "Google Gemini Cloud (Opcional con clave)".
- Persistencia de la preferencia en `localStorage`.

---

## 3. Plan de Verificación y Pruebas

1. **Prueba de Identidad Vocal**:
   - Probar "Fenrir": verificar que el timbre sea inequívocamente masculino, grave y con presencia acústica.
   - Probar "Gaucho Payador" en *Martín Fierro*: verificar que la voz inicie de inmediato sin pausas indefinidas, con la entonación gaucha y la guitarra sonando en armonía.
   - Probar "Kore", "Puck", "Charon" y "Zephyr": verificar que cada una conserve su carácter propio sin alternancias involuntarias.
2. **Prueba de Continuidad y Memoria**:
   - Navegar entre párrafos u oraciones comprobando que el cursor conserve la posición y la misma voz continúe fluidamente.
3. **Prueba de Descarga Completa**:
   - Ejecutar la descarga del texto completo y corroborar que el archivo resultante no se corte a la mitad, contenga todo el contenido y se guarde en formato reproducible.
4. **Validación de Compilación y Calidad**:
   - Ejecutar `lint_applet` y `compile_applet` para confirmar cero errores de sintaxis y tipos en TypeScript.
