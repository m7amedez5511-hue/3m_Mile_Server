import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { customAlphabet } from 'nanoid';

// __dirname does not exist in ESM — this is how you reconstruct it.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const hasRequiredParams = (body, params = []) => {
  return params.every((key) => body[key] !== undefined && body[key] !== null && body[key].length !== 0);
};

export const requiredFields = (body, params = []) => {
  const missing = params.filter((field) => !(field in body) || body[field] === undefined || body[field] === null);
  const emptyArrays = params.filter((field) => Array.isArray(body[field]) && body[field].length === 0);
  return [...missing, ...emptyArrays];
};

export const chunkArray = (array, size) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

export const normalizeVersion = (version) => {
  if (!version) return null;
  const parts = version.split('.');
  while (parts.length < 3) parts.push('0');
  return parts.map((p) => p.padStart(3, '0')).join('.');
};

export const writeTempJSONFile = async (data, prefix = 'temp') => {
  const logsDir = path.join(__dirname, '../logs/transactions');
  await fs.mkdir(logsDir, { recursive: true });
  const filename = path.join(logsDir, `${prefix}-${Date.now()}.json`);
  await fs.writeFile(filename, JSON.stringify(data, null, 2));
  return filename;
};

export const getNanoid = (length = 8) => {
  const nanoidNumbers = customAlphabet('0123456789', length);
  return nanoidNumbers();
};