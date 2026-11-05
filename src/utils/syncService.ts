import { Article, InventoryEntry, EmplacementItem, InventoryCampaign, AppUser } from '../types/inventory';

export interface RemoteServerState {
  inventories?: InventoryCampaign[];
  activeInventoryId?: string;
  articles: Article[];
  entries: InventoryEntry[];
  locations: EmplacementItem[];
  familles: string[];
  machines: string[];
  lastLocation: string;
  users?: AppUser[];
  updatedAt?: string;
}

interface QueuedAction {
  id: string;
  action: string;
  payload: any;
  timestamp: number;
}

type StateListener = (state: RemoteServerState) => void;
type ClientCountListener = (count: number) => void;
type ConnectionStatusListener = (isConnected: boolean) => void;
type ConnectionQualityListener = (isDegraded: boolean) => void;
type SyncActivityListener = (isSyncing: boolean, pendingCount: number) => void;

const OFFLINE_QUEUE_KEY = 'inventaire_offline_sync_queue_v5';

// High-reliability fetch with strict timeout for bad/degraded connections
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3200): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

class RealtimeSyncService {
  private socket: WebSocket | null = null;
  private clientId: string;
  private isConnected: boolean = false;
  private isDegraded: boolean = false;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private pongTimeoutTimer: any = null;
  private autoFlushInterval: any = null;
  private stateListeners: Set<StateListener> = new Set();
  private countListeners: Set<ClientCountListener> = new Set();
  private statusListeners: Set<ConnectionStatusListener> = new Set();
  private qualityListeners: Set<ConnectionQualityListener> = new Set();
  private activityListeners: Set<SyncActivityListener> = new Set();
  private queueFlushedListeners: Set<() => void> = new Set();
  private clientCount: number = 1;
  private inFlightRequests: number = 0;
  private offlineQueue: QueuedAction[] = [];
  private isFlushingQueue: boolean = false;

  constructor() {
    this.clientId = 'client-' + Math.random().toString(36).substring(2, 9);
    this.loadOfflineQueue();
  }

