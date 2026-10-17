import React, { useState } from 'react';
import {
  X,
  Plus,
  Package,
  Layers,
  Copy,
  FolderPlus,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

interface CreateInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newInventoryId: string) => void;
}

export const CreateInventoryModal: React.FC<CreateInventoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { createInventory, inventories, articles, operator } = useInventory();

  const [titre, setTitre] = useState('');
  const [code, setCode] = useState(() => `INV-${new Date().getFullYear()}-${String(inventories.length + 1).padStart(2, '0')}`);
  const [description, setDescription] = useState('');
  const [responsable, setResponsable] = useState(operator || 'ouaradtech');
  const [copyFromCatalog, setCopyFromCatalog] = useState(true);
  const [switchToNew, setSwitchToNew] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre.trim()) {
      setError('Veuillez renseigner un titre pour cet inventaire.');
      return;
    }

    try {
      const created = createInventory({
        titre: titre.trim(),
        code: code.trim() || `INV-${String(inventories.length + 1).padStart(2, '0')}`,
        description: description.trim(),
        responsable: responsable.trim() || 'ouaradtech',
        copyFromCatalog,
        switchToNew
      });

      if (onSuccess) onSuccess(created.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création de l\'inventaire.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[95vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Création d'un Nouvel Inventaire
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Chaque inventaire possède ses propres listes enregistrées et sauvegardées
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Titre de l'Inventaire <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex: Inventaire Annuel 2026, Inventaire Magasin Pièces..."
                required
                autoFocus
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Code / Référence
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="INV-2026-01"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Responsable de l'Inventaire
              </label>
              <input
                type="text"
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                placeholder="ouaradtech"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Date de début
              </label>
              <input
                type="text"
                disabled
                value={new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Description / Objectifs de la session
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Comptage physique complet du stock pièces de rechange, vérification des emplacements zone A..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none resize-none"
            />
          </div>

          {/* Options de démarrage des listes */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              Initialisation des listes d'articles
            </span>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={copyFromCatalog}
                onChange={(e) => setCopyFromCatalog(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 group-hover:text-amber-700 transition-colors">
                  Reprendre la base d'articles du catalogue ({articles.length} article(s))
                </span>
                <p className="text-slate-500 mt-0.5">
                  Les références et désignations sont prêtes à être inventoriées. Toutes les saisies démarreront à zéro avec le statut « À faire » pour ce nouvel inventaire.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group pt-2 border-t border-slate-200/60">
              <input
                type="checkbox"
                checked={switchToNew}
                onChange={(e) => setSwitchToNew(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 group-hover:text-amber-700 transition-colors">
                  Activer immédiatement ce nouvel inventaire pour la saisie
                </span>
                <p className="text-slate-500 mt-0.5">
                  L'application basculera automatiquement sur cette nouvelle session d'inventaire.
                </p>
              </div>
            </label>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Les données de chaque inventaire sont <strong>sauvegardées et isolées</strong>. Seul l'administrateur a le droit de modification et de suppression.
            </span>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white border border-slate-300 rounded-xl font-semibold text-xs text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Créer & Sauvegarder l'Inventaire</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
