import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { createWorker } from 'tesseract.js';
import {
  Camera,
  X,
  ScanLine,
  FileText,
  Upload,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Database,
  MapPin,
  Cpu,
  Package,
  Layers,
  Sparkles,
  Check,
  RotateCw,
  Trash2,
  Plus,
  Minus,
  ListPlus,
  CheckCheck,
  Zap,
  Volume2,
  VolumeX,
  AlertTriangle
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Article, InventoryEntry, QualiteEtat, EmplacementItem } from '../types/inventory';
import { ScanMatchResult, ParsedScannedInfo } from '../utils/scanParser';
import { QUALITE_LABELS } from '../utils/excelExport';

export interface QueuedBatchItem {
  id: string;
  rawCode: string;
  articleId?: string;
  code_article: string;
  designation: string;
  reference: string;
  famille: string;
  machine: string;
  position: string;
  emplacement: string;
  unite: string;
  quantite: number;
  qualite: QualiteEtat;
  notes: string;
  isKnown: boolean;
  timestamp: string;
  scanCount: number;
}

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectArticle: (article: Article, scannedCode?: string, existingEntry?: InventoryEntry) => void;
  onCodeNotFound: (scannedCode: string, parsedData?: ParsedScannedInfo) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onSelectArticle,
  onCodeNotFound
}) => {
  const {
    matchScannedArticle,
    articles,
    entries,
    locations,
    lastLocation,
    setLastLocation,
    operator,
    currentUser,
    addArticle,
    addOrUpdateEntry
  } = useInventory();

  // Tab: QR / Barcode vs OCR text recognition
  const [activeTab, setActiveTab] = useState<'qr' | 'ocr'>('qr');

  // Scan Mode: 'single' (inspect & open entry modal) vs 'batch' (continuous queuing)
  const [scanMode, setScanMode] = useState<'single' | 'batch'>('batch');

  // Continuous Batch Queue
  const [batchQueue, setBatchQueue] = useState<QueuedBatchItem[]>([]);
  const [batchDefaultLocation, setBatchDefaultLocation] = useState<string>('');
  const [recentScanFlash, setRecentScanFlash] = useState<{
    code: string;
    name: string;
    qty: number;
    isIncrement: boolean;
  } | null>(null);
  const [batchSaveSuccess, setBatchSaveSuccess] = useState<{ count: number; totalUnits: number } | null>(null);
  const [manualBatchCode, setManualBatchCode] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState<boolean>(false);

  // Debounce refs for batch scanning
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scanner state (Single mode)
  const [qrScanning, setQrScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [scanMatch, setScanMatch] = useState<ScanMatchResult | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // OCR state
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrText, setOcrText] = useState<string>('');
  const [detectedTokens, setDetectedTokens] = useState<{
    token: string;
    article?: Article;
    matchResult?: ScanMatchResult;
  }[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef<boolean>(false);

  // Auto-load countdown timer ref for single mode
  const autoLoadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [autoLoadCountdown, setAutoLoadCountdown] = useState<number | null>(null);

  // Initialize batch default location
  useEffect(() => {
    if (isOpen) {
      if (!batchDefaultLocation) {
        if (lastLocation && lastLocation !== 'Non renseigné' && lastLocation !== 'Non assigné') {
          setBatchDefaultLocation(lastLocation);
        } else if (locations.length > 0) {
          setBatchDefaultLocation(locations[0].code);
        }
      }
    }
  }, [isOpen, lastLocation, locations, batchDefaultLocation]);

  // Audio & haptic feedback on detection
  const playBeep = (success = true) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = success ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(success ? 880 : 440, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // AudioContext might be blocked before user gesture
    }
  };

  const cancelAutoLoad = () => {
    if (autoLoadTimerRef.current) {
      clearTimeout(autoLoadTimerRef.current);
      autoLoadTimerRef.current = null;
    }
    setAutoLoadCountdown(null);
  };

  // Start QR scanning
  const startQrScanner = async () => {
    setCameraError(null);
    setScannedResult(null);
    setScanMatch(null);
    setBatchSaveSuccess(null);
    cancelAutoLoad();

    // Ensure container exists in DOM before instantiating scanner
    const container = document.getElementById('qr-reader-container');
    if (!container) {
      setTimeout(() => {
        if (isOpen && activeTab === 'qr') {
          startQrScanner();
        }
      }, 80);
      return;
    }

    try {
      if (html5QrCodeRef.current) {
        const prevScanner = html5QrCodeRef.current;
        html5QrCodeRef.current = null;
        try {
          if (prevScanner.isScanning) {
            await prevScanner.stop();
          }
          await prevScanner.clear();
        } catch {
          // ignore previous stop/clear error
        }
      }

      const scanner = new Html5Qrcode('qr-reader-container', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.DATA_MATRIX
        ],
        verbose: false
      });
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          qrbox: { width: 260, height: 260 }
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Frame without code, ignore
        }
      );
      isScanningRef.current = true;
      setQrScanning(true);
    } catch (err: any) {
      console.error('Camera QR error:', err);
      isScanningRef.current = false;
      setCameraError(
        err?.message ||
          "Impossible d'accéder à la caméra. Vérifiez les autorisations de votre navigateur."
      );
      setQrScanning(false);
    }
  };

  const stopQrScanner = async () => {
    cancelAutoLoad();
    isScanningRef.current = false;
    if (html5QrCodeRef.current) {
      const scanner = html5QrCodeRef.current;
      html5QrCodeRef.current = null;
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        await scanner.clear();
      } catch (e) {
        console.warn('Error stopping scanner', e);
      }
    }
    setQrScanning(false);
  };

  /**
   * Handle decoded scan string (from camera or uploaded file)
   * If in Continuous Batch mode: debounces and queues item without stopping the camera.
   * If in Single mode: stops camera and prepares detailed inspection/loading.
   */
  const handleScanSuccess = async (decodedText: string) => {
    // CONTINUOUS BATCH MODE
    if (scanMode === 'batch') {
      const now = Date.now();
      // Debounce: prevent duplicate firing on the same barcode held in view (< 1.4s)
      if (lastScannedCodeRef.current === decodedText && now - lastScannedTimeRef.current < 1400) {
        return;
      }
      lastScannedCodeRef.current = decodedText;
      lastScannedTimeRef.current = now;

      playBeep(true);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(80);
        } catch {
          // ignore
        }
      }

      // Parse code using multi-field article matcher
      const match = matchScannedArticle(decodedText);
      const codeArt = (match.matchedArticle?.code_article || match.parsedData.code_article || decodedText).trim();
      const designation = (match.matchedArticle?.designation || match.parsedData.designation || `Article ${codeArt}`).trim();
      const reference = (match.matchedArticle?.reference || match.parsedData.reference || '').trim();
      const machine = match.matchedArticle?.machine || 'Standard';
      const famille = match.matchedArticle?.famille || 'Général';
      const position = match.matchedArticle?.position || '';
      const unite = match.matchedArticle?.unite || 'Pièce';
      const targetLocation = (batchDefaultLocation || match.matchedArticle?.emplacement || lastLocation || '').trim();

      setBatchQueue((prev) => {
        const existingIndex = prev.findIndex(
          (item) => item.code_article.toLowerCase() === codeArt.toLowerCase() &&
                    item.emplacement.toLowerCase() === targetLocation.toLowerCase()
        );

        let updated: QueuedBatchItem[];
        let newQty = 1;
        let isIncrement = false;

        if (existingIndex >= 0) {
          isIncrement = true;
          newQty = Math.round((prev[existingIndex].quantite + 1) * 100) / 100;
          const updatedItem: QueuedBatchItem = {
            ...prev[existingIndex],
            quantite: newQty,
            scanCount: prev[existingIndex].scanCount + 1,
            timestamp: new Date().toLocaleTimeString('fr-FR')
          };
          // Move to top of queue for immediate visual feedback
          updated = [updatedItem, ...prev.filter((_, idx) => idx !== existingIndex)];
        } else {
          const newItem: QueuedBatchItem = {
            id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            rawCode: decodedText,
            articleId: match.matchedArticle?.id,
            code_article: codeArt,
            designation,
            reference,
            famille,
            machine,
            position,
            emplacement: targetLocation,
            unite,
            quantite: 1,
            qualite: 'conforme',
            notes: '',
            isKnown: !!match.matchedArticle,
            timestamp: new Date().toLocaleTimeString('fr-FR'),
            scanCount: 1
          };
          updated = [newItem, ...prev];
        }

        // Trigger on-screen scan flash banner
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        setRecentScanFlash({ code: codeArt, name: designation, qty: newQty, isIncrement });
        flashTimeoutRef.current = setTimeout(() => {
          setRecentScanFlash(null);
        }, 1600);

        return updated;
      });

      // Crucial: Keep camera running continuously!
      return;
    }

    // SINGLE SCAN MODE
    playBeep(true);
    setScannedResult(decodedText);
    await stopQrScanner();

    // Compare with database using full multi-field parser
    const match = matchScannedArticle(decodedText);
    setScanMatch(match);

    if (match.matchedArticle) {
      // Auto-load after a brief visual review (1.5 seconds) so operator can see comparison
      setAutoLoadCountdown(2);
      autoLoadTimerRef.current = setTimeout(() => {
        handleLoadArticle(match.matchedArticle!, decodedText, match.existingEntry);
      }, 1600);
    }
  };

  const handleLoadArticle = (
    art: Article,
    rawCode?: string,
    existing?: InventoryEntry
  ) => {
    cancelAutoLoad();
    onSelectArticle(art, rawCode, existing);
    onClose();
  };

  const handleCreateNewArticle = (parsedData: ParsedScannedInfo, rawCode: string) => {
    cancelAutoLoad();
    onCodeNotFound(rawCode, parsedData);
    onClose();
  };

  // Start live OCR camera stream
  const startOcrCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError("Erreur caméra pour l'OCR. Vous pouvez aussi téléverser une photo.");
    }
  };

  const stopOcrCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  // Run OCR on an image element or canvas
  const processImageOcr = async (imageSource: string | HTMLCanvasElement) => {
    setOcrProcessing(true);
    setOcrProgress(5);
    setOcrText('');
    setDetectedTokens([]);
    setScanMatch(null);
    cancelAutoLoad();

    try {
      const worker = await createWorker('fra+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });

      const ret = await worker.recognize(imageSource);
      await worker.terminate();

      const text = ret.data.text.trim();
      setOcrText(text);

      if (!text) {
        setOcrProcessing(false);
        return;
      }

      // Check full text match with database
      const fullMatch = matchScannedArticle(text);
      if (fullMatch.matchedArticle) {
        setScanMatch(fullMatch);
        playBeep(true);
      }

      // Tokenize words and alphanumeric codes
      const words = text
        .split(/[\s,\n;:|/]+/)
        .map((w) => w.trim().replace(/^[^\w\d]+|[^\w\d]+$/g, ''))
        .filter((w) => w.length >= 3 && /^[A-Za-z0-9-_.]+$/.test(w));

      const uniqueTokens = Array.from(new Set(words));
      const candidates: {
        token: string;
        article?: Article;
        matchResult?: ScanMatchResult;
      }[] = [];

      for (const token of uniqueTokens) {
        const m = matchScannedArticle(token);
        candidates.push({
          token,
          article: m.matchedArticle,
          matchResult: m
        });
      }

      // Sort: recognized articles first, then length
      candidates.sort((a, b) => {
        if (a.article && !b.article) return -1;
        if (!a.article && b.article) return 1;
        return b.token.length - a.token.length;
      });

      setDetectedTokens(candidates);
      setOcrProcessing(false);
    } catch (err) {
      console.error('OCR Error:', err);
      setOcrProcessing(false);
      setOcrText("Erreur lors de l'analyse OCR. Veuillez réessayer avec un éclairage plus direct.");
    }
  };

  // Capture video frame to canvas
  const captureOcrSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    processImageOcr(canvas);
  };

  // Upload image file for OCR or QR
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (activeTab === 'qr') {
        try {
          const scanner = new Html5Qrcode('qr-reader-container');
          const result = await scanner.scanFile(file, true);
          handleScanSuccess(result);
        } catch {
          setCameraError(
            "Aucun QR/Code-barres détecté sur l'image. Basculez sur l'onglet OCR pour lire le texte."
          );
        }
      } else {
        processImageOcr(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Batch Queue Item operations
  const handleUpdateQueueItemQty = (id: string, delta: number) => {
    setBatchQueue((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextVal = Math.max(0, Math.round((item.quantite + delta) * 100) / 100);
          return { ...item, quantite: nextVal };
        }
        return item;
      })
    );
  };

  const handleSetQueueItemQty = (id: string, val: number) => {
    const safeVal = isNaN(val) ? 0 : Math.max(0, val);
    setBatchQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantite: safeVal } : item))
    );
  };

  const handleUpdateQueueItemLocation = (id: string, loc: string) => {
    setBatchQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, emplacement: loc } : item))
    );
  };

  const handleUpdateQueueItemQualite = (id: string, qualite: QualiteEtat) => {
    setBatchQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qualite } : item))
    );
  };

  const handleRemoveQueueItem = (id: string) => {
    setBatchQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearBatchQueue = () => {
    setBatchQueue([]);
    setBatchSaveSuccess(null);
  };

  const handleApplyLocationToAll = (newLocation: string) => {
    const trimmed = newLocation.trim();
    if (!trimmed) return;
    setBatchDefaultLocation(trimmed);
    setBatchQueue((prev) =>
      prev.map((item) => ({ ...item, emplacement: trimmed }))
    );
  };

  // Manual add to batch queue
  const handleAddManualCodeToBatch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = manualBatchCode.trim();
    if (!code) return;

    const match = matchScannedArticle(code);
    const codeArt = (match.matchedArticle?.code_article || match.parsedData.code_article || code).trim();
    const designation = (match.matchedArticle?.designation || match.parsedData.designation || `Article ${codeArt}`).trim();
    const reference = (match.matchedArticle?.reference || match.parsedData.reference || '').trim();
    const machine = match.matchedArticle?.machine || 'Standard';
    const famille = match.matchedArticle?.famille || 'Général';
    const position = match.matchedArticle?.position || '';
    const unite = match.matchedArticle?.unite || 'Pièce';
    const targetLocation = (batchDefaultLocation || match.matchedArticle?.emplacement || lastLocation || '').trim();

    setBatchQueue((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.code_article.toLowerCase() === codeArt.toLowerCase() &&
                  item.emplacement.toLowerCase() === targetLocation.toLowerCase()
      );

      let updated: QueuedBatchItem[];
      let newQty = 1;
      let isIncrement = false;

      if (existingIndex >= 0) {
        isIncrement = true;
        newQty = prev[existingIndex].quantite + 1;
        const updatedItem: QueuedBatchItem = {
          ...prev[existingIndex],
          quantite: newQty,
          scanCount: prev[existingIndex].scanCount + 1,
          timestamp: new Date().toLocaleTimeString('fr-FR')
        };
        updated = [updatedItem, ...prev.filter((_, idx) => idx !== existingIndex)];
      } else {
        const newItem: QueuedBatchItem = {
          id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          rawCode: code,
          articleId: match.matchedArticle?.id,
          code_article: codeArt,
          designation,
          reference,
          famille,
          machine,
          position,
          emplacement: targetLocation,
          unite,
          quantite: 1,
          qualite: 'conforme',
          notes: '',
          isKnown: !!match.matchedArticle,
          timestamp: new Date().toLocaleTimeString('fr-FR'),
          scanCount: 1
        };
        updated = [newItem, ...prev];
      }

      playBeep(true);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      setRecentScanFlash({ code: codeArt, name: designation, qty: newQty, isIncrement });
      flashTimeoutRef.current = setTimeout(() => {
        setRecentScanFlash(null);
      }, 1600);

      return updated;
    });

    setManualBatchCode('');
  };

  // Add OCR token to batch queue
  const handleAddOcrTokenToBatch = (token: string, article?: Article, matchResult?: ScanMatchResult) => {
    playBeep(true);
    const codeArt = (article?.code_article || matchResult?.parsedData.code_article || token).trim();
    const designation = (article?.designation || matchResult?.parsedData.designation || `Article ${codeArt}`).trim();
    const reference = (article?.reference || matchResult?.parsedData.reference || '').trim();
    const machine = article?.machine || 'Standard';
    const famille = article?.famille || 'Général';
    const position = article?.position || '';
    const unite = article?.unite || 'Pièce';
    const targetLocation = (batchDefaultLocation || article?.emplacement || lastLocation || '').trim();

    setBatchQueue((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.code_article.toLowerCase() === codeArt.toLowerCase() &&
                  item.emplacement.toLowerCase() === targetLocation.toLowerCase()
      );

      let updated: QueuedBatchItem[];
      let newQty = 1;
      let isIncrement = false;

      if (existingIndex >= 0) {
        isIncrement = true;
        newQty = prev[existingIndex].quantite + 1;
        const updatedItem: QueuedBatchItem = {
          ...prev[existingIndex],
          quantite: newQty,
          scanCount: prev[existingIndex].scanCount + 1,
          timestamp: new Date().toLocaleTimeString('fr-FR')
        };
        updated = [updatedItem, ...prev.filter((_, idx) => idx !== existingIndex)];
      } else {
        const newItem: QueuedBatchItem = {
          id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          rawCode: token,
          articleId: article?.id,
          code_article: codeArt,
          designation,
          reference,
          famille,
          machine,
          position,
          emplacement: targetLocation,
          unite,
          quantite: 1,
          qualite: 'conforme',
          notes: '',
          isKnown: !!article,
          timestamp: new Date().toLocaleTimeString('fr-FR'),
          scanCount: 1
        };
        updated = [newItem, ...prev];
      }

      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      setRecentScanFlash({ code: codeArt, name: designation, qty: newQty, isIncrement });
      flashTimeoutRef.current = setTimeout(() => {
        setRecentScanFlash(null);
      }, 1600);

      return updated;
    });
  };

  // Confirm and persist all queued items
  const handleConfirmBatch = () => {
    if (batchQueue.length === 0) return;

    setIsSubmittingBatch(true);
    try {
      let savedCount = 0;
      let totalUnits = 0;

      batchQueue.forEach((item) => {
        const matchedArt = articles.find(
          (a) => a.code_article.toLowerCase() === item.code_article.toLowerCase()
        );
        const stockTheorique = typeof matchedArt?.quantite === 'number' ? matchedArt.quantite : 0;
        const realLoc = (item.emplacement || batchDefaultLocation || lastLocation || '').trim();
        const cleanPos = (item.position && item.position !== '-' && item.position !== 'Non assigné' && item.position !== 'Non renseigné')
          ? item.position.trim()
          : '';

        // 1. Ensure article exists in catalog with status 'saisi' while preserving internal theoretical stock
        addArticle({
          code_article: item.code_article,
          designation: item.designation || item.code_article,
          reference: item.reference || '',
          famille: item.famille || 'Général',
          machine: item.machine || 'Standard',
          position: cleanPos,
          emplacement: realLoc,
          unite: item.unite || 'Pièce',
          quantite: stockTheorique, // Stock interne théorique conservé
          status: 'saisi'
        });

        // 2. Add inventory entry for physical counted quantity
        addOrUpdateEntry({
          articleId: item.articleId || matchedArt?.id,
          code_article: item.code_article,
          designation: item.designation || item.code_article,
          reference: item.reference || '',
          famille: item.famille || 'Général',
          machine: item.machine || 'Standard',
          position: cleanPos,
          emplacement: realLoc,
          unite: item.unite || 'Pièce',
          quantite: Math.max(0, item.quantite), // Support quantity 0
          qualite: item.qualite,
          notes: item.notes.trim() || 'Saisi en mode lot continu',
          operator: currentUser?.nom || currentUser?.username || operator || 'Opérateur',
          status: 'saisi'
        });

        savedCount += 1;
        totalUnits += item.quantite;
      });

      if (batchDefaultLocation && batchDefaultLocation !== 'Non assigné' && batchDefaultLocation !== 'Non renseigné') {
        setLastLocation(batchDefaultLocation);
      }

      setBatchSaveSuccess({ count: savedCount, totalUnits });
      setBatchQueue([]);

      // Double confirmation beep
      playBeep(true);
      setTimeout(() => playBeep(true), 120);
    } catch (err) {
      console.error('Error confirming batch:', err);
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // Lifecycle effects
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'qr') {
        startQrScanner();
      } else {
        startOcrCamera();
      }
    } else {
      stopQrScanner();
      stopOcrCamera();
      cancelAutoLoad();
    }

    return () => {
      stopQrScanner();
      stopOcrCamera();
      cancelAutoLoad();
    };
  }, [isOpen, activeTab]);

  // Restart QR camera if user switches back to batch mode and scanner was stopped
  const handleSwitchScanMode = (newMode: 'single' | 'batch') => {
    setScanMode(newMode);
    setScanMatch(null);
    setScannedResult(null);
    cancelAutoLoad();
    if (activeTab === 'qr' && !qrScanning) {
      startQrScanner();
    }
  };

  if (!isOpen) return null;

  const totalBatchUnits = batchQueue.reduce((acc, it) => acc + (it.quantite || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div
        className={`relative w-full ${
          scanMode === 'batch' ? 'max-w-5xl' : 'max-w-2xl'
        } bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[94vh] transition-all duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              {scanMode === 'batch' ? <Zap className="w-5 h-5" /> : <ScanLine className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Lecteur & Comparaison Base
                </h2>
                {scanMode === 'batch' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
                    Mode Rafale Continu
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {scanMode === 'batch'
                  ? 'Scannez en continu plusieurs articles à la chaîne avec file d\'attente avant validation'
                  : 'Extraction Code Article, Désignation, Référence et recharge pour inventaire'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              className={`p-2 rounded-xl text-xs transition-colors border ${
                soundEnabled
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
              }`}
              title={soundEnabled ? 'Bip sonore activé' : 'Bip sonore désactivé'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={() => {
                cancelAutoLoad();
                onClose();
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Mode Segmented Switch + QR/OCR Tabs */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 shrink-0 space-y-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Mode Switcher: Single vs Batch */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/80 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => handleSwitchScanMode('single')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${
                  scanMode === 'single'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ScanLine className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Mode Unitaire</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchScanMode('batch')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-bold rounded-lg transition-all relative ${
                  scanMode === 'batch'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Lot Continu (Rafale)</span>
                {batchQueue.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full">
                    {batchQueue.length}
                  </span>
                )}
              </button>
            </div>

            {/* QR vs OCR Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl">
              <button
                onClick={() => {
                  cancelAutoLoad();
                  setActiveTab('qr');
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'qr'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ScanLine className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>QR & Code-barres</span>
              </button>
              <button
                onClick={() => {
                  cancelAutoLoad();
                  setActiveTab('ocr');
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'ocr'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>OCR Texte</span>
              </button>
            </div>
          </div>

          {/* Batch Mode Contextual Bar: Emplacement par défaut du lot */}
          {scanMode === 'batch' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Emplacement du lot :
                </span>
                <input
                  type="text"
                  placeholder="Ex: A-01-02, Rayon 3..."
                  value={batchDefaultLocation}
                  onChange={(e) => setBatchDefaultLocation(e.target.value.toUpperCase())}
                  className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:font-normal placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500 w-36"
                />
                {locations.length > 0 && (
                  <select
                    value={locations.some((l) => l.code === batchDefaultLocation) ? batchDefaultLocation : ''}
                    onChange={(e) => {
                      if (e.target.value) setBatchDefaultLocation(e.target.value);
                    }}
                    className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200"
                  >
                    <option value="">Sélectionner existant...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.code}>
                        {loc.code} ({loc.nom})
                      </option>
                    ))}
                  </select>
                )}
                {batchQueue.length > 0 && batchDefaultLocation && (
                  <button
                    type="button"
                    onClick={() => handleApplyLocationToAll(batchDefaultLocation)}
                    className="text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:underline px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800"
                  >
                    Appliquer à toute la file
                  </button>
                )}
              </div>

              {/* Live Batch Count Badge */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  En attente :
                </span>
                <span className="px-2 py-0.5 rounded-full font-bold text-xs bg-slate-900 dark:bg-slate-800 text-white font-mono">
                  {batchQueue.length} réf. · {totalBatchUnits} pcs
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {/* Celebratory Batch Save Notification */}
          {batchSaveSuccess && (
            <div className="mb-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Lot Enregistré avec Succès !
                  </h3>
                  <p className="text-xs text-emerald-900 dark:text-emerald-200">
                    <strong>{batchSaveSuccess.count} articles</strong> distincts (total de{' '}
                    <strong>{batchSaveSuccess.totalUnits} pièces</strong>) ont été validés et ajoutés à l'inventaire.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  onClick={() => {
                    setBatchSaveSuccess(null);
                    if (activeTab === 'qr') startQrScanner();
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Scanner un autre lot</span>
                </button>
                <button
                  onClick={() => {
                    cancelAutoLoad();
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs font-semibold rounded-lg hover:bg-emerald-100 dark:hover:bg-slate-700"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          {/* Grid Layout: If Batch Mode is active, split into Camera (Left) and Batch Queue (Right) on md+ */}
          <div className={scanMode === 'batch' ? 'grid grid-cols-1 md:grid-cols-12 gap-5' : 'space-y-4'}>
            {/* COLUMN 1: Camera & Scanner Viewfinder */}
            <div className={scanMode === 'batch' ? 'md:col-span-6 space-y-4' : 'space-y-4'}>
              {activeTab === 'qr' ? (
                <div className="space-y-3">
                  {/* QR Camera Viewfinder Container */}
                  <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center border border-slate-800 shadow-inner">
                    <div id="qr-reader-container" className="w-full h-full" />

                    {/* Continuous Scan Reticle Target Overlay */}
                    {qrScanning && scanMode === 'batch' && (
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-3">
                        <div className="flex items-center justify-between w-full">
                          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900/80 text-[10px] font-bold text-emerald-400 border border-emerald-500/40">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                            Scan Continu Actif
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-900/80 text-[10px] font-mono text-slate-300 border border-slate-700">
                            Lot: {batchQueue.length} articles
                          </span>
                        </div>

                        {/* Reticle */}
                        <div className="w-52 h-52 border-2 border-dashed border-amber-400/90 rounded-2xl flex items-center justify-center">
                          <div className="w-4 h-4 border-t-2 border-l-2 border-amber-400 absolute -top-1 -left-1" />
                          <div className="w-4 h-4 border-t-2 border-r-2 border-amber-400 absolute -top-1 -right-1" />
                          <div className="w-4 h-4 border-b-2 border-l-2 border-amber-400 absolute -bottom-1 -left-1" />
                          <div className="w-4 h-4 border-b-2 border-r-2 border-amber-400 absolute -bottom-1 -right-1" />
                        </div>

                        <span className="text-[10px] text-slate-300 bg-slate-950/80 px-2 py-0.5 rounded text-center">
                          Visez les codes à la chaîne. La caméra ne s'interrompt pas.
                        </span>
                      </div>
                    )}

                    {/* Camera Error Screen */}
                    {cameraError && (
                      <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center text-white z-20">
                        <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
                        <p className="text-sm font-medium mb-3">{cameraError}</p>
                        <button
                          onClick={startQrScanner}
                          className="px-4 py-2 bg-amber-500 text-slate-950 font-semibold text-xs rounded-lg hover:bg-amber-400 flex items-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Réessayer la caméra
                        </button>
                      </div>
                    )}

                    {/* Flash Notification Overlay on Scan Detection in Batch Mode */}
                    {recentScanFlash && scanMode === 'batch' && (
                      <div className="absolute inset-x-2 bottom-3 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <div className="bg-emerald-600/95 text-white p-2.5 rounded-xl shadow-lg border border-emerald-400/50 backdrop-blur-xs flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 truncate">
                            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                            <div className="truncate text-left leading-tight">
                              <span className="font-mono font-bold text-xs truncate block">
                                {recentScanFlash.code}
                              </span>
                              <span className="text-[10px] text-emerald-100 truncate block">
                                {recentScanFlash.name}
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-white text-emerald-900 font-mono font-black text-xs rounded-lg shrink-0">
                            {recentScanFlash.isIncrement ? `+1 (Qté: ${recentScanFlash.qty})` : `Ajouté (Qté: 1)`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Manual Code Input Bar for Batch Mode */}
                  {scanMode === 'batch' && (
                    <form onSubmit={handleAddManualCodeToBatch} className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Code article ou référence à ajouter manuellement..."
                          value={manualBatchCode}
                          onChange={(e) => setManualBatchCode(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white placeholder:font-sans placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      </div>
                      <button
                        type="submit"
                        disabled={!manualBatchCode.trim()}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ajouter</span>
                      </button>
                    </form>
                  )}

                  {/* Single Mode Result Card (When in Single Mode) */}
                  {scanMode === 'single' && scanMatch && (
                    <div
                      className={`rounded-xl border p-4 transition-all shadow-xs ${
                        scanMatch.matchedArticle
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700'
                          : 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                      }`}
                    >
                      {/* Top Status Banner */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800 mb-3">
                        <div className="flex items-center gap-2">
                          {scanMatch.matchedArticle ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                              <AlertCircle className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                              {scanMatch.matchedArticle
                                ? 'Article Reconnu dans la Base'
                                : 'Article Non Référencé'}
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {scanMatch.matchDescription}
                            </p>
                          </div>
                        </div>

                        {autoLoadCountdown !== null && scanMatch.matchedArticle && (
                          <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full animate-pulse">
                            Ouverture auto...
                          </span>
                        )}
                      </div>

                      {/* 3 Key Scanned Fields Comparison Block */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          Informations Reçues au Scan :
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white/90 dark:bg-slate-900/90 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">
                              Code Article :
                            </span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white break-all">
                              {scanMatch.parsedData.code_article || '(Non détecté)'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">
                              Désignation :
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 break-words">
                              {scanMatch.parsedData.designation || '(Non spécifiée)'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">
                              Référence :
                            </span>
                            <span className="font-mono text-slate-700 dark:text-slate-300 break-all">
                              {scanMatch.parsedData.reference || '(Non spécifiée)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* If Matched in Database: Loaded Catalog Details & Action */}
                      {scanMatch.matchedArticle ? (
                        <div className="mt-3 pt-3 border-t border-emerald-200/80 dark:border-emerald-800 space-y-3">
                          <div className="bg-white/95 dark:bg-slate-900 p-3 rounded-lg border border-emerald-300 dark:border-emerald-700">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1.5">
                              <Database className="w-3.5 h-3.5" />
                              <span>Données Rechargées de la Base du Catalogue :</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                              <div>
                                <span className="text-slate-400 block">Machine :</span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {scanMatch.matchedArticle.machine || 'Standard'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Emplacement :</span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {scanMatch.matchedArticle.emplacement || 'Non assigné'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Famille :</span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {scanMatch.matchedArticle.famille || 'Général'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Unité :</span>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {scanMatch.matchedArticle.unite || 'Pièce'}
                                </span>
                              </div>
                            </div>

                            {/* Existing inventory entry notice */}
                            {scanMatch.existingEntry && (
                              <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/60 rounded border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] flex items-center justify-between">
                                <span>
                                  ⚠️ Déjà saisi dans l'inventaire :{' '}
                                  <strong>
                                    {scanMatch.existingEntry.quantite} {scanMatch.existingEntry.unite}
                                  </strong>{' '}
                                  à <strong>{scanMatch.existingEntry.emplacement}</strong>
                                </span>
                                <span className="text-[10px] bg-amber-200/80 dark:bg-amber-800/80 px-1.5 py-0.5 rounded font-semibold uppercase">
                                  Modifier
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Primary Button: Recharge & Open Inventory Entry */}
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={startQrScanner}
                              className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition-colors"
                            >
                              Scanner un autre
                            </button>
                            <button
                              onClick={() =>
                                handleLoadArticle(
                                  scanMatch.matchedArticle!,
                                  scannedResult || undefined,
                                  scanMatch.existingEntry
                                )
                              }
                              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all"
                            >
                              <span>Recharger & Saisir l'inventaire</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Not matched in database -> Create candidate */
                        <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800 space-y-2">
                          <p className="text-xs text-amber-900 dark:text-amber-200">
                            Cet article n'est pas encore présent dans la base. Les informations extraites
                            seront chargées pour vous permettre de l'enregistrer et de saisir sa quantité.
                          </p>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              onClick={startQrScanner}
                              className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl"
                            >
                              Réessayer le scan
                            </button>
                            <button
                              onClick={() =>
                                handleCreateNewArticle(
                                  scanMatch.parsedData,
                                  scannedResult || scanMatch.parsedData.code_article
                                )
                              }
                              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
                            >
                              <span>Créer & Saisir cet article</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Upload image alternative & Restart */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <label className="cursor-pointer font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>Photo QR / Code-barres</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                    <button
                      onClick={startQrScanner}
                      className="font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Redémarrer caméra</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* OCR Mode Viewfinder */
                <div className="space-y-4">
                  <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Target Alignment Crosshairs */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-72 h-36 border-2 border-dashed border-amber-400/90 rounded-lg bg-amber-500/5 flex flex-col items-center justify-center p-2 text-center">
                        <span className="text-[11px] font-mono text-amber-300 bg-slate-950/80 px-2 py-0.5 rounded">
                          Cadrer la plaque signalétique ou l'étiquette
                        </span>
                        <span className="text-[10px] text-slate-300 mt-1">
                          Code Article, Désignation & Référence
                        </span>
                      </div>
                    </div>

                    {ocrProcessing && (
                      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-white text-center">
                        <div className="w-12 h-12 rounded-full border-4 border-amber-500 border-t-transparent animate-spin mb-3" />
                        <p className="text-sm font-semibold">Analyse OCR & Comparaison Base...</p>
                        <p className="text-xs text-slate-400 mt-1">Progression : {ocrProgress}%</p>
                      </div>
                    )}
                  </div>

                  {/* OCR Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={captureOcrSnapshot}
                      disabled={ocrProcessing}
                      className="flex-1 py-3 px-4 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-all"
                    >
                      <Camera className="w-4 h-4 text-amber-400" />
                      <span>Photographier & Comparer</span>
                    </button>
                    <label className="cursor-pointer py-3 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center justify-center transition-colors">
                      <Upload className="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>

                  {/* Detected Tokens in OCR: Allow instant addition to batch queue */}
                  {detectedTokens.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Éléments extraits & Références ({detectedTokens.length})
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {scanMode === 'batch' ? 'Cliquez pour ajouter au lot (+)' : 'Cliquez pour recharger'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
                        {detectedTokens.map(({ token, article, matchResult }, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              if (scanMode === 'batch') {
                                handleAddOcrTokenToBatch(token, article, matchResult);
                              } else if (article) {
                                handleLoadArticle(article, token, matchResult?.existingEntry);
                              } else {
                                handleCreateNewArticle(
                                  matchResult?.parsedData || {
                                    code_article: token,
                                    designation: `Article ${token}`,
                                    reference: token
                                  },
                                  token
                                );
                              }
                            }}
                            className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 border ${
                              article
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {article ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className="font-bold">{token}</span>
                            {scanMode === 'batch' && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1 rounded font-bold">
                                +1
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw OCR Text output */}
                  {ocrText && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                      <span className="font-sans font-bold text-slate-500 dark:text-slate-400 block text-[11px] mb-1">
                        Texte brut reconnu :
                      </span>
                      {ocrText}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* COLUMN 2: Batch Queue Interactive Panel (Batch Mode only) */}
            {scanMode === 'batch' && (
              <div className="md:col-span-6 flex flex-col bg-slate-50/70 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 min-h-[380px] max-h-[580px]">
                {/* Queue Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                      {batchQueue.length}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        File d'Attente du Lot
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {batchQueue.length === 0
                          ? 'En attente de scan'
                          : `${batchQueue.length} articles · ${totalBatchUnits} unités au total`}
                      </p>
                    </div>
                  </div>

                  {batchQueue.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearBatchQueue}
                      className="text-xs text-rose-600 hover:text-rose-700 dark:hover:text-rose-400 font-semibold flex items-center gap-1 px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Vider la file</span>
                    </button>
                  )}
                </div>

                {/* Queue Items List */}
                <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
                  {batchQueue.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-400">
                        <Layers className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Aucun article dans la file
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs mt-1">
                          Visez les QR codes ou codes-barres avec la caméra. Chaque article scanné s'ajoutera ici automatiquement.
                        </p>
                      </div>
                    </div>
                  ) : (
                    batchQueue.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2.5"
                      >
                        {/* Header of Item Card */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                              {item.code_article}
                            </span>
                            {item.isKnown ? (
                              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                ✓ Catalogue
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                                Nouveau
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.timestamp}
                            </span>
                          </div>

                          {/* Delete Item Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveQueueItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Supprimer du lot"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Designation & Reference */}
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {item.designation}
                          </div>
                          {item.reference && (
                            <div className="text-[10px] text-slate-500 font-mono">
                              Réf: {item.reference}
                            </div>
                          )}
                        </div>

                        {/* Controls: Stepper, Emplacement & Qualite */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                          {/* Quantity Stepper */}
                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => handleUpdateQueueItemQty(item.id, -1)}
                              className="w-6 h-6 rounded flex items-center justify-center bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-bold active:scale-95"
                              title="-1"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.quantite}
                              onChange={(e) => handleSetQueueItemQty(item.id, parseFloat(e.target.value))}
                              className="w-14 text-center font-mono font-bold text-xs bg-transparent text-slate-900 dark:text-white focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateQueueItemQty(item.id, 1)}
                              className="w-6 h-6 rounded flex items-center justify-center bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-bold active:scale-95"
                              title="+1"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <span className="text-[10px] text-slate-400 px-1">
                              {item.unite}
                            </span>
                          </div>

                          {/* Quick Emplacement input / selector */}
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              value={item.emplacement}
                              onChange={(e) => handleUpdateQueueItemLocation(item.id, e.target.value.toUpperCase())}
                              placeholder="Emplacement..."
                              className="w-24 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-mono text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          {/* Quality selector */}
                          <select
                            value={item.qualite}
                            onChange={(e) => handleUpdateQueueItemQualite(item.id, e.target.value as QualiteEtat)}
                            className="text-[10px] py-0.5 px-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300"
                          >
                            {(Object.keys(QUALITE_LABELS) as QualiteEtat[]).map((k) => (
                              <option key={k} value={k}>
                                {QUALITE_LABELS[k]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Queue Footer Action: Confirm Entire Batch */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-2">
                  <button
                    type="button"
                    onClick={handleConfirmBatch}
                    disabled={batchQueue.length === 0 || isSubmittingBatch}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>
                      {isSubmittingBatch
                        ? 'Enregistrement en cours...'
                        : `Confirmer & Enregistrer le lot (${batchQueue.length} articles · ${totalBatchUnits} pcs)`}
                    </span>
                  </button>
                  <p className="text-[10px] text-center text-slate-400 dark:text-slate-500">
                    Les articles seront enregistrés avec leur emplacement et ajoutés directement aux saisis.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>
              <strong>{articles.length}</strong> articles dans la base de données
            </span>
          </div>
          <button
            onClick={() => {
              cancelAutoLoad();
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