  private loadOfflineQueue(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.offlineQueue = parsed;
        }
      }
    } catch {
      this.offlineQueue = [];
    }
  }

  private saveOfflineQueue(): void {
    if (typeof window === 'undefined') return;
    try {
      if (this.offlineQueue.length === 0) {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
      } else {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.offlineQueue));
      }
    } catch {
      // ignore
    }
  }

  public getClientId(): string {
    return this.clientId;
  }

  public getClientCount(): number {
    return this.clientCount;
  }

  public isSocketConnected(): boolean {
    return this.isConnected;
  }

  public isConnectionDegraded(): boolean {
    return this.isDegraded;
  }

  public getPendingCount(): number {
    return this.offlineQueue.length + this.inFlightRequests;
  }

  public clearOfflineQueue(): void {
    this.offlineQueue = [];
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
      } catch {
        // ignore
      }
    }
    this.notifyActivity();
  }

  public subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public subscribeClientCount(listener: ClientCountListener): () => void {
    this.countListeners.add(listener);
    listener(this.clientCount);
    return () => {
      this.countListeners.delete(listener);
    };
  }

  public subscribeStatus(listener: ConnectionStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.isConnected);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public subscribeConnectionQuality(listener: ConnectionQualityListener): () => void {
    this.qualityListeners.add(listener);
    listener(this.isDegraded);
    return () => {
      this.qualityListeners.delete(listener);
    };
  }

  public subscribeActivity(listener: SyncActivityListener): () => void {
    this.activityListeners.add(listener);
    const pending = this.getPendingCount();
    listener(this.inFlightRequests > 0 || this.isFlushingQueue, pending);
    return () => {
      this.activityListeners.delete(listener);
    };
  }

  private setDegraded(degraded: boolean): void {
    if (this.isDegraded !== degraded) {
      this.isDegraded = degraded;
      this.qualityListeners.forEach((l) => {
        try {
          l(degraded);
        } catch {
          // ignore
        }
      });
    }
  }

  private notifyActivity(): void {
    const pending = this.getPendingCount();
    const isSyncing = this.inFlightRequests > 0 || this.isFlushingQueue;
    this.activityListeners.forEach((listener) => {
      try {
        listener(isSyncing, pending);
      } catch (e) {
        console.error('[SyncService] Error in activity listener:', e);
      }
    });
  }

  public start(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.setDegraded(false);
      this.connect();
      this.fetchInitialState();
      this.flushOfflineQueue();
    });

    window.addEventListener('offline', () => {
      this.isConnected = false;
      this.setDegraded(true);
      this.notifyStatus(false);
      this.notifyActivity();
    });

    this.connect();
    this.fetchInitialState();
    this.flushOfflineQueue();

    // Periodic background queue auto-flusher every 8 seconds
    if (!this.autoFlushInterval) {
      this.autoFlushInterval = setInterval(() => {
        if (this.offlineQueue.length > 0) {
          this.flushOfflineQueue();
        }
        if (!this.isConnected && (typeof navigator === 'undefined' || navigator.onLine)) {
          this.connect();
        }
      }, 8000);
    }
  }

  private getWebSocketUrl(): string {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${loc.host}/api/ws`;
  }

  private connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = this.getWebSocketUrl();
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.setDegraded(false);
        this.notifyStatus(true);
        this.startHeartbeat();
        this.flushOfflineQueue();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch (err) {
          console.error('[SyncService] Failed to parse message', err);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.notifyStatus(false);
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnected = false;
        this.setDegraded(true);
        this.notifyStatus(false);
      };
    } catch (err) {
      console.warn('[SyncService] Connection error:', err);
      this.setDegraded(true);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
      this.fetchInitialState();
    }, 2500);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        try {
          // Expect PONG within 5 seconds; otherwise consider connection degraded or stalled
          this.clearPongTimeout();
          this.pongTimeoutTimer = setTimeout(() => {
            console.warn('[SyncService] Heartbeat PONG timeout - connection is degraded or stalled');
            this.setDegraded(true);
            try {
              if (this.socket) this.socket.close();
            } catch {
              // ignore
            }
          }, 5000);

          this.socket.send(JSON.stringify({ type: 'PING' }));
        } catch {
          this.setDegraded(true);
        }
      }
    }, 15000);
  }

  private clearPongTimeout(): void {
    if (this.pongTimeoutTimer) {
      clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }
  }

  private stopHeartbeat(): void {
    this.clearPongTimeout();
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private handleIncomingMessage(data: any): void {
    if (data.type === 'PONG') {
      this.clearPongTimeout();
      this.setDegraded(false);
      return;
    }

    if (data.type === 'INIT_STATE' || data.type === 'STATE_UPDATED') {
      if (data.payload) {
        this.notifyState(data.payload);
      }
      if (typeof data.clientCount === 'number') {
        this.clientCount = data.clientCount;
        this.notifyCount(this.clientCount);
      }
    } else if (data.type === 'CLIENT_COUNT') {
      if (typeof data.count === 'number') {
        this.clientCount = data.count;
        this.notifyCount(this.clientCount);
      }
    }
  }

  private notifyState(state: RemoteServerState): void {
    this.stateListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (e) {
        console.error('[SyncService] Error in state listener:', e);
      }
    });
  }

  private notifyCount(count: number): void {
    this.countListeners.forEach((listener) => {
      try {
        listener(count);
      } catch (e) {
        console.error('[SyncService] Error in count listener:', e);
      }
    });
  }

  private notifyStatus(status: boolean): void {
    this.statusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (e) {
        console.error('[SyncService] Error in status listener:', e);
      }
    });
  }

  public async fetchInitialState(): Promise<RemoteServerState | null> {
    this.inFlightRequests++;
    this.notifyActivity();
    try {
      const res = await fetchWithTimeout('/api/inventory/state', {}, 3000);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          this.setDegraded(false);
          this.notifyState(json.data);
          if (typeof json.connectedClients === 'number') {
            this.clientCount = json.connectedClients;
            this.notifyCount(this.clientCount);
          }
          return json.data;
        }
      } else {
        this.setDegraded(true);
      }
    } catch {
      // offline or poor connection
      this.setDegraded(true);
    } finally {
      setTimeout(() => {
        this.inFlightRequests = Math.max(0, this.inFlightRequests - 1);
        this.notifyActivity();
      }, 300);
    }
    return null;
  }

  public sendAction(action: string, payload: any): void {
    // If completely offline according to browser, queue immediately without blocking
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.queueAction(action, payload);
      this.setDegraded(true);
      this.notifyActivity();
      return;
    }

    const message = {
      type: 'ACTION',
      action,
      payload,
      clientId: this.clientId,
      timestamp: Date.now()
    };

    let sentViaWs = false;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(message));
        sentViaWs = true;
      } catch (err) {
        console.warn('[SyncService] WS send failed, fallback to HTTP', err);
        this.setDegraded(true);
      }
    }

    if (!sentViaWs) {
      this.inFlightRequests++;
      this.notifyActivity();

      fetchWithTimeout('/api/inventory/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          payload,
          clientId: this.clientId
        })
      }, 3000)
        .then((res) => {
          if (!res.ok) throw new Error('HTTP action failed');
          this.setDegraded(false);
        })
        .catch(() => {
          // In bad network or timeout, safely queue to persistent offline queue in localStorage!
          this.setDegraded(true);
          this.queueAction(action, payload);
        })
        .finally(() => {
          this.inFlightRequests = Math.max(0, this.inFlightRequests - 1);
          this.notifyActivity();
        });
    } else {
      setTimeout(() => {
        this.inFlightRequests = Math.max(0, this.inFlightRequests - 1);
        this.notifyActivity();
      }, 250);
    }
  }

  private queueAction(action: string, payload: any): void {
    const item: QueuedAction = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      action,
      payload,
      timestamp: Date.now()
    };
    this.offlineQueue.push(item);
    this.saveOfflineQueue();
    this.notifyActivity();
  }

  public async flushOfflineQueue(): Promise<void> {
    if (this.isFlushingQueue || this.offlineQueue.length === 0) return;
    this.isFlushingQueue = true;
    this.notifyActivity();

    try {
      while (this.offlineQueue.length > 0) {
        const item = this.offlineQueue[0];
        try {
          const res = await fetchWithTimeout('/api/inventory/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: item.action,
              payload: item.payload,
              clientId: this.clientId
            })
          }, 3200);

          if (res.ok) {
            this.offlineQueue.shift();
            this.saveOfflineQueue();
            this.setDegraded(false);
            this.notifyActivity();
          } else {
            this.setDegraded(true);
            break;
          }
        } catch {
          // Still offline or timeout
          this.setDegraded(true);
          break;
        }
      }
      if (this.offlineQueue.length === 0) {
        this.notifyQueueFlushed();
      }
    } finally {
      this.isFlushingQueue = false;
      this.notifyActivity();
    }
  }

  public subscribeQueueFlushed(listener: () => void): () => void {
    this.queueFlushedListeners.add(listener);
    return () => {
      this.queueFlushedListeners.delete(listener);
    };
  }

  private notifyQueueFlushed(): void {
    this.queueFlushedListeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error('[SyncService] Error in queue flushed listener:', e);
      }
    });
  }

  public sendFullSync(state: Partial<RemoteServerState>): void {
    this.inFlightRequests++;
    this.notifyActivity();

    fetchWithTimeout('/api/inventory/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    }, 3500)
      .then((res) => {
        if (res.ok) this.setDegraded(false);
      })
      .catch((err) => {
        console.warn('[SyncService] HTTP full sync failed', err);
        this.setDegraded(true);
      })
      .finally(() => {
        setTimeout(() => {
          this.inFlightRequests = Math.max(0, this.inFlightRequests - 1);
          this.notifyActivity();
        }, 400);
      });
  }
}

export const syncService = new RealtimeSyncService();
