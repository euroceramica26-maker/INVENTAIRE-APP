import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Download,
  MapPin,
  Cpu,
  Users,
  Shield,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  CheckCircle2,
  LogOut,
  Sun,
  Moon,
  Cloud,
  ScanLine,
  X,
  Package
} from 'lucide-react';
import { ActiveTab } from './Header';
import { useInventory } from '../context/InventoryContext';
import { useTheme } from '../context/ThemeContext';
import { SyncStatusBadge } from './SyncStatusBadge';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onOpenScanner: () => void;
  onOpenImport: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isMobileOpen,
  setIsMobileOpen,
  isCollapsed,
  setIsCollapsed,
  onOpenScanner,
  onOpenImport
}) => {
  const {
    isAdmin,
    inventories,
    activeInventoryId,
    activeInventory,
    switchInventory,
    currentUser,
    logoutUser,
    syncState,
    entries,
    articles,
    locations,
    users,
    triggerManualSync
  } = useInventory();

  const { isDark, toggleTheme } = useTheme();
  const [isCampaignDropdownOpen, setIsCampaignDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isPendingSync =
    syncState.isSyncing ||
    syncState.pendingCount > 0 ||
    !syncState.isOnline ||
    entries.some((e) => e.syncStatus === 'pending');

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsCampaignDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Comptage & Saisie',
      shortLabel: 'Saisie',
      icon: LayoutDashboard,
      badge: entries.length,
      badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
      description: 'Scan & inventaire physique',
      adminOnly: false
    },
    {
      id: 'catalog' as ActiveTab,
      label: 'Base Articles Excel',
      shortLabel: 'Articles',
      icon: Package,
      badge: articles.length,
      badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
      description: 'Catalogue & stock interne',
      adminOnly: true
    },
    {
      id: 'locations' as ActiveTab,
      label: 'Machines & Emplacements',
      shortLabel: 'Emplacements',
      icon: Cpu,
      badge: locations.length,
      badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
      description: 'Zones & lignes industrielles',
      adminOnly: true
    },
    {
      id: 'export' as ActiveTab,
      label: 'Exports Excel',
      shortLabel: 'Exports',
      icon: Download,
      badge: 'XLSX',
      badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
      description: 'Rapports Saisis & À faire',
      adminOnly: true
    },
    {
      id: 'users' as ActiveTab,
      label: 'Utilisateurs & Équipe',
      shortLabel: 'Équipe',
      icon: Users,
      badge: users.length,
      badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
      description: 'Comptes & autorisations',
      adminOnly: true
    },
    {
      id: 'admin' as ActiveTab,
      label: 'Administration',
      shortLabel: 'Admin',
      icon: Shield,
      badge: 'Total',
      badgeColor: 'bg-amber-500 text-slate-950 font-black',
      description: 'Gestion & maintenance',
      adminOnly: true
    }
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setIsMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 select-none transition-all duration-200">
      {/* 1. Header / Brand Strip */}
      <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <button
          onClick={() => handleSelectTab('dashboard')}
          className="flex items-center gap-3 text-left overflow-hidden cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-base shadow-sm shrink-0 group-hover:scale-105 transition-transform">
            IP
          </div>
          {!isCollapsed && (
            <div className="truncate animate-in fade-in duration-150">
              <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                Inventaire Pro
              </h2>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider block">
                Système Industriel
              </span>
            </div>
          )}
        </button>

        {/* Mobile close button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
          aria-label="Fermer le menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Desktop collapse button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
          title={isCollapsed ? "Agrandir le menu" : "Réduire le menu"}
          aria-label={isCollapsed ? "Agrandir le menu" : "Réduire le menu"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* 2. Active Inventory Switcher Dropdown */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 shrink-0" ref={dropdownRef}>
        {!isCollapsed ? (
          <div className="relative">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block mb-1 px-1">
              Dossier Actif
            </span>
            <button
              onClick={() => setIsCampaignDropdownOpen(!isCampaignDropdownOpen)}
              className="w-full flex items-center justify-between gap-2 p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate text-slate-900 dark:text-slate-100">
                  {activeInventory ? `${activeInventory.code} · ${activeInventory.titre}` : 'Inventaire'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {isCampaignDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-64 overflow-y-auto">
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>Inventaires enregistrés</span>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                    {inventories.length}
                  </span>
                </div>
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
                        <div className="font-mono text-[11px] font-bold">{inv.code} - {inv.titre}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {inv.articles?.length || 0} art. · {inv.entries?.length || 0} saisies
                        </div>
                      </div>
                      {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    </button>
                  );
                })}
                {isAdmin && (
                  <div className="pt-2 px-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => {
                        setIsCampaignDropdownOpen(false);
                        handleSelectTab('admin');
                      }}
                      className="w-full py-1.5 px-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Gérer les Inventaires</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setIsCampaignDropdownOpen(!isCampaignDropdownOpen)}
            className="w-full flex items-center justify-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={activeInventory ? `${activeInventory.code} · ${activeInventory.titre}` : 'Changer de dossier'}
          >
            <Layers className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3. Main Vertical Navigation Links */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {!isCollapsed && (
          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block px-2 mb-1">
            Menu Principal
          </span>
        )}

        {navItems.map((item) => {
          // If not admin, only show dashboard / comptage & saisie
          if (!isAdmin && item.adminOnly) return null;

          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none group relative ${
                isActive
                  ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-950 dark:text-amber-200 font-bold border border-amber-500/40 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white border border-transparent'
              } ${isCollapsed ? 'justify-center px-2' : ''}`}
              title={isCollapsed ? `${item.label} (${item.badge})` : undefined}
            >
              {/* Active Left indicator bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-amber-500 rounded-r-full" />
              )}

              <Icon
                className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                  isActive ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              />

              {!isCollapsed && (
                <div className="flex-1 text-left truncate flex items-center justify-between gap-1.5">
                  <div className="truncate">
                    <span className="block truncate text-xs">{item.label}</span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate">
                      {item.description}
                    </span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}

        {/* Non-Admin Info Card */}
        {!isAdmin && !isCollapsed && (
          <div className="mt-4 p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
            <span className="font-bold block flex items-center gap-1 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Poste Saisie Opérateur
            </span>
            Vous êtes connecté sur le module de comptage terrain. L'accès aux exports et paramètres requiert le compte administrateur.
          </div>
        )}
      </div>

      {/* 4. Bottom Controls: Theme Toggle, Sync Status, User Profile */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
        {/* Theme Toggle Button (Mode Clair / Mode Sombre) */}
        <button
          type="button"
          data-testid="sidebar-theme-toggle-button"
          onClick={toggleTheme}
          className={`w-full flex items-center gap-2 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none shadow-2xs active:scale-95 ${
            isDark
              ? 'bg-slate-800 hover:bg-slate-700/90 border-amber-500/40 text-amber-300'
              : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
          } ${isCollapsed ? 'justify-center p-2' : 'justify-between'}`}
          title={isDark ? "Passer en Mode Clair" : "Passer en Mode Sombre"}
        >
          <div className="flex items-center gap-2 truncate">
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
            )}
            {!isCollapsed && <span>{isDark ? 'Mode Clair' : 'Mode Sombre'}</span>}
          </div>

          {!isCollapsed && (
            <div
              className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors shrink-0 ${
                isDark ? 'bg-amber-500 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-white shadow-xs" />
            </div>
          )}
        </button>

        {/* Sync Status Button */}
        <button
          type="button"
          onClick={triggerManualSync}
          className={`w-full flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
            isPendingSync
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
              : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
          } ${isCollapsed ? 'justify-center p-2' : ''}`}
          title={isPendingSync ? 'Synchronisation en attente (cliquer pour forcer)' : 'Données synchronisées'}
        >
          <div className="relative shrink-0">
            <Cloud className={`w-3.5 h-3.5 ${isPendingSync ? 'text-amber-500' : 'text-emerald-500'}`} />
            <span
              className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                isPendingSync ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-500'
              }`}
            />
          </div>
          {!isCollapsed && (
            <span className="truncate text-[11px]">
              {isPendingSync ? 'Synchro en attente' : 'Cloud synchronisé'}
            </span>
          )}
        </button>

        {/* User Card with Logout */}
        {currentUser && (
          <div
            className={`p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-2 ${
              isCollapsed ? 'justify-center p-1.5' : 'justify-between'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  currentUser.role === 'admin'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {currentUser.role === 'admin' ? (
                  <Shield className="w-3.5 h-3.5" />
                ) : (
                  <span>{(currentUser.nom || currentUser.username).charAt(0).toUpperCase()}</span>
                )}
              </div>
              {!isCollapsed && (
                <div className="truncate text-left leading-tight">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate block">
                    {currentUser.nom || currentUser.username}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 capitalize block">
                    {currentUser.role === 'admin' ? 'Administrateur' : 'Opérateur'}
                  </span>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <button
                type="button"
                onClick={logoutUser}
                className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Déconnexion"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Vertical Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 sticky top-0 h-screen z-30 transition-all duration-200 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Slide-out Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
