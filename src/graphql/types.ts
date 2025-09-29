import { gql } from "apollo-server";

export const typeDefs = gql`
  scalar JSON

  # ----------------- Shared Types -----------------
  type validity {
    startDate: String
    endDate: String
  }

  # ----------------- Todo List -----------------
  type TodoItem {
    _id: ID!
    companyId: String
    employeeId: String
    status: String
    taskName: JSON
    leavePeriod: JSON
    expectedResumptionDate: String
    createdAt: String
  }

  # ----------------- Leave Balance -----------------
  type TransactionCount {
    transactionType: Int
    CreditOrDebit: String
    leaveAdded: Float
    leaveUsed: Float
    unitOfLeave: Int
  }

  type EmployeeLeaveTypeBalance {
    EmployeeLeaveTypeId: ID
    LeaveTypeName: JSON
    PayType: Int
    LeaveEntitlementType: Int
    IsActive: Boolean
    IsSystemDefault: Boolean
    IsCountrySpecific: Boolean
    CountryCode: String
    IsCustomized: Boolean
    currentBalance: Float
    transactionCounts: [TransactionCount]
  }
    
  type LeaveBalance {
    EmployeeId: ID!
    EmployeeName: JSON
    EmployeeCode: String
    LeaveBalanceAsOn: String
    employeeLeaveTypes: [EmployeeLeaveTypeBalance]
  }

  # ----------------- Pending Applications -----------------
  type EmployeeInfo {
    employeeId: ID
    name: String
    employeeCode: String
    email: String
  }

  type MyPendingApplication {
    _id: ID
    companyId: ID
    employeeId: ID
    status: String
    taskName: JSON
    taskModule: String
    totalApprovalStages: Int
    createdAt: String
    leaveType: JSON
    leavePeriod: JSON
    resumptionDate: JSON
    employee: EmployeeInfo
    moduleData: JSON
  }

  # ----------------- Leave Applications -----------------
  type LeaveApplication {
    applicationId: ID!
    status: String
    leaveTypeName: JSON
    appliedOn: String
    approvedOn: String
  }

  # ----------------- Encashment Applications -----------------
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

  # ----------------- Dashboard Data -----------------
  type DashboardData {
    todoList: [TodoItem]
    pendingApplications: [MyPendingApplication]
    leaveBalance: LeaveBalance
    applicationHistory: [LeaveApplication]
    encashmentApplications: [EncashmentApplication]
  }

  # ----------------- Queries -----------------
  type Query {
    # Todo list
    getTodoList(
      companyIdBase64: String!
      employeeIdBase64: String!
    ): [TodoItem]

    # Leave balance (with currentBalance + transaction details)
    getLeaveBalance(
      tenantIdBase64: String!
      companyIdBase64: String!
      employeeIdBase64: String!
      # EmployeeLeaveTypeIdBase64: String
    ): LeaveBalance

    # Leave history
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

    # Encashment history
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

    # My pending apps
    getMyPendingApplications(
      companyIdBase64: String!
      employeeIdBase64: String!
      isPending: Boolean!
    ): [MyPendingApplication]

    # Dashboard
    getDashboardData(
      tenantIdBase64: String!
      companyIdBase64: String!
      employeeIdBase64: String!
    ): DashboardData
  }
`;
