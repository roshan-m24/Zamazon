// src/identityService.js
// Core reconciliation logic for the /identify endpoint.
//
// Algorithm summary:
//   1. Find every non-deleted Contact row whose email OR phoneNumber matches
//      the incoming request.
//   2. If nothing matches -> create a brand new "primary" contact.
//   3. If something matches -> walk every match to its ultimate primary
//      contact, collect the full set of primaries touched.
//        - If more than one distinct primary is touched, the OLDEST one
//          (by createdAt, ties broken by id) stays primary; every other
//          primary (and everything already linked to it) is converted to
//          "secondary" and re-linked to the oldest primary.
//        - If the incoming request carries an email or phoneNumber that is
//          not yet present anywhere in the consolidated group, a new
//          "secondary" contact is created holding that new information.
//   4. Return the consolidated contact info.

const db = require('./db');

function nowIso() {
  return new Date().toISOString();
}

// Find all non-deleted contacts that directly match the given email or phone.
function findDirectMatches(email, phoneNumber) {
  const clauses = [];
  const params = {};
  if (email) {
    clauses.push('email = @email');
    params.email = email;
  }
  if (phoneNumber) {
    clauses.push('phoneNumber = @phoneNumber');
    params.phoneNumber = phoneNumber;
  }
  if (clauses.length === 0) return [];

  const sql = `SELECT * FROM Contact WHERE deletedAt IS NULL AND (${clauses.join(' OR ')})`;
  return db.prepare(sql).all(params);
}

// Given a contact row, walk to its primary ancestor (a contact's linkedId
// chain should only ever be one level deep in steady state, but we walk
// defensively in case of legacy data).
function resolvePrimaryOf(contact) {
  let current = contact;
  const seen = new Set();
  while (current.linkPrecedence === 'secondary' && current.linkedId && !seen.has(current.id)) {
    seen.add(current.id);
    const next = db.prepare('SELECT * FROM Contact WHERE id = ?').get(current.linkedId);
    if (!next) break;
    current = next;
  }
  return current;
}

// Return every contact (primary + all secondaries) belonging to a primary id.
function getFullGroup(primaryId) {
  return db
    .prepare(
      `SELECT * FROM Contact
       WHERE deletedAt IS NULL AND (id = @id OR linkedId = @id)
       ORDER BY createdAt ASC, id ASC`
    )
    .all({ id: primaryId });
}

function createContact({ email, phoneNumber, linkedId = null, linkPrecedence = 'primary' }) {
  const ts = nowIso();
  const info = db
    .prepare(
      `INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt)
       VALUES (@phoneNumber, @email, @linkedId, @linkPrecedence, @createdAt, @updatedAt)`
    )
    .run({
      phoneNumber: phoneNumber || null,
      email: email || null,
      linkedId,
      linkPrecedence,
      createdAt: ts,
      updatedAt: ts,
    });
  return db.prepare('SELECT * FROM Contact WHERE id = ?').get(info.lastInsertRowid);
}

function demoteToSecondary(contactId, newLinkedId) {
  db.prepare(
    `UPDATE Contact SET linkPrecedence = 'secondary', linkedId = ?, updatedAt = ? WHERE id = ?`
  ).run(newLinkedId, nowIso(), contactId);
}

function buildResponse(group) {
  const primary = group.find((c) => c.linkPrecedence === 'primary');
  const secondaries = group.filter((c) => c.linkPrecedence === 'secondary');

  const emails = [];
  const phoneNumbers = [];

  // Primary's own values come first, per the assignment's implied ordering.
  if (primary.email) emails.push(primary.email);
  if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

  for (const c of secondaries) {
    if (c.email && !emails.includes(c.email)) emails.push(c.email);
    if (c.phoneNumber && !phoneNumbers.includes(c.phoneNumber)) phoneNumbers.push(c.phoneNumber);
  }

  return {
    contact: {
      primaryContactId: primary.id,
      emails,
      phoneNumbers,
      secondaryContactIds: secondaries.map((c) => c.id).sort((a, b) => a - b),
    },
  };
}

/**
 * Main entry point used by the /identify route.
 * @param {{email?: string|null, phoneNumber?: string|null}} payload
 */
function identify({ email, phoneNumber }) {
  email = email || null;
  phoneNumber = phoneNumber ? String(phoneNumber) : null;

  const txn = db.transaction(() => {
    const directMatches = findDirectMatches(email, phoneNumber);

    // Case 1: nothing matches at all -> brand new primary contact.
    if (directMatches.length === 0) {
      const created = createContact({ email, phoneNumber, linkPrecedence: 'primary' });
      return buildResponse([created]);
    }

    // Resolve every match up to its primary, collect the distinct primaries touched.
    const primariesById = new Map();
    for (const match of directMatches) {
      const primary = resolvePrimaryOf(match);
      primariesById.set(primary.id, primary);
    }
    let primaries = [...primariesById.values()];

    // If multiple distinct primary chains were touched, merge them: the
    // oldest becomes/remains primary, the rest (and their groups) become secondary.
    if (primaries.length > 1) {
      primaries.sort((a, b) => {
        if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
        return a.id - b.id;
      });
      const survivor = primaries[0];
      const toDemote = primaries.slice(1);

      for (const p of toDemote) {
        // Demote the primary itself.
        demoteToSecondary(p.id, survivor.id);
        // Re-point anything that was already secondary under it.
        db.prepare(
          `UPDATE Contact SET linkedId = ?, updatedAt = ? WHERE linkedId = ? AND deletedAt IS NULL`
        ).run(survivor.id, nowIso(), p.id);
      }
      primaries = [survivor];
    }

    const primary = primaries[0];
    let group = getFullGroup(primary.id);

    // Case: does the incoming request introduce brand-new information
    // (an email or phone not yet present anywhere in the group)?
    const knownEmails = new Set(group.map((c) => c.email).filter(Boolean));
    const knownPhones = new Set(group.map((c) => c.phoneNumber).filter(Boolean));

    const emailIsNew = email && !knownEmails.has(email);
    const phoneIsNew = phoneNumber && !knownPhones.has(phoneNumber);

    // Only create a new secondary if the request actually adds new info AND
    // the request isn't just a subset of what's already known (an exact
    // duplicate, or a request with just one field that's already known,
    // creates no new row).
    if (emailIsNew || phoneIsNew) {
      createContact({
        email,
        phoneNumber,
        linkedId: primary.id,
        linkPrecedence: 'secondary',
      });
      group = getFullGroup(primary.id);
    }

    return buildResponse(group);
  });

  return txn();
}

module.exports = { identify, _internal: { findDirectMatches, resolvePrimaryOf, getFullGroup } };
