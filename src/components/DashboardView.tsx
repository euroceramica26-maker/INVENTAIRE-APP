import React, { useState, useMemo } from 'react';
import {
  ScanLine,
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Trash2,
  Edit3,
  HardDrive,
  Package,
  Layers,
  Cpu,
  RotateCcw,
  CheckCircle2,
  Clock,
  X,
  User,
  MapPin,
  FolderTree,
  Crosshair,
  Equal,
  TrendingUp,
  TrendingDown,
  CheckSquare,
  Square,
  MinusSquare
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Article, InventoryEntry, QualiteEtat } from '../types/inventory';
import { QUALITE_LABELS, buildCombinedInventoryList, exportInventoryToExcel } from '../utils/excelExport';
import { exportFullJsonBackup } from '../utils/storage';
import { ConfirmModal } from './ConfirmModal';
import { ClearDatabaseModal } from './ClearDatabaseModal';

interface DashboardViewProps {
  onOpenScanner: () => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onSelectArticleToCount: (article: Article) => void;
  onEditEntry: (entry: InventoryEntry) => void;
  onOpenManualEntry?: (initialCodeOrName?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenScanner,
  onOpenImport,
  onOpenExport,
  onSelectArticleToCount,
  onEditEntry,
  onOpenManualEntry
}) => {
  const {
    entries,
    articles,
    machines,
    familles,
    locations,
    lastLocation,
    deleteEntry,
    deleteCombinedRowsBulk,
    searchArticles,
    matchScannedArticle,
    clearEntireDatabase,
    isAdmin,
    requestAdminAction,
    activeInventory,
    users
  } = useInventory();

  // Search & filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [displayMode, setDisplayMode] = useState<'saisis' | 'tous' | 'a_faire'>(() => {
    try {
      const stored = localStorage.getItem('inventory_display_mode');
      if (stored === 'saisis' || stored === 'tous' || stored === 'a_faire') {
        return stored as 'saisis' | 'tous' | 'a_faire';
      }
    } catch {
      // ignore
    }
    return 'saisis';
  });

  const handleDisplayModeChange = (mode: 'saisis' | 'tous' | 'a_faire') => {
    setDisplayMode(mode);
    try {
      localStorage.setItem('inventory_display_mode', mode);
    } catch {
      // ignore
    }
  };

  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [selectedFamille, setSelectedFamille] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedQualite, setSelectedQualite] = useState<string>('all');
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [exportToast, setExportToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Deletion modals & multi-selection state
  const [entryToDelete, setEntryToDelete] = useState<InventoryEntry | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const handleQuickExport = () => {
    try {
      const res = exportInventoryToExcel(
        entries,
        articles,
        {
          famille: selectedFamille,
          machine: selectedMachine,
          designationSearch: '',
          codeSearch: '',
          referenceSearch: '',
          unite: 'all',
          emplacement: selectedLocation,
          qualite: selectedQualite,
          statusFilter: displayMode === 'saisis' ? 'saisi' : displayMode === 'a_faire' ? 'a_faire' : 'all',
          operator: selectedOperator
        },
        `Inventaire_${displayMode === 'saisis' ? 'Articles_Saisis' : 'Base_Complete'}`
      );
      if (res.success) {
        setExportToast({
          type: 'success',
          message: `Fichier téléchargé : ${res.fileName} (${res.rowCount} ligne(s))`
        });
        setTimeout(() => setExportToast(null), 5000);
      }
    } catch (err: any) {
      console.error('Erreur export:', err);
      setExportToast({
        type: 'error',
        message: `Erreur lors de l'exportation : ${err?.message || 'Erreur inattendue'}`
      });
      setTimeout(() => setExportToast(null), 6000);
    }
  };

  // Search suggestions enhanced with scan parsing (code, designation, reference, or composite scan)
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    // Check if query matches via the scan comparison engine
    const scanMatch = matchScannedArticle(searchTerm);
    const standardResults = searchArticles(searchTerm, selectedMachine, selectedFamille);
    
    const combined: Article[] = [];
    if (scanMatch.matchedArticle) {
      combined.push(scanMatch.matchedArticle);
    }
    for (const art of standardResults) {
      if (!combined.some(c => c.id === art.id)) {
        combined.push(art);
      }
    }
    return combined.slice(0, 6);
  }, [searchTerm, selectedMachine, selectedFamille, searchArticles, matchScannedArticle]);

  // Combined full inventory list (both saisis and pending articles)
  const combinedList = useMemo(() => {
    return buildCombinedInventoryList(entries, articles);
  }, [entries, articles]);

  const countPending = useMemo(() => {
    return combinedList.filter((item) => item.statutInventaire !== 'Saisi').length;
  }, [combinedList]);

  // Distinct operators list for filtering
  const distinctOperators = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.nom) set.add(u.nom);
      if (u.username) set.add(u.username);
    });
    entries.forEach((e) => {
      if (e.operator && e.operator !== '-') set.add(e.operator);
    });
    return Array.from(set).sort();
  }, [users, entries]);

  // Distinct locations list for filtering in Base d'Inventaire
  const distinctLocations = useMemo(() => {
    const set = new Set<string>();
    locations.forEach((l) => {
      if (l.code && l.code !== 'Non renseigné' && l.code !== 'Non assigné') set.add(l.code);
    });
    entries.forEach((e) => {
      if (e.emplacement && e.emplacement !== 'Non renseigné' && e.emplacement !== 'Non assigné') set.add(e.emplacement);
    });
    return Array.from(set).sort();
  }, [locations, entries]);

  // Filtered rows depending on active displayMode ('saisis' | 'tous' | 'a_faire')
  const displayedRows = useMemo(() => {
    return combinedList.filter((item) => {
      // 1. Filter by display tab
      if (displayMode === 'saisis' && item.statutInventaire !== 'Saisi') return false;
      if (displayMode === 'a_faire' && item.statutInventaire === 'Saisi') return false;

      // 2. Machine filter
      if (selectedMachine !== 'all' && item.machine !== selectedMachine) return false;

      // 3. Famille filter
      if (selectedFamille !== 'all' && item.famille !== selectedFamille) return false;

      // 4. Emplacement filter
      if (selectedLocation !== 'all' && (item.emplacement || '').toLowerCase() !== selectedLocation.toLowerCase()) {
        return false;
      }

      // 5. Operator filter
      if (selectedOperator !== 'all') {
        const itemOp = (item.operator || '').toLowerCase();
        const sel = selectedOperator.toLowerCase();
        if (itemOp !== sel && !itemOp.includes(sel)) return false;
      }

      // 6. Qualite filter (only if not 'all' and item is counted)
      if (selectedQualite !== 'all') {
        const selectedLabel = (QUALITE_LABELS as Record<string, string>)[selectedQualite] || selectedQualite;
        if (item.qualite !== selectedLabel) return false;
      }

      // 7. Table text search
      const q = tableSearch.toLowerCase().trim();
      if (q) {
        const matchesCode = (item.code_article || '').toLowerCase().includes(q);
        const matchesDesig = (item.designation || '').toLowerCase().includes(q);
        const matchesRef = (item.reference || '').toLowerCase().includes(q);
        const matchesLoc = (item.emplacement || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesDesig && !matchesRef && !matchesLoc) return false;
      }

      return true;
    });
  }, [combinedList, displayMode, selectedMachine, selectedFamille, selectedLocation, selectedOperator, selectedQualite, tableSearch]);

  // Multi-row selection helpers
  const isAllSelected = useMemo(() => {
    return displayedRows.length > 0 && displayedRows.every((r) => selectedRowIds.has(r.id));
  }, [displayedRows, selectedRowIds]);

  const isSomeSelected = useMemo(() => {
    return displayedRows.some((r) => selectedRowIds.has(r.id)) && !isAllSelected;
  }, [displayedRows, selectedRowIds, isAllSelected]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRowIds(new Set());
    } else {
      const next = new Set<string>();
      displayedRows.forEach((r) => next.add(r.id));
      setSelectedRowIds(next);
    }
  };

  const handleToggleSelectRow = (id: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRowIds(next);
  };

  const handleClearSelection = () => {
    setSelectedRowIds(new Set());
  };

  const selectedItems = useMemo(() => {
    return displayedRows.filter((r) => selectedRowIds.has(r.id));
  }, [displayedRows, selectedRowIds]);

  const selectedCountSaisis = useMemo(() => {
    return selectedItems.filter((i) => i.statutInventaire === 'Saisi').length;
  }, [selectedItems]);

  const selectedCountAFaire = useMemo(() => {
    return selectedItems.filter((i) => i.statutInventaire !== 'Saisi').length;
  }, [selectedItems]);

  const handleRequestBulkDelete = () => {
    if (selectedRowIds.size === 0) return;
    if (isAdmin) {
      setIsBulkDeleteModalOpen(true);
    } else {
      requestAdminAction(
        () => setIsBulkDeleteModalOpen(true),
        `Suppression de ${selectedRowIds.size} ligne(s) sélectionnée(s)`
      );
    }
  };

  const handleConfirmBulkDelete = () => {
    if (selectedItems.length === 0) return;
    const itemsToDelete = selectedItems.map((item) => ({
      id: item.id,
      code_article: item.code_article,
      isSaisi: item.statutInventaire === 'Saisi'
    }));

    deleteCombinedRowsBulk(itemsToDelete);
    setSelectedRowIds(new Set());
    setIsBulkDeleteModalOpen(false);

    setExportToast({
      type: 'success',
      message: `${itemsToDelete.length} ligne(s) supprimée(s) avec succès.`
    });
    setTimeout(() => setExportToast(null), 4000);
  };

  // KPI Calculations (No ecart)
  const countSaisis = useMemo(() => {
    return Math.max(entries.length, combinedList.filter((item) => item.statutInventaire === 'Saisi').length);
  }, [entries, combinedList]);

  const totalCountedLines = countSaisis;
  const totalQuantitySum = entries.reduce((acc, curr) => acc + curr.quantite, 0);
  const distinctMachinesCount = new Set(entries.map(e => e.machine)).size;
  const anomaliesQualityCount = entries.filter(e => e.qualite !== 'conforme' && e.qualite !== 'bon_etat').length;

  return (
    <div className="space-y-6">
      {/* 1. TOP HERO WORKSTATION / SEARCH & SCAN PROMPT */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs transition-colors">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {isAdmin ? "Saisie & Suivi d'Inventaire" : "Poste de Comptage & Saisie"}
              </h1>
              <span className="text-xs bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{countSaisis} article(s) saisi(s)</span>
              </span>
              {!isAdmin && (
                <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  Poste Opérateur
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isAdmin 
                ? "Scannez le QR/Code-barres, photographiez l'étiquette (OCR) ou saisissez directement"
                : "Scannez les articles et saisissez vos comptages d'inventaire"}
            </p>
          </div>

          {/* Quick Action Buttons (Comptage & Saisie pour utilisateurs, Actions supplémentaires pour Admin) */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={onOpenScanner}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <ScanLine className="w-4 h-4" />
              <span>Scanner QR / OCR</span>
            </button>
            <button
              onClick={() => {
                if (onOpenManualEntry) {
                  onOpenManualEntry();
                } else {
                  onSelectArticleToCount({
                    id: `manual-${Date.now()}`,
                    code_article: '',
                    designation: '',
                    reference: '',
                    famille: familles[0] || 'Général',
                    machine: machines[0] || 'Standard',
                    unite: 'Pièce',
                    emplacement: lastLocation || '',
                    quantite: 1,
                    status: 'saisi'
                  });
                }
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Saisie Manuelle</span>
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={onOpenImport}
                  className="px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Importer Base Excel</span>
                </button>
                <button
                  onClick={onOpenExport}
                  className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>Exporter en Excel</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live Search Bar with Suggestions */}
        <div className="relative mt-5">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (searchResults.length > 0) {
                    onSelectArticleToCount(searchResults[0]);
                    setSearchTerm('');
                  } else if (searchTerm.trim()) {
                    const term = searchTerm.trim();
                    setSearchTerm('');
                    if (onOpenManualEntry) {
                      onOpenManualEntry(term);
                    } else {
                      onSelectArticleToCount({
                        id: `manual-${Date.now()}`,
                        code_article: term,
                        designation: term,
                        reference: '',
                        famille: familles[0] || 'Général',
                        machine: machines[0] || 'Standard',
                        unite: 'Pièce',
                        emplacement: lastLocation || '',
                        quantite: 1,
                        status: 'saisi'
                      });
                    }
                  }
                }
              }}
              placeholder="Rechercher ou saisir un article par code, désignation ou référence..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300/80 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:border-amber-500 dark:focus:border-amber-400 focus:outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                Effacer
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown if typing search term */}
          {searchTerm.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-20 space-y-1.5">
              {/* Manual Entry Quick Action Shortcut */}
              <div
                className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100/90 dark:hover:bg-amber-950/60 border border-amber-200/90 dark:border-amber-800/80 rounded-lg transition-colors cursor-pointer"
                onClick={() => {
                  const term = searchTerm.trim();
                  setSearchTerm('');
                  if (onOpenManualEntry) {
                    onOpenManualEntry(term);
                  } else {
                    onSelectArticleToCount({
                      id: `manual-${Date.now()}`,
                      code_article: term,
                      designation: term,
                      reference: '',
                      famille: familles[0] || 'Général',
                      machine: machines[0] || 'Standard',
                      unite: 'Pièce',
                      emplacement: lastLocation || '',
                      quantite: 1,
                      status: 'saisi'
                    });
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0">
                    +
                  </div>
                  <div>
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                      Saisie manuelle : Ajouter & inventorier "{searchTerm.trim()}"
                    </span>
                    <div className="text-[10px] text-amber-800 dark:text-amber-300">
                      Sera ajouté à la liste des articles et dans la liste des saisis avec le statut (saisi)
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700 shrink-0">
                  Statut : (saisi)
                </span>
              </div>

              {searchResults.length > 0 && (
                <div className="pt-1">
                  <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 px-3 py-1 uppercase tracking-wider">
                    Articles correspondants dans la base ({searchResults.length})
                  </div>
                  {searchResults.map((art) => (
                    <div
                      key={art.id}
                      className="flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg transition-colors group cursor-pointer"
                      onClick={() => {
                        onSelectArticleToCount(art);
                        setSearchTerm('');
                      }}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {art.code_article}
                          </span>
                          <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                            {art.designation}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Machine : <strong>{art.machine}</strong> · Emplacement : <strong>{art.emplacement}</strong>
                        </div>
                      </div>
                      <button
                        className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg group-hover:bg-amber-600 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Saisir</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. STATS & KPI STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1 */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs transition-colors">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Lignes Saisies</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {totalCountedLines}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">références</span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-2">
            Articles répertoriés à l'inventaire
          </span>
        </div>

        {/* KPI 2 */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs transition-colors">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Quantité Totale</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
              {totalQuantitySum}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">unités</span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-2">
            Cumul de toutes les pièces saisies
          </span>
        </div>

        {/* KPI 3 */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs transition-colors">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Machines Inventoriées</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums">
              {distinctMachinesCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">équipements</span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-2">
            Machines avec pièces comptées
          </span>
        </div>

        {/* KPI 4 */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs transition-colors">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Anomalies Qualité</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${anomaliesQualityCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
              {anomaliesQualityCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">à réparer / rebut</span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-2">
            Matériel dégradé ou non conforme
          </span>
        </div>
      </div>

      {/* 3. INVENTORY BASE & ENTRIES TABLE SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs transition-colors">
        {/* Table Header & View Switcher */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Base d'Inventaire & Articles Saisis
                </h3>
                {activeInventory && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    <span className="font-mono text-amber-700 dark:text-amber-400 font-bold">{activeInventory.code}</span>
                    <span>·</span>
                    <span className="truncate max-w-[150px]">{activeInventory.titre}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Chaque article inventorié s'affiche automatiquement dans la base d'inventaire avec son emplacement, son statut (saisi) et ses quantités enregistrées.
              </p>
            </div>

            {/* View Mode Switcher Tabs & Quick Excel Export */}
            <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
              <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700/70 text-xs">
                <button
                  type="button"
                  onClick={() => handleDisplayModeChange('saisis')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    displayMode === 'saisis'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs font-bold border border-slate-200/60 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Articles Saisis</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    displayMode === 'saisis'
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {countSaisis}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDisplayModeChange('tous')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    displayMode === 'tous'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold border border-slate-200/60 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <span>Base Complète</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    displayMode === 'tous'
                      ? 'bg-slate-800 dark:bg-slate-700 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {combinedList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDisplayModeChange('a_faire')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    displayMode === 'a_faire'
                      ? 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 shadow-xs font-bold border border-slate-200/60 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>En attente</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    displayMode === 'a_faire'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {countPending}
                  </span>
                </button>
              </div>

              {/* Direct Excel Export Button from Base d'Inventaire */}
              <button
                type="button"
                onClick={handleQuickExport}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Exporter la sélection en Excel avec colonne Emplacement"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export Excel</span>
              </button>
            </div>
          </div>

          {exportToast && (
            <div
              className={`mt-3 p-3 rounded-xl border text-xs flex items-center gap-2 transition-all ${
                exportToast.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{exportToast.message}</span>
            </div>
          )}
        </div>

        {/* Table Filter Toolbar */}
        <div className="p-3 sm:p-4 bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 transition-colors">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Live Search inside the Table */}
            <div className="relative min-w-[180px] flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Filtrer code, nom, réf, emplacement..."
                className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-amber-500 dark:focus:border-amber-400"
              />
              {tableSearch && (
                <button
                  onClick={() => setTableSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Machine Filter Dropdown */}
            {machines.length > 0 && (
              <select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                className="text-xs font-medium px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
              >
                <option value="all">Toutes les machines</option>
                {machines.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}

            {/* Famille Filter Dropdown */}
            {familles.length > 0 && (
              <select
                value={selectedFamille}
                onChange={(e) => setSelectedFamille(e.target.value)}
                className="text-xs font-medium px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
              >
                <option value="all">Toutes les familles</option>
                {familles.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            )}

            {/* Emplacement Filter Dropdown */}
            {distinctLocations.length > 0 && (
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="text-xs font-medium px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                title="Filtrer par emplacement"
              >
                <option value="all">Tous les emplacements ({distinctLocations.length})</option>
                {distinctLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    Emplacement : {loc}
                  </option>
                ))}
              </select>
            )}

            {/* Qualité Filter (useful in saisis and tous) */}
            {displayMode !== 'a_faire' && (
              <select
                value={selectedQualite}
                onChange={(e) => setSelectedQualite(e.target.value)}
                className="text-xs font-medium px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
              >
                <option value="all">Toutes les qualités</option>
                {Object.entries(QUALITE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            )}

            {/* Operator Filter Dropdown */}
            {displayMode !== 'a_faire' && distinctOperators.length > 0 && (
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                className="text-xs font-medium px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
              >
                <option value="all">Tous les opérateurs ({distinctOperators.length})</option>
                {distinctOperators.map((op) => (
                  <option key={op} value={op}>
                    Opérateur : {op}
                  </option>
                ))}
              </select>
            )}

            {/* Reset Filter Button if active */}
            {(selectedMachine !== 'all' || selectedFamille !== 'all' || selectedLocation !== 'all' || selectedQualite !== 'all' || selectedOperator !== 'all' || tableSearch) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedMachine('all');
                  setSelectedFamille('all');
                  setSelectedLocation('all');
                  setSelectedQualite('all');
                  setSelectedOperator('all');
                  setTableSearch('');
                }}
                className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-semibold px-2 py-1 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg border border-amber-200 dark:border-amber-800 transition-colors flex items-center gap-1 cursor-pointer"
                title="Réinitialiser tous les filtres"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Réinitialiser</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 text-xs text-slate-500 dark:text-slate-400 shrink-0">
            <span>
              <strong className="text-slate-800 dark:text-slate-200">{displayedRows.length}</strong> ligne(s) affichée(s)
            </span>
            {isAdmin && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => exportFullJsonBackup()}
                  className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                  title="Sauvegarder une copie locale JSON"
                >
                  <HardDrive className="w-4 h-4" />
                </button>
                {(entries.length > 0 || articles.length > 0) && (
                  <button
                    onClick={() => setIsConfirmClearOpen(true)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors flex items-center gap-1 text-xs cursor-pointer"
                    title="Vider toute la base (Mot de passe administrateur obligatoire)"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline font-medium">Vider la base</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Floating Bulk Selection Action Banner */}
        {selectedRowIds.size > 0 && (
          <div className="mx-4 sm:mx-5 my-3 p-3 sm:p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 dark:from-amber-950/40 dark:via-amber-900/40 dark:to-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-2xs">
                {selectedRowIds.size}
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-amber-100">
                {selectedRowIds.size} ligne{selectedRowIds.size > 1 ? 's' : ''} sélectionnée{selectedRowIds.size > 1 ? 's' : ''}
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              {selectedCountSaisis > 0 && (
                <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>{selectedCountSaisis} saisie{selectedCountSaisis > 1 ? 's' : ''}</span>
                </span>
              )}
              {selectedCountAFaire > 0 && (
                <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>{selectedCountAFaire} à faire</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium hover:bg-white/80 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-300 dark:hover:border-slate-700"
              >
                {isAllSelected ? "Tout désélectionner" : `Tout sélectionner (${displayedRows.length})`}
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleRequestBulkDelete}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                title={`Supprimer définitivement les ${selectedRowIds.size} lignes sélectionnées`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer la sélection ({selectedRowIds.size})</span>
              </button>
            </div>
          </div>
        )}

        {/* Data Table */}
        {displayedRows.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 transition-colors">
            <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {displayMode === 'saisis'
                ? (entries.length === 0 ? "Aucun article inventorié pour le moment" : "Aucun article saisi ne correspond aux filtres")
                : displayMode === 'a_faire'
                ? (countPending === 0 ? "Félicitations ! 100% des articles sont inventoriés" : "Aucun article en attente ne correspond aux filtres")
                : (combinedList.length === 0 ? "La base d'inventaire est actuellement vide" : "Aucun article ne correspond à votre recherche")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              {displayMode === 'saisis' && entries.length === 0
                ? "Scannez un code-barres ou lancez une saisie manuelle pour inventorier votre premier article. Il s'affichera immédiatement ici avec le statut (saisi)."
                : "Modifiez vos termes de recherche ou sélectionnez un autre affichage."}
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {displayMode === 'saisis' && combinedList.length > 0 && (
                <button
                  onClick={() => setDisplayMode('tous')}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Layers className="w-4 h-4" />
                  <span>Afficher toute la base ({combinedList.length})</span>
                </button>
              )}
              <button
                onClick={onOpenScanner}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <ScanLine className="w-4 h-4" />
                <span>Scanner un code</span>
              </button>
              <button
                onClick={() => {
                  if (onOpenManualEntry) {
                    onOpenManualEntry();
                  } else {
                    onSelectArticleToCount({
                      id: `manual-${Date.now()}`,
                      code_article: '',
                      designation: '',
                      reference: '',
                      famille: familles[0] || 'Général',
                      machine: machines[0] || 'Standard',
                      unite: 'Pièce',
                      position: '',
                      emplacement: lastLocation || '',
                      quantite: 0,
                      status: 'saisi'
                    });
                  }
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Saisie manuelle</span>
              </button>
              {isAdmin && (
                <button
                  onClick={onOpenImport}
                  className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Importer Excel</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white dark:bg-slate-900 transition-colors">
            <table className="w-full text-left text-xs divide-y divide-slate-100 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  {/* Master Checkbox: Tout Sélectionner */}
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      title={isAllSelected ? "Tout désélectionner" : `Tout sélectionner (${displayedRows.length} lignes)`}
                      className="p-1 rounded text-slate-400 hover:text-amber-600 dark:text-slate-500 dark:hover:text-amber-400 transition-colors cursor-pointer inline-flex items-center justify-center"
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-amber-500" />
                      ) : isSomeSelected ? (
                        <MinusSquare className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4">Code Article</th>
                  <th className="py-3 px-4">Désignation</th>
                  <th className="py-3 px-3">
                    <div className="flex items-center gap-1.5" title="Famille de l'article">
                      <FolderTree className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Famille</span>
                    </div>
                  </th>
                  <th className="py-3 px-3">
                    <div className="flex items-center gap-1.5" title="Machine où la pièce est installée">
                      <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Machine (Installation)</span>
                    </div>
                  </th>
                  <th className="py-3 px-3">
                    <div className="flex items-center gap-1.5" title="Position de la pièce dans la machine">
                      <Crosshair className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Position (Machine)</span>
                    </div>
                  </th>
                  <th className="py-3 px-3">
                    <div className="flex items-center gap-1.5" title="Position de la pièce dans le magasin (dépôt, rayonnage, bac... rempli lors de la saisie)">
                      <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Emplacement (Magasin)</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 text-right">Stock Interne</th>
                  <th className="py-3 px-3 text-right">Quantité Saisie</th>
                  <th className="py-3 px-3 text-right" title="Écart = Quantité Saisie - Stock Interne">
                    <div className="flex items-center justify-end gap-1">
                      <span>Écart</span>
                      <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">(Qté - Stock)</span>
                    </div>
                  </th>
                  <th className="py-3 px-4">Qualité Réelle</th>
                  <th className="py-3 px-4">Date / Opérateur</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {displayedRows.map((item) => {
                  const isSaisi = item.statutInventaire === 'Saisi';
                  const isRowSelected = selectedRowIds.has(item.id);
                  const matchingEntry = entries.find(
                    (e) => (e.code_article || '').toLowerCase() === item.code_article.toLowerCase()
                  );

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isRowSelected
                          ? 'bg-amber-100/60 dark:bg-amber-950/50 hover:bg-amber-100/80 dark:hover:bg-amber-950/70'
                          : isSaisi
                          ? 'bg-emerald-50/20 dark:bg-emerald-950/20 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/40'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {/* Row Checkbox */}
                      <td className="py-3 px-3 w-10 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleSelectRow(item.id)}
                          title={isRowSelected ? "Désélectionner cette ligne" : "Sélectionner cette ligne"}
                          className="p-1 rounded text-slate-400 hover:text-amber-600 dark:text-slate-500 dark:hover:text-amber-400 transition-colors cursor-pointer inline-flex items-center justify-center"
                        >
                          {isRowSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Statut : (saisi) ou (À faire) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isSaisi ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            (saisi)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            À faire
                          </span>
                        )}
                      </td>

                      {/* Code Article */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {item.code_article}
                      </td>

                      {/* Designation & Reference */}
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200 max-w-[220px]">
                        <div className="truncate font-semibold">{item.designation}</div>
                        {item.reference && item.reference !== '-' && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate">
                            Réf: {item.reference}
                          </div>
                        )}
                      </td>

                      {/* Famille (Catégorie d'articles) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-200 dark:border-slate-700">
                          <FolderTree className="w-3 h-3 text-slate-500 dark:text-slate-400 shrink-0" />
                          <span>{item.famille || 'Général'}</span>
                        </span>
                      </td>

                      {/* Machine (Installation où la pièce est montée) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-blue-900 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded text-[11px] border border-blue-200 dark:border-blue-800">
                          <Cpu className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{item.machine || 'Standard'}</span>
                        </span>
                      </td>

                      {/* Position (Emplacement de la pièce dans la machine) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.position && item.position !== '-' ? (
                          <span className="inline-flex items-center gap-1 font-medium text-indigo-900 dark:text-indigo-200 bg-indigo-50/80 dark:bg-indigo-950/40 px-2 py-0.5 rounded text-[11px] border border-indigo-200/80 dark:border-indigo-800">
                            <Crosshair className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span className="truncate max-w-[130px]" title={item.position}>{item.position}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic text-[11px] pl-1">-</span>
                        )}
                      </td>

                      {/* Emplacement (Magasin / Dépôt : UNIQUEMENT pour les articles saisis !) */}
                      <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {isSaisi && (item.emplacement || matchingEntry?.emplacement) ? (
                          (() => {
                            const rawLoc = (item.emplacement || matchingEntry?.emplacement || '').trim();
                            const cleanLoc = (rawLoc && rawLoc !== 'Non renseigné' && rawLoc !== 'Non assigné') ? rawLoc : '';
                            if (!cleanLoc) {
                              return <span className="text-slate-400 dark:text-slate-500 italic text-[11px] pl-1">-</span>;
                            }
                            return (
                              <button
                                type="button"
                                onClick={() => setSelectedLocation(cleanLoc)}
                                title={`Filtrer par cet emplacement magasin (${cleanLoc})`}
                                className="inline-flex items-center gap-1 font-mono font-bold text-amber-950 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-2 py-0.5 rounded text-[11px] border border-amber-300 dark:border-amber-700 transition-colors cursor-pointer shadow-2xs"
                              >
                                <MapPin className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>{cleanLoc}</span>
                              </button>
                            );
                          })()
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic text-[11px] pl-1">-</span>
                        )}
                      </td>

                      {/* Stock Interne */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap bg-sky-50/20 dark:bg-sky-950/10">
                        <span className="text-sky-700 dark:text-sky-300 font-extrabold text-[12px] bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                          {typeof item.stock_interne === 'number' ? item.stock_interne.toFixed(2) : '0.00'}
                        </span>
                      </td>

                      {/* Quantité Saisie */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap bg-emerald-50/20 dark:bg-emerald-950/10">
                        {isSaisi ? (
                          <>
                            <span className="text-base text-amber-600 dark:text-amber-400">{item.quantite}</span>{' '}
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">{item.unite}</span>
                          </>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">Non saisi</span>
                        )}
                      </td>

                      {/* Écart de Stock */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                        {isSaisi ? (() => {
                          const stockInt = typeof item.stock_interne === 'number' ? item.stock_interne : 0;
                          const ecartVal = (typeof item.quantite === 'number' ? item.quantite : 0) - stockInt;
                          return ecartVal === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                              <Equal className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              0.00
                            </span>
                          ) : ecartVal > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-sky-100/70 dark:bg-sky-950/50 px-2 py-0.5 rounded border border-sky-300 dark:border-sky-800">
                              <TrendingUp className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                              +{ecartVal.toFixed(2)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-950/50 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-800">
                              <TrendingDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              {ecartVal.toFixed(2)}
                            </span>
                          );
                        })() : (
                          <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">-</span>
                        )}
                      </td>

                      {/* Qualité */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isSaisi ? (
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                              item.qualite.includes('Conforme') || item.qualite.includes('Bon')
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : item.qualite.includes('réparer') || item.qualite.includes('Dégradé')
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            {item.qualite}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">En attente</span>
                        )}
                      </td>

                      {/* Date & Opérateur */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                        {isSaisi ? (
                          <div className="space-y-1">
                            <div className="text-slate-600 dark:text-slate-400 font-mono text-[10px]">{item.timestamp}</div>
                            <button
                              type="button"
                              onClick={() => setSelectedOperator(item.operator)}
                              title={`Filtrer par cet opérateur (${item.operator})`}
                              className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-amber-100/80 dark:hover:bg-amber-950/60 hover:text-amber-900 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer"
                            >
                              <User className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                              <span className="truncate max-w-[120px]">{item.operator}</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isSaisi ? (
                          isAdmin ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  if (matchingEntry) {
                                    onEditEntry(matchingEntry);
                                  } else {
                                    const art = articles.find(
                                      (a) => a.code_article.toLowerCase() === item.code_article.toLowerCase()
                                    );
                                    if (art) {
                                      onSelectArticleToCount(art);
                                    }
                                  }
                                }}
                                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
                                title="Modifier la saisie (Admin)"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (matchingEntry) {
                                    setEntryToDelete(matchingEntry);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                title="Supprimer la saisie (Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Enregistré</span>
                            </span>
                          )
                        ) : (
                          <button
                            onClick={() => {
                              const matchingArticle = articles.find(
                                (a) => a.code_article.toLowerCase() === item.code_article.toLowerCase()
                              );
                              if (matchingArticle) {
                                onSelectArticleToCount(matchingArticle);
                              } else {
                                onSelectArticleToCount({
                                  id: item.id,
                                  code_article: item.code_article,
                                  designation: item.designation,
                                  reference: item.reference !== '-' ? item.reference : '',
                                  famille: item.famille,
                                  machine: item.machine,
                                  unite: item.unite,
                                  emplacement: item.emplacement !== 'Non assigné' ? item.emplacement : '',
                                  quantite: 1,
                                  status: 'a_faire'
                                });
                              }
                            }}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-xs rounded-lg inline-flex items-center gap-1 shadow-xs transition-transform cursor-pointer"
                            title="Saisir et inventorier cet article maintenant"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Saisir</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal confirmation suppression d'une ligne d'inventaire */}
      <ConfirmModal
        isOpen={!!entryToDelete}
        title="Supprimer la saisie d'inventaire"
        message={`Êtes-vous sûr de vouloir supprimer la saisie d'inventaire pour l'article ${entryToDelete?.code_article} (${entryToDelete?.designation}) ?`}
        confirmLabel="Supprimer"
        isDestructive={true}
        onConfirm={() => {
          if (entryToDelete) {
            deleteEntry(entryToDelete.id);
            setEntryToDelete(null);
          }
        }}
        onCancel={() => setEntryToDelete(null)}
      />

      {/* Modal confirmation suppression de plusieurs lignes d'inventaire */}
      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        title="Supprimer les lignes sélectionnées"
        message={`Êtes-vous sûr de vouloir supprimer définitivement les ${selectedRowIds.size} ligne(s) sélectionnée(s) ?${
          selectedCountSaisis > 0 ? `\n• ${selectedCountSaisis} saisie(s) d'inventaire seront supprimées.` : ''
        }${
          selectedCountAFaire > 0 ? `\n• ${selectedCountAFaire} article(s) non inventorié(s) seront supprimés du catalogue.` : ''
        }`}
        confirmLabel={`Supprimer définitivement (${selectedRowIds.size})`}
        isDestructive={true}
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setIsBulkDeleteModalOpen(false)}
      />

      {/* Modal sécurisée effacement complet de la base avec mot de passe admin obligatoire */}
      <ClearDatabaseModal
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        onConfirm={() => {
          clearEntireDatabase();
          setIsConfirmClearOpen(false);
        }}
        title="Vider toute la base de données"
        message="Attention : Cette action va effacer définitivement tous les articles importés, les machines, familles, emplacements et toutes les saisies d'inventaire pour repartir d'une base 100% vide."
      />
    </div>
  );
};
