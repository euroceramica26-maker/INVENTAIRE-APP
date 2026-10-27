import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  X,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

interface ClearDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
}

export const ClearDatabaseModal: React.FC<ClearDatabaseModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Vider toute la base de données",
  message = "Attention : Cette action va effacer définitivement tous les articles du catalogue, toutes les saisies d'inventaire, ainsi que les machines, familles et emplacements enregistrés pour repartir d'une base 100% vierge."
}) => {
  const { verifyAdminPassword, articles, entries } = useInventory();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setIsSuccess(false);
      setShowPassword(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPwd = password.trim();
    if (!cleanPwd) {
      setError("Le mot de passe administrateur est obligatoire pour vider la base.");
      inputRef.current?.focus();
      return;
    }

    const isValid = verifyAdminPassword(cleanPwd);
    if (!isValid) {
      setError("Mot de passe administrateur incorrect. Action refusée pour protéger vos données.");
      inputRef.current?.focus();
      return;
    }

    // Success: Admin authorization confirmed
    setIsSuccess(true);
    setTimeout(() => {
      onConfirm();
      onClose();
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/60 overflow-hidden flex flex-col">
        {/* Header with Red Warning Accent */}
        <div className="bg-rose-600 dark:bg-rose-900/80 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-white">{title}</h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-rose-950 text-rose-200 px-2 py-0.5 rounded-full">
                  Admin Requis
                </span>
              </div>
              <p className="text-xs text-rose-100 mt-0.5">
                Authentification administrateur obligatoire
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-rose-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Warning Banner */}
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Opération Critique & Irréversible</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {message}
            </p>
            <div className="pt-2 border-t border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Articles catalogue à effacer : <strong className="text-slate-900 dark:text-white font-mono">{articles.length}</strong></span>
              <span>Saisies d'inventaire : <strong className="text-slate-900 dark:text-white font-mono">{entries.length}</strong></span>
            </div>
          </div>

          {/* Password Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>Mot de passe administrateur :</span>
              </label>
              <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">
                Obligatoire
              </span>
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Entrez le mot de passe administrateur..."
                className={`w-full pl-3.5 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-all ${
                  error
                    ? 'border-rose-500 ring-2 ring-rose-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus:border-rose-500 dark:focus:border-rose-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error ? (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5 animate-in fade-in duration-100">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Saisissez le mot de passe du compte administrateur (<code className="font-mono text-slate-700 dark:text-slate-300">ouaradtech</code>) pour déverrouiller la suppression.
              </p>
            )}
          </div>

          {/* Success indication */}
          {isSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Autorisation validée. Réinitialisation en cours...</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSuccess}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Annuler (Conserver mes données)
            </button>
            <button
              type="submit"
              disabled={!password.trim() || isSuccess}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Confirmer et Vider la Base</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
