import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'inventory-database.json');

// Interface for server database state
interface ServerDatabase {
  inventories: any[];
  activeInventoryId: string;
  articles: any[];
  entries: any[];
  locations: any[];
  familles: string[];
  machines: string[];
  lastLocation: string;
  users: any[];
  updatedAt: string;
}

const DEFAULT_USERS = [
  {
    id: 'usr-admin-01',
    username: 'ouaradtech',
    nom: 'Mohamed Ouarad (Admin)',
    motDePasse: 'Ouaradtech26@',
    role: 'admin',
    actif: true,
    dateCreation: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'usr-op-01',
    username: 'saisie1',
    nom: 'Opérateur 1 (Atelier)',
    motDePasse: '1234',
    role: 'operateur',
    actif: true,
    dateCreation: '2026-01-01T08:00:00.000Z'
  },
  {
    id: 'usr-op-02',
    username: 'saisie2',
    nom: 'Opérateur 2 (Magasin)',
    motDePasse: '1234',
    role: 'operateur',
    actif: true,
    dateCreation: '2026-01-01T08:00:00.000Z'
  }
];

// Initial state : clean start
const emptyDatabase: ServerDatabase = {
  inventories: [],
  activeInventoryId: 'inv-principal',
  articles: [],
  entries: [],
  locations: [],
  familles: [],
  machines: [],
  lastLocation: '',
  users: DEFAULT_USERS,
  updatedAt: new Date().toISOString()
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load or initialize DB
let db: ServerDatabase = { ...emptyDatabase };

function loadDatabase(): ServerDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);

      const arts = Array.isArray(parsed.articles) ? parsed.articles : [];
      const ents = Array.isArray(parsed.entries) ? parsed.entries : [];
      const locs = Array.isArray(parsed.locations) ? parsed.locations : [];
      const fams = Array.isArray(parsed.familles) ? parsed.familles : [];
      const machs = Array.isArray(parsed.machines) ? parsed.machines : [];
      const lastLoc = typeof parsed.lastLocation === 'string' ? parsed.lastLocation : '';

      let users = Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : [...DEFAULT_USERS];
      if (!users.some((u: any) => u.username?.toLowerCase() === 'ouaradtech')) {
        users.unshift(DEFAULT_USERS[0]);
      }

      let inventories = Array.isArray(parsed.inventories) ? parsed.inventories : [];
      let activeInvId = typeof parsed.activeInventoryId === 'string' && parsed.activeInventoryId ? parsed.activeInventoryId : 'inv-principal';

      if (inventories.length === 0) {
        inventories = [
          {
            id: 'inv-principal',
            titre: 'Inventaire Principal',
            code: 'INV-01',
            description: 'Campagne principale d\'inventaire',
            dateCreation: new Date().toISOString(),
            statut: 'en_cours',
            responsable: 'ouaradtech',
            articles: arts,
            entries: ents,
            locations: locs,
            familles: fams,
            machines: machs,
            lastLocation: lastLoc
          }
        ];
        activeInvId = 'inv-principal';
      }

      return {
        inventories,
        activeInventoryId: activeInvId,
        articles: arts,
        entries: ents,
        locations: locs,
        familles: fams,
        machines: machs,
        lastLocation: lastLoc,
        users,
        updatedAt: parsed.updatedAt || new Date().toISOString()
      };
    }
  } catch (err) {
    console.error('Error loading inventory database file:', err);
  }
  return { ...emptyDatabase };
}

function syncActiveInventoryInList(): void {
  const idx = db.inventories.findIndex((inv) => inv.id === db.activeInventoryId);
  if (idx >= 0) {
    db.inventories[idx] = {
      ...db.inventories[idx],
      articles: db.articles,
      entries: db.entries,
      locations: db.locations,
      familles: db.familles,
      machines: db.machines,
      lastLocation: db.lastLocation
    };
  }
}

function saveDatabase(): void {
  try {
    syncActiveInventoryInList();
    db.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving inventory database file:', err);
  }
}

db = loadDatabase();
saveDatabase();

const app = express();
const server = createServer(app);

app.use(express.json({ limit: '50mb' }));

