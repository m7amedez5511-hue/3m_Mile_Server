import mongoose from 'mongoose';
import process from 'node:process';

/**
 * MongoDB Connection Utility
 * Uses Mongoose to connect to the configured MONGODB_URI
 * Throws on failure so the caller (server.js) can fail fast.
 */
const connectMongoDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    throw new Error('MONGODB_URI is not defined in environment variables.');
  }

  const { connection } = await mongoose.connect(mongoURI);

  console.log(`✅ MongoDB Connected: ${connection.host}`);

  // Handle connection errors after initial connection
  mongoose.connection.on('error', (err) => {
    console.error(`❌ MongoDB Runtime Error: ${err.message}`);
  });

  return connection;
};

export default connectMongoDB;