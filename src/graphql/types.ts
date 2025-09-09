import { gql } from 'apollo-server';

export const typeDefs = gql`
    type LeaveBalance {
    employeeId: ID!
    annualLeaveCreditBalance: Float
}

type Task {
    taskId: ID!
    description: String
    status: String
}

type LeaveApplication {
    applicationId: ID!
    status: String
    type: String
    appliedDate: String
}

type Query {
    getLeaveBalance(employeeId: ID!): LeaveBalance
    getPendingTasks(companyId: ID!, userId: ID!): [Task]
    getPendingApplications(companyId: ID!, userId: ID!): [LeaveApplication]
    getApplicationHistory(companyId: ID!, employeeId: ID!): [LeaveApplication]
}

`;
