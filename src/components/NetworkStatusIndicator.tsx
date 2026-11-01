import React, { useState, useRef, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  RefreshCw,
  Check,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Users,
  Copy,
  Smartphone,
  Radio,
  ExternalLink
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

export const NetworkStatusIndicator: React.FC = () => {
  const { syncState, triggerManualSync, entries, articles } = useInventory();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSyncTriggering, setIsSyncTriggering] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const appUrl = typeof window !== 'undefined' ? window.location.href : '';

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleManualSyncClick = async () => {
    setIsSyncTriggering(true);
    try {
      await triggerManualSync();
    } finally {
      setIsSyncTriggering(false);
    }
  };

  // Compute pending offline mutations
  const pendingEntriesCount = entries.filter((e) => e.syncStatus === 'pending').length;
  const effectivePending = Math.max(syncState.pendingCount, pendingEntriesCount);

  // States
  const isSyncing = syncState.isSyncing || isSyncTriggering;
  const isOnline = syncState.isOnline;
  const isOfflineWithPending = !isOnline && effectivePending > 0;
  const isOfflineNoPending = !isOnline && effectivePending === 0;
  const isOnlineWithPending = isOnline && effectivePending > 0 && !isSyncing;
  const isOnlineSynced = isOnline && !isSyncing && effectivePending === 0;

  const peerCount = syncState.peerCount || 1;

  return (
    <div className="relative" ref={popoverRef} data-testid="network-status-indicator">
      {/* Primary Top Header Indicator Button */}
      <button
        type="button"
        data-testid="cloud-sync-indicator"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none shadow-2xs active:scale-98 ${
          isSyncing
            ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200'
            : isOfflineWithPending
            ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-600 text-amber-900 dark:text-amber-200 animate-pulse'
            : isOfflineNoPending
            ? 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            : isOnlineWithPending
            ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
            : 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
        }`}
        title="Cliquez pour voir les détails de la synchronisation réseau et cloud"
        aria-label="Statut du réseau et de la synchronisation cloud"
      >
        {/* Status Dot / Animated Indicator */}
        <div className="relative flex items-center justify-center shrink-0">
          {isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 animate-spin" />
          ) : isOfflineWithPending ? (
            <div className="relative flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping absolute" />
              <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            </div>
          ) : isOfflineNoPending ? (
            <WifiOff className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          ) : (
            <div className="relative flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            </div>
          )}
        </div>

        {/* Status Text (Responsive: concise on mobile, clear on desktop) */}
        <span className="truncate leading-tight">
          {isSyncing ? (
            <>
              <span className="hidden sm:inline">Synchronisation cloud...</span>
              <span className="sm:hidden">Sync...</span>
            </>
          ) : isOfflineWithPending ? (
            <>
              <span className="hidden sm:inline">Hors-ligne · </span>
              <span>{effectivePending} en attente</span>
            </>
          ) : isOfflineNoPending ? (
            <span>Hors-ligne</span>
          ) : isOnlineWithPending ? (
            <>
              <span className="hidden sm:inline">Envoi cloud (</span>
              <span>{effectivePending} en attente</span>
              <span className="hidden sm:inline">)</span>
            </>
          ) : (
            <>
              <span className="hidden md:inline">Connecté & Synchronisé</span>
              <span className="md:hidden">Synchronisé</span>
            </>
          )}
        </span>

        {/* Counter Badge if changes are pending */}
        {effectivePending > 0 && !isSyncing && (
          <span className="font-mono text-[10px] font-black bg-amber-200 dark:bg-amber-800 text-amber-950 dark:text-amber-100 px-1.5 py-0.2 rounded-full shrink-0">
            {effectivePending}
          </span>
        )}

        {/* Multi-Device Badge when connected with peers */}
        {isOnlineSynced && peerCount > 1 && (
          <span className="hidden lg:flex items-center gap-0.5 text-[10px] font-mono font-bold bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-950 dark:text-emerald-200 px-1.5 py-0.2 rounded-full">
            <Smartphone className="w-2.5 h-2.5" />
            <span>{peerCount}</span>
          </span>
        )}
      </button>

      {/* Detailed Status Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-84 sm:w-92 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50 text-xs space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Popover Header Card */}
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 ${
              isSyncing
                ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800 text-sky-950 dark:text-sky-200'
                : isOfflineWithPending
                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200'
                : isOfflineNoPending
                ? 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isSyncing
                  ? 'bg-sky-200/80 dark:bg-sky-800 text-sky-700 dark:text-sky-300'
                  : isOfflineWithPending
                  ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                  : isOfflineNoPending
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  : 'bg-emerald-200/80 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {isSyncing ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : isOfflineWithPending ? (
                <AlertTriangle className="w-5 h-5" />
              ) : isOfflineNoPending ? (
                <WifiOff className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-xs uppercase tracking-wider mb-0.5">
                {isSyncing
                  ? 'Synchronisation Cloud Active'
                  : isOfflineWithPending
                  ? 'Mode Hors-Ligne (Modifications en attente)'
                  : isOfflineNoPending
                  ? 'Mode Hors-Ligne (Données Locales)'
                  : 'Connecté au Cloud & Synchronisé'}
              </h4>
              <p className="text-[11px] leading-relaxed opacity-90">
                {isSyncing
                  ? 'Transmission des données en direct avec le serveur cloud...'
                  : isOfflineWithPending
                  ? `${effectivePending} modification(s) enregistrée(s) localement sur cet appareil. Elles seront automatiquement envoyées au cloud dès le rétablissement de la connexion.`
                  : isOfflineNoPending
                  ? 'Aucune connexion internet détectée. Vos données sont conservées en sécurité dans le cache local de votre navigateur.'
                  : 'Toutes vos saisies sont enregistrées en direct sur le serveur et synchronisées instantanément avec les autres postes.'}
              </p>
            </div>
          </div>

          {/* Technical Connection Metrics Breakdown */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-500" />
                Statut Réseau :
              </span>
              <span
                className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                  isOnline
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {isOnline ? '🟢 En ligne (Internet actif)' : '🔴 Déconnecté (Hors-ligne)'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-sky-500" />
                Modifications en attente de cloud :
              </span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded ${
                  effectivePending > 0
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {effectivePending} élément(s)
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                Saisies sauvegardées localement :
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {entries.length} saisie(s)
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                Appareils connectés en direct :
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {peerCount} appareil(s)
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700">
              <span className="text-slate-400 dark:text-slate-500">Dernière synchronisation réussie :</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                {syncState.lastSyncedAt || 'En direct'}
              </span>
            </div>
          </div>

          {/* Multi-Device QR / Link Sharing */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
              Partager la session avec un autre poste (Mobile / Tablette) :
            </label>
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
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>
          </div>

          {/* Action: Manual Sync Button */}
          <button
            type="button"
            onClick={handleManualSyncClick}
            disabled={isSyncing}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-99 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>
              {isSyncing
                ? 'Synchronisation en cours...'
                : 'Forcer la synchronisation avec le serveur cloud'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
