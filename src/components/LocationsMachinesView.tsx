import React, { useState } from 'react';
import {
  Cpu,
  FolderTree,
  MapPin,
  Plus,
  Trash2,
  FileSpreadsheet,
  Download,
  Check,
  Search
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { generateSampleLocationsExcel } from '../utils/excelImport';
import { ConfirmModal } from './ConfirmModal';

interface LocationsMachinesViewProps {
  onOpenImport: () => void;
}

export const LocationsMachinesView: React.FC<LocationsMachinesViewProps> = ({ onOpenImport }) => {
  const {
    machines,
    familles,
    locations,
    articles,
    entries,
    addMachine,
    deleteMachine,
    addFamille,
    deleteFamille,
    addLocation,
    deleteLocation
  } = useInventory();

  const [activeTab, setActiveTab] = useState<'machines' | 'familles' | 'locations'>('machines');
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'machine' | 'famille' | 'location';
    id: string;
    name: string;
  } | null>(null);

  // Input states for adding
  const [newMachine, setNewMachine] = useState('');
  const [newFamille, setNewFamille] = useState('');
  const [newLocCode, setNewLocCode] = useState('');
  const [newLocNom, setNewLocNom] = useState('');
  const [newLocZone, setNewLocZone] = useState('');

  const [searchFilter, setSearchFilter] = useState('');

  const handleAddMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMachine.trim()) {
      addMachine(newMachine.trim());
      setNewMachine('');
    }
  };

  const handleAddFamille = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFamille.trim()) {
      addFamille(newFamille.trim());
      setNewFamille('');
    }
  };

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLocCode.trim()) {
      addLocation({
        code: newLocCode.trim().toUpperCase(),
        nom: newLocNom.trim() || newLocCode.trim().toUpperCase(),
        zone: newLocZone.trim() || 'Atelier Principal'
      });
      setNewLocCode('');
      setNewLocNom('');
      setNewLocZone('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Paramétrage : Machines, Familles & Emplacements
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gérez les équipements de production, la classification et les emplacements de stockage
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => generateSampleLocationsExcel()}
            className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Modèle Emplacements</span>
          </button>
          <button
            onClick={onOpenImport}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importer Excel</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-xs">
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => {
              setActiveTab('machines');
              setSearchFilter('');
            }}
            className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'machines'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Cpu className="w-4 h-4 text-blue-400" />
            <span>Machines ({machines.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('familles');
              setSearchFilter('');
            }}
            className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'familles'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FolderTree className="w-4 h-4 text-emerald-400" />
            <span>Familles ({familles.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('locations');
              setSearchFilter('');
            }}
            className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'locations'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>Emplacements ({locations.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: MACHINES */}
      {activeTab === 'machines' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Form */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Saisir une Machine</h3>
            </div>
            <p className="text-xs text-slate-500">
              Ajoutez un équipement ou une ligne de fabrication pour y affecter des pièces de rechange.
            </p>

            <form onSubmit={handleAddMachine} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nom / Désignation de la Machine
                </label>
                <input
                  type="text"
                  required
                  value={newMachine}
                  onChange={(e) => setNewMachine(e.target.value)}
                  placeholder="Ex: Compresseur C-02, Presse 500T, Convoyeur 3..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Enregistrer la Machine</span>
              </button>
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Machines Référencées ({machines.length})
              </h3>
              <input
                type="text"
                placeholder="Filtrer..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="px-3 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs w-40"
              />
            </div>

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {machines
                .filter((m) => m.toLowerCase().includes(searchFilter.toLowerCase()))
                .map((m, idx) => {
                  const articleCount = articles.filter((a) => a.machine === m).length;
                  const entryCount = entries.filter((e) => e.machine === m).length;
                  return (
                    <div key={idx} className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </div>
                        <div>
                          <span className="font-semibold text-xs text-slate-900 block">{m}</span>
                          <span className="text-[11px] text-slate-400">
                            {articleCount} référence(s) en catalogue · {entryCount} inventoriée(s)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
                          {entryCount} / {articleCount}
                        </span>
                        <button
                          onClick={() => setItemToDelete({ type: 'machine', id: m, name: m })}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Supprimer la machine"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FAMILLES */}
      {activeTab === 'familles' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Form */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Saisir une Famille</h3>
            </div>
            <p className="text-xs text-slate-500">
              Organisez votre stock par famille technique (roulements, vérins, électricité, lubrifiants...).
            </p>

            <form onSubmit={handleAddFamille} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nom de la Famille
                </label>
                <input
                  type="text"
                  required
                  value={newFamille}
                  onChange={(e) => setNewFamille(e.target.value)}
                  placeholder="Ex: Pneumatique, Filtration, Visserie..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Enregistrer la Famille</span>
              </button>
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Familles Enregistrées ({familles.length})
              </h3>
              <input
                type="text"
                placeholder="Filtrer..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="px-3 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs w-40"
              />
            </div>

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {familles
                .filter((f) => f.toLowerCase().includes(searchFilter.toLowerCase()))
                .map((f, idx) => {
                  const articleCount = articles.filter((a) => a.famille === f).length;
                  const entryCount = entries.filter((e) => e.famille === f).length;
                  return (
                    <div key={idx} className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </div>
                        <div>
                          <span className="font-semibold text-xs text-slate-900 block">{f}</span>
                          <span className="text-[11px] text-slate-400">
                            {articleCount} référence(s) · {entryCount} inventoriée(s)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                          {entryCount} / {articleCount}
                        </span>
                        <button
                          onClick={() => setItemToDelete({ type: 'famille', id: f, name: f })}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Supprimer la famille"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EMPLACEMENTS (INSÉRÉS SOUS FORMAT EXCEL) */}
      {activeTab === 'locations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Form */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">Saisir un Emplacement</h3>
            </div>
            <p className="text-xs text-slate-500">
              Ces emplacements sont sélectionnables lors du comptage physique. Vous pouvez aussi les importer en masse via Excel.
            </p>

            <form onSubmit={handleAddLocation} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Code Emplacement *
                </label>
                <input
                  type="text"
                  required
                  value={newLocCode}
                  onChange={(e) => setNewLocCode(e.target.value.toUpperCase())}
                  placeholder="Ex: MAG-A-01-B, BAC-14, R02..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nom / Libellé explicite
                </label>
                <input
                  type="text"
                  value={newLocNom}
                  onChange={(e) => setNewLocNom(e.target.value)}
                  placeholder="Ex: Magasin Central - Allée A - Étagère 1..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Zone / Bâtiment
                </label>
                <input
                  type="text"
                  value={newLocZone}
                  onChange={(e) => setNewLocZone(e.target.value)}
                  placeholder="Ex: Magasin Central, Atelier, Ligne 1..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Enregistrer l'Emplacement</span>
              </button>
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Emplacements de Stockage ({locations.length})
              </h3>
              <input
                type="text"
                placeholder="Filtrer code ou nom..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="px-3 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs w-48"
              />
            </div>

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {locations
                .filter((l) =>
                  l.code.toLowerCase().includes(searchFilter.toLowerCase()) ||
                  l.nom.toLowerCase().includes(searchFilter.toLowerCase()) ||
                  l.zone.toLowerCase().includes(searchFilter.toLowerCase())
                )
                .map((loc) => {
                  const entryCount = entries.filter((e) => e.emplacement === loc.code).length;
                  return (
                    <div key={loc.id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                          {loc.code}
                        </span>
                        <div>
                          <span className="font-semibold text-xs text-slate-900 block">{loc.nom}</span>
                          <span className="text-[11px] text-slate-400">
                            Zone : {loc.zone}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-mono">
                          {entryCount} articles comptés
                        </span>
                        <button
                          onClick={() => setItemToDelete({ type: 'location', id: loc.id, name: `${loc.code} (${loc.nom})` })}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Supprimer l'emplacement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Suppression Machine / Famille / Emplacement */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        title={
          itemToDelete?.type === 'machine'
            ? 'Supprimer la machine'
            : itemToDelete?.type === 'famille'
            ? 'Supprimer la famille'
            : "Supprimer l'emplacement"
        }
        message={`Êtes-vous sûr de vouloir supprimer définitivement "${itemToDelete?.name}" ?`}
        confirmLabel="Supprimer"
        isDestructive={true}
        onConfirm={() => {
          if (itemToDelete) {
            if (itemToDelete.type === 'machine') deleteMachine(itemToDelete.id);
            else if (itemToDelete.type === 'famille') deleteFamille(itemToDelete.id);
            else if (itemToDelete.type === 'location') deleteLocation(itemToDelete.id);
            setItemToDelete(null);
          }
        }}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};
