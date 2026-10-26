import React, { useState } from 'react';
import {
  Wifi,
  WifiOff,
  Cloud,
  Check,
  RefreshCw,
  HardDrive,
  Users,
  QrCode,
  Copy,
  ExternalLink,
  Smartphone
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

export const SyncStatusBadge: React.FC = () => {
  const { syncState, triggerManualSync, entries, articles } = useInventory();
  const [showConfig, setShowConfig] = useState(false);
  const [copied, setCopied] = useState(false);

  const appUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const peerCount = syncState.peerCount || 1;
  const isPendingSync =
    syncState.isSyncing ||
    syncState.pendingCount > 0 ||
    !syncState.isOnline ||
    entries.some((e) => e.syncStatus === 'pending');

  return (
    <div className="relative">
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Local Storage Indicator */}
        <div
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors"
          title="Toutes les saisies sont sauvegardées en direct dans la base partagée et en cache local"
        >
          <HardDrive className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span>Local : <strong className="text-slate-900 dark:text-white">{entries.length}</strong> saisies</span>
        </div>

        {/* Realtime Sync Status Pill */}
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
            !syncState.isOnline
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : isPendingSync
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
              : peerCount > 1
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 shadow-2xs hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
          }`}
          title="Cliquez pour voir l'état multi-appareils et synchroniser"
        >
          <div className="flex items-center gap-1.5">
            {!syncState.isOnline ? (
              <WifiOff className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            ) : isPendingSync ? (
              <span
                className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0"
                title="Synchronisation en attente"
              />
            ) : (
              <span
                className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                title="Synchronisé avec le cloud"
              />
            )}
            <span className="font-semibold">
              {!syncState.isOnline
                ? 'Déconnecté'
                : isPendingSync
                ? 'En attente...'
                : peerCount > 1
                ? `${peerCount} appareils connectés`
                : 'Synchronisé'}
            </span>
          </div>

          {peerCount > 1 && (
            <span className="font-mono text-[10px] bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-950 dark:text-emerald-200 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Smartphone className="w-2.5 h-2.5" />
              <span>Multi-Appareils</span>
            </span>
          )}
        </button>
      </div>

      {/* Sync Dropdown Modal */}
      {showConfig && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50 text-xs space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">Synchronisation Multi-Appareils</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                syncState.isOnline
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {syncState.isOnline ? '🟢 En direct (WebSocket)' : '🔴 Déconnecté'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                Appareils connectés en direct :
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                {peerCount}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
              <span>Articles au catalogue :</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{articles.length}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
              <span>Lignes d'inventaire saisies :</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{entries.length}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block font-semibold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
              Ouvrir sur un 2ème appareil (Smartphone / Tablette) :
            </label>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Ouvrez ce même lien sur votre smartphone ou une 2ème fenêtre : chaque scan ou saisie s'affiche <strong>instantanément</strong> sur tous les écrans !
            </p>
            <div className="flex gap-1.5 items-center">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="flex-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-400 dark:text-slate-500 text-[11px]">
            <span>Dernière synchronisation :</span>
            <span className="font-mono text-slate-600 dark:text-slate-400">{syncState.lastSyncedAt || 'En direct'}</span>
          </div>

          <button
            onClick={() => {
              triggerManualSync();
              setShowConfig(false);
            }}
            className="w-full py-2 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Actualiser les données du serveur</span>
          </button>
        </div>
      )}
    </div>
  );
};
