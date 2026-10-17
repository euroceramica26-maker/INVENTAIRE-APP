import React, { useState } from 'react';
import { Shield, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
  onSuccess?: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  message,
  onSuccess
}) => {
  const { loginAdmin } = useInventory();
  const [login, setLogin] = useState('ouaradtech');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const ok = loginAdmin(login.trim(), password);
      if (ok) {
        setPassword('');
        setError(null);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setError('Identifiant ou mot de passe administrateur incorrect.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = () => {
    setLogin('ouaradtech');
    setPassword('Ouaradtech26@');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header with security banner */}
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>Espace Administrateur</span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">
                  Contrôle Total
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Authentification requise pour modification & suppression
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative message if triggered by restricted action */}
        {message && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200/80 flex items-center gap-2 text-xs text-amber-900">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Identifiant Administrateur
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="ouaradtech"
              required
              autoFocus
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Mot de passe
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-900 pr-10 focus:bg-white focus:border-amber-500 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Quick Auto-fill button for authorized user */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleFillDemo}
              className="text-[11px] text-slate-500 hover:text-amber-600 underline"
            >
              Remplir identifiants administrateur
            </button>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Se Connecter en Administrateur</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
