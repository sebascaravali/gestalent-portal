const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Load Big Five items from JSON
let bigFiveItems = [];
try {
  const cfgPath = path.join(__dirname, "bigfive_items.json");
  if (fs.existsSync(cfgPath)) {
    bigFiveItems = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  }
} catch (e) {
  console.warn("No se pudo cargar bigfive_items.json:", e.message);
}

// Ensure uploads directory exists
const uploadsPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// Multer storage for CV
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsPath);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9\.\-_]/g, "_");
    cb(null, unique + "-" + safeName);
  },
});
const upload = multer({ storage });

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/gestalent_portal";
mongoose
  .connect(mongoUri)
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch((err) => console.error("❌ Error conectando a MongoDB:", err.message));

// Schemas
const candidateSchema = new mongoose.Schema(
  {
    nombre: String,
    email: { type: String, index: true },
    telefono: String,
    ciudad: String,
    areaInteres: String,
    cvFile: String,
    origen: String,
  },
  { timestamps: true }
);
const Candidate = mongoose.model("Candidate", candidateSchema);

const assessmentSchema = new mongoose.Schema(
  {
    nombre: String,
    email: String,
    ciudad: String,
    areaInteres: String,
    respuestas: Object,
    promedios: Object,
    puntajeGlobal: Number,
  },
  { timestamps: true }
);
const Assessment = mongoose.model("Assessment", assessmentSchema);

const bigFiveSchema = new mongoose.Schema(
  {
    nombre: String,
    email: String,
    ciudad: String,
    areaInteres: String,
    answers: Object,
    scores: Object,
    globalScore: Number,
  },
  { timestamps: true }
);
const BigFiveResult = mongoose.model("BigFiveResult", bigFiveSchema);

// Auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ message: "Token requerido" });
  const parts = authHeader.split(" ");
  const token = parts.length === 2 ? parts[1] : parts[0];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido" });
  }
}

// Health
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Login admin
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || "admin";
  const adminPass = process.env.ADMIN_PASSWORD || "admin123";
  if (username !== adminUser || password !== adminPass) {
    return res.status(401).json({ message: "Credenciales incorrectas" });
  }
  const token = jwt.sign(
    { username },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "8h" }
  );
  res.json({ token });
});

// Public: register candidate (Paso 1 obligatorio)
app.post("/api/candidates", upload.single("cv"), async (req, res) => {
  try {
    const { nombre, email, telefono, ciudad, areaInteres, origen } = req.body;
    const cvFile = req.file ? req.file.filename : null;

    const cand = new Candidate({
      nombre,
      email: (email || "").toLowerCase(),
      telefono,
      ciudad,
      areaInteres,
      cvFile,
      origen: origen || "Portal GesTalent",
    });
    await cand.save();
    res.status(201).json({ message: "Candidato registrado correctamente" });
  } catch (error) {
    console.error("Error registrando candidato:", error);
    res.status(500).json({ message: "Error al registrar candidato" });
  }
});

// Public: check candidate by email
app.get("/api/candidates/check", async (req, res) => {
  try {
    const email = (req.query.email || "").toString().trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ exists: false, message: "Email requerido" });
    }
    const cand = await Candidate.findOne({ email });
    res.json({ exists: !!cand });
  } catch (error) {
    console.error("Error verificando candidato:", error);
    res.status(500).json({ exists: false, message: "Error al verificar candidato" });
  }
});

// Admin: list candidates
app.get("/api/candidates", authMiddleware, async (req, res) => {
  try {
    const list = await Candidate.find().sort({ createdAt: -1 }).limit(1000);
    res.json(list);
  } catch (error) {
    console.error("Error obteniendo candidatos:", error);
    res.status(500).json({ message: "Error al obtener candidatos" });
  }
});

// Public: save competencies assessment (requires previous registration)
app.post("/api/assessments", upload.none(), async (req, res) => {
  try {
    const {
      nombre,
      email,
      ciudad,
      areaInteres,
      respuestasJSON,
      promediosJSON,
      puntajeGlobal,
    } = req.body;

    const emailClean = (email || "").toString().trim().toLowerCase();
    if (!emailClean) {
      return res.status(400).json({ message: "Email requerido para la evaluación." });
    }

    const candidate = await Candidate.findOne({ email: emailClean });
    if (!candidate) {
      return res.status(400).json({
        message:
          "Para completar esta evaluación primero debes registrarte como candidato en el portal (sección Registro).",
      });
    }

    let respuestas = {};
    let promedios = {};
    try {
      if (respuestasJSON) respuestas = JSON.parse(respuestasJSON);
      if (promediosJSON) promedios = JSON.parse(promediosJSON);
    } catch (e) {
      console.warn("No se pudieron parsear respuestas/promedios:", e.message);
    }

    const doc = new Assessment({
      nombre,
      email: emailClean,
      ciudad,
      areaInteres,
      respuestas,
      promedios,
      puntajeGlobal: puntajeGlobal ? Number(puntajeGlobal) : undefined,
    });

    await doc.save();
    res.status(201).json({ message: "Evaluación registrada correctamente" });
  } catch (error) {
    console.error("Error guardando evaluación:", error);
    res.status(500).json({ message: "Error al registrar evaluación" });
  }
});

// Admin: list assessments
app.get("/api/assessments", authMiddleware, async (req, res) => {
  try {
    const list = await Assessment.find().sort({ createdAt: -1 }).limit(1000);
    res.json(list);
  } catch (error) {
    console.error("Error obteniendo evaluaciones:", error);
    res.status(500).json({ message: "Error al obtener evaluaciones" });
  }
});

// Big Five items
app.get("/api/bigfive/items", (req, res) => {
  res.json(bigFiveItems || []);
});

// Public: save Big Five 132 (requires previous registration)
app.post("/api/bigfive", upload.none(), async (req, res) => {
  try {
    const {
      nombre,
      email,
      ciudad,
      areaInteres,
      answersJSON,
      dimScoresJSON,
      globalScore,
    } = req.body;

    const emailClean = (email || "").toString().trim().toLowerCase();
    if (!emailClean) {
      return res.status(400).json({ message: "Email requerido para el cuestionario." });
    }

    const candidate = await Candidate.findOne({ email: emailClean });
    if (!candidate) {
      return res.status(400).json({
        message:
          "Para completar este cuestionario primero debes registrarte como candidato en el portal (sección Registro).",
      });
    }

    let answers = {};
    let scores = {};
    try {
      if (answersJSON) answers = JSON.parse(answersJSON);
      if (dimScoresJSON) scores = JSON.parse(dimScoresJSON);
    } catch (e) {
      console.warn("No se pudieron parsear answers/scores:", e.message);
    }

    const doc = new BigFiveResult({
      nombre,
      email: emailClean,
      ciudad,
      areaInteres,
      answers,
      scores,
      globalScore: globalScore ? Number(globalScore) : undefined,
    });

    await doc.save();
    res.status(201).json({ message: "Cuestionario Big Five registrado correctamente" });
  } catch (error) {
    console.error("Error guardando Big Five:", error);
    res.status(500).json({ message: "Error al registrar cuestionario Big Five" });
  }
});

// Admin: list Big Five results
app.get("/api/bigfive", authMiddleware, async (req, res) => {
  try {
    const list = await BigFiveResult.find().sort({ createdAt: -1 }).limit(1000);
    res.json(list);
  } catch (error) {
    console.error("Error obteniendo Big Five:", error);
    res.status(500).json({ message: "Error al obtener Big Five" });
  }
});

// Fallback SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`🚀 Servidor GesTalent corriendo en http://localhost:${port}`);
});
