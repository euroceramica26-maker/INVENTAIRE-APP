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
import { exportFullJsonBackup } from '../utils/storage';

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

  // User Management state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    nom: '',
    motDePasse: '',
    role: 'operateur' as 'admin' | 'operateur',
    actif: true,
    telephone: ''
  });
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [userModalError, setUserModalError] = useState<string | null>(null);
  const [viewingUserEntries, setViewingUserEntries] = useState<AppUser | null>(null);
  const [userEntriesSearch, setUserEntriesSearch] = useState('');

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

  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUserForm({
      username: '',
      nom: '',
      motDePasse: '',
      role: 'operateur',
      actif: true,
      telephone: ''
    });
    setUserModalError(null);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: AppUser) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      nom: user.nom,
      motDePasse: user.motDePasse,
      role: user.role,
      actif: user.actif,
      telephone: user.telephone || ''
    });
    setUserModalError(null);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserModalError(null);

    const trimmedUsername = userForm.username.trim().toLowerCase();
    const trimmedNom = userForm.nom.trim();
    const trimmedPwd = userForm.motDePasse.trim();

    if (!trimmedUsername) {
      setUserModalError("L'identifiant est obligatoire.");
      return;
    }
    if (!trimmedNom) {
      setUserModalError("Le nom complet est obligatoire.");
      return;
    }
    if (!trimmedPwd) {
      setUserModalError("Le mot de passe est obligatoire.");
      return;
    }

    if (editingUser) {
      const res = updateUser({
        ...editingUser,
        username: trimmedUsername,
        nom: trimmedNom,
        motDePasse: trimmedPwd,
        role: userForm.role,
        actif: userForm.actif,
        telephone: userForm.telephone?.trim()
      });
      if (!res.success) {
        setUserModalError(res.message || "Erreur lors de la modification de l'utilisateur.");
        return;
      }
    } else {
      const res = createUser({
        username: trimmedUsername,
        nom: trimmedNom,
        motDePasse: trimmedPwd,
        role: userForm.role,
        actif: userForm.actif,
        telephone: userForm.telephone?.trim()
      });
      if (!res.success) {
        setUserModalError(res.message || "Erreur lors de la création de l'utilisateur.");
        return;
      }
    }

    setIsUserModalOpen(false);
    setEditingUser(null);
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
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Gestion des Utilisateurs & Opérateurs de Saisie
                </h2>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  Traçabilité Obligatoire
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Créez les comptes utilisateurs autorisés à saisir l'inventaire. Au démarrage, la connexion identifie l'auteur de chaque article inventorié.
              </p>
            </div>
            <button
              onClick={handleOpenCreateUser}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Créer un Utilisateur</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block">Total Utilisateurs</span>
              <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                {users.length}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">Comptes enregistrés</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block">Opérateurs de Saisie</span>
              <span className="text-2xl font-bold font-mono text-emerald-600 mt-1 block">
                {users.filter(u => u.role === 'operateur' && u.actif).length}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">Comptes actifs autorisés</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block">Administrateurs</span>
              <span className="text-2xl font-bold font-mono text-amber-600 mt-1 block">
                {users.filter(u => u.role === 'admin').length}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">Contrôle total & gestion</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block">Saisies Traçables</span>
              <span className="text-2xl font-bold font-mono text-blue-600 mt-1 block">
                {entries.length}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">Lignes avec nom d'opérateur</span>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-slate-100">
                <thead className="bg-slate-50 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Utilisateur / Opérateur</th>
                    <th className="py-3 px-4">Identifiant (Login)</th>
                    <th className="py-3 px-4">Rôle</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4">Saisies Réalisées</th>
                    <th className="py-3 px-4">Dernière Connexion</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {users.map((u) => {
                    const userEntries = entries.filter(
                      (e) => (e.operator || '').toLowerCase() === (u.nom || '').toLowerCase() ||
                             (e.operator || '').toLowerCase() === (u.username || '').toLowerCase()
                    );
                    const totalQty = userEntries.reduce((sum, e) => sum + e.quantite, 0);
                    const isMainAdmin = u.username.toLowerCase() === 'ouaradtech';

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                              u.role === 'admin'
                                ? 'bg-amber-500 text-slate-950 font-black'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {u.nom ? u.nom.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{u.nom}</div>
                              {u.telephone && (
                                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  <span>{u.telephone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {u.username}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {u.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                              <Shield className="w-3 h-3 text-amber-600" />
                              Administrateur
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              <User className="w-3 h-3 text-emerald-600" />
                              Opérateur de saisie
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {u.actif ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Actif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Désactivé
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setUserEntriesSearch('');
                              setViewingUserEntries(u);
                            }}
                            className="text-left group cursor-pointer"
                            title="Cliquer pour voir la liste détaillée des articles saisis par cet utilisateur"
                          >
                            <div className="font-mono font-bold text-amber-600 group-hover:text-amber-700 flex items-center gap-1.5">
                              <span>{userEntries.length} article(s)</span>
                              <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 transition-colors" />
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {totalQty} pièces comptées
                            </div>
                          </button>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                          {u.lastLogin ? (
                            <span>{new Date(u.lastLogin).toLocaleString('fr-FR')}</span>
                          ) : (
                            <span className="text-slate-400 italic">Pas encore connecté</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setUserEntriesSearch('');
                                setViewingUserEntries(u);
                              }}
                              className="px-2 py-1 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold border border-slate-200 hover:border-amber-300"
                              title="Voir les articles saisis par cet opérateur"
                            >
                              <Eye className="w-3.5 h-3.5 text-amber-600" />
                              <span>Articles ({userEntries.length})</span>
                            </button>

                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Modifier l'utilisateur"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {!isMainAdmin && (
                              <>
                                <button
                                  onClick={() => toggleUserActive(u.id)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    u.actif
                                      ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                      : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                  title={u.actif ? "Désactiver le compte" : "Activer le compte"}
                                >
                                  {u.actif ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                </button>

                                <button
                                  onClick={() => setUserToDelete(u)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Supprimer cet utilisateur"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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

      {/* Confirmation Vider Toute la Base */}
      <ConfirmModal
        isOpen={isConfirmClearOpen}
        title="Vider toute la base de données (Admin)"
        message="Attention : Vous êtes sur le point de supprimer définitivement tous les inventaires, tous les articles, toutes les saisies, machines, familles et emplacements pour repartir d'une base 100% vide. Confirmez-vous cette action d'administration ?"
        confirmLabel="Vider complètement la base"
        isDestructive={true}
        onConfirm={() => {
          clearEntireDatabase();
          setIsConfirmClearOpen(false);
        }}
        onCancel={() => setIsConfirmClearOpen(false)}
      />

      {/* Modal Création / Modification d'un Utilisateur */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingUser ? "Modifier l'Utilisateur" : "Créer un Nouvel Utilisateur"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsUserModalOpen(false);
                  setEditingUser(null);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {userModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{userModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Identifiant de connexion (Login) *
                </label>
                <input
                  type="text"
                  required
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                  placeholder="Ex: saisie1, ahmed, agent_nuit"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-hidden focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Identifiant unique utilisé pour le login au démarrage
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nom complet de l'opérateur *
                </label>
                <input
                  type="text"
                  required
                  value={userForm.nom}
                  onChange={(e) => setUserForm({ ...userForm, nom: e.target.value })}
                  placeholder="Ex: Ahmed Benali (Atelier A)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-hidden focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Nom qui sera apposé sur chaque article inventorié
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mot de passe *
                </label>
                <input
                  type="text"
                  required
                  value={userForm.motDePasse}
                  onChange={(e) => setUserForm({ ...userForm, motDePasse: e.target.value })}
                  placeholder="Ex: 1234, Pass2026@"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Rôle de l'utilisateur *
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      userForm.role === 'operateur'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="userRole"
                      value="operateur"
                      checked={userForm.role === 'operateur'}
                      onChange={() => setUserForm({ ...userForm, role: 'operateur' })}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-xs">Opérateur Saisie</div>
                      <div className="text-[10px] text-slate-500 font-normal">Comptage & Scan</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      userForm.role === 'admin'
                        ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="userRole"
                      value="admin"
                      checked={userForm.role === 'admin'}
                      onChange={() => setUserForm({ ...userForm, role: 'admin' })}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="text-xs">Administrateur</div>
                      <div className="text-[10px] text-slate-500 font-normal">Contrôle total</div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Téléphone ou poste (optionnel)
                </label>
                <input
                  type="text"
                  value={userForm.telephone}
                  onChange={(e) => setUserForm({ ...userForm, telephone: e.target.value })}
                  placeholder="Ex: 06 12 34 56 78 ou Poste 204"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="userActiveCheck"
                  checked={userForm.actif}
                  onChange={(e) => setUserForm({ ...userForm, actif: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="userActiveCheck" className="font-semibold text-slate-700 cursor-pointer">
                  Compte actif (autorisé à se connecter)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs"
                >
                  {editingUser ? "Mettre à jour l'utilisateur" : "Créer l'utilisateur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Suppression Utilisateur */}
      <ConfirmModal
        isOpen={!!userToDelete}
        title="Supprimer cet utilisateur"
        message={`Êtes-vous sûr de vouloir supprimer définitivement le compte utilisateur "${userToDelete?.nom}" (${userToDelete?.username}) ?`}
        confirmLabel="Supprimer l'utilisateur"
        isDestructive={true}
        onConfirm={() => {
          if (userToDelete) {
            deleteUser(userToDelete.id);
            setUserToDelete(null);
          }
        }}
        onCancel={() => setUserToDelete(null)}
      />

      {/* MODAL: DÉTAIL DES ARTICLES SAISIS PAR UN UTILISATEUR */}
      {viewingUserEntries && (() => {
        const targetNom = (viewingUserEntries.nom || '').toLowerCase();
        const targetUser = (viewingUserEntries.username || '').toLowerCase();
        const userEntriesList = entries.filter(
          (e) => (e.operator || '').toLowerCase() === targetNom ||
                 (e.operator || '').toLowerCase() === targetUser
        );
        const q = userEntriesSearch.trim().toLowerCase();
        const filteredEntriesList = q
          ? userEntriesList.filter(
              (e) =>
                (e.code_article || '').toLowerCase().includes(q) ||
                (e.designation || '').toLowerCase().includes(q) ||
                (e.reference || '').toLowerCase().includes(q) ||
                (e.emplacement || '').toLowerCase().includes(q) ||
                (e.machine || '').toLowerCase().includes(q) ||
                (e.famille || '').toLowerCase().includes(q)
            )
          : userEntriesList;

        const totalQtyCounted = userEntriesList.reduce((sum, e) => sum + e.quantite, 0);
        const uniqueLocsCount = new Set(userEntriesList.map(e => e.emplacement).filter(Boolean)).size;
        const uniqueMachinesCount = new Set(userEntriesList.map(e => e.machine).filter(Boolean)).size;

        const handleExportUserExcel = () => {
          if (userEntriesList.length === 0) return;
          const rows = userEntriesList.map((e, idx) => ({
            'N°': idx + 1,
            'Opérateur': viewingUserEntries.nom || viewingUserEntries.username,
            'Identifiant': viewingUserEntries.username,
            'Code Article': e.code_article,
            'Désignation': e.designation,
            'Référence': e.reference || '',
            'Machine': e.machine,
            'Famille': e.famille,
            'Emplacement': e.emplacement,
            'Quantité Comptée': e.quantite,
            'Unité': e.unite || 'Pièce',
            'Qualité': e.qualite,
            'Date & Heure': new Date(e.timestamp).toLocaleString('fr-FR'),
            'Remarques': e.notes || ''
          }));
          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, `Saisies_${viewingUserEntries.username.slice(0, 15)}`);
          XLSX.writeFile(wb, `Articles_Saisis_${viewingUserEntries.username}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${
                    viewingUserEntries.role === 'admin'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-500 text-slate-950'
                  }`}>
                    {viewingUserEntries.nom ? viewingUserEntries.nom.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                        Articles saisis par {viewingUserEntries.nom}
                      </h2>
                      <span className="font-mono text-[11px] bg-slate-800 text-amber-400 px-2 py-0.5 rounded border border-slate-700">
                        @{viewingUserEntries.username}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {viewingUserEntries.role === 'admin' ? 'Administrateur' : 'Opérateur'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Traçabilité certifiée dans l'inventaire en cours · {userEntriesList.length} ligne(s) saisie(s)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportUserExcel}
                    disabled={userEntriesList.length === 0}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                    title="Télécharger la liste de cet opérateur en Excel"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Exporter Excel</span>
                  </button>
                  <button
                    onClick={() => setViewingUserEntries(null)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Metrics strip */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center shrink-0">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Articles Différents</span>
                  <span className="font-mono text-lg font-bold text-slate-900">{userEntriesList.length}</span>
                </div>
                <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200/60 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Total Pièces</span>
                  <span className="font-mono text-lg font-bold text-emerald-700">{totalQtyCounted}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Emplacements</span>
                  <span className="font-mono text-lg font-bold text-slate-900">{uniqueLocsCount}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Machines Couvertes</span>
                  <span className="font-mono text-lg font-bold text-slate-900">{uniqueMachinesCount}</span>
                </div>
              </div>

              {/* Search Toolbar */}
              <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userEntriesSearch}
                    onChange={(e) => setUserEntriesSearch(e.target.value)}
                    placeholder="Filtrer parmi les articles saisis par cet opérateur..."
                    className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-amber-500"
                  />
                  {userEntriesSearch && (
                    <button
                      onClick={() => setUserEntriesSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  <strong>{filteredEntriesList.length}</strong> / {userEntriesList.length} article(s)
                </span>
              </div>

              {/* Table of Articles */}
              <div className="overflow-y-auto flex-1 p-2 sm:p-4">
                {userEntriesList.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs">
                    <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">Aucun article saisi par cet utilisateur</p>
                    <p className="text-slate-400 mt-1">
                      Dès que cet opérateur comptera des articles, ils apparaîtront automatiquement dans cette fiche.
                    </p>
                  </div>
                ) : filteredEntriesList.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Aucun article ne correspond au filtre de recherche "{userEntriesSearch}".
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left text-xs divide-y divide-slate-100">
                      <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Code Article</th>
                          <th className="py-2.5 px-3">Désignation</th>
                          <th className="py-2.5 px-3">Machine & Famille</th>
                          <th className="py-2.5 px-3">Emplacement</th>
                          <th className="py-2.5 px-3 text-right">Quantité Saisie</th>
                          <th className="py-2.5 px-3">Qualité</th>
                          <th className="py-2.5 px-3">Date & Heure</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredEntriesList.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {entry.code_article}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800 max-w-[200px]">
                              <div className="truncate font-semibold">{entry.designation}</div>
                              {entry.reference && (
                                <div className="text-[10px] text-slate-400 font-mono truncate">
                                  Réf: {entry.reference}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                              <div className="font-medium text-slate-800">{entry.machine}</div>
                              <div className="text-[10px] text-slate-400">{entry.famille}</div>
                            </td>
                            <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                              <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                                {entry.emplacement || 'Non assigné'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                              <span className="text-amber-600 text-sm">{entry.quantite}</span>{' '}
                              <span className="text-[10px] text-slate-500 font-normal">{entry.unite}</span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                {entry.qualite}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                              {new Date(entry.timestamp).toLocaleString('fr-FR')}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <button
                                onClick={() => {
                                  if (confirm(`Supprimer la saisie de l'article ${entry.code_article} ?`)) {
                                    deleteEntry(entry.id);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Supprimer cette saisie (Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
                <span className="text-xs text-slate-500">
                  Total : <strong>{totalQtyCounted}</strong> pièces comptées réparties sur <strong>{userEntriesList.length}</strong> lignes
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportUserExcel}
                    disabled={userEntriesList.length === 0}
                    className="sm:hidden px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl"
                  >
                    Export Excel
                  </button>
                  <button
                    onClick={() => setViewingUserEntries(null)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
