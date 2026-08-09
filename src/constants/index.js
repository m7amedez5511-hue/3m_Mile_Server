import { DATABASE_INDEXES } from './indexes.constant.js';

export default {
  LOGIN_ATTEMPT_LIMIT: 5,
  PAGINATION: {
    LIMIT: 10,
    PAGE: 1,
    MAX_LIMIT: 100, // hard cap so nobody can request ?limit=999999
  },
  SESSION_CONFIG: {
    EXPIRES_IN: 60 * 60 * 1000,
  },
  OTP_CONFIG: {
    LENGTH: 6,
    EXPIRATION_MINUTES: 5,
    MAX_SEND_PER_DAY: 20,
    MAX_INVALID_ATTEMPTS: 3,
  },
  LANG: {
    DEFAULT: 'ar',
    SUPPORTED: ['ar', 'en'],
  },
  GALLERY: {
    MAX_IMAGES_PER_PRODUCT: 8,
    MAX_ASSET_SIZE: 4 * 1024 * 1024, // 4MB
  },
  JWT_CONFIG: {
    ACCESS_TOKEN_EXPIRE_IN: '15m',   // shortened — see security notes in §D
    REFRESH_TOKEN_EXPIRE_IN: '30d',
  },
  ORDER_CONFIG: {
    STATUSES: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    PREFIX: 'ORD',
  },
  DATABASE_INDEXES,
};