/**
 * Datenbank-Modul (sql.js – reines JavaScript, kein C++ Compiler nötig)
 *
 * sql.js ist eine WASM-kompilierte Version von SQLite.
 * Es läuft komplett im Speicher und speichert auf Festplatte.
 *
 * Verwendung:
 *   await initDatabase();        // Einmal beim Start aufrufen
 *   const db = getDb();          // Danach synchron nutzbar
 *   db.prepare(sql).all(params)  // Gleiche API wie better-sqlite3
 */

const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'catwalk.db');

// Datenverzeichnis sicherstellen
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let rawDb = null; // sql.js Database-Instanz

// ─── Wrapper-Klassen (gleiche API wie better-sqlite3) ───

class StatementWrapper {
  constructor(rawDb, sql) {
    this._rawDb = rawDb;
    this._sql = sql;
  }

  /** Führt eine INSERT/UPDATE/DELETE-Anweisung aus */
  run(...params) {
    this._rawDb.run(this._sql, params.length > 0 ? params : undefined);
    const changes = this._rawDb.getRowsModified();
    // Nach Mutation auf Festplatte speichern
    _saveToDisk();
    return { changes };
  }

  /** Gibt eine einzelne Zeile zurück (oder undefined) */
  get(...params) {
    let stmt;
    try {
      stmt = this._rawDb.prepare(this._sql);
      if (params.length > 0) stmt.bind(params);
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return undefined;
    } finally {
      if (stmt) stmt.free();
    }
  }

  /** Gibt alle Zeilen als Array zurück */
  all(...params) {
    const results = [];
    let stmt;
    try {
      stmt = this._rawDb.prepare(this._sql);
      if (params.length > 0) stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
    } finally {
      if (stmt) stmt.free();
    }
    return results;
  }
}

class DatabaseWrapper {
  constructor(rawDb) {
    this._rawDb = rawDb;
  }

  /** Prepared Statement erstellen (kompatibel mit better-sqlite3 API) */
  prepare(sql) {
    return new StatementWrapper(this._rawDb, sql);
  }

  /** Rohes SQL ausführen (z.B. CREATE TABLE) */
  exec(sql) {
    this._rawDb.exec(sql);
    _saveToDisk();
  }

  /** SQLite PRAGMA setzen */
  pragma(value) {
    try {
      this._rawDb.exec(`PRAGMA ${value}`);
    } catch (e) {
      // Einige PRAGMAs werden in sql.js nicht unterstützt (z.B. WAL)
    }
  }

  /** Datenbank schließen und speichern */
  close() {
    _saveToDisk();
    this._rawDb.close();
    rawDb = null;
  }
}

// ─── Hilfsfunktionen ───

function _saveToDisk() {
  if (!rawDb) return;
  try {
    const data = rawDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('⚠️ Fehler beim Speichern der Datenbank:', e.message);
  }
}

// ─── Öffentliche API ───

/**
 * Datenbank initialisieren (muss einmal vor getDb() aufgerufen werden)
 */
async function initDatabase() {
  if (rawDb) return; // Bereits initialisiert

  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    rawDb = new SQL.Database(buffer);
  } else {
    rawDb = new SQL.Database();
  }

  // Foreign Keys aktivieren
  rawDb.exec('PRAGMA foreign_keys = ON');
}

/**
 * Datenbank-Instanz abrufen (synchron, nach initDatabase())
 */
function getDb() {
  if (!rawDb) {
    throw new Error(
      'Datenbank nicht initialisiert! Bitte zuerst "await initDatabase()" aufrufen.'
    );
  }
  return new DatabaseWrapper(rawDb);
}

module.exports = { getDb, DB_PATH, initDatabase };
