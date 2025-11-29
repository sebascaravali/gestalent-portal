const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// ---------- CONFIG SERVIDOR ----------
const PORT = process.env.PORT || 4000;

// ---------- LOG DE TODAS LAS PETICIONES (para depurar) ----------
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ---------- MONGODB ----------
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('MongoDB conectado correctamente');
  })
  .catch((err) => {
    console.error('Error conectando a MongoDB:', err.message);
  });

// ---------- STATIC FILES ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- PARSEO DE FORMULARIOS ----------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---------- CARGA DE ARCHIVOS (CV) ----------
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ---------- MODELO ----------
const candidatoSchema = new mongoose.Schema(
  {
    nombre: String,
    email: String,
    telefono: String,
    ciudad: String,
    areaInteres: String,
    cargoInteres: String,
    cv: String,
    origen: String,
  },
  { timestamps: true }
);

const Candidato = mongoose.model('Candidato', candidatoSchema);

// ---------- ENDPOINT DE SALUD (PRUEBA RÁPIDA) ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'API funcionando' });
});

// ---------- LISTAR ÚLTIMOS CANDIDATOS (PRUEBA) ----------
app.get('/api/candidates', async (req, res) => {
  try {
    const candidatos = await Candidato.find()
      .sort({ createdAt: -1 })
      .limit(10);
    res.json({ ok: true, data: candidatos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Error obteniendo candidatos' });
  }
});

// ---------- API REGISTRO DE CANDIDATOS ----------
app.post('/api/candidates', upload.single('cv'), async (req, res) => {
  try {
    console.log('BODY:', req.body);
    console.log('FILE:', req.file);

    const nuevo = new Candidato({
      nombre: req.body.nombre,
      email: req.body.email,
      telefono: req.body.telefono,
      ciudad: req.body.ciudad,
      areaInteres: req.body.areaInteres,
      cargoInteres: req.body.cargoInteres,
      cv: req.file ? req.file.filename : null,
      origen: req.body.origen || 'Portal GesTalent',
    });

    await nuevo.save();

    res.status(200).json({
      ok: true,
      message: 'Candidato registrado correctamente',
    });
  } catch (err) {
    console.error('Error registrando candidato:', err);
    res.status(500).json({
      ok: false,
      message: 'Error registrando candidato',
    });
  }
});

// ---------- RUTA PRINCIPAL (SPA / FRONT) ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- INICIAR SERVIDOR ----------
app.listen(PORT, () => {
  console.log(`Servidor GesTalent corriendo en puerto ${PORT}`);
});
