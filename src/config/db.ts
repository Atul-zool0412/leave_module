import mongoose from 'mongoose';
import dotenv from 'dotenv';


dotenv.config();

const dbURI = process.env.MONGO_URI;

const connections: { [key: string]: mongoose.Connection } = {};

const connectDB = async (dbName: string): Promise<mongoose.Connection> => {
  if (!dbURI || !dbName) {
    throw new Error('MONGO_URI or database name not defined');
  }

  // Reuse connection if already connected
  if (connections[dbName]) {
    if (connections[dbName].readyState === 1) {
      console.log(`✅ Reusing existing connection for DB: ${dbName}`);
      return connections[dbName];
    }
  }

  const connection = await mongoose.createConnection(dbURI, {
    dbName,
  });

  connections[dbName] = connection;

  console.log(`✅ New connection established to DB: ${dbName}`);

  return connection;
};

// Example helper to get the native MongoDB database instance
export const getDb = (dbName: string): mongoose.mongo.Db => {
  const connection = connections[dbName];
  if (!connection || !connection.db) {
    throw new Error(`No connection found for DB: ${dbName}`);
  }
  return connection.db;
};

export default connectDB;
