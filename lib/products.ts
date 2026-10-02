import type { Product, DeliveryAgent } from './types';

export const PRODUCTS: Product[] = [
  {
    id: 'PROD-WH-001',
    name: 'Studio Wireless Headphones',
    price: 129.00,
    currency: 'USD',
    category: 'Audio & Electronics',
    description: 'Over-ear active noise cancelling Bluetooth headphones with 40-hour battery life.',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60',
    inStock: true
  },
  {
    id: 'PROD-KB-002',
    name: 'Mechanical Gaming Keyboard',
    price: 89.00,
    currency: 'USD',
    category: 'Computer Accessories',
    description: 'RGB hot-swappable mechanical keyboard with custom linear switches.',
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60',
    inStock: true
  },
  {
    id: 'PROD-SM-003',
    name: 'Smart Fitness Watch Pro',
    price: 199.00,
    currency: 'USD',
    category: 'Wearables',
    description: 'AMOLED fitness tracker with heart-rate, SpO2, GPS, and 14-day battery.',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60',
    inStock: true
  },
  {
    id: 'PROD-AP-004',
    name: 'Noise-Cancelling True Wireless Earbuds',
    price: 149.00,
    currency: 'USD',
    category: 'Audio & Electronics',
    description: 'Waterproof IPX7 wireless earbuds with spatial audio and wireless charging case.',
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop&q=60',
    inStock: true
  }
];
