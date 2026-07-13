// src/data.js
// In-memory product catalogue. In a real deployment this would be backed by
// a database; kept in-memory here so the service has zero external
// dependencies and is trivial to run in any container / k8s pod.

const products = [
  { id: 1, name: 'Wireless Mouse', category: 'electronics', price: 799, keywords: ['mouse', 'wireless', 'electronics'] },
  { id: 2, name: 'Mechanical Keyboard', category: 'electronics', price: 3499, keywords: ['keyboard', 'mechanical', 'electronics'] },
  { id: 3, name: 'USB-C Hub', category: 'electronics', price: 1599, keywords: ['usb', 'hub', 'electronics'] },
  { id: 4, name: 'Yoga Mat', category: 'fitness', price: 999, keywords: ['yoga', 'mat', 'fitness'] },
  { id: 5, name: 'Dumbbell Set 10kg', category: 'fitness', price: 2499, keywords: ['dumbbell', 'weights', 'fitness'] },
  { id: 6, name: 'Running Shoes', category: 'fitness', price: 3999, keywords: ['shoes', 'running', 'fitness'] },
  { id: 7, name: 'Stainless Steel Bottle', category: 'home', price: 499, keywords: ['bottle', 'steel', 'home'] },
  { id: 8, name: 'Non-stick Pan', category: 'home', price: 1299, keywords: ['pan', 'cookware', 'home'] },
  { id: 9, name: 'Novel: The Silent Patient', category: 'books', price: 349, keywords: ['book', 'novel', 'books'] },
  { id: 10, name: 'Notebook Set (3 pack)', category: 'stationery', price: 199, keywords: ['notebook', 'stationery'] },
];

module.exports = { products };
