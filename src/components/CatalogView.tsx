import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  Shield,
  Lock,
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
    addManualArticle,
    updateArticle,
    deleteArticle,
    isAdmin,
    requestAdminAction,
    operator,
    lastLocation
  } = useInventory();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMachine, setFilterMachine] = useState<string>('all');
  const [filterFamille, setFilterFamille] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'counted' | 'not_counted'>('all');
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);

  // New Article Modal
  const [isCreatingArticle, setIsCreatingArticle] = useState(false);
  const [newArtForm, setNewArtForm] = useState<Omit<Article, 'id'>>({
    code_article: '',
    designation: '',
    reference: '',
    famille: familles[0] || 'Général',
    sous_famille: '',
    depart: machines[0] || 'LIGNE-01',
    machine: machines[0] || 'LIGNE-01',
    position: '',
    emplacement: '',
    unite: 'Pièce',
    gere_nn: 'G',
    quantite: 1,
    prix_unitaire: 0,
    status: 'saisi'
  });

  const countedCodesSet = useMemo(() => {
    return new Set(entries.map(e => e.code_article.toLowerCase()));
  }, [entries]);

  const filteredArticles = useMemo(() => {
    return articles.filter(art => {
      const artMachine = art.depart || art.machine;
      if (filterMachine !== 'all' && artMachine !== filterMachine) return false;
      if (filterFamille !== 'all' && art.famille !== filterFamille) return false;

      const isCounted = countedCodesSet.has(art.code_article.toLowerCase()) || art.status === 'saisi';
      if (filterStatus === 'counted' && !isCounted) return false;
      if (filterStatus === 'not_counted' && isCounted) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchCode = art.code_article.toLowerCase().includes(q);
        const matchDesig = art.designation.toLowerCase().includes(q);
        const matchRef = art.reference.toLowerCase().includes(q);
        const matchLoc = (art.position || art.emplacement || '').toLowerCase().includes(q);
        const matchSub = (art.sous_famille || '').toLowerCase().includes(q);
        const matchDep = (art.depart || art.machine || '').toLowerCase().includes(q);
        if (!matchCode && !matchDesig && !matchRef && !matchLoc && !matchSub && !matchDep) return false;
      }

      return true;
    });
  }, [articles, filterMachine, filterFamille, filterStatus, searchTerm, countedCodesSet]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArtForm.code_article.trim() || !newArtForm.designation.trim()) return;

    const departVal = newArtForm.depart?.trim() || newArtForm.machine?.trim() || 'Standard';
    const positionVal = newArtForm.position?.trim() || newArtForm.emplacement?.trim() || lastLocation || 'Non assigné';

    addManualArticle(
      {
        code_article: newArtForm.code_article.trim(),
        designation: newArtForm.designation.trim(),
        reference: newArtForm.reference.trim(),
        famille: newArtForm.famille || 'Général',
        sous_famille: newArtForm.sous_famille?.trim() || '',
        depart: departVal,
        machine: departVal,
        position: positionVal,
        emplacement: positionVal,
        unite: newArtForm.unite || 'Pièce',
        gere_nn: newArtForm.gere_nn || 'G',
        quantite: Number(newArtForm.quantite) || 1,
        prix_unitaire: Number(newArtForm.prix_unitaire) || 0,
        status: 'saisi'
      },
      Number(newArtForm.quantite) || 1,
      'conforme',
      'Article créé et saisi manuellement'
    );

    setIsCreatingArticle(false);
    setNewArtForm({
      code_article: '',
      designation: '',
      reference: '',
      famille: familles[0] || 'Général',
      sous_famille: '',
      depart: machines[0] || 'LIGNE-01',
      machine: machines[0] || 'LIGNE-01',
      position: '',
      emplacement: '',
      unite: 'Pièce',
      gere_nn: 'G',
      quantite: 1,
      prix_unitaire: 0,
      status: 'saisi'
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Base Articles (Catalogue Excel)
            </h1>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{entries.length} article(s) saisi(s)</span>
            </span>
          </div>
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
            <thead className="bg-[#f28e2b] text-white font-bold text-[11px] shadow-xs">
              <tr className="divide-x divide-orange-400/80">
                <th className="py-3 px-3 whitespace-nowrap text-center">Statut</th>
                <th className="py-3 px-3 whitespace-nowrap">Famaille</th>
                <th className="py-3 px-3 whitespace-nowrap">S.famaille</th>
                <th className="py-3 px-3 whitespace-nowrap">Départ</th>
                <th className="py-3 px-3 whitespace-nowrap">Position</th>
                <th className="py-3 px-4 min-w-[180px]">Désignation</th>
                <th className="py-3 px-3 whitespace-nowrap">Référence manuel</th>
                <th className="py-3 px-3 whitespace-nowrap">Code magasin</th>
                <th className="py-3 px-2 text-center whitespace-nowrap">Unité</th>
                <th className="py-3 px-2 text-center whitespace-nowrap">Géré /nn</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    {articles.length === 0
                      ? "Le catalogue est vide. Importez votre fichier Excel ou créez un article."
                      : "Aucun article ne correspond à votre recherche."}
                  </td>
                </tr>
              ) : (
                filteredArticles.map((art) => {
                  const isCounted = countedCodesSet.has(art.code_article.toLowerCase()) || art.status === 'saisi';
                  const departVal = art.depart || art.machine || '-';
                  const positionVal = art.position || art.emplacement || '-';
                  const gereVal = art.gere_nn || 'G';

                  return (
                    <tr key={art.id} className="hover:bg-amber-50/50 transition-colors divide-x divide-slate-100/60">
                      {/* Statut */}
                      <td className="py-3 px-3 whitespace-nowrap text-center">
                        {isCounted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            (saisi)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3 text-slate-400" />
                            À faire
                          </span>
                        )}
                      </td>

                      {/* 1. Famaille */}
                      <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap max-w-[140px] truncate">
                        {art.famille || 'Général'}
                      </td>

                      {/* 2. S.famaille */}
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap max-w-[130px] truncate">
                        {art.sous_famille || '-'}
                      </td>

                      {/* 3. Départ */}
                      <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap max-w-[130px] truncate">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                          {departVal}
                        </span>
                      </td>

                      {/* 4. Position */}
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                        <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200 text-[11px] font-semibold">
                          {positionVal}
                        </span>
                      </td>

                      {/* 5. Désignation */}
                      <td className="py-3 px-4 font-semibold text-slate-900 min-w-[200px] max-w-[280px]">
                        <div className="line-clamp-2 leading-snug">{art.designation}</div>
                      </td>

                      {/* 6. Référence manuel */}
                      <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {art.reference || '-'}
                      </td>

                      {/* 7. Code magasin */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-900 px-2 py-0.5 rounded font-mono font-bold text-[11px] border border-slate-300">
                          {art.code_article}
                        </span>
                      </td>

                      {/* 8. Unité */}
                      <td className="py-3 px-2 text-center whitespace-nowrap text-slate-600">
                        {art.unite || 'Pièce'}
                      </td>

                      {/* 9. Géré /nn */}
                      <td className="py-3 px-2 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          gereVal === 'G' || gereVal.toLowerCase() === 'géré' || gereVal.toLowerCase() === 'oui'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}>
                          {gereVal}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onCountArticle(art)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-lg inline-flex items-center gap-1 shadow-xs transition-transform"
                            title="Saisir et inventorier cet article maintenant"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Saisir</span>
                          </button>
                          <button
                            onClick={() => {
                              requestAdminAction(() => {
                                setEditingArticle(art);
                              }, "Seul l'administrateur (ouaradtech) a le droit de modifier un article du catalogue.");
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title={isAdmin ? "Modifier l'article (Admin)" : "Modifier l'article (Admin uniquement)"}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              requestAdminAction(() => {
                                setArticleToDelete(art);
                              }, "Seul l'administrateur (ouaradtech) a le droit de supprimer un article du catalogue.");
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title={isAdmin ? "Supprimer du catalogue (Admin)" : "Supprimer (Admin uniquement)"}
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
              {/* Code magasin & Référence manuel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Code magasin (Code Art.) *</label>
                  <input
                    type="text"
                    required
                    value={newArtForm.code_article}
                    onChange={(e) => setNewArtForm({ ...newArtForm, code_article: e.target.value.toUpperCase() })}
                    placeholder="Ex: MAG-100234..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Référence manuel</label>
                  <input
                    type="text"
                    value={newArtForm.reference}
                    onChange={(e) => setNewArtForm({ ...newArtForm, reference: e.target.value })}
                    placeholder="Ex: SKF-6205-2RSH"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              {/* Désignation */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Désignation *</label>
                <input
                  type="text"
                  required
                  value={newArtForm.designation}
                  onChange={(e) => setNewArtForm({ ...newArtForm, designation: e.target.value })}
                  placeholder="Ex: Roulement rigide à billes 25x52..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                />
              </div>

              {/* Famaille & S.famaille */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Famaille</label>
                  <input
                    type="text"
                    value={newArtForm.famille}
                    onChange={(e) => setNewArtForm({ ...newArtForm, famille: e.target.value })}
                    placeholder="Ex: MÉCANIQUE"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">S.famaille</label>
                  <input
                    type="text"
                    value={newArtForm.sous_famille || ''}
                    onChange={(e) => setNewArtForm({ ...newArtForm, sous_famille: e.target.value })}
                    placeholder="Ex: ROULEMENTS"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Départ & Position */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Départ (Machine/Atelier)</label>
                  <input
                    type="text"
                    value={newArtForm.depart || newArtForm.machine}
                    onChange={(e) => setNewArtForm({ ...newArtForm, depart: e.target.value, machine: e.target.value })}
                    placeholder="Ex: LIGNE-01"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Position (Emplacement)</label>
                  <input
                    type="text"
                    value={newArtForm.position || newArtForm.emplacement}
                    onChange={(e) => setNewArtForm({ ...newArtForm, position: e.target.value.toUpperCase(), emplacement: e.target.value.toUpperCase() })}
                    placeholder="Ex: MAG-A-01"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              {/* Unité, Géré /nn & Quantité */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unité</label>
                  <input
                    type="text"
                    value={newArtForm.unite}
                    onChange={(e) => setNewArtForm({ ...newArtForm, unite: e.target.value })}
                    placeholder="Pièce, Sachet..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Géré /nn</label>
                  <select
                    value={newArtForm.gere_nn || 'G'}
                    onChange={(e) => setNewArtForm({ ...newArtForm, gere_nn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="G">G (Géré)</option>
                    <option value="NN">NN (Non géré)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantité Saisie</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={newArtForm.quantite ?? 1}
                    onChange={(e) => setNewArtForm({ ...newArtForm, quantite: Math.max(0, parseFloat(e.target.value) || 0) })}
                    placeholder="1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-amber-700"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Cet article sera automatiquement ajouté à la <strong>liste des articles</strong>, ajouté dans la <strong>liste des saisis</strong> et son statut passera à <strong>(saisi)</strong>.
                </span>
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
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter & Saisir l'Article</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Modification Article (Réservé Administrateur) */}
      {editingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Modifier l'Article (Admin)</h3>
                  <p className="text-[11px] text-slate-400">Contrôle réservé à l'administrateur</p>
                </div>
              </div>
              <button
                onClick={() => setEditingArticle(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingArticle) {
                  updateArticle(editingArticle);
                  setEditingArticle(null);
                }
              }}
              className="space-y-3 text-xs"
            >
              {/* Code magasin & Référence manuel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Code magasin (Code Art.) *</label>
                  <input
                    type="text"
                    required
                    value={editingArticle.code_article}
                    onChange={(e) =>
                      setEditingArticle({ ...editingArticle, code_article: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Référence manuel</label>
                  <input
                    type="text"
                    value={editingArticle.reference || ''}
                    onChange={(e) =>
                      setEditingArticle({ ...editingArticle, reference: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              {/* Désignation */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Désignation *</label>
                <input
                  type="text"
                  required
                  value={editingArticle.designation}
                  onChange={(e) =>
                    setEditingArticle({ ...editingArticle, designation: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              {/* Famaille & S.famaille */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Famaille</label>
                  <input
                    type="text"
                    value={editingArticle.famille || ''}
                    onChange={(e) =>
                      setEditingArticle({ ...editingArticle, famille: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">S.famaille</label>
                  <input
                    type="text"
                    value={editingArticle.sous_famille || ''}
                    onChange={(e) =>
                      setEditingArticle({ ...editingArticle, sous_famille: e.target.value })
                    }
                    placeholder="Sous-famille..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Départ & Position */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Départ (Machine/Atelier)</label>
                  <input
                    type="text"
                    value={editingArticle.depart || editingArticle.machine || ''}
                    onChange={(e) =>
                      setEditingArticle({ ...editingArticle, depart: e.target.value, machine: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Position (Emplacement)</label>
                  <input
                    type="text"
                    value={editingArticle.position || editingArticle.emplacement || ''}
                    onChange={(e) =>
                      setEditingArticle({ ...editingArticle, position: e.target.value, emplacement: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              {/* Unité & Géré /nn */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unité</label>
                  <input
                    type="text"
                    value={editingArticle.unite || 'Pièce'}
                    onChange={(e) =>
                      setEditingArticle({ ...editingArticle, unite: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Géré /nn</label>
                  <select
                    value={editingArticle.gere_nn || 'G'}
                    onChange={(e) =>
                      setEditingArticle({ ...editingArticle, gere_nn: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="G">G (Géré)</option>
                    <option value="NN">NN (Non géré)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingArticle(null)}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enregistrer les modifications</span>
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
