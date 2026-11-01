import React, { useState } from 'react';
import { 
  X, 
  Cloud, 
  Smartphone, 
  Tablet, 
  Laptop, 
  RefreshCw, 
  Copy, 
  Check, 
  Link, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { CloudSyncVault, DocumentItem } from '../types';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncVault: CloudSyncVault;
  onSyncNow: () => Promise<void>;
  onLinkDeviceCode: (code: string) => Promise<void>;
  documents: DocumentItem[];
  activeDocument: DocumentItem | null;
  isOnline: boolean;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  syncVault,
  onSyncNow,
  onLinkDeviceCode,
  documents,
  activeDocument,
  isOnline,
}) => {
  const [inputCode, setInputCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(syncVault.syncCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualSync = async () => {
    setFeedbackMsg(null);
    setIsSyncing(true);
    try {
      await onSyncNow();
      setFeedbackMsg({
        type: 'success',
        text: '¡Biblioteca y posición de lectura sincronizadas exitosamente en la nube!',
      });
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Error al conectar con el servidor de sincronización.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLinkNewCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    setFeedbackMsg(null);
    setIsLinking(true);
    try {
      await onLinkDeviceCode(inputCode.trim().toUpperCase());
      setFeedbackMsg({
        type: 'success',
        text: `¡Dispositivo vinculado con la bóveda ${inputCode.trim().toUpperCase()}! Documentos y avances actualizados.`,
      });
      setInputCode('');
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Código de sincronización no encontrado en la nube.',
      });
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 font-reader-serif">
                Sincronización en la Nube
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Guarda tus avances de lectura en todos tus dispositivos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 flex-1 overflow-y-auto">
          {feedbackMsg && (
            <div 
              className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                feedbackMsg.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
              }`}
            >
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* Current Device Vault Code */}
          <div className="p-4 rounded-xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                Código de tu Bóveda Cloud:
              </span>
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Segura & Cifrada
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 py-2 px-3 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 font-mono text-base font-bold text-amber-600 dark:text-amber-400 tracking-wider">
                {syncVault.syncCode}
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Copiar código para usar en tu tablet o móvil"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Usa este código en tu tablet, smartphone o computadora para continuar leyendo exactamente en el mismo párrafo donde lo dejaste.
            </p>
          </div>

          {/* Device icons preview */}
          <div className="flex items-center justify-around py-3 px-2 rounded-xl bg-amber-500/5 border border-amber-500/20 text-stone-600 dark:text-stone-300 text-xs text-center">
            <div className="flex flex-col items-center gap-1">
              <Tablet className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span className="text-[10px]">Tablets (iPad/Android)</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
            <div className="flex flex-col items-center gap-1">
              <Smartphone className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span className="text-[10px]">Smartphones</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
            <div className="flex flex-col items-center gap-1">
              <Laptop className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span className="text-[10px]">Computadoras</span>
            </div>
          </div>

          {/* Active Reading Progress Status */}
          {activeDocument && (
            <div className="text-xs text-stone-600 dark:text-stone-300 space-y-1">
              <div className="flex justify-between font-medium">
                <span>Avance guardado de lectura:</span>
                <span className="text-amber-600 dark:text-amber-400 font-mono">
                  Párrafo {activeDocument.currentParagraphIndex + 1} ({activeDocument.percentRead}%)
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                Documento actual: "{activeDocument.title}"
              </p>
            </div>
          )}

          {/* Link to Existing Code Form */}
          <form onSubmit={handleLinkNewCode} className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
              ¿Tienes un código de otro dispositivo? Ingrésalo aquí:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ej: VOX-7842"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 font-mono text-xs uppercase placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={isLinking || !inputCode.trim()}
                className="py-2 px-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 font-semibold text-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Link className="w-3.5 h-3.5" />
                <span>Vincular</span>
              </button>
            </div>
          </form>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 flex items-center justify-between">
          <span className="text-[11px] text-stone-500 dark:text-stone-400">
            {syncVault.lastSyncedAt 
              ? `Última sincronización: ${new Date(syncVault.lastSyncedAt).toLocaleTimeString('es-ES')}` 
              : 'Sincronización pendiente'}
          </span>

          <button
            onClick={handleManualSync}
            disabled={isSyncing || !isOnline}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-semibold text-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Bóveda Ahora'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
