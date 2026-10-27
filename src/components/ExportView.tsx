import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  RotateCcw,
  Cpu,
  FolderTree,
  MapPin,
  AlertCircle,
  User,
  Boxes,
  TrendingUp,
  TrendingDown,
  Equal
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { ExportFilters } from '../types/inventory';
import {
  exportInventoryToExcel,
  buildCombinedInventoryList,
  filterCombinedInventory,
  QUALITE_LABELS
} from '../utils/excelExport';

export const ExportView: React.FC = () => {
  const { entries, articles, machines, familles, locations, users } = useInventory();

  // Combine entries and uncounted catalog articles
  const allCombined = useMemo(() => {
    return buildCombinedInventoryList(entries, articles);
  }, [entries, articles]);

  const availableUnits = useMemo(() => {
    const set = new Set<string>();
    allCombined.forEach(item => {
      if (item.unite) set.add(item.unite);
    });
    return Array.from(set);
  }, [allCombined]);

  const distinctOperators = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.nom) set.add(u.nom);
      if (u.username) set.add(u.username);
    });
    allCombined.forEach((item) => {
      if (item.operator && item.operator !== '-' && item.operator !== 'En attente') {
        set.add(item.operator);
      }
    });
    return Array.from(set).sort();
  }, [users, allCombined]);

  const [filters, setFilters] = useState<ExportFilters>({
    famille: 'all',
    machine: 'all',
    designationSearch: '',
    codeSearch: '',
    referenceSearch: '',
    unite: 'all',
    emplacement: 'all',
    qualite: 'all',
    statusFilter: 'all',
    operator: 'all'
  });

  const [lastExportMessage, setLastExportMessage] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    return filterCombinedInventory(allCombined, filters);
  }, [allCombined, filters]);

  const stats = useMemo(() => {
    let totalQty = 0;
    let countSaisis = 0;
    let countAFaire = 0;
    let totalStockInterne = 0;

    filteredData.forEach(item => {
      totalStockInterne += typeof item.stock_interne === 'number' ? item.stock_interne : 0;
      if (item.statutInventaire === 'Saisi') {
        countSaisis += 1;
        totalQty += typeof item.quantite === 'number' ? item.quantite : 0;
      } else {
        countAFaire += 1;
      }
    });

    const completionRate = filteredData.length > 0
      ? Math.round((countSaisis / filteredData.length) * 100)
      : 0;

    const ecartGlobal = totalQty - totalStockInterne;

    return {
      total: filteredData.length,
      countSaisis,
      countAFaire,
      totalQty,
      totalStockInterne,
      ecartGlobal,
      completionRate
    };
  }, [filteredData]);

  const handleResetFilters = () => {
    setFilters({
      famille: 'all',
      machine: 'all',
      designationSearch: '',
      codeSearch: '',
      referenceSearch: '',
      unite: 'all',
      emplacement: 'all',
      qualite: 'all',
      statusFilter: 'all',
      operator: 'all'
    });
  };

  const [isExporting, setIsExporting] = useState(false);
  const [lastExportError, setLastExportError] = useState<string | null>(null);

  const handleExport = () => {
    setLastExportError(null);
    setLastExportMessage(null);
    setIsExporting(true);

    try {
      if (filteredData.length === 0) {
        if (allCombined.length === 0) {
          setLastExportError("La base d'inventaire est vide. Importez vos articles Excel ou chargez la démo pour exporter.");
        } else {
          setLastExportError("Aucun article ne correspond aux filtres sélectionnés. Réinitialisez les filtres pour exporter.");
        }
        setIsExporting(false);
        return;
      }

      const res = exportInventoryToExcel(entries, articles, filters, 'Inventaire_Global');
      if (res.success) {
        setLastExportMessage(
          `Classeur Excel téléchargé avec succès : ${res.fileName} — Total ${res.rowCount} article(s) (${res.countSaisis} saisis, ${res.countAFaire} à faire pour contrôle)`
        );
        setTimeout(() => setLastExportMessage(null), 8000);
      }
    } catch (err: any) {
      console.error('Erreur export Excel:', err);
      setLastExportError(`Erreur lors du téléchargement : ${err?.message || 'Erreur inattendue'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 transition-colors">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Exportation Complète de l'Inventaire (Saisis & À Faire)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Générez un classeur Excel contenant tous les articles saisis et ceux restant à faire avec Stock Interne, Quantités Saisies, Écarts et Traçabilité Opérateur.
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>
            {isExporting
              ? 'Génération en cours...'
              : `Télécharger l'Inventaire Excel (${filteredData.length} articles)`}
          </span>
        </button>
      </div>

      {lastExportMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold">{lastExportMessage}</span>
        </div>
      )}

      {lastExportError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 rounded-xl text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="font-semibold">{lastExportError}</span>
          </div>
          <button
            onClick={() => setLastExportError(null)}
            className="text-xs text-rose-700 dark:text-rose-300 hover:underline font-semibold ml-2"
          >
            Fermer
          </button>
        </div>
      )}

      {/* FILTER CONTROLS GRID */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Filtres & Sélection d'Exportation
            </h3>
          </div>

          {/* Status Filter Segmented Controls */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setFilters({ ...filters, statusFilter: 'all' })}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filters.statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tous les articles ({allCombined.length})
            </button>
            <button
              onClick={() => setFilters({ ...filters, statusFilter: 'saisi' })}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                filters.statusFilter === 'saisi'
                  ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Saisis ({entries.length})</span>
            </button>
            <button
              onClick={() => setFilters({ ...filters, statusFilter: 'a_faire' })}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                filters.statusFilter === 'a_faire'
                  ? 'bg-white dark:bg-slate-700 text-amber-800 dark:text-amber-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>À faire / Non inventoriés ({Math.max(0, allCombined.length - entries.length)})</span>
            </button>
          </div>

          <button
            onClick={handleResetFilters}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Réinitialiser</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. Famille */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <FolderTree className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Famille
            </label>
            <select
              value={filters.famille}
              onChange={(e) => setFilters({ ...filters, famille: e.target.value })}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-amber-500"
            >
              <option value="all">Toutes les familles ({familles.length})</option>
              {familles.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* 2. Machine */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Machine
            </label>
            <select
              value={filters.machine}
              onChange={(e) => setFilters({ ...filters, machine: e.target.value })}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-amber-500"
            >
              <option value="all">Toutes les machines ({machines.length})</option>
              {machines.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* 3. Unité */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Unité
            </label>
            <select
              value={filters.unite}
              onChange={(e) => setFilters({ ...filters, unite: e.target.value })}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-amber-500"
            >
              <option value="all">Toutes les unités</option>
              {availableUnits.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* 4. Emplacement */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Emplacement
            </label>
            <select
              value={filters.emplacement}
              onChange={(e) => setFilters({ ...filters, emplacement: e.target.value })}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-amber-500"
            >
              <option value="all">Tous les emplacements</option>
              {locations.map((l) => (
                <option key={l.id} value={l.code}>{l.code} — {l.nom}</option>
              ))}
            </select>
          </div>

          {/* 5. Code Article */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Code Article
            </label>
            <input
              type="text"
              placeholder="Ex: ROU-, VER-..."
              value={filters.codeSearch}
              onChange={(e) => setFilters({ ...filters, codeSearch: e.target.value })}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* 6. Désignation */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Désignation
            </label>
            <input
              type="text"
              placeholder="Ex: Roulement, Huile..."
              value={filters.designationSearch}
              onChange={(e) => setFilters({ ...filters, designationSearch: e.target.value })}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* 7. Référence */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Référence
            </label>
            <input
              type="text"
              placeholder="Ex: SKF, FESTO..."
              value={filters.referenceSearch}
              onChange={(e) => setFilters({ ...filters, referenceSearch: e.target.value })}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* 8. Qualité */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Qualité / État Réel
            </label>
            <select
              value={filters.qualite}
              onChange={(e) => setFilters({ ...filters, qualite: e.target.value })}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-amber-500"
            >
              <option value="all">Toutes les qualités</option>
              {Object.entries(QUALITE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>

          {/* 9. Opérateur de Saisie */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Opérateur de saisie
            </label>
            <select
              value={filters.operator || 'all'}
              onChange={(e) => setFilters({ ...filters, operator: e.target.value })}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-amber-500"
            >
              <option value="all">Tous les opérateurs ({distinctOperators.length})</option>
              {distinctOperators.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SUMMARY STATS BAR WITH STOCK INTERNE TOTAL & ÉCART GLOBAL */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 bg-slate-900 dark:bg-slate-950 text-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-800">
        {/* Metric 1: Total Sélectionné */}
        <div className="p-2 sm:p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
            Total Articles
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-white">
              {stats.total}
            </span>
            <span className="text-xs text-slate-400">réf.</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {stats.countSaisis} saisis • {stats.countAFaire} à faire
          </span>
        </div>

        {/* Metric 2: Stock Interne Total */}
        <div className="p-2 sm:p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-sky-400 block uppercase tracking-wider">
              Stock Interne Total
            </span>
            <Boxes className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-sky-300">
              {Number(stats.totalStockInterne || 0).toFixed(2)}
            </span>
            <span className="text-xs text-slate-400">unités</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            Catalogue théorique initial
          </span>
        </div>

        {/* Metric 3: Quantité Totale Comptée */}
        <div className="p-2 sm:p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-emerald-400 block uppercase tracking-wider">
              Stock Compté (Physique)
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-emerald-300">
              {Number(stats.totalQty || 0).toFixed(2)}
            </span>
            <span className="text-xs text-slate-400">unités</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            Sur {stats.countSaisis} article(s) compté(s)
          </span>
        </div>

        {/* Metric 4: Écart Global de Stock */}
        <div className="p-2 sm:p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-300 block uppercase tracking-wider">
              Écart Global Stock
            </span>
            {stats.ecartGlobal === 0 ? (
              <Equal className="w-4 h-4 text-emerald-400" />
            ) : stats.ecartGlobal > 0 ? (
              <TrendingUp className="w-4 h-4 text-sky-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span
              className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
                stats.ecartGlobal === 0
                  ? 'text-emerald-400'
                  : stats.ecartGlobal > 0
                  ? 'text-sky-300'
                  : 'text-rose-400'
              }`}
            >
              {stats.ecartGlobal > 0 ? `+${stats.ecartGlobal.toFixed(2)}` : stats.ecartGlobal.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400">
              {stats.ecartGlobal === 0 ? 'conforme' : stats.ecartGlobal > 0 ? 'surplus' : 'déficit'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            Physique vs Catalogue
          </span>
        </div>

        {/* Metric 5: Taux d'Avancement */}
        <div className="p-2 sm:p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-amber-400 block uppercase tracking-wider">
              Avancement Saisie
            </span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-white">
              {stats.completionRate}%
            </span>
            <span className="text-xs text-slate-400">réalisé</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {stats.countAFaire} restant(s) à contrôler
          </span>
        </div>
      </div>

      {/* PREVIEW TABLE IDENTIQUE À LA BASE D'INVENTAIRE & ARTICLES SAISIS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs transition-colors">
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Aperçu des données du classeur Excel
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                <span className="font-mono text-amber-700 dark:text-amber-400 font-bold">{filteredData.length}</span>
                <span>articles</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Présentation identique à la base d'inventaire : statut (saisi/à faire), emplacement, stock interne, quantité saisie, écart et opérateur.
            </p>
          </div>

          {/* Quick Status Filter Tabs */}
          <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700/70 text-xs self-start md:self-auto">
            <button
              type="button"
              onClick={() => setFilters({ ...filters, statusFilter: 'saisi' })}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                filters.statusFilter === 'saisi'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs font-bold border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Articles Saisis</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                filters.statusFilter === 'saisi'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {stats.countSaisis}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilters({ ...filters, statusFilter: 'all' })}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                filters.statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Base Complète</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                filters.statusFilter === 'all'
                  ? 'bg-slate-800 dark:bg-slate-700 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {allCombined.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilters({ ...filters, statusFilter: 'a_faire' })}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                filters.statusFilter === 'a_faire'
                  ? 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 shadow-xs font-bold border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>En attente</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                filters.statusFilter === 'a_faire'
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {stats.countAFaire}
              </span>
            </button>
          </div>
        </div>

        {filteredData.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs">
            Aucun article ne correspond aux filtres appliqués.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] bg-white dark:bg-slate-900 transition-colors">
            <table className="w-full text-left text-xs divide-y divide-slate-100 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-semibold sticky top-0 shadow-2xs z-10">
                <tr>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4">Code Article</th>
                  <th className="py-3 px-4">Désignation</th>
                  <th className="py-3 px-4">Machine & Famille</th>
                  <th className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Emplacement</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 text-right">Stock Interne</th>
                  <th className="py-3 px-3 text-right">Quantité Saisie</th>
                  <th className="py-3 px-3 text-right">Écart</th>
                  <th className="py-3 px-4">Qualité Réelle</th>
                  <th className="py-3 px-4">Date / Opérateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredData.map((item) => {
                  const isSaisi = item.statutInventaire === 'Saisi';
                  const ecart = typeof item.ecart_stock === 'number' ? item.ecart_stock : null;
                  const displayLoc = item.emplacement || item.position || 'Non assigné';

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isSaisi
                          ? 'bg-emerald-50/20 dark:bg-emerald-950/20 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/40'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {/* Statut : (saisi) ou À faire */}
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

                      {/* Désignation & Référence */}
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200 max-w-[220px]">
                        <div className="truncate font-semibold">{item.designation}</div>
                        {item.reference && item.reference !== '-' && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate">
                            Réf: {item.reference}
                          </div>
                        )}
                      </td>

                      {/* Machine & Famille */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                          {item.machine || item.depart || 'Standard'}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[160px]">
                          {item.famille || 'Général'}
                        </div>
                      </td>

                      {/* Emplacement */}
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-semibold px-2 py-0.5 rounded text-[11px] border ${
                            isSaisi
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <MapPin className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>{displayLoc}</span>
                        </span>
                      </td>

                      {/* Stock Interne (Théorique) */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap bg-sky-50/20 dark:bg-sky-950/10">
                        <span className="text-sky-700 dark:text-sky-300 font-extrabold text-[12px] bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                          {typeof item.stock_interne === 'number' ? item.stock_interne.toFixed(2) : '0.00'}
                        </span>
                      </td>

                      {/* Quantité Saisie (Physique) */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap bg-emerald-50/20 dark:bg-emerald-950/10">
                        {isSaisi ? (
                          <>
                            <span className="text-base text-amber-600 dark:text-amber-400">
                              {typeof item.quantite === 'number' ? item.quantite.toFixed(2) : item.quantite}
                            </span>{' '}
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                              {item.unite || 'Pièce'}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">Non saisi</span>
                        )}
                      </td>

                      {/* Écart de Stock */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                        {isSaisi && ecart !== null ? (
                          ecart === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                              <Equal className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              0.00
                            </span>
                          ) : ecart > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-sky-100/70 dark:bg-sky-950/50 px-2 py-0.5 rounded border border-sky-300 dark:border-sky-800">
                              <TrendingUp className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                              +{ecart.toFixed(2)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-950/50 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-800">
                              <TrendingDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              {ecart.toFixed(2)}
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">-</span>
                        )}
                      </td>

                      {/* Qualité */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isSaisi ? (
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                              item.qualite.includes('Conforme') || item.qualite.includes('Bon') || item.qualite.includes('Neuf')
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
                            {item.timestamp && item.timestamp !== '-' && (
                              <div className="text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                                {item.timestamp}
                              </div>
                            )}
                            {item.operator && item.operator !== '-' && item.operator !== 'En attente' ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                                <User className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                <span className="truncate max-w-[120px]">{item.operator}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">-</span>
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
    </div>
  );
};
