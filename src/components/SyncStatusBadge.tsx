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

  return (
    <div className="relative">
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Local Storage Indicator */}
        <div
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200"
          title="Toutes les saisies sont sauvegardées en direct dans la base partagée et en cache local"
        >
          <HardDrive className="w-3.5 h-3.5 text-slate-500" />
          <span>Local : <strong>{entries.length}</strong> saisies</span>
        </div>

        {/* Realtime Sync Status Pill */}
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            !syncState.isOnline
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : syncState.isSyncing
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : peerCount > 1
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs hover:bg-emerald-100'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
          }`}
          title="Cliquez pour voir l'état multi-appareils et synchroniser"
        >
          <div className="flex items-center gap-1.5">
            {syncState.isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            ) : syncState.isOnline ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-600" />
            )}
            <span className="font-semibold">
              {syncState.isSyncing
                ? 'Synchro...'
                : syncState.isOnline
                ? peerCount > 1
                  ? `${peerCount} appareils connectés`
                  : 'Temps Réel Actif'
                : 'Déconnecté'}
            </span>
          </div>

          {peerCount > 1 && (
            <span className="font-mono text-[10px] bg-emerald-200/60 text-emerald-950 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Smartphone className="w-2.5 h-2.5" />
              <span>Multi-Appareils</span>
            </span>
          )}
        </button>
      </div>

      {/* Sync Dropdown Modal */}
      {showConfig && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 text-xs space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">Synchronisation Multi-Appareils</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                syncState.isOnline
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-100 text-rose-800 border border-rose-200'
              }`}
            >
              {syncState.isOnline ? '🟢 En direct (WebSocket)' : '🔴 Déconnecté'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-slate-700">
              <span className="flex items-center gap-1.5 font-medium">
                <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                Appareils connectés en direct :
              </span>
              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {peerCount}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>Articles au catalogue :</span>
              <span className="font-mono font-semibold text-slate-800">{articles.length}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>Lignes d'inventaire saisies :</span>
              <span className="font-mono font-semibold text-slate-800">{entries.length}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
              Ouvrir sur un 2ème appareil (Smartphone / Tablette) :
            </label>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Ouvrez ce même lien sur votre smartphone ou une 2ème fenêtre : chaque scan ou saisie s'affiche <strong>instantanément</strong> sur tous les écrans !
            </p>
            <div className="flex gap-1.5 items-center">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="flex-1 px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-mono text-[11px] text-slate-700 truncate"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs flex items-center gap-1 shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-400 text-[11px]">
            <span>Dernière synchronisation :</span>
            <span className="font-mono text-slate-600">{syncState.lastSyncedAt || 'En direct'}</span>
          </div>

          <button
            onClick={() => {
              triggerManualSync();
              setShowConfig(false);
            }}
            className="w-full py-2 bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
            <span>Actualiser les données du serveur</span>
          </button>
        </div>
      )}
    </div>
  );
};
