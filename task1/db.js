// src/db.js
// Sets up the SQLite database and the Contact table, matching the schema
// given in the assignment:
//   id, phoneNumber, email, linkedId, linkPrecedence,
//   createdAt, updatedAt, deletedAt
//
// SQLite (via better-sqlite3) is used so the project runs with zero external
// setup. Swapping to Postgres/MySQL only requires changing this file - all
// SQL here is plain, portable SQL (see README "Using Postgres instead").

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS Contact (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    phoneNumber    TEXT,
    email          TEXT,
    linkedId       INTEGER,
    linkPrecedence TEXT NOT NULL CHECK (linkPrecedence IN ('primary', 'secondary')),
    createdAt      TEXT NOT NULL,
    updatedAt      TEXT NOT NULL,
    deletedAt      TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_contact_email ON Contact(email);
  CREATE INDEX IF NOT EXISTS idx_contact_phone ON Contact(phoneNumber);
  CREATE INDEX IF NOT EXISTS idx_contact_linkedId ON Contact(linkedId);
`);

module.exports = db;
