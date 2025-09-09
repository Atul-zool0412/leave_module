import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import dotenv from 'dotenv';
dotenv.config();
// import { context } from './context';
import connectDB from './config/db';
import schema from './graphql/schema';


async function startServer() {
  const app = express();

  // Connect to MongoDB
  connectDB();
  // Initialize Apollo Server
  const server = new ApolloServer({
    schema,
    // context,
    formatError: (error) => {
      // Customize error output here if needed
      return error;
    },
  });

  console.log("Server started");
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
