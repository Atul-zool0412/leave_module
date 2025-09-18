import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import dotenv from 'dotenv';
import connectDB from './config/db';
import schema from './graphql/schema';

dotenv.config();

async function startServer() {
  const app = express();

  const MONGO_URI = process.env.MONGO_URI;
  const DB_NAME_1 = process.env.LEAVE_DB_NAME;
  const DB_NAME_2 = process.env.Task_DB_NAME;

  console.log('MONGO_URI:', MONGO_URI);
  console.log('DB_NAME_1:', DB_NAME_1);

  if (!MONGO_URI || !DB_NAME_1 || !DB_NAME_2) {
    throw new Error('MONGO_URI or LEAVE_DB_NAME or Task_DB_NAME is not defined in .env');
  }

  // Connect to the desired DB
  await connectDB(DB_NAME_1);
  await connectDB(DB_NAME_2);

  const server = new ApolloServer({
    schema,
    formatError: (error) => {
      return error;
    },
  });

  // console.log('Server starting...');
  await server.start();
  app.use(express.json());

  server.applyMiddleware({ app, path: '/graphql' });

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start', err);
});
