import multer from 'multer';
import { createAppError } from '../utils/createAppError.js';
import path from 'path';
import fs from 'fs';

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads';
    if (req.originalUrl.includes('/car-images') || req.originalUrl.includes('/cars')) {
      folder = 'uploads/car-photos';
    }
    if (req.originalUrl.includes('/drivers') || req.originalUrl.includes('/driver')) {
      folder = 'uploads/driver-photos';
    }

    const destinationPath = path.join(process.cwd(), 'public', folder);
    fs.mkdirSync(destinationPath, { recursive: true });
    cb(null, destinationPath);
  },
  filename: (req, file, cb) => {
    const extFromOriginal = path.extname(file.originalname || '').replace('.', '');
    const extFromMime = (file.mimetype?.split('/')[1] || '').replace(/["'`]/g, '');
    const safeExt = (extFromOriginal || extFromMime || 'jpg')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}.${safeExt || 'jpg'}`);
  },
});

const filterMulter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(createAppError(400, 'Not an image! Please upload only images.'), false);
  }
};

const upload = multer({
  storage: diskStorage,
  fileFilter: filterMulter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export default upload;
