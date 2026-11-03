import React from 'react';
import { X, Sparkles, Zap, ShieldCheck, ExternalLink, BookOpen, Layers } from 'lucide-react';

interface QuotaInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToUnlimitedSystem: () => void;
}

export const QuotaInfoModal: React.FC<QuotaInfoModalProps> = ({
  isOpen,
  onClose,
  onSwitchToUnlimitedSystem,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-stone-850 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold border border-amber-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-stone-100">
                ¿Cómo funciona la cuota y cómo ampliarla?
              </h3>
              <p className="text-[11px] text-stone-400">
                Opciones para lectura continua y ampliación de límites
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh] text-xs leading-relaxed text-stone-300">
          
          {/* Explanation Card */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-300 text-xs">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Límite de la versión gratuita (Free Tier)</span>
            </div>
            <p className="text-stone-300 text-[11px]">
              La API de Google Gemini en su nivel gratuito incluye una cuota de prueba de <strong>10 peticiones diarias</strong> por proyecto para síntesis de voz. Al leer libros extensos frase por frase, ese límite se alcanza en pocos minutos.
            </p>
          </div>

          {/* Solution 1: Recommended */}
          <div className="p-4 rounded-xl bg-stone-800/80 border border-emerald-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Solución Inmediata: Voz Ilimitada del Sistema</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                100% Gratis & Ilimitado
              </span>
            </div>
            <p className="text-stone-300 text-[11px]">
              Utiliza el motor acústico nativo del dispositivo calibrado especialmente para cada personaje (Gaucho payador con guitarra, locutor serio, orador dinámico o narradora). Funciona con <strong>0 ms de espera</strong>, no gasta cuota y lee libros completos de principio a fin sin cambiar de voz jamás.
            </p>
            <button
              onClick={() => {
                onSwitchToUnlimitedSystem();
                onClose();
              }}
              className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <span>Activar Voz Ilimitada para todo el libro</span>
            </button>
          </div>

          {/* Solution 2: Reading by Paragraphs */}
          <div className="p-3.5 rounded-xl bg-stone-800/50 border border-stone-700/80 space-y-2">
            <div className="flex items-center gap-2 font-bold text-stone-200">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Ahorro del 80%: Modo Lectura por Párrafos</span>
            </div>
            <p className="text-stone-400 text-[11px]">
              Al activar el modo <strong>"Párrafos (Continuo)"</strong> en la barra inferior, el reproductor lee bloques completos en lugar de oraciones cortas. Esto hace que cada petición rinda 5 veces más y elimina las pausas artificiales.
            </p>
          </div>

          {/* Solution 3: Paid API Key in Google AI Studio */}
          <div className="p-3.5 rounded-xl bg-stone-800/50 border border-stone-700/80 space-y-2">
            <div className="flex items-center gap-2 font-bold text-stone-200">
              <ExternalLink className="w-4 h-4 text-sky-400" />
              <span>Ampliar cuota en Google AI Studio (Nivel Producción)</span>
            </div>
            <p className="text-stone-400 text-[11px]">
              Si deseas utilizar las voces de IA de Gemini sin límite diario de 10 peticiones, puedes vincular una cuenta de Google Cloud con facturación en <span className="font-mono text-amber-300">Google AI Studio &gt; Get API Key</span> (el costo por millón de caracteres es extremadamente bajo, menos de unos pocos centavos por libro).
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-stone-850 border-t border-stone-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-750 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
