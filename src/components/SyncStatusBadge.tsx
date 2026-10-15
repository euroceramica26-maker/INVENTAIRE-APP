import React, { useState } from 'react';
import {
  Wifi,
  WifiOff,
  Cloud,
  Check,
  RefreshCw,
  HardDrive,
  Users,
  Settings,
  Share2
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

export const SyncStatusBadge: React.FC = () => {
  const { syncState, triggerManualSync, updateRoomCode, entries } = useInventory();
  const [showConfig, setShowConfig] = useState(false);
  const [roomInput, setRoomInput] = useState(syncState.roomCode);

  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomInput.trim()) {
      updateRoomCode(roomInput.trim());
      setShowConfig(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Local Storage Status indicator */}
        <div
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200"
          title="Toutes les données sont automatiquement sauvegardées en mémoire locale sécurisée (IndexedDB / LocalStorage)"
        >
          <HardDrive className="w-3.5 h-3.5 text-slate-500" />
          <span>Local : <strong>{entries.length}</strong> lignes</span>
        </div>

        {/* Cloud Sync Status Pill */}
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            !syncState.isOnline
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : syncState.isSyncing
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {syncState.isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            ) : syncState.isOnline ? (
              <Cloud className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span className="hidden sm:inline">
              {syncState.isSyncing
                ? 'Synchronisation...'
                : syncState.isOnline
                ? 'Cloud Actif'
                : 'Mode Hors-ligne'}
            </span>
          </div>

          <span className="font-mono text-[11px] bg-white/80 px-1.5 py-0.2 rounded border border-emerald-200">
            {syncState.roomCode}
          </span>
        </button>
      </div>

      {/* Sync Configuration Dropdown */}
      {showConfig && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 text-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="font-bold text-slate-800">Synchronisation Temps Réel</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                syncState.isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {syncState.isOnline ? 'En ligne' : 'Hors-ligne'}
            </span>
          </div>

          <p className="text-slate-500 leading-relaxed">
            Permet à plusieurs tablettes ou smartphones d'inventorier simultanément avec le même code de session.
          </p>

          <form onSubmit={handleSaveRoom} className="space-y-2">
            <label className="block font-semibold text-slate-700">Code de Session / Salle :</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs uppercase font-bold"
                placeholder="INV-XXX"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800"
              >
                Rejoindre
              </button>
            </div>
          </form>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-500">
            <span>Dernière synchro :</span>
            <span className="font-mono">{syncState.lastSyncedAt || 'En direct'}</span>
          </div>

          <button
            onClick={() => {
              triggerManualSync();
              setShowConfig(false);
            }}
            className="w-full py-2 bg-emerald-50 text-emerald-800 font-semibold rounded-lg hover:bg-emerald-100 flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Forcer la synchronisation immédiate</span>
          </button>
        </div>
      )}
    </div>
  );
};
