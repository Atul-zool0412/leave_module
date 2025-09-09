import mongoose from 'mongoose';

const dbURI = process.env.MONGO_URI;
const connectDB = async (): Promise<void> => {
  if (!dbURI) {
    throw new Error('MONGO_URI environment variable not defined');
  }

  const conn = await mongoose.connect(dbURI);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
};

export default connectDB;

