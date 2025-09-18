import dotenv from "dotenv";
dotenv.config();
import { Binary } from "mongodb";
import GraphQLJSON from "graphql-type-json";
import connectDB, { getDb } from "../../config/db";

const LEAVE_DB_NAME = process.env.LEAVE_DB_NAME || "LeaveSvcNET8test";
const Task_DB_NAME = process.env.TASK_DB_NAME || "TaskMgmtSvcNET8test";

export const resolvers = {
  JSON: GraphQLJSON,

  Query: {
getTodoList: async (
  _parent: any,
  args: { companyIdBase64: string; employeeIdBase64: string }
) => {
  await connectDB(Task_DB_NAME);
  const db = getDb(Task_DB_NAME);

  const aggregationPipeline = [
    {
      $match: {
        CompanyId: new Binary(Buffer.from(args.companyIdBase64, "base64"), 3),
        "Employee.EmployeeId": new Binary(Buffer.from(args.employeeIdBase64, "base64"), 3),
        Status: 1, // Pending
      },
    },
    { $unwind: { path: "$ModuleData", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        CompanyId: 1,
        EmployeeId: "$Employee.EmployeeId",
        Status: 1,
        TaskName: 1,
        CreationTime: 1,
        LeavePeriod: "$ModuleData.keyValuePair.Leave Period",
        ExpectedResumptionDate: "$ModuleData.keyValuePair.Expected Resumption Date" // Extract Leave Period
      },
    },
    { $sort: { CreationTime: -1 } },
    { $limit: 50 },
  ];

  const result = await db.collection("TodoTaskApproval").aggregate(aggregationPipeline).toArray();

  return result.map((todo: any) => ({
    _id: todo._id.toString("base64"),
    companyId: todo.CompanyId?.buffer?.toString("base64") || null,
    employeeId: todo.EmployeeId?.buffer?.toString("base64") || null,
    status: todo.Status === 1 ? "Pending" : "Completed",
    TaskName: todo.TaskName || {},  // Return the whole JSON object
    leavePeriod: todo.LeavePeriod || {},
    ExpectedResumptionDate: todo.ExpectedResumptionDate?.en, // Return Leave Period in English
    createdAt: todo.CreationTime ? todo.CreationTime.toISOString() : null,
  }));
},



    // Get Leave Balance
    getLeaveBalance: async (
      _parent: any,
      args: {
        tenantIdBase64: string;
        companyIdBase64: string;
        employeeIdBase64: string;
        leaveTypeIdBase64?: string;
      }
    ) => {
      await connectDB(LEAVE_DB_NAME);
      const db = getDb(LEAVE_DB_NAME);

      const aggregationPipeline = [
        {
          $match: {
            TenantId: new Binary(Buffer.from(args.tenantIdBase64, "base64"), 3),
            CompanyId: new Binary(
              Buffer.from(args.companyIdBase64, "base64"),
              3
            ),
            EmployeeId: new Binary(
              Buffer.from(args.employeeIdBase64, "base64"),
              3
            ),
          },
        },
        { $unwind: "$EmployeeLeaveTypes" },
        {
          $match: args.leaveTypeIdBase64
            ? {
                "EmployeeLeaveTypes.LeaveTypeId": new Binary(
                  Buffer.from(args.leaveTypeIdBase64, "base64"),
                  3
                ),
              }
            : {},
        },
        {
          $lookup: {
            from: "EmployeeLeaveLedgerCollection",
            let: { leaveTypeId: "$EmployeeLeaveTypes.LeaveTypeId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$EmployeeLeaveTypeId", "$$leaveTypeId"] },
                },
              },
              {
                $project: {
                  LeaveLedgers: 1,
                  EmployeeLeaveTypeId: 1,
                },
              },
            ],
            as: "LeaveBalanceRecords",
          },
        },
        {
          $project: {
            EmployeeId: 1,
            EmployeeName: 1,
            EmployeeLeaveType: "$EmployeeLeaveTypes",
            LeaveBalanceRecords: 1,
          },
        },
      ];

      const result = await db
        .collection("EmployeeLeaveMapCollection")
        .aggregate(aggregationPipeline)
        .toArray();

      if (result.length === 0) return null;

      const employeeLeaveTypesWithBalance = result.map((record: any) => {
        const balanceRecord = record.LeaveBalanceRecords[0];

        const currentBalance =
          balanceRecord &&
          Array.isArray(balanceRecord.LeaveLedgers) &&
          balanceRecord.LeaveLedgers.length > 0
            ? balanceRecord.LeaveBalanceRecords.sort(
                (a: any, b: any) =>
                  new Date(b.Date).getTime() - new Date(a.Date).getTime()
              )[0].LeaveBalance
            : 0;

        return {
          leaveTypeId:
            record.EmployeeLeaveType.LeaveTypeId.buffer.toString("base64"),
          EmployeeName: record.EmployeeName,
          leaveTypeName: record.EmployeeLeaveType.LeaveTypeName,
          payType: record.EmployeeLeaveType.PayType,
          unitOfLeave: record.EmployeeLeaveType.UnitOfLeave,
          entitlementType: record.EmployeeLeaveType.LeaveEntitlementType,
          validity: record.EmployeeLeaveType.Validity,
          isActive: record.EmployeeLeaveType.IsActive,
          currentBalance,
        };
      });

      return {
        employeeId: result[0].EmployeeId.buffer.toString("base64"),
        employeeLeaveTypes: employeeLeaveTypesWithBalance,
      };
    },

    // Get Leave Application History
    getApplicationHistory: async (
      _parent: any,
      args: {
        tenantIdBase64: string;
        companyIdBase64: string;
        filter?: string;
        leaveTypeIdBase64?: string;
        employeeLeaveTypeIdBase64?: string;
        employeeIdBase64?: string;
        unitOfLeave?: number;
        payType?: number;
        approvalStatus?: string;
        employeePlaceholderIdsBase64?: string[];
        startDate?: string;
        endDate?: string;
        applicationDate?: string;
        skipCount?: number;
        maxResultCount?: number;
      }
    ) => {
      await connectDB(LEAVE_DB_NAME);
      const db = getDb(LEAVE_DB_NAME);

      const matchStage: any = {
        TenantId: new Binary(Buffer.from(args.tenantIdBase64, "base64"), 3),
        CompanyId: new Binary(Buffer.from(args.companyIdBase64, "base64"), 3),
      };

      if (args.employeeIdBase64) {
        matchStage.EmployeeId = new Binary(
          Buffer.from(args.employeeIdBase64, "base64"),
          3
        );
      }

      if (args.filter) {
        matchStage["$or"] = [
          {
            "EmployeeName.en.FullName": {
              $regex: `.*${args.filter}.*`,
              $options: "i",
            },
          },
          { EmployeeCode: { $regex: `^${args.filter}$`, $options: "i" } },
        ];
      }

      if (args.leaveTypeIdBase64) {
        matchStage.LeaveTypeId = new Binary(
          Buffer.from(args.leaveTypeIdBase64, "base64"),
          3
        );
      }

      if (args.employeeLeaveTypeIdBase64) {
        matchStage.EmployeeLeaveTypeId = new Binary(
          Buffer.from(args.employeeLeaveTypeIdBase64, "base64"),
          3
        );
      }

      if (args.unitOfLeave !== undefined) {
        matchStage.UnitOfLeave = args.unitOfLeave;
      }

      if (args.payType !== undefined) {
        matchStage.PayType = args.payType;
      }

      if (args.approvalStatus) {
        matchStage.ApprovalStatus = parseInt(args.approvalStatus, 10);
      }

      if (args.employeePlaceholderIdsBase64) {
        matchStage.EmployeePlaceholderId = {
          $in: args.employeePlaceholderIdsBase64.map(
            (id) => new Binary(Buffer.from(id, "base64"), 3)
          ),
        };
      }

      if (args.startDate && args.endDate) {
        matchStage["LeavePeriod.StartDate"] = {
          $gte: new Date(args.startDate),
        };
        matchStage["LeavePeriod.EndDate"] = { $lt: new Date(args.endDate) };
      }

      if (args.applicationDate) {
        const start = new Date(args.applicationDate);
        const end = new Date(args.applicationDate);
        end.setDate(end.getDate() + 1);

        matchStage.AppliedOn = { $gte: start, $lt: end };
      }

      const aggregationPipeline = [
        { $match: matchStage },
        {
          $project: {
            _id: 1,
            ApprovalStatus: 1,
            LeaveTypeName: 1,
            AppliedOn: 1,
            ApprovedOn: 1,
          },
        },
        { $sort: { AppliedOn: -1 } },
        { $skip: args.skipCount || 0 },
        { $limit: args.maxResultCount || 10 },
      ];

      const result = await db
        .collection("EmployeeLeaveApplications")
        .aggregate(aggregationPipeline)
        .toArray();

      return result.map((app: any) => ({
        applicationId: app._id.toString("base64"),
        status: app.ApprovalStatus.toString(),
        leaveTypeName: app.LeaveTypeName?.en?.Name || "N/A",
        appliedOn: app.AppliedOn.toISOString(),
        approvedOn: app.ApprovedOn ? app.ApprovedOn.toISOString() : null,
      }));
    },

    // Get Encashment Applications
    getEncashmentApplications: async (
      _parent: any,
      args: {
        tenantIdBase64: string;
        companyIdBase64: string;
        filter?: string;
        leaveTypeIdBase64?: string;
        employeeLeaveTypeIdBase64?: string;
        employeeIdBase64?: string;
        unitOfLeave?: number;
        approvalStatus?: string;
        employeePlaceholderIdsBase64?: string[];
        applicationDate?: string;
        skipCount?: number;
        maxResultCount?: number;
      }
    ) => {
      await connectDB(LEAVE_DB_NAME);
      const db = getDb(LEAVE_DB_NAME);

      const matchStage: any = {
        TenantId: new Binary(Buffer.from(args.tenantIdBase64, "base64"), 3),
        CompanyId: new Binary(Buffer.from(args.companyIdBase64, "base64"), 3),
      };

      if (args.employeeIdBase64) {
        matchStage.EmployeeId = new Binary(
          Buffer.from(args.employeeIdBase64, "base64"),
          3
        );
      }

      if (args.filter) {
        matchStage["$or"] = [
          {
            "EmployeeName.en.FullName": {
              $regex: `.*${args.filter}.*`,
              $options: "i",
            },
          },
          { EmployeeCode: { $regex: `^${args.filter}$`, $options: "i" } },
        ];
      }

      if (args.leaveTypeIdBase64) {
        matchStage.LeaveTypeId = new Binary(
          Buffer.from(args.leaveTypeIdBase64, "base64"),
          3
        );
      }

      if (args.employeeLeaveTypeIdBase64) {
        matchStage.EmployeeLeaveTypeId = new Binary(
          Buffer.from(args.employeeLeaveTypeIdBase64, "base64"),
          3
        );
      }

      if (args.unitOfLeave !== undefined) {
        matchStage.UnitOfLeave = args.unitOfLeave;
      }

      if (args.approvalStatus) {
        matchStage.ApprovalStatus = parseInt(args.approvalStatus, 10);
      }

      if (args.employeePlaceholderIdsBase64) {
        matchStage.EmployeePlaceholderId = {
          $in: args.employeePlaceholderIdsBase64.map(
            (id) => new Binary(Buffer.from(id, "base64"), 3)
          ),
        };
      }

      if (args.applicationDate) {
        const start = new Date(args.applicationDate);
        const end = new Date(args.applicationDate);
        end.setDate(end.getDate() + 1);
        matchStage.ApplicationDate = { $gte: start, $lt: end };
      }

      const aggregationPipeline = [
        { $match: matchStage },
        {
          $project: {
            _id: 1,
            EmployeeName: 1,
            EmployeeCode: 1,
            LeaveTypeName: 1,
            EncashmentQuantityApplied: 1,
            AppliedOn: 1,
            ApprovalStatus: 1,
            IsPaid: 1,
          },
        },
        { $sort: { AppliedOn: -1 } },
        { $skip: args.skipCount || 0 },
        { $limit: args.maxResultCount || 10 },
      ];

      const result = await db
        .collection("EmployeeLeaveEncashments")
        .aggregate(aggregationPipeline)
        .toArray();

      return result.map((encash: any) => ({
        encashmentId: encash._id ? encash._id.toString("base64") : null,
        employeeName: encash.EmployeeName?.en?.FullName || "N/A",
        employeeCode: encash.EmployeeCode || "N/A",
        leaveTypeName: encash.LeaveTypeName?.en?.Name || "N/A",
        encashDays: encash.EncashmentQuantityApplied || 0,
        appliedOn: encash.AppliedOn ? encash.AppliedOn.toISOString() : null,
        approvalStatus:
          encash.ApprovalStatus !== undefined
            ? encash.ApprovalStatus.toString()
            : "N/A",
        isPaid: encash.IsPaid ?? false,
      }));
    },
  },
};
