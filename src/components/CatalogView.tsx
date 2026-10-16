import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Trash2,
  CheckCircle2,
  Clock,
  X
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Article } from '../types/inventory';
import { generateSampleArticlesExcel } from '../utils/excelImport';
import { ConfirmModal } from './ConfirmModal';

interface CatalogViewProps {
  onOpenImport: () => void;
  onCountArticle: (article: Article) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  onOpenImport,
  onCountArticle
}) => {
  const {
    articles,
    entries,
    machines,
    familles,
    addArticle,
    deleteArticle
  } = useInventory();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMachine, setFilterMachine] = useState<string>('all');
  const [filterFamille, setFilterFamille] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'counted' | 'not_counted'>('all');
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);

  // New Article Modal
  const [isCreatingArticle, setIsCreatingArticle] = useState(false);
  const [newArtForm, setNewArtForm] = useState<Omit<Article, 'id'>>({
    code_article: '',
    designation: '',
    reference: '',
    famille: familles[0] || 'Général',
    machine: machines[0] || 'Standard',
    unite: 'Pièce',
    emplacement: '',
    quantite: 1,
    prix_unitaire: 0
  });

  const countedCodesSet = useMemo(() => {
    return new Set(entries.map(e => e.code_article.toLowerCase()));
  }, [entries]);

  const filteredArticles = useMemo(() => {
    return articles.filter(art => {
      if (filterMachine !== 'all' && art.machine !== filterMachine) return false;
      if (filterFamille !== 'all' && art.famille !== filterFamille) return false;

      const isCounted = countedCodesSet.has(art.code_article.toLowerCase());
      if (filterStatus === 'counted' && !isCounted) return false;
      if (filterStatus === 'not_counted' && isCounted) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchCode = art.code_article.toLowerCase().includes(q);
        const matchDesig = art.designation.toLowerCase().includes(q);
        const matchRef = art.reference.toLowerCase().includes(q);
        const matchLoc = art.emplacement.toLowerCase().includes(q);
        if (!matchCode && !matchDesig && !matchRef && !matchLoc) return false;
      }

      return true;
    });
  }, [articles, filterMachine, filterFamille, filterStatus, searchTerm, countedCodesSet]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArtForm.code_article.trim() || !newArtForm.designation.trim()) return;

    addArticle(newArtForm);
    setIsCreatingArticle(false);
    setNewArtForm({
      code_article: '',
      designation: '',
      reference: '',
      famille: familles[0] || 'Général',
      machine: machines[0] || 'Standard',
      unite: 'Pièce',
      emplacement: '',
      quantite: 1,
      prix_unitaire: 0
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Base Articles (Catalogue Excel)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Recherche par code ou désignation parmi les articles importés préalablement sous Excel
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => generateSampleArticlesExcel()}
            className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Modèle Excel</span>
          </button>
          <button
            onClick={onOpenImport}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importer Excel</span>
          </button>
          <button
            onClick={() => setIsCreatingArticle(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvel Article</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par code article ou désignation..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          {machines.length > 0 && (
            <select
              value={filterMachine}
              onChange={(e) => setFilterMachine(e.target.value)}
              className="text-xs font-medium px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-700"
            >
              <option value="all">Toutes les machines</option>
              {machines.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}

          {familles.length > 0 && (
            <select
              value={filterFamille}
              onChange={(e) => setFilterFamille(e.target.value)}
              className="text-xs font-medium px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-700"
            >
              <option value="all">Toutes les familles</option>
              {familles.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          )}

          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-medium shrink-0">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterStatus === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600'
              }`}
            >
              Tous ({articles.length})
            </button>
            <button
              onClick={() => setFilterStatus('counted')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterStatus === 'counted' ? 'bg-white text-emerald-800 shadow-2xs font-semibold' : 'text-slate-600'
              }`}
            >
              Saisis ({entries.length})
            </button>
            <button
              onClick={() => setFilterStatus('not_counted')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterStatus === 'not_counted' ? 'bg-white text-amber-800 shadow-2xs font-semibold' : 'text-slate-600'
              }`}
            >
              Restants
            </button>
          </div>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-100">
            <thead className="bg-slate-50 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Code Article</th>
                <th className="py-3 px-4">Désignation</th>
                <th className="py-3 px-4">Référence</th>
                <th className="py-3 px-4">Machine</th>
                <th className="py-3 px-4">Famille</th>
                <th className="py-3 px-4">Emplacement</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    {articles.length === 0
                      ? "Le catalogue est vide. Importez votre fichier Excel ou créez un article."
                      : "Aucun article ne correspond à votre recherche."}
                  </td>
                </tr>
              ) : (
                filteredArticles.map((art) => {
                  const isCounted = countedCodesSet.has(art.code_article.toLowerCase());
                  return (
                    <tr key={art.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isCounted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Saisi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3 text-slate-400" />
                            À faire
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {art.code_article}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-800 max-w-[220px] truncate">
                        {art.designation}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {art.reference || '-'}
                      </td>

                      <td className="py-3 px-4 text-slate-600 max-w-[150px] truncate">
                        {art.machine}
                      </td>

                      <td className="py-3 px-4 text-slate-600 max-w-[150px] truncate">
                        {art.famille}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                          {art.emplacement || 'Non assigné'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onCountArticle(art)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Saisir</span>
                          </button>
                          <button
                            onClick={() => setArticleToDelete(art)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Supprimer du catalogue"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Article Creation Modal */}
      {isCreatingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Ajouter un Article au Catalogue</h3>
              <button
                onClick={() => setIsCreatingArticle(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Code Article *</label>
                <input
                  type="text"
                  required
                  value={newArtForm.code_article}
                  onChange={(e) => setNewArtForm({ ...newArtForm, code_article: e.target.value.toUpperCase() })}
                  placeholder="Ex: ROU-6205, VER-100..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Désignation *</label>
                <input
                  type="text"
                  required
                  value={newArtForm.designation}
                  onChange={(e) => setNewArtForm({ ...newArtForm, designation: e.target.value })}
                  placeholder="Ex: Roulement étanche 25x52..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Référence Fabricant</label>
                  <input
                    type="text"
                    value={newArtForm.reference}
                    onChange={(e) => setNewArtForm({ ...newArtForm, reference: e.target.value })}
                    placeholder="Ex: SKF-6205"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unité</label>
                  <input
                    type="text"
                    value={newArtForm.unite}
                    onChange={(e) => setNewArtForm({ ...newArtForm, unite: e.target.value })}
                    placeholder="Pièce, Litre, Mètre..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Machine</label>
                  <input
                    type="text"
                    value={newArtForm.machine}
                    onChange={(e) => setNewArtForm({ ...newArtForm, machine: e.target.value })}
                    placeholder="Nom machine..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Famille</label>
                  <input
                    type="text"
                    value={newArtForm.famille}
                    onChange={(e) => setNewArtForm({ ...newArtForm, famille: e.target.value })}
                    placeholder="Nom famille..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Emplacement</label>
                <input
                  type="text"
                  value={newArtForm.emplacement}
                  onChange={(e) => setNewArtForm({ ...newArtForm, emplacement: e.target.value.toUpperCase() })}
                  placeholder="MAG-A-01..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreatingArticle(false)}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl"
                >
                  Ajouter au Catalogue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal Suppression Article */}
      <ConfirmModal
        isOpen={!!articleToDelete}
        title="Supprimer du catalogue"
        message={`Êtes-vous sûr de vouloir supprimer définitivement l'article "${articleToDelete?.code_article} - ${articleToDelete?.designation}" du catalogue ?`}
        confirmLabel="Supprimer"
        isDestructive={true}
        onConfirm={() => {
          if (articleToDelete) {
            deleteArticle(articleToDelete.id);
            setArticleToDelete(null);
          }
        }}
        onCancel={() => setArticleToDelete(null)}
      />
    </div>
  );
};
