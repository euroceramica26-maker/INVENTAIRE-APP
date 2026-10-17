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
  CheckCircle2
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Article, InventoryEntry } from '../types/inventory';
import { QUALITE_LABELS } from '../utils/excelExport';
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
    lastLocation,
    deleteEntry,
    searchArticles,
    matchScannedArticle,
    clearEntireDatabase,
    isAdmin,
    requestAdminAction
  } = useInventory();

  // Search & filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [selectedFamille, setSelectedFamille] = useState<string>('all');
  const [selectedQualite, setSelectedQualite] = useState<string>('all');

  // Deletion modals state
  const [entryToDelete, setEntryToDelete] = useState<InventoryEntry | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

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

  // Filtered inventory entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (selectedMachine !== 'all' && e.machine !== selectedMachine) return false;
      if (selectedFamille !== 'all' && e.famille !== selectedFamille) return false;
      if (selectedQualite !== 'all' && e.qualite !== selectedQualite) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesCode = e.code_article.toLowerCase().includes(q);
        const matchesDesig = e.designation.toLowerCase().includes(q);
        const matchesRef = e.reference.toLowerCase().includes(q);
        const matchesLoc = e.emplacement.toLowerCase().includes(q);
        if (!matchesCode && !matchesDesig && !matchesRef && !matchesLoc) return false;
      }

      return true;
    });
  }, [entries, selectedMachine, selectedFamille, selectedQualite, searchTerm]);

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
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Saisie d'Inventaire
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Scannez le QR/Code-barres, photographiez l'étiquette (OCR) ou saisissez directement
            </p>
          </div>

          {/* Quick Action Buttons */}
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

      {/* 3. INVENTORY ENTRIES TABLE SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        {/* Table Filter Toolbar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
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

            {/* Qualité Filter */}
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
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 text-xs text-slate-500">
            <span>
              <strong>{filteredEntries.length}</strong> ligne(s) d'inventaire
            </span>
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
                  title={isAdmin ? "Vider toute la base (Admin)" : "Vider la base (Admin uniquement)"}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline font-medium">Vider la base</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Data Table */}
        {filteredEntries.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">
              {entries.length === 0 ? "Base d'inventaire vide" : "Aucun article correspondant"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {entries.length === 0
                ? "Vous pouvez importer votre fichier Excel d'articles ou scanner directement un code pour commencer."
                : "Modifiez vos filtres ou termes de recherche."}
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
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
              <button
                onClick={onOpenImport}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl inline-flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Importer Excel</span>
              </button>
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
                  <th className="py-3 px-4">Emplacement</th>
                  <th className="py-3 px-4 text-right">Quantité</th>
                  <th className="py-3 px-4">Qualité Réelle</th>
                  <th className="py-3 px-4">Date / Opérateur</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredEntries.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Statut (saisi) */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        (saisi)
                      </span>
                    </td>

                    {/* Code Article */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {item.code_article}
                    </td>

                    {/* Designation */}
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
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                        {item.emplacement}
                      </span>
                    </td>

                    {/* Quantité Saisie */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                      <span className="text-base text-amber-600">{item.quantite}</span>{' '}
                      <span className="text-xs text-slate-500 font-normal">{item.unite}</span>
                    </td>

                    {/* Qualité */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                          item.qualite === 'conforme' || item.qualite === 'bon_etat'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : item.qualite === 'a_reparer' || item.qualite === 'degrade'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {QUALITE_LABELS[item.qualite] || item.qualite}
                      </span>
                    </td>

                    {/* Date & Opérateur */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                      <div>{new Date(item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="text-slate-400">{item.operator}</div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            requestAdminAction(
                              () => onEditEntry(item),
                              "Seul l'administrateur (ouaradtech) a le droit de modifier une ligne de saisie d'inventaire."
                            );
                          }}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title={isAdmin ? "Modifier la saisie (Admin)" : "Modifier (Admin uniquement)"}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            requestAdminAction(
                              () => setEntryToDelete(item),
                              "Seul l'administrateur (ouaradtech) a le droit de supprimer une ligne de saisie d'inventaire."
                            );
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title={isAdmin ? "Supprimer la saisie (Admin)" : "Supprimer (Admin uniquement)"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
