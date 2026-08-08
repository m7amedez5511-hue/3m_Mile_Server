import mongoose from 'mongoose';
import process from 'node:process';

/**
 * MongoDB Connection Utility
 * Uses Mongoose to connect to the configured MONGODB_URI
 */
const connectMongoDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.warn('⚠️ MONGODB_URI is not defined in environment variables.');
      return;
    }

    const { connection } = await mongoose.connect(mongoURI);

    console.log(`✅ MongoDB Connected: ${connection.host}`);
    
    // Handle connection errors after initial connection
    mongoose.connection.on('error', (err) => {
      console.error(`❌ MongoDB Runtime Error: ${err.message}`);
    });

  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // In production, we might want to exit the process if DB connection fails
    // process.exit(1);
  }
};

export default connectMongoDB;
