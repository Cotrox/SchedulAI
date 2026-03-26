import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn("JWT_SECRET not found in environment. Using fallback for development.");
}
const SECRET = JWT_SECRET || "schedulai-super-secret-key";
const DATA_DIR = path.join(process.cwd(), "data");
const USERS_CSV = path.join(DATA_DIR, "users.csv");
const DEADLINES_CSV = path.join(DATA_DIR, "deadlines.csv");

// Ensure data directory and files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(USERS_CSV)) {
  fs.writeFileSync(USERS_CSV, "id,email,password,emailNotifications,onboarded\n");
}
if (!fs.existsSync(DEADLINES_CSV)) {
  fs.writeFileSync(DEADLINES_CSV, "id,userId,title,amount,dueDate,frequency,lastPaidDate,category\n");
}

function readCSV(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, { columns: true, skip_empty_lines: true });
}

function writeCSV(filePath: string, data: any[]) {
  const content = stringify(data, { header: true });
  fs.writeFileSync(filePath, content);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // Auth Routes
  app.post("/api/auth/signup", async (req, res) => {
    const { email, password } = req.body;
    const users = readCSV(USERS_CSV);

    if (users.find((u: any) => u.email === email)) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now().toString(), email, password: hashedPassword, emailNotifications: "false", onboarded: "false" };
    users.push(newUser);
    writeCSV(USERS_CSV, users);

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, SECRET);
    res.json({ token, user: { id: newUser.id, email: newUser.email, emailNotifications: false, onboarded: false } });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const users = readCSV(USERS_CSV) as any[];
    const user = users.find((u: any) => u.email === email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, SECRET);
    res.json({ token, user: { id: user.id, email: user.email, emailNotifications: user.emailNotifications === "true", onboarded: user.onboarded === "true" } });
  });

  // Profile Routes
  app.get("/api/profile", authenticateToken, (req: any, res) => {
    const users = readCSV(USERS_CSV) as any[];
    const user = users.find((u: any) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ id: user.id, email: user.email, emailNotifications: user.emailNotifications === "true", onboarded: user.onboarded === "true" });
  });

  app.put("/api/profile", authenticateToken, (req: any, res) => {
    const users = readCSV(USERS_CSV) as any[];
    const index = users.findIndex((u: any) => u.id === req.user.id);
    if (index === -1) return res.status(404).json({ error: "User not found" });

    users[index] = { ...users[index], ...req.body };
    // Ensure boolean fields are stored as string "true"/"false"
    if (req.body.emailNotifications !== undefined) {
      users[index].emailNotifications = String(req.body.emailNotifications);
    }
    if (req.body.onboarded !== undefined) {
      users[index].onboarded = String(req.body.onboarded);
    }
    
    writeCSV(USERS_CSV, users);
    res.json({ 
      id: users[index].id, 
      email: users[index].email, 
      emailNotifications: users[index].emailNotifications === "true",
      onboarded: users[index].onboarded === "true"
    });
  });

  app.delete("/api/profile", authenticateToken, (req: any, res) => {
    // Delete user
    const users = readCSV(USERS_CSV) as any[];
    const filteredUsers = users.filter((u: any) => u.id !== req.user.id);
    writeCSV(USERS_CSV, filteredUsers);

    // Delete user's deadlines
    const deadlines = readCSV(DEADLINES_CSV) as any[];
    const filteredDeadlines = deadlines.filter((d: any) => d.userId !== req.user.id);
    writeCSV(DEADLINES_CSV, filteredDeadlines);

    res.sendStatus(204);
  });

  // Deadlines Routes
  app.get("/api/deadlines", authenticateToken, (req: any, res) => {
    const deadlines = readCSV(DEADLINES_CSV) as any[];
    const userDeadlines = deadlines.filter((d: any) => d.userId === req.user.id);
    res.json(userDeadlines);
  });

  app.post("/api/deadlines", authenticateToken, (req: any, res) => {
    const deadlines = readCSV(DEADLINES_CSV) as any[];
    const newDeadline = {
      ...req.body,
      id: Date.now().toString(),
      userId: req.user.id
    };
    deadlines.push(newDeadline);
    writeCSV(DEADLINES_CSV, deadlines);
    res.json(newDeadline);
  });

  app.put("/api/deadlines/:id", authenticateToken, (req: any, res) => {
    const deadlines = readCSV(DEADLINES_CSV) as any[];
    const index = deadlines.findIndex((d: any) => d.id === req.params.id && d.userId === req.user.id);
    if (index === -1) return res.status(404).json({ error: "Not found" });

    deadlines[index] = { ...deadlines[index], ...req.body };
    writeCSV(DEADLINES_CSV, deadlines);
    res.json(deadlines[index]);
  });

  app.delete("/api/deadlines/:id", authenticateToken, (req: any, res) => {
    const deadlines = readCSV(DEADLINES_CSV) as any[];
    const filtered = deadlines.filter((d: any) => !(d.id === req.params.id && d.userId === req.user.id));
    writeCSV(DEADLINES_CSV, filtered);
    res.sendStatus(204);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