// Set up WebSocket server on path /api/ws
const wss = new WebSocketServer({ server, path: '/api/ws' });

function broadcast(message: any, excludeClient?: WebSocket) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch (err) {
        // ignore client send error
      }
    }
  });
}

function broadcastClientCount() {
  broadcast({
    type: 'CLIENT_COUNT',
    count: wss.clients.size
  });
}

// Handle mutations on server DB
function applyAction(actionType: string, payload: any): boolean {
  switch (actionType) {
    case 'SYNC_STATE': {
      if (payload) {
        if (Array.isArray(payload.inventories)) db.inventories = payload.inventories;
        if (typeof payload.activeInventoryId === 'string' && payload.activeInventoryId) {
          db.activeInventoryId = payload.activeInventoryId;
        }
        if (Array.isArray(payload.articles)) db.articles = payload.articles;
        if (Array.isArray(payload.entries)) db.entries = payload.entries;
        if (Array.isArray(payload.locations)) db.locations = payload.locations;
        if (Array.isArray(payload.familles)) db.familles = payload.familles;
        if (Array.isArray(payload.machines)) db.machines = payload.machines;
        if (Array.isArray(payload.users)) db.users = payload.users;
        if (typeof payload.lastLocation === 'string') db.lastLocation = payload.lastLocation;
      }
      break;
    }

    case 'CREATE_INVENTORY': {
      const newInv = payload;
      if (!newInv || !newInv.id) return false;
      const existingIdx = db.inventories.findIndex((i) => i.id === newInv.id);
      if (existingIdx >= 0) {
        db.inventories[existingIdx] = newInv;
      } else {
        db.inventories.unshift(newInv);
      }
      if (payload.switchToNew) {
        syncActiveInventoryInList();
        db.activeInventoryId = newInv.id;
        db.articles = Array.isArray(newInv.articles) ? newInv.articles : [];
        db.entries = Array.isArray(newInv.entries) ? newInv.entries : [];
        db.locations = Array.isArray(newInv.locations) ? newInv.locations : [];
        db.familles = Array.isArray(newInv.familles) ? newInv.familles : [];
        db.machines = Array.isArray(newInv.machines) ? newInv.machines : [];
        db.lastLocation = newInv.lastLocation || '';
      }
      break;
    }

    case 'SWITCH_INVENTORY': {
      const targetId = typeof payload === 'string' ? payload : payload?.id;
      if (!targetId) return false;
      syncActiveInventoryInList();
      const target = db.inventories.find((i) => i.id === targetId);
      if (target) {
        db.activeInventoryId = target.id;
        db.articles = Array.isArray(target.articles) ? target.articles : [];
        db.entries = Array.isArray(target.entries) ? target.entries : [];
        db.locations = Array.isArray(target.locations) ? target.locations : [];
        db.familles = Array.isArray(target.familles) ? target.familles : [];
        db.machines = Array.isArray(target.machines) ? target.machines : [];
        db.lastLocation = target.lastLocation || '';
      }
      break;
    }

    case 'UPDATE_INVENTORY': {
      const updatedInv = payload;
      if (!updatedInv || !updatedInv.id) return false;
      const idx = db.inventories.findIndex((i) => i.id === updatedInv.id);
      if (idx >= 0) {
        db.inventories[idx] = { ...db.inventories[idx], ...updatedInv };
        if (db.activeInventoryId === updatedInv.id) {
          if (Array.isArray(updatedInv.articles)) db.articles = updatedInv.articles;
          if (Array.isArray(updatedInv.entries)) db.entries = updatedInv.entries;
        }
      }
      break;
    }

    case 'DELETE_INVENTORY': {
      const targetId = typeof payload === 'string' ? payload : payload?.id;
      if (!targetId) return false;
      db.inventories = db.inventories.filter((i) => i.id !== targetId);
      if (db.activeInventoryId === targetId) {
        if (db.inventories.length > 0) {
          const nextInv = db.inventories[0];
          db.activeInventoryId = nextInv.id;
          db.articles = nextInv.articles || [];
          db.entries = nextInv.entries || [];
          db.locations = nextInv.locations || [];
          db.familles = nextInv.familles || [];
          db.machines = nextInv.machines || [];
          db.lastLocation = nextInv.lastLocation || '';
        } else {
          db.articles = [];
          db.entries = [];
          db.locations = [];
          db.familles = [];
          db.machines = [];
          db.lastLocation = '';
        }
      }
      break;
    }

    case 'ADD_ENTRY':
    case 'UPDATE_ENTRY': {
      const entry = payload;
      if (!entry) return false;
      const index = db.entries.findIndex((e) => e.id === entry.id);
      if (index >= 0) {
        db.entries[index] = entry;
      } else {
        // Check duplicate code_article & emplacement
        const matchIdx = db.entries.findIndex(
          (e) =>
            e.code_article.toLowerCase() === entry.code_article.toLowerCase() &&
            e.emplacement.toLowerCase() === entry.emplacement.toLowerCase()
        );
        if (matchIdx >= 0) {
          db.entries[matchIdx] = entry;
        } else {
          db.entries.unshift(entry);
        }
      }
      if (entry.emplacement && entry.emplacement.trim()) {
        db.lastLocation = entry.emplacement.trim();
      }

      // Update status in db.articles if found
      const artIdx = db.articles.findIndex((a) => a.code_article.toLowerCase() === entry.code_article.toLowerCase());
      if (artIdx >= 0) {
        db.articles[artIdx] = {
          ...db.articles[artIdx],
          status: 'saisi',
          quantite: entry.quantite,
          emplacement: entry.emplacement || db.articles[artIdx].emplacement
        };
      }
      break;
    }

    case 'DELETE_ENTRY': {
      const id = payload?.id || payload;
      const targetEntry = db.entries.find((e) => e.id === id);
      db.entries = db.entries.filter((e) => e.id !== id);

      if (targetEntry) {
        const remaining = db.entries.some((e) => e.code_article.toLowerCase() === targetEntry.code_article.toLowerCase());
        if (!remaining) {
          const artIdx = db.articles.findIndex((a) => a.code_article.toLowerCase() === targetEntry.code_article.toLowerCase());
          if (artIdx >= 0) {
            db.articles[artIdx] = { ...db.articles[artIdx], status: 'a_faire' };
          }
        }
      }
      break;
    }

    case 'CLEAR_ENTRIES': {
      db.entries = [];
      db.articles = db.articles.map((a) => ({ ...a, status: 'a_faire' }));
      break;
    }

    case 'CLEAR_DATABASE': {
      db.articles = [];
      db.entries = [];
      db.locations = [];
      db.familles = [];
      db.machines = [];
      db.lastLocation = '';
      db.inventories = [
        {
          id: 'inv-principal',
          titre: 'Inventaire Principal',
          code: 'INV-01',
          description: "Campagne principale d'inventaire",
          dateCreation: new Date().toISOString(),
          statut: 'en_cours',
          responsable: 'ouaradtech',
          articles: [],
          entries: [],
          locations: [],
          familles: [],
          machines: [],
          lastLocation: ''
        }
      ];
      db.activeInventoryId = 'inv-principal';
      break;
    }

    case 'ADD_ARTICLE': {
      const art = payload;
      if (!art) return false;
      const existingIdx = db.articles.findIndex((a) => a.id === art.id || a.code_article.toLowerCase() === art.code_article.toLowerCase());
      if (existingIdx >= 0) {
        db.articles[existingIdx] = art;
      } else {
        db.articles.unshift(art);
      }
      if (art.machine && !db.machines.includes(art.machine)) db.machines.push(art.machine);
      if (art.famille && !db.familles.includes(art.famille)) db.familles.push(art.famille);
      if (art.emplacement && !db.locations.some((l) => l.code.toLowerCase() === art.emplacement.toLowerCase())) {
        db.locations.push({
          id: `loc-${Date.now()}`,
          code: art.emplacement,
          nom: art.emplacement,
          zone: 'Général'
        });
      }
      break;
    }

    case 'UPDATE_ARTICLE': {
      const updated = payload;
      db.articles = db.articles.map((a) => (a.id === updated.id ? updated : a));
      break;
    }

    case 'DELETE_ARTICLE': {
      const id = payload?.id || payload;
      db.articles = db.articles.filter((a) => a.id !== id);
      break;
    }

    case 'ADD_MACHINE': {
      const m = (payload?.name || payload || '').trim();
      if (m && !db.machines.some((x) => x.toLowerCase() === m.toLowerCase())) {
        db.machines.push(m);
      }
      break;
    }

    case 'DELETE_MACHINE': {
      const m = (payload?.name || payload || '').trim();
      db.machines = db.machines.filter((x) => x.toLowerCase() !== m.toLowerCase());
      break;
    }

    case 'ADD_FAMILLE': {
      const f = (payload?.name || payload || '').trim();
      if (f && !db.familles.some((x) => x.toLowerCase() === f.toLowerCase())) {
        db.familles.push(f);
      }
      break;
    }

    case 'DELETE_FAMILLE': {
      const f = (payload?.name || payload || '').trim();
      db.familles = db.familles.filter((x) => x.toLowerCase() !== f.toLowerCase());
      break;
    }

    case 'ADD_LOCATION': {
      const loc = payload;
      if (loc && loc.code) {
        if (!db.locations.some((l) => l.code.toLowerCase() === loc.code.toLowerCase())) {
          db.locations.push(loc);
        }
      }
      break;
    }

    case 'DELETE_LOCATION': {
      const idOrCode = payload?.id || payload?.code || payload;
      db.locations = db.locations.filter((l) => l.id !== idOrCode && l.code !== idOrCode);
      break;
    }

    case 'UPDATE_LOCATION': {
      const loc = payload;
      if (loc && (loc.id || loc.code)) {
        const idx = db.locations.findIndex((l) => l.id === loc.id || l.code === loc.code);
        if (idx >= 0) {
          db.locations[idx] = { ...db.locations[idx], ...loc };
        } else {
          db.locations.push(loc);
        }
      }
      break;
    }

    case 'SET_LAST_LOCATION': {
      const loc = typeof payload === 'string' ? payload : payload?.location;
      if (loc) {
        db.lastLocation = loc.trim();
      }
      break;
    }

    case 'IMPORT_ARTICLES': {
      const { newArticles, newMachines, newFamilles, newEmplacements } = payload;
      if (Array.isArray(newArticles)) {
        const map = new Map<string, any>();
        db.articles.forEach((a) => map.set(a.code_article.toLowerCase(), a));
        newArticles.forEach((a) => map.set(a.code_article.toLowerCase(), a));
        db.articles = Array.from(map.values());
      }
      if (Array.isArray(newMachines)) {
        newMachines.forEach((m) => {
          if (m && !db.machines.some((x) => x.toLowerCase() === m.toLowerCase())) {
            db.machines.push(m);
          }
        });
      }
      if (Array.isArray(newFamilles)) {
        newFamilles.forEach((f) => {
          if (f && !db.familles.some((x) => x.toLowerCase() === f.toLowerCase())) {
            db.familles.push(f);
          }
        });
      }
      if (Array.isArray(newEmplacements)) {
        newEmplacements.forEach((code) => {
          if (code && !db.locations.some((l) => l.code.toLowerCase() === code.toLowerCase())) {
            db.locations.push({
              id: `loc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              code,
              nom: code,
              zone: 'Import Catalogue'
            });
          }
        });
      }
      break;
    }

    case 'IMPORT_LOCATIONS': {
      const { newLocations, newZones } = payload;
      if (Array.isArray(newLocations)) {
        const map = new Map<string, any>();
        db.locations.forEach((l) => map.set(l.code.toLowerCase(), l));
        newLocations.forEach((l) => map.set(l.code.toLowerCase(), l));
        db.locations = Array.from(map.values());
      }
      break;
    }

    case 'LOAD_DEMO': {
      if (payload) {
        if (Array.isArray(payload.articles)) db.articles = payload.articles;
        if (Array.isArray(payload.locations)) db.locations = payload.locations;
        if (Array.isArray(payload.familles)) db.familles = payload.familles;
        if (Array.isArray(payload.machines)) db.machines = payload.machines;
      }
      break;
    }

    case 'CREATE_USER': {
      const user = payload;
      if (user && user.id && user.username) {
        if (!Array.isArray(db.users)) db.users = [];
        const existingIdx = db.users.findIndex(
          (u) => u.id === user.id || u.username.toLowerCase() === user.username.toLowerCase()
        );
        if (existingIdx >= 0) {
          db.users[existingIdx] = user;
        } else {
          db.users.push(user);
        }
      }
      break;
    }

    case 'UPDATE_USER': {
      const user = payload;
      if (user && user.id) {
        if (!Array.isArray(db.users)) db.users = [];
        const existingIdx = db.users.findIndex((u) => u.id === user.id);
        if (existingIdx >= 0) {
          db.users[existingIdx] = { ...db.users[existingIdx], ...user };
        } else {
          db.users.push(user);
        }
      }
      break;
    }

    case 'DELETE_USER': {
      const userId = payload?.id || payload;
      if (userId && Array.isArray(db.users)) {
        db.users = db.users.filter((u) => u.id !== userId && u.username?.toLowerCase() !== 'ouaradtech');
      }
      break;
    }

    case 'SYNC_USERS': {
      if (Array.isArray(payload) && payload.length > 0) {
        db.users = payload;
        if (!db.users.some((u: any) => u.username?.toLowerCase() === 'ouaradtech')) {
          db.users.unshift(DEFAULT_USERS[0]);
        }
      }
      break;
    }

    default:
      return false;
  }

  saveDatabase();
  return true;
}

// WebSocket Connection lifecycle
wss.on('connection', (ws: WebSocket) => {
  // Send current state immediately upon connection
  ws.send(
    JSON.stringify({
      type: 'INIT_STATE',
      payload: db,
      clientCount: wss.clients.size
    })
  );

  // Notify all clients of new connection
  broadcastClientCount();

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
        return;
      }

      if (data.type === 'ACTION') {
        const handled = applyAction(data.action, data.payload);
        if (handled) {
          // Broadcast updated state to all connected devices!
          broadcast({
            type: 'STATE_UPDATED',
            payload: db,
            action: data.action,
            fromClient: data.clientId
          });
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    broadcastClientCount();
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err);
  });
});

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    connectedClients: wss.clients.size,
    dbStats: {
      articles: db.articles.length,
      entries: db.entries.length,
      locations: db.locations.length,
      machines: db.machines.length,
      familles: db.familles.length
    }
  });
});

app.get('/api/inventory/state', (req, res) => {
  res.json({
    success: true,
    data: db,
    connectedClients: wss.clients.size
  });
});

app.post('/api/inventory/action', (req, res) => {
  const { action, payload, clientId } = req.body;
  if (!action) {
    return res.status(400).json({ success: false, error: 'Missing action' });
  }

  const handled = applyAction(action, payload);
  if (handled) {
    broadcast({
      type: 'STATE_UPDATED',
      payload: db,
      action,
      fromClient: clientId
    });
    return res.json({ success: true, data: db });
  }

  return res.status(400).json({ success: false, error: 'Unknown action' });
});

app.post('/api/inventory/sync', (req, res) => {
  const { articles, entries, locations, familles, machines, lastLocation, inventories, activeInventoryId, users } = req.body;
  if (articles !== undefined) db.articles = articles;
  if (entries !== undefined) db.entries = entries;
  if (locations !== undefined) db.locations = locations;
  if (familles !== undefined) db.familles = familles;
  if (machines !== undefined) db.machines = machines;
  if (lastLocation !== undefined) db.lastLocation = lastLocation;
  if (inventories !== undefined) db.inventories = inventories;
  if (activeInventoryId !== undefined) db.activeInventoryId = activeInventoryId;
  if (users !== undefined) db.users = users;

  saveDatabase();
  broadcast({
    type: 'STATE_UPDATED',
    payload: db
  });

  res.json({ success: true, data: db });
});

// Dev vs Prod Vite Integration
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Inventory Pro Server running on http://0.0.0.0:${PORT}`);
    console.log(`📡 WebSocket real-time sync listening on ws://0.0.0.0:${PORT}/api/ws`);
  });
}

startServer();
