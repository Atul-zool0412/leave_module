import { mergeResolvers, mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs as leaveTypesDefs } from './types';
import { resolvers as leavesResolvers } from './resolvers/leaveResolvers';

const resolvers = mergeResolvers([leavesResolvers]);
const typeDefs = mergeTypeDefs([leaveTypesDefs]);

const schema = makeExecutableSchema({ typeDefs, resolvers });

export default schema;
