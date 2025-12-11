// server.js (backend for BuddyUp) - COMMONJS VERSION
const express = require("express");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const PORT = 5000;
const DB_PATH = path.join(__dirname, "db.json");

// ---- CORS FIX (manual) ----
app.use((req, res, next) => {
  // allow your local frontends
  res.header("Access-Control-Allow-Origin", "http://127.0.0.1:5500");
  // if you also use localhost:5500 you can do:
//   if (req.headers.origin === "http://localhost:5500") {
//     res.header("Access-Control-Allow-Origin", req.headers.origin);
//   }

  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    // preflight request
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// ----- tiny JSON "DB" helpers -----
async function readDb() {
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    // first run / file missing
    return { users: [], profiles: [] };
  }
}

async function writeDb(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

// ----- middleware -----
app.use(express.json());

// helper
function findUserByEmail(db, email) {
  return db.users.find((u) => u.email === email);
}

// ---------- SIGNUP ----------
app.post("/api/signup", async (req, res) => {
  try {
    const { name, roll, email, password } = req.body;

    if (!name || !roll || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const db = await readDb();

    if (findUserByEmail(db, email)) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = {
      id: nanoid(),
      name,
      roll,
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    db.users.push(user);
    await writeDb(db);

    res.status(201).json({
      message: "User created",
      userId: user.id,
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- LOGIN ----------
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const db = await readDb();
    const user = findUserByEmail(db, email);

    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    res.json({
      message: "Login success",
      userId: user.id,
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- ROLE + SKILLS PROFILE ----------
app.post("/api/profile", async (req, res) => {
  try {
    const {
      userId,
      role,
      skills,
      category,
      rate,
      mode,
      availability,
      bio,
    } = req.body;

    if (!userId || !role || !skills) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const db = await readDb();
    const user = db.users.find((u) => u.id === userId);

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const profile = {
      userId,
      role,
      skills,
      category,
      rate,
      mode,
      availability,
      bio,
      updatedAt: new Date().toISOString(),
    };

    const existingIndex = db.profiles.findIndex((p) => p.userId === userId);
    if (existingIndex >= 0) {
      db.profiles[existingIndex] = profile;
    } else {
      db.profiles.push(profile);
    }

    await writeDb(db);

    res.json({ message: "Profile saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`BuddyUp backend running on http://localhost:${PORT}`);
});