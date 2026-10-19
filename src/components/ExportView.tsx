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
  User
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
      if (item.operator && item.operator !== '-') set.add(item.operator);
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

    filteredData.forEach(item => {
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

    return {
      total: filteredData.length,
      countSaisis,
      countAFaire,
      totalQty,
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

  const handleExport = () => {
    if (filteredData.length === 0) {
      setLastExportMessage("Aucune donnée à exporter avec les filtres sélectionnés.");
      setTimeout(() => setLastExportMessage(null), 5000);
      return;
    }

    const res = exportInventoryToExcel(entries, articles, filters, 'Inventaire_Global');
    if (res.success) {
      setLastExportMessage(
        `Export Excel téléchargé : ${res.fileName} — Total ${res.rowCount} articles (${res.countSaisis} saisis, ${res.countAFaire} à faire pour contrôle)`
      );
      setTimeout(() => setLastExportMessage(null), 8000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Exportation Complète de l'Inventaire (Saisis & À Faire)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Générez un classeur Excel contenant tous les articles saisis et ceux restant à faire pour contrôler les non inventorier
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={filteredData.length === 0}
          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Télécharger l'Inventaire Excel ({filteredData.length} articles)</span>
        </button>
      </div>

      {lastExportMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{lastExportMessage}</span>
        </div>
      )}

      {/* FILTER CONTROLS GRID */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Filtres & Sélection d'Exportation
            </h3>
          </div>

          {/* Status Filter Segmented Controls */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setFilters({ ...filters, statusFilter: 'all' })}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filters.statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tous les articles ({allCombined.length})
            </button>
            <button
              onClick={() => setFilters({ ...filters, statusFilter: 'saisi' })}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                filters.statusFilter === 'saisi'
                  ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Saisis ({entries.length})</span>
            </button>
            <button
              onClick={() => setFilters({ ...filters, statusFilter: 'a_faire' })}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                filters.statusFilter === 'a_faire'
                  ? 'bg-white text-amber-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>À faire / Non inventoriés ({Math.max(0, allCombined.length - entries.length)})</span>
            </button>
          </div>

          <button
            onClick={handleResetFilters}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Réinitialiser</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. Famille */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <FolderTree className="w-3.5 h-3.5 text-emerald-600" />
              Famille
            </label>
            <select
              value={filters.famille}
              onChange={(e) => setFilters({ ...filters, famille: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
            >
              <option value="all">Toutes les familles ({familles.length})</option>
              {familles.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* 2. Machine */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-blue-600" />
              Machine
            </label>
            <select
              value={filters.machine}
              onChange={(e) => setFilters({ ...filters, machine: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
            >
              <option value="all">Toutes les machines ({machines.length})</option>
              {machines.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* 3. Unité */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Unité
            </label>
            <select
              value={filters.unite}
              onChange={(e) => setFilters({ ...filters, unite: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
            >
              <option value="all">Toutes les unités</option>
              {availableUnits.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* 4. Emplacement */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              Emplacement
            </label>
            <select
              value={filters.emplacement}
              onChange={(e) => setFilters({ ...filters, emplacement: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
            >
              <option value="all">Tous les emplacements</option>
              {locations.map((l) => (
                <option key={l.id} value={l.code}>{l.code} — {l.nom}</option>
              ))}
            </select>
          </div>

          {/* 5. Code Article */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Code Article
            </label>
            <input
              type="text"
              placeholder="Ex: ROU-, VER-..."
              value={filters.codeSearch}
              onChange={(e) => setFilters({ ...filters, codeSearch: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono"
            />
          </div>

          {/* 6. Désignation */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Désignation
            </label>
            <input
              type="text"
              placeholder="Ex: Roulement, Huile..."
              value={filters.designationSearch}
              onChange={(e) => setFilters({ ...filters, designationSearch: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
            />
          </div>

          {/* 7. Référence */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Référence
            </label>
            <input
              type="text"
              placeholder="Ex: SKF, FESTO..."
              value={filters.referenceSearch}
              onChange={(e) => setFilters({ ...filters, referenceSearch: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono"
            />
          </div>

          {/* 8. Qualité */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Qualité / État Réel
            </label>
            <select
              value={filters.qualite}
              onChange={(e) => setFilters({ ...filters, qualite: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
            >
              <option value="all">Toutes les qualités</option>
              {Object.entries(QUALITE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>

          {/* 9. Opérateur de Saisie */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              Opérateur de saisie
            </label>
            <select
              value={filters.operator || 'all'}
              onChange={(e) => setFilters({ ...filters, operator: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
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

      {/* SUMMARY STATS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-900 text-white p-4 rounded-2xl shadow-xs">
        <div>
          <span className="text-xs text-slate-400 block">Total Articles Sélectionnés</span>
          <span className="text-2xl font-bold font-mono tabular-nums">{stats.total}</span>
        </div>
        <div>
          <span className="text-xs text-emerald-400 block">Articles Saisis</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
              {stats.countSaisis}
            </span>
            <span className="text-xs text-slate-400">({stats.completionRate}%)</span>
          </div>
        </div>
        <div>
          <span className="text-xs text-amber-400 block">À Faire (Non inventoriés)</span>
          <span className="text-2xl font-bold font-mono tabular-nums text-amber-400">
            {stats.countAFaire}
          </span>
        </div>
        <div>
          <span className="text-xs text-slate-400 block">Quantité Totale Comptée</span>
          <span className="text-2xl font-bold font-mono tabular-nums text-white">
            {stats.totalQty}
          </span>
        </div>
      </div>

      {/* PREVIEW TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">
              Aperçu des données du fichier Excel ({filteredData.length} articles)
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Comprend l'inventaire global, l'onglet de contrôle des articles non inventoriés et les synthèses par Machine / Famille.
          </span>
        </div>

        {filteredData.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">
            Aucun article ne correspond aux filtres appliqués.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-left text-xs divide-y divide-slate-100">
              <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Statut Inventaire</th>
                  <th className="py-2.5 px-3">Code Article</th>
                  <th className="py-2.5 px-3">Désignation</th>
                  <th className="py-2.5 px-3">Référence</th>
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3">Famille</th>
                  <th className="py-2.5 px-3">Emplacement</th>
                  <th className="py-2.5 px-3 text-right">Quantité</th>
                  <th className="py-2.5 px-3">Qualité / État</th>
                  <th className="py-2.5 px-3">Opérateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredData.map((item) => {
                  const isSaisi = item.statutInventaire === 'Saisi';
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 ${
                        !isSaisi ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* Statut Inventaire */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isSaisi ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Saisi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-600" />
                            À faire (Non inventorié)
                          </span>
                        )}
                      </td>

                      {/* Code */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {item.code_article}
                      </td>

                      {/* Designation */}
                      <td className="py-2.5 px-3 font-medium max-w-[200px] truncate">
                        {item.designation}
                      </td>

                      {/* Reference */}
                      <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {item.reference || '-'}
                      </td>

                      {/* Machine */}
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap truncate max-w-[150px]">
                        {item.machine}
                      </td>

                      {/* Famille */}
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap truncate max-w-[140px]">
                        {item.famille}
                      </td>

                      {/* Emplacement */}
                      <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                          {item.emplacement}
                        </span>
                      </td>

                      {/* Quantité */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                        {isSaisi ? (
                          <span className="text-amber-600">
                            {item.quantite} {item.unite}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal italic">
                            Non saisi
                          </span>
                        )}
                      </td>

                      {/* Qualité */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
                        {isSaisi ? (
                          <span>{item.qualite}</span>
                        ) : (
                          <span className="text-slate-400 italic">En attente</span>
                        )}
                      </td>

                      {/* Opérateur */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-600">
                        {isSaisi && item.operator && item.operator !== '-' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <User className="w-3 h-3 text-emerald-600" />
                            <span>{item.operator}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
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
