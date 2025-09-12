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
        currentBalance: Float
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
        leaveTypeName: JSON
        appliedOn: String
        approvedOn: String
    }

    type EncashmentApplication {
        encashmentId: ID!
        employeeName: JSON
        employeeCode: String
        leaveTypeName: JSON
        encashDays: Int
        appliedOn: String
        approvalStatus: String
        isPaid: Boolean
    }

    type Query {
        getLeaveBalance(
            tenantIdBase64: String!
            companyIdBase64: String!
            employeeIdBase64: String!
            leaveTypeIdBase64: String
        ): LeaveBalance

        getPendingTasks(
            companyId: ID!
            userId: ID!
        ): [Task]

        getPendingApplications(
            companyId: ID!
            userId: ID!
        ): [LeaveApplication]

        getApplicationHistory(
            tenantIdBase64: String!
            companyIdBase64: String!
            filter: String
            leaveTypeIdBase64: String
            employeeLeaveTypeIdBase64: String
            employeeIdBase64: String
            unitOfLeave: Int
            payType: Int
            approvalStatus: String
            employeePlaceholderIdsBase64: [String]
            startDate: String
            endDate: String
            applicationDate: String
            skipCount: Int
            maxResultCount: Int
        ): [LeaveApplication]

        getEncashmentApplications(
            tenantIdBase64: String!
            companyIdBase64: String!
            filter: String
            leaveTypeIdBase64: String
            employeeLeaveTypeIdBase64: String
            employeeIdBase64: String
            unitOfLeave: Int
            approvalStatus: String
            employeePlaceholderIdsBase64: [String]
            applicationDate: String
            skipCount: Int
            maxResultCount: Int
        ): [EncashmentApplication]
    }
`;
