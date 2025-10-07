import express, { Request, Response } from 'express';
import { ApolloServer } from 'apollo-server-express';
import dotenv from 'dotenv';
import connectDB from './config/db';
import schema from './graphql/schema';
import mongoose from 'mongoose';
import { IQueryContext } from "./interface/interface";
import { jwtDecode } from 'jwt-decode';

dotenv.config();

async function startServer() {
  const MONGO_URI = process.env.MONGO_URI;
  const DB_NAME_1 = process.env.LEAVE_DB_NAME;
  const DB_NAME_2 = process.env.Task_DB_NAME;
  const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

  console.log('MONGO_URI:', MONGO_URI);

  if (!MONGO_URI || !DB_NAME_1 || !DB_NAME_2) {
    throw new Error('MONGO_URI or LEAVE_DB_NAME or Task_DB_NAME is not defined in .env');
  }

  // Connect to the desired DB
  await connectDB(DB_NAME_1);
  await connectDB(DB_NAME_2);

  const app = express();
  app.use(express.json());

  const server = new ApolloServer<IQueryContext>({
    schema,
    formatError: (error) => error,
    context: async ({ req, res }: { req: Request; res: Response }): Promise<IQueryContext> => {
      const authHeader = req.headers.authorization;
      let tokenData: any = {};
      try {
        if (authHeader) {
          tokenData = jwtDecode(authHeader);
        }
      } catch (err) {
        console.warn('⚠️ Invalid token in request:', err);
      }

      return {
        token: authHeader,
        tokenData: {
        exp: tokenData.exp
        }
      };
    },
  });
  // console.log('Server starting...');
  await server.start();
  server.applyMiddleware({ app, path: '/graphql', cors: true });

  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start', err);
});
