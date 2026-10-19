import React, { useState } from 'react';
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  ScanLine,
  ArrowRight,
  CheckCircle2,
  Users
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

export const LoginScreen: React.FC = () => {
  const { loginUser, users } = useInventory();
  const [username, setUsername] = useState('ouaradtech');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError("Veuillez saisir votre identifiant.");
      return;
    }
    if (!password) {
      setError("Veuillez saisir votre mot de passe.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = loginUser(username, password);
      if (!result.success) {
        setError(result.message || "Identifiant ou mot de passe incorrect.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = (userLogin: string, userPwd: string) => {
    setUsername(userLogin);
    setPassword(userPwd);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-md">
        {/* Brand & App Identity */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500 text-slate-950 font-black shadow-xl shadow-amber-500/20 mb-4 border border-amber-400">
            <ScanLine className="w-9 h-9" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Inventaire Pro
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Système Industriel de Comptage & Traçabilité
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-full">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Authentification obligatoire au démarrage</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 backdrop-blur-md rounded-3xl border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Connexion Opérateur</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Identifiez-vous pour attribuer chaque saisie d'inventaire à votre nom.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                Identifiant utilisateur *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex: ouaradtech, saisie1..."
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-medium placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                Mot de passe *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-medium placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer mt-2"
            >
              <span>Démarrer la session d'inventaire</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick User Selection Panel */}
          <div className="pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Sélection rapide du compte :</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {users.filter(u => u.actif).length} actif(s)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left max-h-48 overflow-y-auto pr-1">
              {users
                .filter((u) => u.actif)
                .map((u) => {
                  const isSelected = username.toLowerCase() === u.username.toLowerCase();
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleFillDemo(u.username, u.motDePasse)}
                      className={`p-2.5 rounded-xl border text-left transition-all group cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800 border-amber-500 ring-1 ring-amber-500/30'
                          : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs truncate">
                          {u.role === 'admin' ? (
                            <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                          <span className={u.role === 'admin' ? 'text-amber-400 truncate' : 'text-emerald-400 truncate'}>
                            {u.nom || u.username}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-500 group-hover:text-amber-400 shrink-0 ml-1">
                          Sélectionner
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 font-mono mt-1 truncate">
                        Login: {u.username}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {u.role === 'admin' ? 'Administrateur (Contrôle total)' : 'Opérateur de saisie'}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-slate-500 space-y-1">
          <p>L'administrateur peut créer et gérer les comptes utilisateurs dans le menu Administration.</p>
          <p className="text-[11px] text-slate-600">Version 5.2 · Traçabilité par opérateur certifiée</p>
        </div>
      </div>
    </div>
  );
};
