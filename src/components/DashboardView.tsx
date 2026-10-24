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
  MapPin
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Article, InventoryEntry, QualiteEtat } from '../types/inventory';
import { QUALITE_LABELS, buildCombinedInventoryList, exportInventoryToExcel } from '../utils/excelExport';
import { exportFullJsonBackup } from '../utils/storage';
import { ConfirmModal } from './ConfirmModal';

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

  // Deletion modals state
  const [entryToDelete, setEntryToDelete] = useState<InventoryEntry | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

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
    locations.forEach((l) => { if (l.code) set.add(l.code); });
    entries.forEach((e) => { if (e.emplacement) set.add(e.emplacement); });
    articles.forEach((a) => { if (a.emplacement) set.add(a.emplacement); });
    return Array.from(set).sort();
  }, [locations, entries, articles]);

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

  // KPI Calculations (No ecart)
  const totalCountedLines = entries.length;
  const totalQuantitySum = entries.reduce((acc, curr) => acc + curr.quantite, 0);
  const distinctMachinesCount = new Set(entries.map(e => e.machine)).size;
  const anomaliesQualityCount = entries.filter(e => e.qualite !== 'conforme' && e.qualite !== 'bon_etat').length;

  return (
    <div className="space-y-6">
      {/* 1. TOP HERO WORKSTATION / SEARCH & SCAN PROMPT */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {isAdmin ? "Saisie & Suivi d'Inventaire" : "Poste de Comptage & Saisie"}
              </h1>
              {!isAdmin && (
                <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Comptage & Saisie
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {isAdmin 
                ? "Scannez le QR/Code-barres, photographiez l'étiquette (OCR) ou saisissez directement"
                : "Scannez les articles et saisissez vos comptages d'inventaire"}
            </p>
          </div>

          {/* Quick Action Buttons (Comptage & Saisie pour utilisateurs, Actions supplémentaires pour Admin) */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={onOpenScanner}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all"
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
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Saisie Manuelle</span>
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={onOpenImport}
                  className="px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-2 shadow-2xs transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Importer Base Excel</span>
                </button>
                <button
                  onClick={onOpenExport}
                  className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center gap-2 shadow-2xs transition-colors"
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
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
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
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300/80 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-amber-500 focus:outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 text-xs text-slate-400 hover:text-slate-600"
              >
                Effacer
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown if typing search term */}
          {searchTerm.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-20 space-y-1.5">
              {/* Manual Entry Quick Action Shortcut */}
              <div
                className="flex items-center justify-between p-2.5 bg-amber-50 hover:bg-amber-100/90 border border-amber-200/90 rounded-lg transition-colors cursor-pointer"
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
                    <span className="text-xs font-bold text-amber-950">
                      Saisie manuelle : Ajouter & inventorier "{searchTerm.trim()}"
                    </span>
                    <div className="text-[10px] text-amber-800">
                      Sera ajouté à la liste des articles et dans la liste des saisis avec le statut (saisi)
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-300 shrink-0">
                  Statut : (saisi)
                </span>
              </div>

              {searchResults.length > 0 && (
                <div className="pt-1">
                  <div className="text-[11px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider">
                    Articles correspondants dans la base ({searchResults.length})
                  </div>
                  {searchResults.map((art) => (
                    <div
                      key={art.id}
                      className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-lg transition-colors group cursor-pointer"
                      onClick={() => {
                        onSelectArticleToCount(art);
                        setSearchTerm('');
                      }}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                            {art.code_article}
                          </span>
                          <span className="text-xs font-medium text-slate-800 truncate">
                            {art.designation}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Machine : <strong>{art.machine}</strong> · Emplacement : <strong>{art.emplacement}</strong>
                        </div>
                      </div>
                      <button
                        className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg group-hover:bg-amber-600 transition-colors shrink-0 flex items-center gap-1"
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
        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Lignes Saisies</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tabular-nums">
              {totalCountedLines}
            </span>
            <span className="text-xs text-slate-400">références</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-2">
            Articles répertoriés à l'inventaire
          </span>
        </div>

        {/* KPI 2 */}
        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Quantité Totale</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-600 tabular-nums">
              {totalQuantitySum}
            </span>
            <span className="text-xs text-slate-500">unités</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-2">
            Cumul de toutes les pièces saisies
          </span>
        </div>

        {/* KPI 3 */}
        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Machines Inventoriées</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-blue-600 tabular-nums">
              {distinctMachinesCount}
            </span>
            <span className="text-xs text-slate-500">équipements</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-2">
            Machines avec pièces comptées
          </span>
        </div>

        {/* KPI 4 */}
        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Anomalies Qualité</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${anomaliesQualityCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {anomaliesQualityCount}
            </span>
            <span className="text-xs text-slate-500">à réparer / rebut</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-2">
            Matériel dégradé ou non conforme
          </span>
        </div>
      </div>

      {/* 3. INVENTORY BASE & ENTRIES TABLE SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        {/* Table Header & View Switcher */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Base d'Inventaire & Articles Saisis
                </h3>
                {activeInventory && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    <span className="font-mono text-amber-700 font-bold">{activeInventory.code}</span>
                    <span>·</span>
                    <span className="truncate max-w-[150px]">{activeInventory.titre}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Chaque article inventorié s'affiche automatiquement dans la base d'inventaire avec son emplacement, son statut (saisi) et ses quantités enregistrées.
              </p>
            </div>

            {/* View Mode Switcher Tabs & Quick Excel Export */}
            <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
              <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/70 text-xs">
                <button
                  type="button"
                  onClick={() => handleDisplayModeChange('saisis')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                    displayMode === 'saisis'
                      ? 'bg-white text-emerald-700 shadow-xs font-bold border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Articles Saisis</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    displayMode === 'saisis' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {entries.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDisplayModeChange('tous')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                    displayMode === 'tous'
                      ? 'bg-white text-slate-900 shadow-xs font-bold border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-slate-600" />
                  <span>Base Complète</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    displayMode === 'tous' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {combinedList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDisplayModeChange('a_faire')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                    displayMode === 'a_faire'
                      ? 'bg-white text-amber-800 shadow-xs font-bold border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>En attente</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    displayMode === 'a_faire' ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {countPending}
                  </span>
                </button>
              </div>

              {/* Direct Excel Export Button from Base d'Inventaire */}
              <button
                type="button"
                onClick={handleQuickExport}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all"
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
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{exportToast.message}</span>
            </div>
          )}
        </div>

        {/* Table Filter Toolbar */}
        <div className="p-3 sm:p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Live Search inside the Table */}
            <div className="relative min-w-[180px] flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Filtrer code, nom, réf, emplacement..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-amber-500"
              />
              {tableSearch && (
                <button
                  onClick={() => setTableSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                className="text-xs font-medium px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700"
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
                className="text-xs font-medium px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700"
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
                className="text-xs font-medium px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700"
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
                className="text-xs font-medium px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700"
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
                className="text-xs font-medium px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700"
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
                className="text-xs text-amber-700 hover:text-amber-800 font-semibold px-2 py-1 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors flex items-center gap-1"
                title="Réinitialiser tous les filtres"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Réinitialiser</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 text-xs text-slate-500 shrink-0">
            <span>
              <strong>{displayedRows.length}</strong> ligne(s) affichée(s)
            </span>
            {isAdmin && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => exportFullJsonBackup()}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg"
                  title="Sauvegarder une copie locale JSON"
                >
                  <HardDrive className="w-4 h-4" />
                </button>
                {(entries.length > 0 || articles.length > 0) && (
                  <button
                    onClick={() => {
                      requestAdminAction(
                        () => setIsConfirmClearOpen(true),
                        "Seul l'administrateur (ouaradtech) a le droit de vider ou réinitialiser la base de données."
                      );
                    }}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 text-xs"
                    title="Vider toute la base (Admin)"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline font-medium">Vider la base</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Data Table */}
        {displayedRows.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">
              {displayMode === 'saisis'
                ? (entries.length === 0 ? "Aucun article inventorié pour le moment" : "Aucun article saisi ne correspond aux filtres")
                : displayMode === 'a_faire'
                ? (countPending === 0 ? "Félicitations ! 100% des articles sont inventoriés" : "Aucun article en attente ne correspond aux filtres")
                : (combinedList.length === 0 ? "La base d'inventaire est actuellement vide" : "Aucun article ne correspond à votre recherche")}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {displayMode === 'saisis' && entries.length === 0
                ? "Scannez un code-barres ou lancez une saisie manuelle pour inventorier votre premier article. Il s'affichera immédiatement ici avec le statut (saisi)."
                : "Modifiez vos termes de recherche ou sélectionnez un autre affichage."}
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {displayMode === 'saisis' && combinedList.length > 0 && (
                <button
                  onClick={() => setDisplayMode('tous')}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Layers className="w-4 h-4" />
                  <span>Afficher toute la base ({combinedList.length})</span>
                </button>
              )}
              <button
                onClick={onOpenScanner}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-sm"
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
                      emplacement: lastLocation || '',
                      quantite: 1,
                      status: 'saisi'
                    });
                  }
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Saisie manuelle</span>
              </button>
              {isAdmin && (
                <button
                  onClick={onOpenImport}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl inline-flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Importer Excel</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-100">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4">Code Article</th>
                  <th className="py-3 px-4">Désignation</th>
                  <th className="py-3 px-4">Machine & Famille</th>
                  <th className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
                      <span>Emplacement</span>
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right">Quantité Saisie</th>
                  <th className="py-3 px-4">Qualité Réelle</th>
                  <th className="py-3 px-4">Date / Opérateur</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedRows.map((item) => {
                  const isSaisi = item.statutInventaire === 'Saisi';
                  const matchingEntry = entries.find(
                    (e) => (e.code_article || '').toLowerCase() === item.code_article.toLowerCase()
                  );

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isSaisi ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Statut : (saisi) ou (À faire) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isSaisi ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            (saisi)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            À faire
                          </span>
                        )}
                      </td>

                      {/* Code Article */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {item.code_article}
                      </td>

                      {/* Designation & Reference */}
                      <td className="py-3 px-4 font-medium text-slate-800 max-w-[220px]">
                        <div className="truncate font-semibold">{item.designation}</div>
                        {item.reference && item.reference !== '-' && (
                          <div className="text-[11px] text-slate-400 font-mono truncate">
                            Réf: {item.reference}
                          </div>
                        )}
                      </td>

                      {/* Machine & Famille */}
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <div className="font-medium text-slate-800 truncate max-w-[160px]">
                          {item.machine}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                          {item.famille}
                        </div>
                      </td>

                      {/* Emplacement */}
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedLocation(item.emplacement || 'all')}
                          title={`Filtrer par cet emplacement (${item.emplacement || 'Non assigné'})`}
                          className="inline-flex items-center gap-1 font-mono font-semibold text-slate-800 bg-slate-100 hover:bg-amber-100/80 hover:text-amber-900 border border-slate-200 px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer"
                        >
                          <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>{item.emplacement || 'Non assigné'}</span>
                        </button>
                      </td>

                      {/* Quantité Saisie */}
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                        {isSaisi ? (
                          <>
                            <span className="text-base text-amber-600">{item.quantite}</span>{' '}
                            <span className="text-xs text-slate-500 font-normal">{item.unite}</span>
                          </>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Non saisi</span>
                        )}
                      </td>

                      {/* Qualité */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isSaisi ? (
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                              item.qualite.includes('Conforme') || item.qualite.includes('Bon')
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : item.qualite.includes('réparer') || item.qualite.includes('Dégradé')
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            {item.qualite}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">En attente</span>
                        )}
                      </td>

                      {/* Date & Opérateur */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                        {isSaisi ? (
                          <div className="space-y-1">
                            <div className="text-slate-600 font-mono text-[10px]">{item.timestamp}</div>
                            <button
                              type="button"
                              onClick={() => setSelectedOperator(item.operator)}
                              title={`Filtrer par cet opérateur (${item.operator})`}
                              className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-slate-100 hover:bg-amber-100/80 hover:text-amber-900 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer"
                            >
                              <User className="w-2.5 h-2.5 text-emerald-600" />
                              <span className="truncate max-w-[120px]">{item.operator}</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
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
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
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
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Supprimer la saisie (Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
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
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-xs rounded-lg inline-flex items-center gap-1 shadow-xs transition-transform"
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

      {/* Modal confirmation effacement complet de la base */}
      <ConfirmModal
        isOpen={isConfirmClearOpen}
        title="Vider toute la base de données"
        message="Attention : Cette action va effacer définitivement tous les articles importés, les machines, familles, emplacements et toutes les saisies d'inventaire pour repartir d'une base 100% vide."
        confirmLabel="Tout supprimer (Remise à zéro)"
        isDestructive={true}
        onConfirm={() => {
          clearEntireDatabase();
          setIsConfirmClearOpen(false);
        }}
        onCancel={() => setIsConfirmClearOpen(false)}
      />
    </div>
  );
};
