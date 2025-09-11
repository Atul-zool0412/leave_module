import { gql } from 'apollo-server';

export const typeDefs = gql`
    scalar JSON  

    type Validity {
        StartDate: String
        EndDate: String
    }

    type EmployeeLeaveType {
        leaveTypeId: ID
        leaveTypeName: JSON   
        payType: Int
        unitOfLeave: Int
        entitlementType: Int
        validity: Validity
        isActive: Boolean
        currentBalance: Float   # Added to match resolver
    }

    type LeaveBalance {
        employeeId: ID!
        employeeLeaveTypes: [EmployeeLeaveType]
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
        getLeaveBalance(
            tenantIdBase64: String!
            companyIdBase64: String!
            employeeIdBase64: String!
            leaveTypeIdBase64: String
        ): LeaveBalance

        getPendingTasks(companyId: ID!, userId: ID!): [Task]

        getPendingApplications(companyId: ID!, userId: ID!): [LeaveApplication]

        getApplicationHistory(companyId: ID!, employeeId: ID!): [LeaveApplication]
    }
`;
