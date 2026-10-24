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
type SyncActivityListener = (isSyncing: boolean, pendingCount: number) => void;

const OFFLINE_QUEUE_KEY = 'inventaire_offline_sync_queue_v5';

class RealtimeSyncService {
  private socket: WebSocket | null = null;
  private clientId: string;
  private isConnected: boolean = false;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private stateListeners: Set<StateListener> = new Set();
  private countListeners: Set<ClientCountListener> = new Set();
  private statusListeners: Set<ConnectionStatusListener> = new Set();
  private activityListeners: Set<SyncActivityListener> = new Set();
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

  public getPendingCount(): number {
    return this.offlineQueue.length + this.inFlightRequests;
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

  public subscribeActivity(listener: SyncActivityListener): () => void {
    this.activityListeners.add(listener);
    const pending = this.getPendingCount();
    listener(this.inFlightRequests > 0 || this.isFlushingQueue, pending);
    return () => {
      this.activityListeners.delete(listener);
    };
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
      this.connect();
      this.fetchInitialState();
      this.flushOfflineQueue();
    });

    window.addEventListener('offline', () => {
      this.isConnected = false;
      this.notifyStatus(false);
      this.notifyActivity();
    });

    this.connect();
    this.fetchInitialState();
    this.flushOfflineQueue();
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
        this.notifyStatus(false);
      };
    } catch (err) {
      console.warn('[SyncService] Connection error:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
      this.fetchInitialState();
    }, 2000);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify({ type: 'PING' }));
        } catch {
          // ignore
        }
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private handleIncomingMessage(data: any): void {
    if (data.type === 'PONG') return;

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
      const res = await fetch('/api/inventory/state');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          this.notifyState(json.data);
          if (typeof json.connectedClients === 'number') {
            this.clientCount = json.connectedClients;
            this.notifyCount(this.clientCount);
          }
          return json.data;
        }
      }
    } catch {
      // offline or server starting
    } finally {
      setTimeout(() => {
        this.inFlightRequests = Math.max(0, this.inFlightRequests - 1);
        this.notifyActivity();
      }, 300);
    }
    return null;
  }

  public sendAction(action: string, payload: any): void {
    this.inFlightRequests++;
    this.notifyActivity();

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
      }
    }

    if (!sentViaWs) {
      fetch('/api/inventory/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          payload,
          clientId: this.clientId
        })
      })
        .then((res) => {
          if (!res.ok) throw new Error('HTTP action failed');
        })
        .catch(() => {
          // Add to offline queue if completely offline
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
      }, 400);
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
          const res = await fetch('/api/inventory/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: item.action,
              payload: item.payload,
              clientId: this.clientId
            })
          });
          if (res.ok) {
            this.offlineQueue.shift();
            this.saveOfflineQueue();
            this.notifyActivity();
          } else {
            break;
          }
        } catch {
          // Still offline
          break;
        }
      }
    } finally {
      this.isFlushingQueue = false;
      this.notifyActivity();
    }
  }

  public sendFullSync(state: Partial<RemoteServerState>): void {
    this.inFlightRequests++;
    this.notifyActivity();

    fetch('/api/inventory/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    })
      .catch((err) => {
        console.warn('[SyncService] HTTP full sync failed', err);
      })
      .finally(() => {
        setTimeout(() => {
          this.inFlightRequests = Math.max(0, this.inFlightRequests - 1);
          this.notifyActivity();
        }, 500);
      });
  }
}

export const syncService = new RealtimeSyncService();
