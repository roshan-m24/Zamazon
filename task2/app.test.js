const request = require('supertest');
const createApp = require('../src/app');

const app = createApp();

describe('v1.0 endpoints', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /products returns the full catalogue', async () => {
    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.count).toBe(res.body.products.length);
  });

  test('unknown route returns 404', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
  });
});

describe('v1.1 endpoints', () => {
  test('GET /products/search finds matching products by keyword', async () => {
    const res = await request(app).get('/products/search').query({ keyword: 'fitness' });
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
    expect(res.body.products.every((p) => p.category === 'fitness')).toBe(true);
  });

  test('GET /products/search with no keyword returns full catalogue', async () => {
    const res = await request(app).get('/products/search');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(10);
  });

  test('GET /products/search with a keyword matching nothing returns empty list', async () => {
    const res = await request(app).get('/products/search').query({ keyword: 'zzzznomatch' });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });
});

describe('v2.0 endpoints', () => {
  test('GET /products/search supports category filter', async () => {
    const res = await request(app).get('/products/search').query({ category: 'books' });
    expect(res.status).toBe(200);
    expect(res.body.products.every((p) => p.category === 'books')).toBe(true);
  });

  test('GET /products/search supports minPrice/maxPrice range', async () => {
    const res = await request(app).get('/products/search').query({ minPrice: 500, maxPrice: 2000 });
    expect(res.status).toBe(200);
    expect(res.body.products.every((p) => p.price >= 500 && p.price <= 2000)).toBe(true);
  });

  test('GET /products/search combines keyword + category + price range', async () => {
    const res = await request(app)
      .get('/products/search')
      .query({ category: 'electronics', maxPrice: 1000 });
    expect(res.status).toBe(200);
    expect(res.body.products.every((p) => p.category === 'electronics' && p.price <= 1000)).toBe(true);
  });

  test('GET /products/search rejects an unknown category', async () => {
    const res = await request(app).get('/products/search').query({ category: 'not-a-real-category' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown category/);
  });

  test('GET /products/search rejects a non-numeric minPrice', async () => {
    const res = await request(app).get('/products/search').query({ minPrice: 'abc' });
    expect(res.status).toBe(400);
  });

  test('GET /products/search rejects minPrice greater than maxPrice', async () => {
    const res = await request(app).get('/products/search').query({ minPrice: 5000, maxPrice: 100 });
    expect(res.status).toBe(400);
  });
});
