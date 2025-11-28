const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// ---------- CONFIG SERVIDOR ----------
const PORT = process.env.PORT || 4000;

// ---------- MONGODB ----------
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("MongoDB conectado correctamente");
}).catch(err => {
  console.error("Error conectando a MongoDB:", err.message);
});

// ---------- STATIC FILES ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- PARSE FORM DATA ----------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---------- UPLOADS ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ---------- MODELO ----------
const candidatoSchema = new mongoose.Schema({
  nombre: String,
  email: String,
  telefono: String,
  ciudad: String,
  areaInteres: String,
  cargoInteres: String,
  cv: String,
  origen: String
});

const Candidato = mongoose.model('Candidato', candidatoSchema);

// ---------- API ----------
app.post('/api/candidates', upload.single('cv'), async (req, res) => {
  try {
    const nuevo = new Candidato({
      nombre: req.body.nombre,
      email: req.body.email,
      telefono: req.body.telefono,
      ciudad: req.body.ciudad,
      areaInteres: req.body.areaInteres,
      cargoInteres: req.body.cargoInteres,
      cv: req.file ? req.file.filename : null,
      origen: req.body.origen || 'Portal GesTalent'
    });

    await nuevo.save();
    res.status(200).send("Candidato registrado");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error registrando candidato");
  }
});

// ---------- RUTA PRINCIPAL ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- INICIAR SERVIDOR ----------
app.listen(PORT, () => {
  console.log(`Servidor GesTalent corriendo en puerto ${PORT}`);
});
