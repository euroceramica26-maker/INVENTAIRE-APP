import React, { useState, useRef, useEffect } from 'react';
import {
  ScanLine,
  FileSpreadsheet,
  Download,
  Shield,
  Layers,
  ChevronDown,
  FolderPlus,
  CheckCircle2,
  Menu,
  Sun,
  Moon,
  Cloud,
  LayoutDashboard,
  Package,
  Cpu,
  Users
} from 'lucide-react';
import { SyncStatusBadge } from './SyncStatusBadge';
import { useInventory } from '../context/InventoryContext';
import { useTheme } from '../context/ThemeContext';

export type ActiveTab = 'dashboard' | 'catalog' | 'locations' | 'export' | 'users' | 'admin';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenScanner: () => void;
  onOpenImport: () => void;
  onToggleMobileMenu?: () => void;
}

const TAB_TITLES: Record<ActiveTab, { title: string; subtitle: string; icon: React.ElementType }> = {
  dashboard: {
    title: 'Comptage & Saisie',
    subtitle: 'Scan QR/OCR et inventaire physique en direct',
    icon: LayoutDashboard
  },
  catalog: {
    title: 'Base Articles Excel',
    subtitle: 'Catalogue des références et stock interne',
    icon: Package
  },
  locations: {
    title: 'Machines & Emplacements',
    subtitle: 'Lignes industrielles et gestion des positions',
    icon: Cpu
  },
  export: {
    title: 'Exports Excel',
    subtitle: 'Rapports complets (Articles saisis et à faire)',
    icon: Download
  },
  users: {
    title: 'Gestion des Utilisateurs',
    subtitle: 'Comptes, rôles et traçabilité des opérateurs',
    icon: Users
  },
  admin: {
    title: 'Administration Système',
    subtitle: 'Contrôle total, campagnes et maintenance',
    icon: Shield
  }
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenScanner,
  onOpenImport,
  onToggleMobileMenu
}) => {
  const {
    isAdmin,
    inventories,
    activeInventoryId,
    activeInventory,
    switchInventory,
    syncState,
    entries,
    triggerManualSync
  } = useInventory();

  const { isDark, toggleTheme } = useTheme();

  const isPendingSync =
    syncState.isSyncing ||
    syncState.pendingCount > 0 ||
    !syncState.isOnline ||
    entries.some((e) => e.syncStatus === 'pending');

  const [isCampaignDropdownOpen, setIsCampaignDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsCampaignDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentTabInfo = TAB_TITLES[activeTab] || TAB_TITLES.dashboard;
  const TabIcon = currentTabInfo.icon;

  return (
    <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 h-16">
          {/* Left: Mobile Menu Toggle + Current View Title & Campaign Info */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger button to open vertical sidebar on mobile */}
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0 transition-colors"
              aria-label="Ouvrir le menu vertical"
              title="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Active View Header Indicator */}
            <div className="flex items-center gap-2.5 truncate">
              <div className="hidden sm:flex w-9 h-9 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 items-center justify-center shrink-0 border border-amber-500/30">
                <TabIcon className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate tracking-tight">
                    {currentTabInfo.title}
                  </h1>
                  {activeTab === 'dashboard' && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {entries.length} saisi(s)
                    </span>
                  )}
                </div>
                <p className="hidden md:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {currentTabInfo.subtitle}
                </p>
              </div>
            </div>

            {/* Active Campaign Quick Badge */}
            <div className="hidden xl:flex items-center ml-2" ref={dropdownRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCampaignDropdownOpen(!isCampaignDropdownOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  title="Changer d'inventaire actif"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    {activeInventory?.code || 'INV-01'}
                  </span>
                  <span className="truncate max-w-[140px] text-slate-800 dark:text-slate-200">
                    {activeInventory?.titre || 'Inventaire Principal'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
                </button>

                {isCampaignDropdownOpen && (
                  <div className="absolute left-0 mt-1.5 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span>Dossiers d'inventaire</span>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                        {inventories.length}
                      </span>
                    </div>
                    <div className="max-h-56 overflow-y-auto py-1">
                      {inventories.map((inv) => {
                        const isActive = inv.id === activeInventoryId;
                        return (
                          <button
                            key={inv.id}
                            onClick={() => {
                              switchInventory(inv.id);
                              setIsCampaignDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                              isActive
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 font-bold border-l-3 border-amber-500'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <span className="font-mono font-bold">{inv.code}</span> - {inv.titre}
                            </div>
                            {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    {isAdmin && (
                      <div className="pt-2 px-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => {
                            setIsCampaignDropdownOpen(false);
                            setActiveTab('admin');
                          }}
                          className="w-full py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                          <span>Gérer les Inventaires</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Action Controls: Sync, Theme Toggle, Excel Import & Scanner */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Visual Indicator: Cloud Sync Status */}
            <button
              type="button"
              data-testid="cloud-sync-indicator"
              onClick={triggerManualSync}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer select-none ${
                isPendingSync
                  ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                  : 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              }`}
              title={
                isPendingSync
                  ? 'Synchronisation avec le cloud en attente'
                  : `Synchronisé avec le cloud (${syncState.lastSyncedAt || 'En direct'})`
              }
            >
              <div className="relative flex items-center justify-center shrink-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isPendingSync ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-500'
                  }`}
                />
              </div>
              <Cloud className={`w-3.5 h-3.5 shrink-0 ${isPendingSync ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
              <span className="hidden md:inline text-[11px] font-semibold">
                {isPendingSync ? 'Synchro...' : 'Synchronisé'}
              </span>
            </button>

            {/* Cloud & Local storage state */}
            <SyncStatusBadge />

            {/* Bouton pour changer du mode clair au mode sombre */}
            <button
              type="button"
              data-testid="theme-toggle-button"
              onClick={toggleTheme}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none shrink-0 shadow-2xs active:scale-95 ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700/90 border-amber-500/40 text-amber-300'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
              }`}
              title={isDark ? "Passer en Mode Clair" : "Passer en Mode Sombre"}
              aria-label={isDark ? "Passer en Mode Clair" : "Passer en Mode Sombre"}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400 shrink-0 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600 shrink-0 transition-transform hover:-rotate-12" />
              )}
              
              <span className="hidden sm:inline">
                {isDark ? 'Mode Clair' : 'Mode Sombre'}
              </span>
              <span className="sm:hidden text-[11px]">
                {isDark ? 'Clair' : 'Sombre'}
              </span>

              {/* Slider switch track indicator */}
              <div
                className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors shrink-0 ${
                  isDark ? 'bg-amber-500 justify-end' : 'bg-slate-300 justify-start'
                }`}
                aria-hidden="true"
              >
                <div className="w-3 h-3 rounded-full bg-white shadow-xs" />
              </div>
            </button>

            {/* Excel Import button (Admin uniquement) */}
            {isAdmin && (
              <button
                onClick={onOpenImport}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-colors shadow-2xs whitespace-nowrap shrink-0 cursor-pointer"
                title="Importer un fichier Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Import Excel</span>
              </button>
            )}

            {/* Primary Action Button: Scanner QR / OCR */}
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ScanLine className="w-4 h-4" />
              <span className="hidden sm:inline">Scanner QR / OCR</span>
              <span className="sm:hidden">Scanner</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
