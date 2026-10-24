import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  User,
  Shield,
  Key,
  Lock,
  Unlock,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Calendar,
  Clock,
  X,
  FileSpreadsheet,
  Package,
  Check,
  AlertCircle,
  MoreVertical,
  RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useInventory } from '../context/InventoryContext';
import { AppUser, UserRole } from '../types/inventory';
import { ConfirmModal } from './ConfirmModal';
import { downloadWorkbook, safeAppendSheet } from '../utils/excelExport';

interface UserManagementViewProps {
  onNavigateToTab?: (tab: string) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = () => {
  const {
    users,
    createUser,
    updateUser,
    deleteUser,
    toggleUserActive,
    isAdmin,
    adminUser,
    setIsAdminLoginModalOpen,
    entries,
    currentUser,
    deleteEntry
  } = useInventory();

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'operateur'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'actif' | 'inactif'>('all');

  // Modal states for Create / Edit User
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [showPasswordInForm, setShowPasswordInForm] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    nom: '',
    motDePasse: '',
    role: 'operateur' as UserRole,
    actif: true,
    telephone: ''
  });
  const [userModalError, setUserModalError] = useState<string | null>(null);

  // Quick Password Reset Modal state
  const [passwordResetUser, setPasswordResetUser] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);

  // Delete User Confirmation Modal state
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);

  // Viewing User Entries Modal state
  const [viewingUserEntries, setViewingUserEntries] = useState<AppUser | null>(null);
  const [userEntriesSearch, setUserEntriesSearch] = useState('');

  // Password visibility map for the table rows
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // KPIs
  const totalUsers = users.length;
  const activeOperators = users.filter((u) => u.role === 'operateur' && u.actif).length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const totalAssignedEntries = entries.filter((e) => e.operator && e.operator !== '-').length;

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;

      // Status filter
      if (statusFilter === 'actif' && !u.actif) return false;
      if (statusFilter === 'inactif' && u.actif) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesName = (u.nom || '').toLowerCase().includes(q);
        const matchesUser = (u.username || '').toLowerCase().includes(q);
        const matchesPhone = (u.telephone || '').toLowerCase().includes(q);
        const matchesRole = u.role.toLowerCase().includes(q);
        if (!matchesName && !matchesUser && !matchesPhone && !matchesRole) {
          return false;
        }
      }

      return true;
    });
  }, [users, roleFilter, statusFilter, searchTerm]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingUser(null);
    setUserForm({
      username: '',
      nom: '',
      motDePasse: '',
      role: 'operateur',
      actif: true,
      telephone: ''
    });
    setShowPasswordInForm(false);
    setUserModalError(null);
    setIsUserModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (user: AppUser) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      nom: user.nom,
      motDePasse: user.motDePasse,
      role: user.role,
      actif: user.actif,
      telephone: user.telephone || ''
    });
    setShowPasswordInForm(false);
    setUserModalError(null);
    setIsUserModalOpen(true);
  };

  // Save Create or Edit
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserModalError(null);

    const cleanUsername = userForm.username.trim().toLowerCase();
    const cleanNom = userForm.nom.trim();
    const cleanPwd = userForm.motDePasse.trim();

    if (!cleanUsername) {
      setUserModalError("L'identifiant de connexion (login) est obligatoire.");
      return;
    }
    if (!cleanNom) {
      setUserModalError("Le nom complet de l'utilisateur est obligatoire.");
      return;
    }
    if (!cleanPwd || cleanPwd.length < 2) {
      setUserModalError("Le mot de passe doit comporter au moins 2 caractères.");
      return;
    }

    if (editingUser) {
      const res = updateUser({
        ...editingUser,
        username: cleanUsername,
        nom: cleanNom,
        motDePasse: cleanPwd,
        role: userForm.role,
        actif: userForm.actif,
        telephone: userForm.telephone?.trim()
      });
      if (!res.success) {
        setUserModalError(res.message || "Erreur lors de la mise à jour de l'utilisateur.");
        return;
      }
    } else {
      const res = createUser({
        username: cleanUsername,
        nom: cleanNom,
        motDePasse: cleanPwd,
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

  // Quick Password Reset Submit
  const handleSavePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetUser || !newPassword.trim()) return;

    const res = updateUser({
      ...passwordResetUser,
      motDePasse: newPassword.trim()
    });

    if (res.success) {
      setPasswordResetSuccess(true);
      setTimeout(() => {
        setPasswordResetSuccess(false);
        setPasswordResetUser(null);
        setNewPassword('');
      }, 1200);
    }
  };

  // If user is not admin, show protection screen
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl p-8 border border-slate-200 text-center shadow-lg">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <Shield className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Option Réservée à l'Administrateur
        </h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          Le menu de gestion des utilisateurs permet de créer, modifier et configurer les comptes des opérateurs de saisie. Connectez-vous avec vos identifiants administrateur pour y accéder.
        </p>

        <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 max-w-sm mx-auto text-left space-y-1.5 font-medium">
          <div className="flex items-center justify-between">
            <span>Identifiant admin :</span>
            <code className="bg-white px-2 py-0.5 rounded font-bold text-slate-900 border border-slate-200">ouaradtech</code>
          </div>
          <div className="flex items-center justify-between">
            <span>Mot de passe :</span>
            <code className="bg-white px-2 py-0.5 rounded font-mono font-bold text-slate-900 border border-slate-200">Ouaradtech26@</code>
          </div>
        </div>

        <button
          onClick={() => setIsAdminLoginModalOpen(true)}
          className="mt-6 px-6 py-3 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-sm rounded-xl inline-flex items-center gap-2 shadow-md transition-all cursor-pointer"
        >
          <Lock className="w-4 h-4" />
          <span>Se Connecter en Administrateur</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. HERO HEADER BANNER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xl shadow-xs shrink-0 mt-0.5">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Menu de Gestion des Utilisateurs
              </h1>
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                Accès Administrateur Actif
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              Options complètes : Créez des comptes pour les opérateurs de saisie, modifiez leurs informations, gérez leurs mots de passe, et vérifiez avec précision les articles saisis par chacun.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 flex-wrap sm:flex-nowrap">
          <button
            onClick={handleOpenCreate}
            className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Créer un Utilisateur</span>
          </button>
        </div>
      </div>

      {/* 2. STATS & KPIS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Total Utilisateurs</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 block">
            {totalUsers}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Comptes configurés dans l'app
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-xs font-semibold">Opérateurs Actifs</span>
            <User className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-600 block">
            {activeOperators}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Autorisés pour le comptage
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs font-semibold">Administrateurs</span>
            <Shield className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-600 block">
            {adminCount}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Contrôle total & gestion
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-blue-700 mb-1">
            <span className="text-xs font-semibold">Lignes Saisies Traçables</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-2xl sm:text-3xl font-bold font-mono text-blue-600 block">
            {totalAssignedEntries}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Rattachées à un opérateur
          </span>
        </div>
      </div>

      {/* 3. TOOLBAR: SEARCH & FILTER TABS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom, identifiant (login), téléphone..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-amber-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
              roleFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tous ({totalUsers})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('operateur')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 flex items-center gap-1 ${
              roleFilter === 'operateur'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Opérateurs ({users.filter((u) => u.role === 'operateur').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('admin')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 flex items-center gap-1 ${
              roleFilter === 'admin'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admins ({adminCount})</span>
          </button>

          <span className="text-slate-300">|</span>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 font-semibold"
          >
            <option value="all">Tous les statuts</option>
            <option value="actif">Comptes Actifs</option>
            <option value="inactif">Comptes Désactivés</option>
          </select>
        </div>
      </div>

      {/* 4. MAIN USERS TABLE & OPTIONS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Aucun utilisateur trouvé</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Modifiez vos critères de recherche ou cliquez sur "+ Créer un Utilisateur" pour en ajouter un nouveau.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Créer un Utilisateur</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-100">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="py-3 px-4">Utilisateur / Profil</th>
                  <th className="py-3 px-4">Identifiant (Login)</th>
                  <th className="py-3 px-4">Mot de Passe</th>
                  <th className="py-3 px-4">Rôle</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4">Articles Saisis</th>
                  <th className="py-3 px-4">Dernière Connexion</th>
                  <th className="py-3 px-4 text-right">Options de Gestion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsers.map((u) => {
                  const targetNom = (u.nom || '').toLowerCase();
                  const targetUser = (u.username || '').toLowerCase();
                  const userEntries = entries.filter(
                    (e) =>
                      (e.operator || '').toLowerCase() === targetNom ||
                      (e.operator || '').toLowerCase() === targetUser
                  );
                  const totalQty = userEntries.reduce((sum, e) => sum + e.quantite, 0);
                  const isMainAdmin = u.username.toLowerCase() === 'ouaradtech';
                  const isPasswordVisible = !!visiblePasswords[u.id];

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !u.actif ? 'bg-slate-50/50 opacity-70' : ''
                      }`}
                    >
                      {/* 1. Utilisateur / Profil */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              u.role === 'admin'
                                ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {u.nom ? u.nom.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{u.nom}</span>
                              {currentUser && currentUser.id === u.id && (
                                <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                                  Vous
                                </span>
                              )}
                            </div>
                            {u.telephone ? (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{u.telephone}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Créé le {new Date(u.dateCreation).toLocaleDateString('fr-FR')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Login (Identifiant) */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="bg-slate-100 px-2 py-1 rounded-md border border-slate-200 text-xs">
                          {u.username}
                        </span>
                      </td>

                      {/* 3. Mot de passe masqué avec bouton afficher */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            {isPasswordVisible ? u.motDePasse : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                            title={isPasswordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                          >
                            {isPasswordVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPasswordResetUser(u);
                              setNewPassword('');
                              setPasswordResetSuccess(false);
                            }}
                            className="p-1 text-slate-400 hover:text-amber-600 rounded transition-colors"
                            title="Changer rapidement le mot de passe"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* 4. Rôle */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            <Shield className="w-3 h-3 text-amber-600" />
                            Administrateur
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            <User className="w-3 h-3 text-emerald-600" />
                            Comptage & Saisie
                          </span>
                        )}
                      </td>

                      {/* 5. Statut Actif / Inactif */}
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

                      {/* 6. Articles Saisis (Bouton d'inspection traçabilité) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setUserEntriesSearch('');
                            setViewingUserEntries(u);
                          }}
                          className="text-left group cursor-pointer"
                          title="Cliquer pour afficher la liste des articles inventoriés par cet utilisateur"
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

                      {/* 7. Dernière Connexion */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                        {u.lastLogin ? (
                          <div>
                            <div className="font-medium text-slate-700">
                              {new Date(u.lastLogin).toLocaleDateString('fr-FR')}
                            </div>
                            <div className="text-slate-400 font-mono text-[10px]">
                              {new Date(u.lastLogin).toLocaleTimeString('fr-FR')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Jamais connecté</span>
                        )}
                      </td>

                      {/* 8. Menu d'options & Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Option 1: Voir articles saisis */}
                          <button
                            type="button"
                            onClick={() => {
                              setUserEntriesSearch('');
                              setViewingUserEntries(u);
                            }}
                            className="px-2 py-1 text-slate-700 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold border border-slate-200 hover:border-amber-300"
                            title="Voir la liste détaillée des articles saisis par cet opérateur"
                          >
                            <Eye className="w-3.5 h-3.5 text-amber-600" />
                            <span>Articles ({userEntries.length})</span>
                          </button>

                          {/* Option 2: Modifier utilisateur */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Modifier ce profil utilisateur"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Option 3: Réinitialiser mot de passe */}
                          <button
                            type="button"
                            onClick={() => {
                              setPasswordResetUser(u);
                              setNewPassword('');
                              setPasswordResetSuccess(false);
                            }}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Modifier le mot de passe"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          {/* Option 4: Activer / Désactiver (sauf admin principal) */}
                          {!isMainAdmin && (
                            <button
                              type="button"
                              onClick={() => toggleUserActive(u.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                u.actif
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={u.actif ? "Désactiver ce compte (bloquer l'accès)" : "Activer ce compte"}
                            >
                              {u.actif ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5 text-emerald-600" />}
                            </button>
                          )}

                          {/* Option 5: Supprimer (sauf admin principal) */}
                          {!isMainAdmin && (
                            <button
                              type="button"
                              onClick={() => setUserToDelete(u)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Supprimer cet utilisateur"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. MODAL: CRÉER / MODIFIER UTILISATEUR */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  {editingUser ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {editingUser ? "Modifier le compte utilisateur" : "Créer un nouvel utilisateur"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {editingUser
                      ? `Modification des accès de @${editingUser.username}`
                      : "Création d'un opérateur de saisie ou administrateur"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUserModalOpen(false);
                  setEditingUser(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="p-6 space-y-4 text-xs">
              {userModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{userModalError}</span>
                </div>
              )}

              {/* Login / Identifiant */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Identifiant de connexion (Login) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold">@</span>
                  <input
                    type="text"
                    required
                    value={userForm.username}
                    onChange={(e) =>
                      setUserForm({ ...userForm, username: e.target.value.toLowerCase().replace(/\s+/g, '') })
                    }
                    placeholder="ex: saisie3, ahmed, mag1"
                    disabled={editingUser?.username.toLowerCase() === 'ouaradtech'}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold focus:outline-hidden focus:border-amber-500 disabled:opacity-60"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Identifiant unique utilisé lors du login obligatoire au démarrage.
                </p>
              </div>

              {/* Nom Complet */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nom complet / Désignation *
                </label>
                <input
                  type="text"
                  required
                  value={userForm.nom}
                  onChange={(e) => setUserForm({ ...userForm, nom: e.target.value })}
                  placeholder="ex: Ahmed Mansouri (Équipe Ligne 2)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-hidden focus:border-amber-500"
                />
              </div>

              {/* Mot de passe */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mot de passe *
                </label>
                <div className="relative">
                  <input
                    type={showPasswordInForm ? 'text' : 'password'}
                    required
                    value={userForm.motDePasse}
                    onChange={(e) => setUserForm({ ...userForm, motDePasse: e.target.value })}
                    placeholder="Mot de passe de session"
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-medium focus:outline-hidden focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordInForm(!showPasswordInForm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showPasswordInForm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Rôle */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Rôle & Droits d'accès *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUserForm({ ...userForm, role: 'operateur' })}
                    disabled={editingUser?.username.toLowerCase() === 'ouaradtech'}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      userForm.role === 'operateur'
                        ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                      <User className="w-4 h-4 text-emerald-600" />
                      <span>Opérateur</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Comptage & Saisie uniquement (aucun accès gestion/admin)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserForm({ ...userForm, role: 'admin' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      userForm.role === 'admin'
                        ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                      <Shield className="w-4 h-4 text-amber-600" />
                      <span>Administrateur</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Contrôle total & gestion
                    </div>
                  </button>
                </div>
              </div>

              {/* Téléphone (optionnel) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Téléphone / Poste interne (Optionnel)
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userForm.telephone}
                    onChange={(e) => setUserForm({ ...userForm, telephone: e.target.value })}
                    placeholder="Ex: 06 12 34 56 78 ou Poste 204"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Statut Actif */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="userActiveToggle"
                  checked={userForm.actif}
                  onChange={(e) => setUserForm({ ...userForm, actif: e.target.checked })}
                  disabled={editingUser?.username.toLowerCase() === 'ouaradtech'}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="userActiveToggle" className="font-semibold text-slate-700 cursor-pointer">
                  Compte actif (autorisé à se connecter à l'application)
                </label>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
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
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {editingUser ? "Enregistrer les modifications" : "Créer l'utilisateur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: RÉINITIALISATION RAPIDE DU MOT DE PASSE */}
      {passwordResetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                  <Key className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Changer le mot de passe</h3>
                  <p className="text-xs text-slate-400">Pour {passwordResetUser.nom} (@{passwordResetUser.username})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordResetUser(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePasswordReset} className="p-6 space-y-4 text-xs">
              {passwordResetSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">Mot de passe mis à jour avec succès !</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nouveau mot de passe pour cet utilisateur *
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Saisissez le nouveau mot de passe"
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-medium focus:outline-hidden focus:border-amber-500 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  L'opérateur utilisera ce nouveau mot de passe pour se connecter au prochain démarrage.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasswordResetUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!newPassword.trim()}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl shadow-xs"
                >
                  Valider le mot de passe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: DÉTAIL DES ARTICLES SAISIS PAR UN UTILISATEUR */}
      {viewingUserEntries && (() => {
        const targetNom = (viewingUserEntries.nom || '').toLowerCase();
        const targetUser = (viewingUserEntries.username || '').toLowerCase();
        const userEntriesList = entries.filter(
          (e) =>
            (e.operator || '').toLowerCase() === targetNom ||
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
        const uniqueLocsCount = new Set(userEntriesList.map((e) => e.emplacement).filter(Boolean)).size;
        const uniqueMachinesCount = new Set(userEntriesList.map((e) => e.machine).filter(Boolean)).size;

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
          safeAppendSheet(wb, ws, `Saisies_${viewingUserEntries.username.slice(0, 15)}`);
          downloadWorkbook(
            wb,
            `Articles_Saisis_${viewingUserEntries.username}_${new Date().toISOString().slice(0, 10)}.xlsx`
          );
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${
                      viewingUserEntries.role === 'admin'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-emerald-500 text-slate-950'
                    }`}
                  >
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
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
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
                  Total : <strong>{totalQtyCounted}</strong> pièces comptées réparties sur{' '}
                  <strong>{userEntriesList.length}</strong> lignes
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

      {/* 8. CONFIRMATION DE SUPPRESSION D'UTILISATEUR */}
      <ConfirmModal
        isOpen={!!userToDelete}
        title="Supprimer cet utilisateur"
        message={`Êtes-vous sûr de vouloir supprimer définitivement le compte utilisateur "${userToDelete?.nom}" (@${userToDelete?.username}) ?`}
        confirmLabel="Supprimer définitivement"
        isDestructive={true}
        onConfirm={() => {
          if (userToDelete) {
            deleteUser(userToDelete.id);
            setUserToDelete(null);
          }
        }}
        onCancel={() => setUserToDelete(null)}
      />
    </div>
  );
};
