import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Supprimer définitivement',
  cancelLabel = 'Annuler',
  isDestructive = true,
  onConfirm,
  onCancel
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isDestructive ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
            }`}>
              {isDestructive ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {message}
        </div>

        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950/70 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            className={`px-4 py-2 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {isDestructive && <Trash2 className="w-3.5 h-3.5" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
