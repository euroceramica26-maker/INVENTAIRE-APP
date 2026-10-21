import React, { useState, useRef, useEffect } from 'react';
import {
  ScanLine,
  FileSpreadsheet,
  Download,
  User,
  Shield,
  Lock,
  ChevronDown,
  FolderPlus,
  Layers,
  CheckCircle2,
  Unlock,
  LogOut,
  Users
} from 'lucide-react';
import { SyncStatusBadge } from './SyncStatusBadge';
import { useInventory } from '../context/InventoryContext';

export type ActiveTab = 'dashboard' | 'catalog' | 'locations' | 'export' | 'users' | 'admin';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenScanner: () => void;
  onOpenImport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenScanner,
  onOpenImport
}) => {
  const {
    operator,
    setOperator,
    isAdmin,
    adminUser,
    logoutAdmin,
    setIsAdminLoginModalOpen,
    inventories,
    activeInventoryId,
    activeInventory,
    switchInventory,
    currentUser,
    logoutUser
  } = useInventory();

  const [editingOperator, setEditingOperator] = useState(false);
  const [operatorInput, setOperatorInput] = useState(operator);
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

  const handleOperatorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (operatorInput.trim()) {
      setOperator(operatorInput.trim());
      setEditingOperator(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 sm:gap-6 h-16">
          {/* Zone 1: Wordmark & Active Inventory Selector */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-amber-600 transition-colors flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-sm shadow-xs">
                IP
              </div>
              <span className="hidden sm:inline">Inventaire Pro</span>
            </button>

            {/* Active Inventory Switcher Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsCampaignDropdownOpen(!isCampaignDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition-colors max-w-[180px] sm:max-w-[240px]"
                title="Changer d'inventaire actif"
              >
                <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">
                  {activeInventory ? `${activeInventory.code} · ${activeInventory.titre}` : 'Inventaire'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" />
              </button>

              {isCampaignDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Inventaires enregistrés
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                        {inventories.length} dossier(s)
                      </span>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto py-1">
                    {inventories.map((inv) => {
                      const isActive = inv.id === activeInventoryId;
                      return (
                        <button
                          key={inv.id}
                          onClick={() => {
                            switchInventory(inv.id);
                            setIsCampaignDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors ${
                            isActive
                              ? 'bg-amber-50 text-amber-950 font-bold border-l-3 border-amber-500'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {inv.code}
                              </span>
                              <span className="truncate">{inv.titre}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {inv.articles?.length || 0} article(s) · {inv.entries?.length || 0} saisie(s)
                            </div>
                          </div>
                          {isActive && <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {isAdmin && (
                    <div className="pt-2 px-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setIsCampaignDropdownOpen(false);
                          setActiveTab('admin');
                        }}
                        className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                        <span>Gérer & Créer un Inventaire (Admin)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Zone 2: Navigation Links (Comptage & Saisie UNIQUEMENT pour les comptes utilisateurs) */}
          {isAdmin ? (
            <nav className="hidden lg:flex items-center gap-5 text-sm font-medium">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
                  activeTab === 'dashboard'
                    ? 'text-amber-600 font-semibold border-b-2 border-amber-500'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Comptage & Saisie
              </button>
              <button
                onClick={() => setActiveTab('catalog')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
                  activeTab === 'catalog'
                    ? 'text-amber-600 font-semibold border-b-2 border-amber-500'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Base Articles Excel
              </button>
              <button
                onClick={() => setActiveTab('locations')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
                  activeTab === 'locations'
                    ? 'text-amber-600 font-semibold border-b-2 border-amber-500'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Machines & Emplacements
              </button>
              <button
                onClick={() => setActiveTab('export')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
                  activeTab === 'export'
                    ? 'text-amber-600 font-semibold border-b-2 border-amber-500'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Exports Excel
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 flex items-center gap-1.5 ${
                  activeTab === 'users'
                    ? 'text-amber-600 font-bold border-b-2 border-amber-500'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4 text-slate-400" />
                <span>Utilisateurs</span>
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 flex items-center gap-1.5 ${
                  activeTab === 'admin'
                    ? 'text-amber-600 font-bold border-b-2 border-amber-500'
                    : 'text-slate-700 hover:text-slate-950 font-semibold'
                }`}
              >
                <Shield className="w-4 h-4 text-amber-500" />
                <span>Administration</span>
                <span className="text-[9px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full font-black uppercase">
                  Total
                </span>
              </button>
            </nav>
          ) : (
            <div className="hidden lg:flex items-center gap-2">
              <span className="px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-950 text-xs font-bold rounded-xl flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Poste Comptage & Saisie</span>
              </span>
            </div>
          )}

          {/* Zone 3: Primary Action, Admin & Sync */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Active Logged-in User Badge with Logout */}
            {currentUser && (
              <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/60 border border-slate-200 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs text-slate-800 transition-colors">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
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

                <div className="hidden sm:flex flex-col text-left leading-tight">
                  <span className="font-bold text-[11px] text-slate-900 truncate max-w-[120px]">
                    {currentUser.nom || currentUser.username}
                  </span>
                  <span
                    className={`text-[9px] font-semibold ${
                      currentUser.role === 'admin' ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {currentUser.role === 'admin' ? 'Admin (Total)' : 'Comptage & Saisie'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={logoutUser}
                  className="ml-0.5 sm:ml-1 p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  title="Déconnexion (Changer d'utilisateur)"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Cloud & Local storage state */}
            <SyncStatusBadge />

            {/* Excel Import button (Admin uniquement) */}
            {isAdmin && (
              <button
                onClick={onOpenImport}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs whitespace-nowrap shrink-0"
                title="Importer un fichier Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Import Excel</span>
              </button>
            )}

            {/* Primary Action Button: Scanner QR / OCR */}
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all whitespace-nowrap shrink-0"
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

