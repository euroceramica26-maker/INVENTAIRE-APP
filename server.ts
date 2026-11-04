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
const BACKUP_FILE = path.resolve(DATA_DIR, 'inventory-database-backup.json');

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
  isCleared?: boolean;
}

const DEFAULT_USERS = [
  {
    id: 'usr-admin-01',
    username: 'ouaradtech',
    nom: 'Radouan Ouarad (Admin)',
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
  updatedAt: new Date().toISOString(),
  isCleared: false
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
      const isCleared = typeof parsed.isCleared === 'boolean' ? parsed.isCleared : false;

      let users = Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : [...DEFAULT_USERS];
      // Migrate legacy name Mohamed Ouarad to Radouan Ouarad
      users = users.map((u: any) => {
        if (u.nom && u.nom.includes('Mohamed Ouarad')) {
          return { ...u, nom: 'Radouan Ouarad (Admin)' };
        }
        return u;
      });
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
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        isCleared
      };
    }
  } catch (err) {
    console.error('Error loading inventory database file:', err);
  }
  return { ...emptyDatabase };
}

function syncActiveInventoryInList(): void {
  if (!Array.isArray(db.inventories) || db.inventories.length === 0) {
    db.inventories = [
      {
        id: db.activeInventoryId || 'inv-principal',
        titre: 'Inventaire Principal',
        code: 'INV-01',
        description: "Campagne principale d'inventaire",
        dateCreation: new Date().toISOString(),
        statut: 'en_cours',
        responsable: 'ouaradtech',
        articles: db.articles,
        entries: db.entries,
        locations: db.locations,
        familles: db.familles,
        machines: db.machines,
        lastLocation: db.lastLocation
      }
    ];
    db.activeInventoryId = db.inventories[0].id;
    return;
  }

  let idx = db.inventories.findIndex((inv) => inv.id === db.activeInventoryId);
  if (idx < 0) {
    idx = 0;
    db.activeInventoryId = db.inventories[0].id;
  }

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

function saveDatabase(): void {
  try {
    syncActiveInventoryInList();
    db.updatedAt = new Date().toISOString();
    const serialized = JSON.stringify(db, null, 2);
    fs.writeFileSync(DB_FILE, serialized, 'utf-8');
    fs.writeFileSync(BACKUP_FILE, serialized, 'utf-8');
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
        if (Array.isArray(payload.entries)) {
          if (payload.entries.length > 0 || db.isCleared) {
            db.entries = payload.entries;
          }
        }
        if (Array.isArray(payload.locations)) db.locations = payload.locations;
        if (Array.isArray(payload.familles)) db.familles = payload.familles;
        if (Array.isArray(payload.machines)) db.machines = payload.machines;
        if (Array.isArray(payload.users)) db.users = payload.users;
        if (typeof payload.lastLocation === 'string') db.lastLocation = payload.lastLocation;
      }
      break;
    }

    case 'CREATE_INVENTORY': {
      const newInv = payload.campaign || payload;
      if (!newInv || !newInv.id) return false;
      const existingIdx = db.inventories.findIndex((i) => i.id === newInv.id);
      if (existingIdx >= 0) {
        db.inventories[existingIdx] = newInv;
      } else {
        db.inventories.unshift(newInv);
      }
      const doSwitch = payload.switchToNew !== false;
      if (doSwitch) {
        syncActiveInventoryInList();
        db.activeInventoryId = newInv.id;
        db.articles = Array.isArray(newInv.articles) ? newInv.articles : [];
        db.entries = Array.isArray(newInv.entries) ? newInv.entries : [];
        db.locations = Array.isArray(newInv.locations) ? newInv.locations : [];
        db.familles = Array.isArray(newInv.familles) ? newInv.familles : [];
        db.machines = Array.isArray(newInv.machines) ? newInv.machines : [];
        db.lastLocation = newInv.lastLocation || '';
      }
      db.isCleared = false;
      break;
    }

    case 'SWITCH_INVENTORY': {
      const targetId = typeof payload === 'string' ? payload : (payload?.inventoryId || payload?.id);
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
      db.isCleared = false;
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
      if (!entry || !entry.code_article) return false;

      const rawLoc = (entry.emplacement || '').trim();
      const realLocation = (rawLoc && rawLoc !== 'Non renseigné' && rawLoc !== 'Non assigné')
        ? rawLoc
        : (db.lastLocation && db.lastLocation !== 'Non renseigné' && db.lastLocation !== 'Non assigné')
        ? db.lastLocation
        : (rawLoc || '');

      entry.emplacement = realLocation;
      const rawPos = (entry.position || '').trim();
      entry.position = (rawPos && rawPos !== '-' && rawPos !== 'Non assigné' && rawPos !== 'Non renseigné') ? rawPos : '';
      entry.status = 'saisi';

      const entryCode = (entry.code_article || '').toLowerCase().trim();
      const entryLoc = (entry.emplacement || '').toLowerCase().trim();

      const index = db.entries.findIndex((e) => e && e.id === entry.id);
      if (index >= 0) {
        db.entries[index] = entry;
      } else {
        // Safe check duplicate code_article & emplacement
        const matchIdx = db.entries.findIndex(
          (e) =>
            e &&
            (e.code_article || '').toLowerCase().trim() === entryCode &&
            (e.emplacement || '').toLowerCase().trim() === entryLoc
        );
        if (matchIdx >= 0) {
          db.entries[matchIdx] = entry;
        } else {
          db.entries.unshift(entry);
        }
      }
      if (realLocation && realLocation !== 'Non assigné' && realLocation !== 'Non renseigné') {
        db.lastLocation = realLocation;
      }

      // Update status in db.articles if found - Stock Interne (quantite) must NEVER be modified!
      const artIdx = db.articles.findIndex((a) => a && (a.code_article || '').toLowerCase().trim() === entryCode);
      if (artIdx >= 0) {
        db.articles[artIdx] = {
          ...db.articles[artIdx],
          status: 'saisi',
          emplacement: realLocation || db.articles[artIdx].emplacement
        };
      }
      db.isCleared = false;
      syncActiveInventoryInList();
      saveDatabase();
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
      db.isCleared = true;
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
      db.isCleared = false;
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
      syncActiveInventoryInList();
      break;
    }

    case 'IMPORT_LOCATIONS': {
      db.isCleared = false;
      const { newLocations, newZones } = payload;
      if (Array.isArray(newLocations)) {
        const map = new Map<string, any>();
        db.locations.forEach((l) => map.set(l.code.toLowerCase(), l));
        newLocations.forEach((l) => map.set(l.code.toLowerCase(), l));
        db.locations = Array.from(map.values());
      }
      syncActiveInventoryInList();
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
  if (Array.isArray(entries)) {
    if (entries.length > 0 || db.isCleared) {
      db.entries = entries;
    }
  }
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

app.post('/api/inventory/clear-database', (req, res) => {
  applyAction('CLEAR_DATABASE', null);
  broadcast({
    type: 'STATE_UPDATED',
    payload: db,
    action: 'CLEAR_DATABASE'
  });
  res.json({ success: true, message: 'Base de données effacée définitivement', data: db });
});

app.post('/api/inventory/clear-entries', (req, res) => {
  applyAction('CLEAR_ENTRIES', null);
  broadcast({
    type: 'STATE_UPDATED',
    payload: db,
    action: 'CLEAR_ENTRIES'
  });
  res.json({ success: true, message: 'Saisies d inventaire vidées avec succès', data: db });
});

app.post('/api/inventory/import-articles', (req, res) => {
  db.isCleared = false;
  applyAction('IMPORT_ARTICLES', req.body);
  broadcast({
    type: 'STATE_UPDATED',
    payload: db,
    action: 'IMPORT_ARTICLES'
  });
  res.json({ success: true, message: 'Articles importés et enregistrés avec succès', count: db.articles.length, data: db });
});

app.post('/api/inventory/import-locations', (req, res) => {
  db.isCleared = false;
  applyAction('IMPORT_LOCATIONS', req.body);
  broadcast({
    type: 'STATE_UPDATED',
    payload: db,
    action: 'IMPORT_LOCATIONS'
  });
  res.json({ success: true, message: 'Emplacements importés et enregistrés avec succès', count: db.locations.length, data: db });
});

// Sauvegarde automatique globale après toute modification ou importation
app.post('/api/inventory/save-all', (req, res) => {
  const { articles, entries, locations, familles, machines, lastLocation, inventories, activeInventoryId, users } = req.body;
  if (Array.isArray(articles) && articles.length > 0) db.isCleared = false;
  if (articles !== undefined) db.articles = articles;
  if (Array.isArray(entries)) {
    if (entries.length > 0 || db.isCleared) {
      db.entries = entries;
    }
  }
  if (locations !== undefined) db.locations = locations;
  if (familles !== undefined) db.familles = familles;
  if (machines !== undefined) db.machines = machines;
  if (lastLocation !== undefined) db.lastLocation = lastLocation;
  if (Array.isArray(inventories) && inventories.length > 0) db.inventories = inventories;
  if (typeof activeInventoryId === 'string' && activeInventoryId) db.activeInventoryId = activeInventoryId;
  if (Array.isArray(users) && users.length > 0) db.users = users;

  saveDatabase();
  broadcast({
    type: 'STATE_UPDATED',
    payload: db,
    action: 'SAVE_ALL'
  });

  res.json({
    success: true,
    message: 'Sauvegarde automatique réussie',
    savedAt: db.updatedAt,
    data: db
  });
});

app.post('/api/inventory/create-inventory', (req, res) => {
  const ok = applyAction('CREATE_INVENTORY', req.body);
  if (ok) {
    saveDatabase();
    broadcast({
      type: 'STATE_UPDATED',
      payload: db,
      action: 'CREATE_INVENTORY'
    });
    return res.json({
      success: true,
      message: 'Nouvel inventaire créé et enregistré avec succès dans la base',
      activeInventoryId: db.activeInventoryId,
      inventories: db.inventories,
      data: db
    });
  }
  res.status(400).json({ success: false, error: "Impossible de créer l'inventaire" });
});

app.post('/api/inventory/switch-inventory', (req, res) => {
  const ok = applyAction('SWITCH_INVENTORY', req.body);
  if (ok) {
    saveDatabase();
    broadcast({
      type: 'STATE_UPDATED',
      payload: db,
      action: 'SWITCH_INVENTORY'
    });
    return res.json({
      success: true,
      message: "Dossier d'inventaire activé et synchronisé",
      activeInventoryId: db.activeInventoryId,
      data: db
    });
  }
  res.status(400).json({ success: false, error: "Impossible de changer d'inventaire" });
});

app.post('/api/inventory/update-inventory', (req, res) => {
  const ok = applyAction('UPDATE_INVENTORY', req.body);
  if (ok) {
    saveDatabase();
    broadcast({
      type: 'STATE_UPDATED',
      payload: db,
      action: 'UPDATE_INVENTORY'
    });
    return res.json({
      success: true,
      message: "Inventaire mis à jour et sauvegardé",
      data: db
    });
  }
  res.status(400).json({ success: false, error: "Impossible de mettre à jour l'inventaire" });
});

app.post('/api/inventory/delete-inventory', (req, res) => {
  const ok = applyAction('DELETE_INVENTORY', req.body);
  if (ok) {
    saveDatabase();
    broadcast({
      type: 'STATE_UPDATED',
      payload: db,
      action: 'DELETE_INVENTORY'
    });
    return res.json({
      success: true,
      message: "Inventaire supprimé de la base",
      activeInventoryId: db.activeInventoryId,
      data: db
    });
  }
  res.status(400).json({ success: false, error: "Impossible de supprimer l'inventaire" });
});

// Dev vs Prod Vite Integration
const distPath = path.resolve(__dirname, 'dist');
const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
const isProduction = process.env.NODE_ENV === 'production' || (hasDist && process.env.NODE_ENV !== 'development');

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
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
