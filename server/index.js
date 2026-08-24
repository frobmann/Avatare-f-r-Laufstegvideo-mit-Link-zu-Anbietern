const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statische Dateien
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Uploads-Verzeichnis sicherstellen
fs.mkdirSync(path.join(__dirname, '..', 'uploads'), { recursive: true });

// Datenbank initialisieren (falls noch nicht geschehen)
const { DB_PATH } = require('./db');
if (!fs.existsSync(DB_PATH)) {
  console.log('📦 Initialisiere Datenbank...');
  require('./init-db');
}

// API Routes
app.use('/api/avatars', require('./routes/avatars'));
app.use('/api/providers', require('./routes/providers'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/catwalk', require('./routes/catwalk'));

// Admin Dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Catwalk Ansicht
app.get('/catwalk', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'catwalk.html'));
});

// Startseite
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Interner Serverfehler', details: err.message });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║  🎭 Avatar Catwalk Shop System                  ║
║  ────────────────────────────────────────────    ║
║  🌐 Server:    http://localhost:${PORT}            ║
║  👔 Admin:     http://localhost:${PORT}/admin       ║
║  🎬 Catwalk:   http://localhost:${PORT}/catwalk     ║
║  📡 API:       http://localhost:${PORT}/api         ║
╚══════════════════════════════════════════════════╝
  `);
});
