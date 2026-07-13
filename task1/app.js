// src/app.js
// Express application exposing the /identify endpoint.

const express = require('express');
const { identify } = require('./identityService');

function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/identify', (req, res) => {
    const body = req.body || {};
    const { email, phoneNumber } = body;

    // Basic validation: at least one identifier is required, and if present,
    // each must be a primitive string/number, not an object/array.
    const isValidField = (v) => v === undefined || v === null || typeof v === 'string' || typeof v === 'number';

    if (!isValidField(email) || !isValidField(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid request payload' });
    }

    if ((email === undefined || email === null) && (phoneNumber === undefined || phoneNumber === null)) {
      return res.status(400).json({ error: 'At least one of email or phoneNumber is required' });
    }

    try {
      const result = identify({ email, phoneNumber });
      return res.status(200).json(result);
    } catch (err) {
      // Bonus: intentionally generic error response so internals
      // (schema, stack traces, DB engine) are never leaked to a caller.
      // Full detail is still logged server-side for debugging.
      console.error('identify failed:', err);
      return res.status(500).json({ error: 'Unable to process request' });
    }
  });

  // Catch-all 404 that reveals nothing about the app's real routes.
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

module.exports = createApp;
