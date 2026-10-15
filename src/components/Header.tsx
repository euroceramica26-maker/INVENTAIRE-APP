import React, { useState } from 'react';
import {
  ScanLine,
  FileSpreadsheet,
  Download,
  User,
  HardDrive
} from 'lucide-react';
import { SyncStatusBadge } from './SyncStatusBadge';
import { useInventory } from '../context/InventoryContext';

export type ActiveTab = 'dashboard' | 'catalog' | 'locations' | 'export';

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
  const { operator, setOperator } = useInventory();
  const [editingOperator, setEditingOperator] = useState(false);
  const [operatorInput, setOperatorInput] = useState(operator);

  const handleOperatorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (operatorInput.trim()) {
      setOperator(operatorInput.trim());
      setEditingOperator(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Wordmark */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-amber-600 transition-colors flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-sm shadow-xs">
                IP
              </div>
              <span>Inventaire Pro</span>
            </button>
          </div>

          {/* Zone 2: Navigation Links (single-line, clean) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
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
              Machines, Familles & Emplacements
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
                activeTab === 'export'
                  ? 'text-amber-600 font-semibold border-b-2 border-amber-500'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Exports Excel Filtrés
            </button>
          </nav>

          {/* Zone 3: Primary Action & Sync */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Operator switch */}
            {editingOperator ? (
              <form onSubmit={handleOperatorSubmit} className="flex items-center">
                <input
                  type="text"
                  value={operatorInput}
                  onChange={(e) => setOperatorInput(e.target.value)}
                  onBlur={() => setEditingOperator(false)}
                  autoFocus
                  className="px-2 py-1 text-xs border border-amber-400 rounded-md w-28 bg-white focus:outline-none"
                />
              </form>
            ) : (
              <button
                onClick={() => {
                  setOperatorInput(operator);
                  setEditingOperator(true);
                }}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="Modifier l'opérateur courant"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate max-w-[100px]">{operator}</span>
              </button>
            )}

            {/* Cloud & Local storage state */}
            <SyncStatusBadge />

            {/* Excel Import button */}
            <button
              onClick={onOpenImport}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs whitespace-nowrap shrink-0"
              title="Importer un fichier Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Import Excel</span>
            </button>

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
