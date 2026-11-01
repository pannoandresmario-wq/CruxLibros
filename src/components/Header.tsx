import React from 'react';
import { 
  BookOpen, 
  Cloud, 
  CloudOff, 
  Sun, 
  Moon, 
  Coffee, 
  Plus, 
  PanelLeftClose, 
  PanelLeft, 
  Share2, 
  Sparkles,
  Wifi,
  WifiOff
} from 'lucide-react';
import { ReadingTheme, CloudSyncVault } from '../types';

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  theme: ReadingTheme;
  setTheme: (theme: ReadingTheme) => void;
  syncVault: CloudSyncVault;
  onOpenSyncModal: () => void;
  onOpenImportModal: () => void;
  onOpenSummaryModal: () => void;
  onOpenExportModal: () => void;
  isOnline: boolean;
  hasActiveDocument: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  sidebarOpen,
  setSidebarOpen,
  theme,
  setTheme,
  syncVault,
  onOpenSyncModal,
  onOpenImportModal,
  onOpenSummaryModal,
  onOpenExportModal,
  isOnline,
  hasActiveDocument,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-3 py-2.5 sm:px-5 sm:py-3 border-b border-stone-200 dark:border-stone-800 bg-stone-50/90 dark:bg-stone-950/90 backdrop-blur-md transition-colors">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          title={sidebarOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
          aria-label="Alternar panel"
        >
          {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold shadow-sm">
            <BookOpen className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-base tracking-tight text-stone-900 dark:text-stone-100 font-reader-serif">
                VoxLibris
              </span>
              <span className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                AI & Offline
              </span>
            </div>
            <p className="text-[10px] text-stone-500 dark:text-stone-400 hidden sm:block">
              Lector Natural & Sincronización Cloud
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <div 
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${
            isOnline 
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' 
              : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20'
          }`}
          title={isOnline ? 'Conexión a internet activa' : 'Modo offline: Síntesis de voz y biblioteca local activa'}
        >
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className="hidden md:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        <button
          onClick={onOpenSyncModal}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
            syncVault.status === 'synced'
              ? 'bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-amber-500/50'
              : syncVault.status === 'syncing'
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 animate-pulse'
              : 'bg-stone-100 dark:bg-stone-900 text-stone-500 border-stone-200 dark:border-stone-800'
          }`}
          title="Sincronización en la nube entre dispositivos"
        >
          {syncVault.status === 'offline' ? (
            <CloudOff className="w-3.5 h-3.5 text-stone-400" />
          ) : (
            <Cloud className={`w-3.5 h-3.5 ${syncVault.status === 'synced' ? 'text-amber-600 dark:text-amber-400' : ''}`} />
          )}
          <span className="hidden lg:inline font-mono">{syncVault.syncCode}</span>
        </button>

        {hasActiveDocument && (
          <button
            onClick={onOpenSummaryModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors cursor-pointer"
            title="Resumir con Inteligencia Artificial"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">Resumen AI</span>
          </button>
        )}

        {hasActiveDocument && (
          <button
            onClick={onOpenExportModal}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            title="Exportar proyecto (PDF, Markdown, Audio)"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        )}

        <div className="flex items-center p-0.5 rounded-xl bg-stone-200/70 dark:bg-stone-900 border border-stone-300/60 dark:border-stone-800">
          <button
            onClick={() => setTheme('light')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              theme === 'light' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
            title="Tema Claro (Papel)"
            aria-label="Tema claro"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setTheme('sepia')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              theme === 'sepia' ? 'bg-[#f4ece1] text-[#3b2f2f] shadow-xs' : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
            title="Tema Sepia (Lectura cálida y descanso visual)"
            aria-label="Tema sepia"
          >
            <Coffee className="w-3.5 h-3.5 text-amber-700" />
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              theme === 'dark' ? 'bg-stone-800 text-amber-400 shadow-xs' : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
            title="Tema Noche / Oscuro"
            aria-label="Tema oscuro"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={onOpenImportModal}
          className="flex items-center gap-1 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-medium text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
          title="Importar PDF, URL o Texto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span className="font-semibold hidden xs:inline">Cargar</span>
        </button>
      </div>
    </header>
  );
};
