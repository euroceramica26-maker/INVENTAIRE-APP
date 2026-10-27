import React, { useState, useMemo } from 'react';
import {
  Shield,
  Lock,
  Unlock,
  FolderPlus,
  Layers,
  Package,
  Calendar,
  User,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  Archive,
  Download,
  AlertTriangle,
  RotateCcw,
  Check,
  FileSpreadsheet,
  Settings,
  HardDrive,
  Users,
  UserPlus,
  Key,
  X,
  Phone,
  Eye,
  Search
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useInventory } from '../context/InventoryContext';
import { InventoryCampaign, AppUser } from '../types/inventory';
import { CreateInventoryModal } from './CreateInventoryModal';
import { ConfirmModal } from './ConfirmModal';
import { ClearDatabaseModal } from './ClearDatabaseModal';
import { exportFullJsonBackup } from '../utils/storage';
import { UserManagementView } from './UserManagementView';

export const AdminView: React.FC = () => {
  const {
    isAdmin,
    adminUser,
    logoutAdmin,
    setIsAdminLoginModalOpen,
    inventories,
    activeInventoryId,
    switchInventory,
    deleteInventory,
    closeInventory,
    reopenInventory,
    updateInventory,
    clearEntireDatabase,
    clearAllEntries,
    articles,
    entries,
    operator,
    syncState,
    users,
    createUser,
    updateUser,
    deleteUser,
    toggleUserActive,
    deleteEntry
  } = useInventory();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [inventoryToDelete, setInventoryToDelete] = useState<InventoryCampaign | null>(null);
  const [editingInventory, setEditingInventory] = useState<InventoryCampaign | null>(null);
  const [editTitre, setEditTitre] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editResponsable, setEditResponsable] = useState('');
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'inventories' | 'users' | 'permissions' | 'backup'>('inventories');

  const activeInv = useMemo(() => {
    return inventories.find((i) => i.id === activeInventoryId) || inventories[0];
  }, [inventories, activeInventoryId]);

  const handleStartEdit = (inv: InventoryCampaign) => {
    setEditingInventory(inv);
    setEditTitre(inv.titre);
    setEditDescription(inv.description || '');
    setEditResponsable(inv.responsable || 'ouaradtech');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInventory || !editTitre.trim()) return;
    updateInventory({
      id: editingInventory.id,
      titre: editTitre.trim(),
      description: editDescription.trim(),
      responsable: editResponsable.trim()
    });
    setEditingInventory(null);
  };

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl p-8 border border-slate-200 text-center shadow-lg">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <Shield className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Menu de Gestion Administrateur
        </h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          Cet espace est réservé à l'administrateur de l'application pour le contrôle total, la création d'inventaires, et les autorisations de modification et suppression.
        </p>

        <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 max-w-sm mx-auto text-left space-y-1.5 font-medium">
          <div className="flex items-center justify-between">
            <span>Identifiant :</span>
            <code className="bg-white px-2 py-0.5 rounded font-bold text-slate-900 border border-slate-200">ouaradtech</code>
          </div>
          <div className="flex items-center justify-between">
            <span>Mot de passe :</span>
            <code className="bg-white px-2 py-0.5 rounded font-mono font-bold text-slate-900 border border-slate-200">Ouaradtech26@</code>
          </div>
        </div>

        <button
          onClick={() => setIsAdminLoginModalOpen(true)}
          className="mt-6 px-6 py-3 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-sm rounded-xl inline-flex items-center gap-2 shadow-md transition-all"
        >
          <Lock className="w-4 h-4" />
          <span>Se Connecter en Administrateur</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. ADMIN HERO STRIP */}
      <div className="bg-slate-900 rounded-2xl text-white p-5 sm:p-6 shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-xs">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Menu de Gestion Administrateur
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full">
                  Contrôle Total Actif
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Connecté en tant que <strong className="text-amber-400">{adminUser || 'ouaradtech'}</strong> · Droits de modification, suppression et gestion des inventaires
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ Créer un Inventaire</span>
            </button>
            <button
              onClick={logoutAdmin}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Unlock className="w-4 h-4 text-rose-400" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Admin Subtabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveAdminSubTab('inventories')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeAdminSubTab === 'inventories'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Gestion des Inventaires ({inventories.length})</span>
          </button>
          <button
            onClick={() => setActiveAdminSubTab('users')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeAdminSubTab === 'users'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Utilisateurs & Opérateurs ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveAdminSubTab('permissions')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeAdminSubTab === 'permissions'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Droits & Sécurité (Modification & Suppression)</span>
          </button>
          <button
            onClick={() => setActiveAdminSubTab('backup')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeAdminSubTab === 'backup'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Sauvegardes & Remise à Zéro</span>
          </button>
        </div>
      </div>

      {/* 2. SUBTAB: INVENTORIES MANAGEMENT */}
      {activeAdminSubTab === 'inventories' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Liste des Inventaires Enregistrés & Sauvegardés
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chaque inventaire dispose de ses propres listes d'articles, de saisies et d'emplacements, synchronisés en temps réel.
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
            >
              <FolderPlus className="w-4 h-4 text-amber-400" />
              <span>Nouveau Dossier d'Inventaire</span>
            </button>
          </div>

          {/* Inventories Cards List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {inventories.map((inv) => {
              const isActive = inv.id === activeInventoryId;
              const totalArts = inv.articles ? inv.articles.length : (isActive ? articles.length : 0);
              const totalEntries = inv.entries ? inv.entries.length : (isActive ? entries.length : 0);
              const rate = totalArts > 0 ? Math.min(100, Math.round((totalEntries / totalArts) * 100)) : (totalEntries > 0 ? 100 : 0);

              return (
                <div
                  key={inv.id}
                  className={`bg-white rounded-2xl border p-5 transition-all shadow-xs relative ${
                    isActive
                      ? 'border-amber-500 ring-2 ring-amber-500/20'
                      : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  {/* Top line badge & status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-200">
                        {inv.code}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full shadow-2xs">
                          ★ Inventaire Actif
                        </span>
                      )}
                      {inv.statut === 'en_cours' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          En cours de saisie
                        </span>
                      ) : inv.statut === 'cloture' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          <Archive className="w-3.5 h-3.5 text-slate-500" />
                          Clôturé
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          Archivé
                        </span>
                      )}
                    </div>

                    {/* Admin Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(inv)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Modifier l'inventaire (Admin)"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {inventories.length > 1 && (
                        <button
                          onClick={() => setInventoryToDelete(inv)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Supprimer cet inventaire (Réservé Admin)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {inv.titre}
                  </h3>
                  {inv.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {inv.description}
                    </p>
                  )}

                  {/* Progress bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                      <span className="text-slate-500">Avancement du comptage</span>
                      <span className="font-mono text-amber-600 font-bold">{rate}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats strip */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Articles</span>
                      <span className="font-mono text-sm font-bold text-slate-800">{totalArts}</span>
                    </div>
                    <div className="p-2 bg-emerald-50/60 rounded-xl">
                      <span className="text-[10px] text-emerald-800 uppercase font-bold block">Saisis</span>
                      <span className="font-mono text-sm font-bold text-emerald-700">{totalEntries}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Responsable</span>
                      <span className="text-xs font-semibold text-slate-700 truncate block">
                        {inv.responsable || 'ouaradtech'}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action buttons */}
                  <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(inv.dateCreation).toLocaleDateString('fr-FR')}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {inv.statut === 'en_cours' ? (
                        <button
                          onClick={() => closeInventory(inv.id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                        >
                          Clôturer
                        </button>
                      ) : (
                        <button
                          onClick={() => reopenInventory(inv.id)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg transition-colors"
                        >
                          Rouvrir
                        </button>
                      )}

                      {!isActive ? (
                        <button
                          onClick={() => switchInventory(inv.id)}
                          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-xs"
                        >
                          Activer cet inventaire
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 text-xs font-bold text-emerald-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          Inventaire en cours
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2.5 SUBTAB: USERS MANAGEMENT */}
      {activeAdminSubTab === 'users' && (
        <UserManagementView />
      )}

      {/* 3. SUBTAB: PERMISSIONS & SECURITY */}
      {activeAdminSubTab === 'permissions' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Règles de Contrôle & Sécurité des Données
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Politique stricte : L'administrateur est le seul habilité à modifier ou supprimer les données
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  Droits Administrateur (Contrôle Total)
                </span>
              </div>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                <li>Création, configuration et clôture des campagnes d'inventaire</li>
                <li>Suppression définitive des lignes de saisies d'inventaire</li>
                <li>Modification et suppression des articles du catalogue</li>
                <li>Suppression des machines, familles et emplacements</li>
                <li>Remise à zéro et réinitialisation de la base de données</li>
                <li>Restauration et import de sauvegardes complètes</li>
              </ul>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Droits Opérateur / Saisie
                </span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li>Consultation et recherche dans le catalogue d'articles</li>
                <li>Scan de codes-barres, QR codes et reconnaissance OCR</li>
                <li>Saisie de quantités comptées et état de qualité</li>
                <li>Création d'articles manuels pour inventaire immédiat</li>
                <li><span className="text-rose-600 font-semibold">Interdiction :</span> Pas de droit de suppression ou de remise à zéro sans mot de passe admin</li>
              </ul>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                Compte Administrateur Actif
              </span>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm font-bold font-mono text-white">login: ouaradtech</code>
                <span className="text-xs text-slate-400">· Mot de passe configuré</span>
              </div>
            </div>
            <button
              onClick={logoutAdmin}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 text-xs font-bold rounded-xl transition-colors"
            >
              Fermer la session Administrateur
            </button>
          </div>
        </div>
      )}

      {/* 4. SUBTAB: BACKUP & SYSTEM RESET */}
      {activeAdminSubTab === 'backup' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Sauvegarde Globale & Maintenance du Système
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sauvegardez l'ensemble des inventaires créés ou effectuez une maintenance
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Sauvegarde JSON Globale</h3>
              </div>
              <p className="text-xs text-slate-500">
                Téléchargez une copie complète et sécurisée contenant tous les inventaires, leurs articles, leurs saisies et leur historique.
              </p>
              <button
                onClick={() => exportFullJsonBackup()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger la Sauvegarde Complète</span>
              </button>
            </div>

            <div className="p-5 bg-rose-50/60 border border-rose-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold text-rose-950">Zone Critique (Admin Uniquement)</h3>
              </div>
              <p className="text-xs text-slate-600">
                Efface définitivement toutes les données de l'inventaire actif ou réinitialise l'ensemble de la base de données.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsConfirmClearOpen(true)}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Vider Toute la Base</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Création Nouvel Inventaire */}
      <CreateInventoryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Modal Edition d'un Inventaire */}
      {editingInventory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Modifier l'Inventaire : {editingInventory.code}</h3>
              <button
                onClick={() => setEditingInventory(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Titre</label>
                <input
                  type="text"
                  value={editTitre}
                  onChange={(e) => setEditTitre(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Responsable</label>
                <input
                  type="text"
                  value={editResponsable}
                  onChange={(e) => setEditResponsable(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingInventory(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Suppression Inventaire */}
      <ConfirmModal
        isOpen={!!inventoryToDelete}
        title="Supprimer cet inventaire (Admin)"
        message={`Êtes-vous sûr de vouloir supprimer définitivement l'inventaire "${inventoryToDelete?.titre}" (${inventoryToDelete?.code}) ainsi que toutes ses listes d'articles et saisies associées ? Cette action est irréversible.`}
        confirmLabel="Supprimer définitivement l'inventaire"
        isDestructive={true}
        onConfirm={() => {
          if (inventoryToDelete) {
            deleteInventory(inventoryToDelete.id);
            setInventoryToDelete(null);
          }
        }}
        onCancel={() => setInventoryToDelete(null)}
      />

      {/* Sécurisation Vider Toute la Base avec mot de passe admin obligatoire */}
      <ClearDatabaseModal
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        onConfirm={() => {
          clearEntireDatabase();
          setIsConfirmClearOpen(false);
        }}
        title="Vider toute la base de données (Admin)"
        message="Attention : Vous êtes sur le point de supprimer définitivement tous les inventaires, tous les articles, toutes les saisies, machines, familles et emplacements pour repartir d'une base 100% vide."
      />
    </div>
  );
};
