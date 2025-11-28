// build v2
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
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB conectado correctamente"))
  .catch(err => console.error("Error conectando a MongoDB:", err.message));

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

// ---------- ENDPOINT DE SUBIDA ----------
app.post('/upload', upload.single('file'), (req, res) => {
  res.send({ message: 'Archivo recibido', file: req.file });
});

// ---------- CATCH-ALL PARA FRONTEND ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- INICIAR SERVIDOR ----------
app.listen(PORT, () => {
  console.log(`Servidor GesTalent corriendo en puerto ${PORT}`);
});
