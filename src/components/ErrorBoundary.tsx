import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Download, RotateCcw, ShieldAlert } from 'lucide-react';
import { exportFullJsonBackup } from '../utils/storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CRITICAL UNCAUGHT ERROR in Inventory App:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetState = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleBackup = () => {
    try {
      exportFullJsonBackup();
    } catch (e) {
      console.error('Failed to export backup during crash:', e);
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white">Une erreur inattendue est survenue</h1>
                <p className="text-sm text-slate-400">
                  Le système a intercepté l'incident pour protéger vos données d'inventaire.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-mono text-rose-300 overflow-x-auto max-h-40">
              <p className="font-bold">{this.state.error?.name || 'Error'}: {this.state.error?.message || 'Erreur inconnue'}</p>
              {this.state.error?.stack && (
                <pre className="mt-2 text-[10px] text-slate-500 whitespace-pre-wrap">{this.state.error.stack.slice(0, 500)}...</pre>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Recharger l'application</span>
                </button>
                <button
                  type="button"
                  onClick={this.handleResetState}
                  className="px-4 py-3 bg-slate-700 hover:bg-slate-600 active:scale-98 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Tenter de reprendre</span>
                </button>
              </div>

              <button
                type="button"
                onClick={this.handleBackup}
                className="w-full px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger une sauvegarde de secours locale (JSON)</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              Vos comptages et bases de données locales et serveur sont conservés.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
