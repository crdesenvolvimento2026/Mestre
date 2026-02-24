import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("mestre.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    role TEXT,
    plan TEXT DEFAULT 'free',
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    category TEXT,
    quantity INTEGER,
    min_quantity INTEGER,
    unit_price REAL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT,
    amount REAL,
    type TEXT, -- 'income' or 'expense'
    category TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS team (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    role TEXT,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    address TEXT,
    contact TEXT
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    title TEXT,
    description TEXT,
    status TEXT DEFAULT 'open',
    priority TEXT,
    technician_id INTEGER,
    latitude REAL,
    longitude REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(client_id) REFERENCES clients(id),
    FOREIGN KEY(technician_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS calculations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER,
    description TEXT,
    data TEXT, -- JSON string of calculation parameters and results
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ticket_id) REFERENCES tickets(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER,
    user_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ticket_id) REFERENCES tickets(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS nr10_checklists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER,
    data TEXT, -- JSON string of checklist items
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ticket_id) REFERENCES tickets(id)
  );
`);

// Seed initial data if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  db.prepare("INSERT INTO users (name, email, role, plan, password) VALUES (?, ?, ?, ?, ?)").run(
    "Mestre Admin", "admin@mestre.app", "engineer", "pro", "admin123"
  );
  db.prepare("INSERT INTO clients (name, address, contact) VALUES (?, ?, ?)").run(
    "Condomínio Solar", "Av. das Palmeiras, 100", "João (11) 99999-9999"
  );
  db.prepare("INSERT INTO inventory (name, category, quantity, min_quantity, unit_price) VALUES (?, ?, ?, ?, ?)").run(
    "Disjuntor 20A Curva C", "Proteção", 50, 10, 15.50
  );
  db.prepare("INSERT INTO transactions (description, amount, type, category) VALUES (?, ?, ?, ?)").run(
    "Assinatura Plano PRO", 199.90, "income", "SaaS"
  );
  db.prepare("INSERT INTO team (name, role) VALUES (?, ?)").run(
    "Carlos Silva", "Eletricista Pleno"
  );
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  app.use(express.json());

  // WebSocket Broadcast Helper
  const broadcast = (data: any) => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  wss.on("connection", (ws) => {
    console.log("Client connected to WebSocket");
  });

  // API Routes
  app.get("/api/dashboard/stats", (req, res) => {
    const openTickets = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'open'").get() as { count: number };
    const inProgress = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'in_progress'").get() as { count: number };
    const completed = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'completed'").get() as { count: number };
    const revenue = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'income'").get() as { total: number };
    
    res.json({
      open: openTickets.count,
      inProgress: inProgress.count,
      completed: completed.count,
      total: openTickets.count + inProgress.count + completed.count,
      revenue: revenue.total || 0
    });
  });

  app.get("/api/inventory", (req, res) => {
    res.json(db.prepare("SELECT * FROM inventory").all());
  });

  app.get("/api/inventory/export", (req, res) => {
    const items = db.prepare("SELECT * FROM inventory").all() as any[];
    const csv = "ID,Nome,Categoria,Quantidade,Preço\n" + 
      items.map(i => `${i.id},${i.name},${i.category},${i.quantity},${i.unit_price}`).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.attachment("estoque.csv");
    res.send(csv);
  });

  app.get("/api/finance", (req, res) => {
    res.json(db.prepare("SELECT * FROM transactions ORDER BY date DESC").all());
  });

  app.get("/api/finance/export", (req, res) => {
    const items = db.prepare("SELECT * FROM transactions").all() as any[];
    const csv = "ID,Descrição,Valor,Tipo,Categoria,Data\n" + 
      items.map(i => `${i.id},${i.description},${i.amount},${i.type},${i.category},${i.date}`).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.attachment("financeiro.csv");
    res.send(csv);
  });

  app.get("/api/team", (req, res) => {
    res.json(db.prepare("SELECT * FROM team").all());
  });

  app.post("/api/inventory/reserve", (req, res) => {
    const { items } = req.body; // Array of { name, quantity }
    const stmt = db.prepare("UPDATE inventory SET quantity = quantity - ? WHERE name = ?");
    
    const transaction = db.transaction((items) => {
      for (const item of items) {
        stmt.run(item.quantity, item.name);
      }
    });

    try {
      transaction(items);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/finance/budget", (req, res) => {
    const { description, amount, ticket_id } = req.body;
    const result = db.prepare(`
      INSERT INTO transactions (description, amount, type, category)
      VALUES (?, ?, 'income', 'Serviço/Material')
    `).run(`${description} (Chamado #${ticket_id})`, amount);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/login", (req, res) => {
    // Simulated login for prototype
    res.json({
      token: "mestre_token_123",
      user: { name: "Mestre Admin", role: "engineer", plan: "pro" }
    });
  });

  app.get("/api/tickets", (req, res) => {
    const tickets = db.prepare(`
      SELECT t.*, c.name as client_name 
      FROM tickets t 
      JOIN clients c ON t.client_id = c.id 
      ORDER BY t.created_at DESC
    `).all();
    res.json(tickets);
  });

  app.post("/api/tickets", (req, res) => {
    const { client_id, title, description, priority, technician_id } = req.body;
    const result = db.prepare(`
      INSERT INTO tickets (client_id, title, description, priority, technician_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(client_id, title, description, priority, technician_id);
    
    broadcast({ type: "TICKET_CREATED", ticket: { id: result.lastInsertRowid, title, status: 'open' } });
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/nr10/:ticketId", (req, res) => {
    const checklist = db.prepare("SELECT * FROM nr10_checklists WHERE ticket_id = ?").get(req.params.ticketId);
    res.json(checklist || null);
  });

  app.post("/api/nr10", (req, res) => {
    const { ticket_id, data } = req.body;
    db.prepare("INSERT INTO nr10_checklists (ticket_id, data) VALUES (?, ?)").run(ticket_id, JSON.stringify(data));
    res.json({ success: true });
  });

  app.get("/api/messages/:ticketId", (req, res) => {
    const messages = db.prepare("SELECT * FROM messages WHERE ticket_id = ? ORDER BY created_at ASC").all(req.params.ticketId);
    res.json(messages);
  });

  app.post("/api/messages", (req, res) => {
    const { ticket_id, user_id, content } = req.body;
    db.prepare("INSERT INTO messages (ticket_id, user_id, content) VALUES (?, ?, ?)").run(ticket_id, user_id, content);
    broadcast({ type: "NEW_MESSAGE", ticket_id, message: { user_id, content, created_at: new Date() } });
    res.json({ success: true });
  });

  app.get("/api/clients", (req, res) => {
    const clients = db.prepare("SELECT * FROM clients").all();
    res.json(clients);
  });

  app.get("/api/calculations/:ticketId", (req, res) => {
    const calcs = db.prepare("SELECT * FROM calculations WHERE ticket_id = ?").all(req.params.ticketId);
    res.json(calcs);
  });

  app.post("/api/calculations", (req, res) => {
    const { ticket_id, description, data } = req.body;
    const result = db.prepare(`
      INSERT INTO calculations (ticket_id, description, data)
      VALUES (?, ?, ?)
    `).run(ticket_id, description, JSON.stringify(data));
    res.json({ id: result.lastInsertRowid });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
