
// End-to-end tests hitting the real Express app + a throwaway SQLite DB file.

const fs = require('fs');
const path = require('path');

const TEST_DB = path.join(__dirname, 'test.sqlite');
process.env.DB_PATH = TEST_DB;

// Clean slate before requiring the app (db.js opens the file on require).
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
if (fs.existsSync(TEST_DB + '-wal')) fs.unlinkSync(TEST_DB + '-wal');
if (fs.existsSync(TEST_DB + '-shm')) fs.unlinkSync(TEST_DB + '-shm');

const request = require('supertest');
const createApp = require('../src/app');

const app = createApp();

afterAll(() => {
  [TEST_DB, TEST_DB + '-wal', TEST_DB + '-shm'].forEach((f) => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

describe('POST /identify', () => {
  test('creates a new primary contact when nothing matches', async () => {
    const res = await request(app)
      .post('/identify')
      .send({ email: 'lorraine@hillvalley.edu', phoneNumber: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.contact.emails).toEqual(['lorraine@hillvalley.edu']);
    expect(res.body.contact.phoneNumbers).toEqual(['123456']);
    expect(res.body.contact.secondaryContactIds).toEqual([]);
    expect(typeof res.body.contact.primaryContactId).toBe('number');
  });

  test('creates a secondary contact when new info is linked to an existing contact', async () => {
    const res = await request(app)
      .post('/identify')
      .send({ email: 'mcfly@hillvalley.edu', phoneNumber: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.contact.emails).toEqual(['lorraine@hillvalley.edu', 'mcfly@hillvalley.edu']);
    expect(res.body.contact.phoneNumbers).toEqual(['123456']);
    expect(res.body.contact.secondaryContactIds.length).toBe(1);
  });

  test('does not create a duplicate row for an exact repeat request', async () => {
    const before = await request(app)
      .post('/identify')
      .send({ email: 'mcfly@hillvalley.edu', phoneNumber: '123456' });

    const after = await request(app)
      .post('/identify')
      .send({ email: 'mcfly@hillvalley.edu', phoneNumber: '123456' });

    expect(after.body.contact.secondaryContactIds.length).toBe(
      before.body.contact.secondaryContactIds.length
    );
  });

  test('merges two separate primary contacts when a request bridges them', async () => {
    // Two independent primaries first.
    const george = await request(app)
      .post('/identify')
      .send({ email: 'george@hillvalley.edu', phoneNumber: '919191' });

    const biffOnly = await request(app)
      .post('/identify')
      .send({ email: 'biffsucks@hillvalley.edu', phoneNumber: '717171' });

    expect(george.body.contact.primaryContactId).not.toBe(biffOnly.body.contact.primaryContactId);

    // A request carrying george's email AND biff's phone bridges the two chains.
    const bridge = await request(app)
      .post('/identify')
      .send({ email: 'george@hillvalley.edu', phoneNumber: '717171' });

    expect(bridge.status).toBe(200);
    // The older of the two contacts (george, created first) must remain primary.
    expect(bridge.body.contact.primaryContactId).toBe(george.body.contact.primaryContactId);
    expect(bridge.body.contact.emails).toEqual(
      expect.arrayContaining(['george@hillvalley.edu', 'biffsucks@hillvalley.edu'])
    );
    expect(bridge.body.contact.phoneNumbers).toEqual(
      expect.arrayContaining(['919191', '717171'])
    );
    // biff's old primary id should now show up as a secondary id.
    expect(bridge.body.contact.secondaryContactIds).toContain(biffOnly.body.contact.primaryContactId);
  });

  test('accepts a request with only an email', async () => {
    const res = await request(app).post('/identify').send({ email: 'onlyemail@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.contact.emails).toEqual(['onlyemail@example.com']);
    expect(res.body.contact.phoneNumbers).toEqual([]);
  });

  test('accepts a request with only a phoneNumber', async () => {
    const res = await request(app).post('/identify').send({ phoneNumber: '555000' });
    expect(res.status).toBe(200);
    expect(res.body.contact.phoneNumbers).toEqual(['555000']);
    expect(res.body.contact.emails).toEqual([]);
  });

  test('rejects a request with neither email nor phoneNumber', async () => {
    const res = await request(app).post('/identify').send({});
    expect(res.status).toBe(400);
  });

  test('rejects malformed field types', async () => {
    const res = await request(app).post('/identify').send({ email: { not: 'a string' } });
    expect(res.status).toBe(400);
  });
});

describe('GET /health', () => {
  test('returns 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
