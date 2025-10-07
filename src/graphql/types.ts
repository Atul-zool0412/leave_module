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
    createdBy: JSON
    assignedTo: JSON
    todoType: Int
    recordSource: Int
    appService: Int
    moduleData: JSON
    isEmployeeSpecificTodo: Boolean
    employeeId: String
    EmployeeName: JSON
    externalId: String
    formUrl: String
    status: Int
    priority: Int
    TenantId: String
  }

  # Wrapper for paginated items
  type TodoListResponse {
    items: [TodoItem]
    totalCount: Int
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
  type PendingEmployee {
    LoginId: String
    LoginName: String
    SerialNo: Int
    IsEmployee: Boolean
    EmployeeName: JSON
    EmployeeCode: String
    AssignedOn: String
    DueDate: String
    IsSendBackTask: Boolean
    IsFinalApprover: Boolean
  }

  type CreatedBy {
    type: String
    loginId: String
    loginName: String
    isEmployee: Boolean
    employee: JSON
  }

  type MyPendingApplication {
    createdBy: CreatedBy
    recordSource: Int
    appService: Int
    isApprovalForEmployee: Boolean
    employeeId: String
    EmployeeName: JSON
    EmployeeCode: String
    ModuleData: JSON
    formUrl: String
    processingMode: Int
    taskApprovalStatus: Int
    totalApprovalStages: Int
    currentApprovalStage: Int
    PendingAt: PendingEmployee
    SmartSummary: String
  }

  # Wrapper for paginated MyPendingApplication
  type MyPendingApplicationResponse {
    items: [MyPendingApplication]
    totalCount: Int
  }

  # ----------------- Leave Applications -----------------
  type LeaveApplication {
    id: ID!
    creationTime: String
    employeeLeaveMapId: ID
    leaveTypeShortCode: String
    employeeLeaveTypeId: ID
    leaveTypeName: JSON
    employeeId: ID
    employeePlaceholderId: ID
    thumbnailPicture: String
    employeeCode: String
    employeeName: JSON
    leaveEntitlementType: Int
    payType: Int
    unitOfLeave: Int
    leavePeriod: JSON
    durationApplied: Int
    rejoinConfRequired: Boolean
    isRejoined: Boolean
    rejoiningStatus: JSON
    approvalStatus: Int
    appliedOn: String
    approvedOn: String
    rejoiningDate: String
    rejoinedOn: String
  }

  type LeaveApplicationResponse {
    items: [LeaveApplication]
    totalCount: Int
  }

  # ----------------- Resumption Applications -----------------
  type LeaveResumptionApplication {
  id: ID
  creationTime: String
  employeeLeaveMapId: ID
  leaveTypeShortCode: String
  employeeLeaveTypeId: ID
  leaveTypeName: JSON
  employeeId: ID
  employeePlaceholderId: ID
  thumbnailPicture: String
  employeeCode: String
  employeeName: JSON
  leaveEntitlementType: Int
  payType: Int
  unitOfLeave: Int
  leavePeriod: String
  durationApproved: Int
  rejoinConfRequired: Boolean
  isRejoined: Boolean
  rejoiningStatus: Int
  rejoiningDate: String
  rejoinedOn: String
  approvalStatus: Int
}

type LeaveResumptionApplicationResponse {
  items: [LeaveResumptionApplication!]!
  totalCount: Int!
}

  # ----------------- Encashment Applications -----------------
   type EncashmentApplication {
    id: ID!
    CreationTime: String
    employeeLeaveMapId: ID
    leaveTypeShortCode: String
    employeeLeaveTypeId: ID
    leaveTypeName: JSON
    employeeId: ID
    employeePlaceholderId: ID
    thumbnailPicture: String
    employeeCode: String
    employeeName: JSON
    leaveEntitlementType: Int
    payType: Int
    unitOfLeave: Int
    applicationDate: String
    encashBalanceAsOn: String
    encashmentQuantityApplied: String
    encashmentQuantityApproved: String
    isPaid: Boolean
    approvalStatus: Int
    approvedOn: String
  }

  # Wrapper for paginated EncashmentApplications
  type EncashmentApplicationResponse {
    items: [EncashmentApplication]
    totalCount: Int
  }

  # ----------------- Dashboard Data -----------------
  type DashboardData {
    todoList: [TodoItem]
    pendingApplications: MyPendingApplicationResponse
    leaveBalance: LeaveBalance
    applicationHistory: LeaveApplicationResponse
    encashmentApplications: [EncashmentApplication]
  }

  # ----------------- Queries -----------------
  type Query {
    getTodoList(
      tenantId: String!
      companyId: String!
      employeeId: String!
      todoStatus: Int
    ): TodoListResponse

    getLeaveBalance(
      tenantId: String!
      companyId: String!
      employeeId: String!
      isActive: Boolean
    ): LeaveBalance

    getApplicationHistory(
      tenantId: String!
      companyId: String!
      employeeId: String!
      leaveTypeId: String
      approvalStatus: String
      skipCount: Int
      maxResultCount: Int
    ): LeaveApplicationResponse

    getLeaveResumptionApplications(
      tenantIdBase64: String!
      companyIdBase64: String!
      employeeIdBase64: String!
      leaveTypeIdBase64: String
      approvalStatus: String
      skipCount: Int
      maxResultCount: Int
  ): LeaveResumptionApplicationResponse

    getEncashmentApplications(
      tenantId: String!
      companyId: String!
      employeeId: String!
      leaveTypeId: String
      approvalStatus: String
      skipCount: Int
      maxResultCount: Int
    ): EncashmentApplicationResponse

    getMyPendingApplications(
      tenantId: String!
      companyId: String!
      employeeId: String!
      ApprovalStatus: Int
      skipCount: Int
      maxResultCount: Int
    ): MyPendingApplicationResponse

    getDashboardData(
      tenantIdBase64: String!
      companyIdBase64: String!
      employeeIdBase64: String!
    ): DashboardData
  }
`;
