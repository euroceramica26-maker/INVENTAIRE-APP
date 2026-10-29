import React, { useState, useEffect } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { ThemeProvider } from './context/ThemeContext';
import { Header, ActiveTab } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { CatalogView } from './components/CatalogView';
import { LocationsMachinesView } from './components/LocationsMachinesView';
import { ExportView } from './components/ExportView';
import { AdminView } from './components/AdminView';
import { AdminLoginModal } from './components/AdminLoginModal';
import { ScannerModal } from './components/ScannerModal';
import { InventoryEntryModal } from './components/InventoryEntryModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { LoginScreen } from './components/LoginScreen';
import { UserManagementView } from './components/UserManagementView';
import { Article, InventoryEntry } from './types/inventory';
import { ParsedScannedInfo } from './utils/scanParser';
import {
  ScanLine,
  LayoutDashboard,
  FileSpreadsheet,
  Settings,
  Download,
  Shield,
  Plus,
  Users
} from 'lucide-react';

function AuthenticatedApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const {
    isAdminLoginModalOpen,
    setIsAdminLoginModalOpen,
    adminActionMessage,
    isAdmin,
    entries
  } = useInventory();

  // Strict route guard: standard user accounts ONLY have the right to Comptage & Saisie
  useEffect(() => {
    if (!isAdmin && activeTab !== 'dashboard') {
      setActiveTab('dashboard');
    }
  }, [isAdmin, activeTab]);

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<InventoryEntry | null>(null);

  // When article is identified via QR or OCR
  const handleSelectArticleFromScanner = (
    article: Article,
    _scannedCode?: string,
    existingEntry?: InventoryEntry
  ) => {
    setSelectedArticle(article);
    setSelectedEntry(existingEntry || null);
    setIsEntryModalOpen(true);
  };

  // When code scanned is unknown or parsed as a new article
  const handleCodeNotFound = (scannedCode: string, parsedData?: ParsedScannedInfo) => {
    const tempArticle: Article = {
      id: `art-new-${Date.now()}`,
      code_article: parsedData?.code_article || scannedCode,
      designation: parsedData?.designation || `Nouvel article (${parsedData?.code_article || scannedCode})`,
      reference: parsedData?.reference || parsedData?.code_article || scannedCode,
      famille: parsedData?.famille || 'Général',
      machine: parsedData?.machine || 'Standard',
      position: '',
      unite: parsedData?.unite || 'Pièce',
      emplacement: parsedData?.emplacement || '',
      quantite: typeof parsedData?.quantite === 'number' ? parsedData.quantite : 0,
      status: 'saisi'
    };
    setSelectedArticle(tempArticle);
    setSelectedEntry(null);
    setIsEntryModalOpen(true);
  };

  const handleCountArticle = (article: Article) => {
    setSelectedArticle(article);
    setSelectedEntry(null);
    setIsEntryModalOpen(true);
  };

  const handleOpenManualEntry = (initialCodeOrName = '') => {
    const tempArticle: Article = {
      id: `manual-${Date.now()}`,
      code_article: initialCodeOrName.trim(),
      designation: initialCodeOrName.trim(),
      reference: '',
      famille: 'Général',
      machine: 'Standard',
      position: '',
      unite: 'Pièce',
      emplacement: '',
      quantite: 0,
      status: 'saisi'
    };
    setSelectedArticle(tempArticle);
    setSelectedEntry(null);
    setIsEntryModalOpen(true);
  };

  const handleEditEntry = (entry: InventoryEntry) => {
    setSelectedEntry(entry);
    setSelectedArticle(null);
    setIsEntryModalOpen(true);
  };

  const handleSaveAndNext = () => {
    setIsEntryModalOpen(false);
    // Immediately reopen scanner for seamless scanning workflow
    setTimeout(() => {
      setIsScannerOpen(true);
    }, 200);
  };

  // Strict Role Guard: Les comptes utilisateurs ont SEULEMENT le droit Comptage & Saisie
  useEffect(() => {
    if (!isAdmin && activeTab !== 'dashboard') {
      setActiveTab('dashboard');
    }
  }, [isAdmin, activeTab]);

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors duration-150">
      {/* Menu Navigation Vertical (Sidebar) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
      />

      {/* Main App Layout Container */}
      <div className={`flex-1 min-w-0 flex flex-col min-h-screen ${isAdmin ? 'pb-20 lg:pb-8' : 'pb-8'}`}>
        {/* Top Bar Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenScanner={() => setIsScannerOpen(true)}
          onOpenImport={() => setIsImportOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Main Content Area (Comptage & Saisie pour utilisateurs, Vues complètes pour Admin) */}
        <main className="flex-1 w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenImport={() => setIsImportOpen(true)}
            onOpenExport={() => setActiveTab('export')}
            onSelectArticleToCount={handleCountArticle}
            onEditEntry={handleEditEntry}
            onOpenManualEntry={handleOpenManualEntry}
          />
        )}

        {isAdmin && activeTab === 'catalog' && (
          <CatalogView
            onOpenImport={() => setIsImportOpen(true)}
            onCountArticle={handleCountArticle}
          />
        )}

        {isAdmin && activeTab === 'locations' && (
          <LocationsMachinesView
            onOpenImport={() => setIsImportOpen(true)}
          />
        )}

        {isAdmin && activeTab === 'export' && (
          <ExportView />
        )}

        {isAdmin && activeTab === 'users' && (
          <UserManagementView onNavigateToTab={(tab) => setActiveTab(tab as ActiveTab)} />
        )}

        {isAdmin && activeTab === 'admin' && (
          <AdminView />
        )}
      </main>
    </div>

      {/* Mobile Ergonomic Bottom Tab Bar: Uniquement visible pour l'administrateur */}
      {isAdmin && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 transition-colors">
          <div className="grid grid-cols-6 items-center h-16 max-w-lg mx-auto px-1">
          {/* Tab 1: Saisie */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors relative ${
              activeTab === 'dashboard' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-[9px] mt-1 font-medium">Saisie</span>
            {entries.length > 0 && (
              <span className="absolute top-1 right-2 bg-emerald-500 text-white text-[9px] px-1 rounded-full font-bold">
                {entries.length}
              </span>
            )}
          </button>

          {/* Tab 2: Articles */}
          <button
            onClick={() => setActiveTab('catalog')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'catalog' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="text-[9px] mt-1 font-medium">Articles</span>
          </button>

          {/* Tab 3: Machines */}
          <button
            onClick={() => setActiveTab('locations')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'locations' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="text-[9px] mt-1 font-medium">Machines</span>
          </button>

          {/* Tab 4: Exports */}
          <button
            onClick={() => setActiveTab('export')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'export' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Download className="w-4 h-4" />
            <span className="text-[9px] mt-1 font-medium">Exports</span>
          </button>

          {/* Tab 5: Utilisateurs */}
          <button
            onClick={() => setActiveTab('users')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'users' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="text-[9px] mt-1 font-medium">Utilisateurs</span>
          </button>

          {/* Tab 6: Admin */}
          <button
            onClick={() => setActiveTab('admin')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors relative ${
              activeTab === 'admin' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span className="text-[9px] mt-1 font-medium">Admin</span>
            {isAdmin && (
              <span className="absolute top-2 right-3 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>
        </div>
      </div>
      )}

      {/* Floating Center Scan Button on Mobile */}
      <div className="md:hidden fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setIsScannerOpen(true)}
          className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold flex items-center justify-center shadow-lg shadow-amber-500/30 transition-transform"
          aria-label="Scanner QR ou OCR"
        >
          <ScanLine className="w-6 h-6" />
        </button>
      </div>

      {/* Modals */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSelectArticle={handleSelectArticleFromScanner}
        onCodeNotFound={handleCodeNotFound}
      />

      <InventoryEntryModal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        article={selectedArticle}
        existingEntry={selectedEntry}
        onSaveAndNext={handleSaveAndNext}
      />

      <ExcelImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />

      {/* Admin Login Modal for Total Control & Restricting Modifications / Deletions */}
      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => setIsAdminLoginModalOpen(false)}
        message={adminActionMessage}
      />
    </div>
  );
}

function InventoryApp() {
  const { currentUser } = useInventory();

  // If no user is logged in, show mandatory login screen on startup
  if (!currentUser) {
    return <LoginScreen />;
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <ThemeProvider>
      <InventoryProvider>
        <InventoryApp />
      </InventoryProvider>
    </ThemeProvider>
  );
}
