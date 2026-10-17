import { Article, InventoryEntry, EmplacementItem, InventoryCampaign } from '../types/inventory';

export interface RemoteServerState {
  inventories?: InventoryCampaign[];
  activeInventoryId?: string;
  articles: Article[];
  entries: InventoryEntry[];
  locations: EmplacementItem[];
  familles: string[];
  machines: string[];
  lastLocation: string;
  updatedAt?: string;
}

type StateListener = (state: RemoteServerState) => void;
type ClientCountListener = (count: number) => void;
type ConnectionStatusListener = (isConnected: boolean) => void;

class RealtimeSyncService {
  private socket: WebSocket | null = null;
  private clientId: string;
  private isConnected: boolean = false;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private stateListeners: Set<StateListener> = new Set();
  private countListeners: Set<ClientCountListener> = new Set();
  private statusListeners: Set<ConnectionStatusListener> = new Set();
  private clientCount: number = 1;

  constructor() {
    this.clientId = 'client-' + Math.random().toString(36).substring(2, 9);
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

  public start(): void {
    if (typeof window === 'undefined') return;
    this.connect();
    this.fetchInitialState();
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
    }, 2500);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify({ type: 'PING' }));
        } catch (e) {
          // ignore
        }
      }
    }, 20000);
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
    } catch (err) {
      // offline or server starting
    }
    return null;
  }

  public sendAction(action: string, payload: any): void {
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
        console.warn('[SyncService] Error sending via WebSocket, falling back to HTTP', err);
      }
    }

    // Also send via HTTP POST as reliable backup
    if (!sentViaWs) {
      fetch('/api/inventory/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          payload,
          clientId: this.clientId
        })
      }).catch((err) => {
        console.warn('[SyncService] HTTP action fallback failed', err);
      });
    }
  }

  public sendFullSync(state: Partial<RemoteServerState>): void {
    fetch('/api/inventory/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    }).catch((err) => {
      console.warn('[SyncService] HTTP full sync failed', err);
    });
  }
}

export const syncService = new RealtimeSyncService();
