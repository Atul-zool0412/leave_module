import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const dbURI = process.env.MONGO_URI;

let isConnected = false;

const connectDB = async (): Promise<void> => {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('✅ Reusing existing MongoDB connection');
    return;
  }

  if (!dbURI) {
    throw new Error('MONGO_URI environment variable not defined');
  }

  await mongoose.connect(dbURI);

  isConnected = true;

  console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
};

// Properly export getDb as a function
export const getDb = (): mongoose.mongo.Db => {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB not connected yet');
  }

  return mongoose.connection.db;
};

export default connectDB;
