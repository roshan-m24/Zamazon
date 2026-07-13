// src/app.js
// v2.0: enhances /products/search with query parameters
// (keyword, category, minPrice, maxPrice) and proper error handling
// around malformed input.

const express = require('express');
const { products } = require('./data');

const VALID_CATEGORIES = new Set(products.map((p) => p.category));

function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', version: 'v2.0' });
  });

  app.get('/products', (req, res) => {
    res.status(200).json({ count: products.length, products });
  });

  // v2.0: search supports combining keyword + category + price range.
  app.get('/products/search', (req, res) => {
    const { keyword, category, minPrice, maxPrice } = req.query;

    // --- error handling for malformed query params ---
    let min, max;
    if (minPrice !== undefined) {
      min = Number(minPrice);
      if (Number.isNaN(min) || min < 0) {
        return res.status(400).json({ error: 'minPrice must be a non-negative number' });
      }
    }
    if (maxPrice !== undefined) {
      max = Number(maxPrice);
      if (Number.isNaN(max) || max < 0) {
        return res.status(400).json({ error: 'maxPrice must be a non-negative number' });
      }
    }
    if (min !== undefined && max !== undefined && min > max) {
      return res.status(400).json({ error: 'minPrice cannot be greater than maxPrice' });
    }
    if (category !== undefined && !VALID_CATEGORIES.has(String(category).toLowerCase())) {
      return res.status(400).json({
        error: `Unknown category "${category}"`,
        validCategories: [...VALID_CATEGORIES],
      });
    }

    let results = products;

    if (keyword) {
      const needle = String(keyword).toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.category.toLowerCase().includes(needle) ||
          p.keywords.some((k) => k.toLowerCase().includes(needle))
      );
    }
    if (category !== undefined) {
      const cat = String(category).toLowerCase();
      results = results.filter((p) => p.category === cat);
    }
    if (min !== undefined) {
      results = results.filter((p) => p.price >= min);
    }
    if (max !== undefined) {
      results = results.filter((p) => p.price <= max);
    }

    res.status(200).json({ count: results.length, products: results });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Centralized error handler: never leak stack traces / internals.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = createApp;
