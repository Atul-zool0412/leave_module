import dotenv from "dotenv";
dotenv.config();
import { Binary } from "mongodb";
import GraphQLJSON from "graphql-type-json";
import connectDB, { getDb } from "../../config/db";
import { TransactionType } from "../../enum/TransactionType";

const LEAVE_DB_NAME = process.env.LEAVE_DB_NAME || "LeaveSvcNET8test";
const TASK_DB_NAME = process.env.TASK_DB_NAME || "TaskMgmtSvcNET8test";

export const resolvers = {
  JSON: GraphQLJSON,

  Query: {
    // Get Todo List
    getTodoList: async (
      _parent: any,
      args: { companyIdBase64: string; employeeIdBase64: string }
    ) => {
      await connectDB(TASK_DB_NAME);
      const db = getDb(TASK_DB_NAME);

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
        taskName: todo.TaskName || {},  // Return the whole JSON object
        leavePeriod: todo.LeavePeriod || {},
        expectedResumptionDate: todo.ExpectedResumptionDate?.en, // Return Leave Period in English
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
      }
    ) => {
      await connectDB(LEAVE_DB_NAME);
      const db = getDb(LEAVE_DB_NAME);

      const aggregationPipeline = [
        {
          $match: {
            TenantId: new Binary(Buffer.from(args.tenantIdBase64, "base64"), 3),
            CompanyId: new Binary(Buffer.from(args.companyIdBase64, "base64"), 3),
            EmployeeCode: args.employeeIdBase64, // EmployeeCode is plain string
            IsDeleted: false,
          },
        },
        { $unwind: "$LeaveLedgers" },
        {
          $addFields: {
            "LeaveLedgers.LeaveAddedNum": {
              $toDouble: { $ifNull: ["$LeaveLedgers.LeaveAdded", 0] },
            },
            "LeaveLedgers.LeaveUsedNum": {
              $toDouble: { $ifNull: ["$LeaveLedgers.LeaveUsed", 0] },
            },
            "LeaveLedgers.LeaveBalanceNum": {
              $toDouble: { $ifNull: ["$LeaveLedgers.LeaveBalance", 0] },
            },
          },
        },
        {
          $group: {
            _id: "$LeaveTypeId",
            leaveTypeName: { $first: "$LeaveTypeName.en.Name" },
            currentBalance: { $last: "$LeaveLedgers.LeaveBalanceNum" },

            // ----------------------
            // Days Calculations
            // ----------------------
            daysCredited: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$LeaveLedgers.TransactionType",
                      [TransactionType.Accrual, TransactionType.CreditedReset],
                    ],
                  },
                  "$LeaveLedgers.LeaveAddedNum",
                  0,
                ],
              },
            },
            daysEncashed: {
              $sum: {
                $cond: [
                  { $eq: ["$LeaveLedgers.TransactionType", TransactionType.LeaveBalanceReset] },
                  "$LeaveLedgers.LeaveUsedNum",
                  0,
                ],
              },
            },
            daysExpired: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$LeaveLedgers.TransactionType",
                      TransactionType.CarryForwardExpiry,
                    ],
                  },
                  "$LeaveLedgers.LeaveUsedNum",
                  0,
                ],
              },
            },
            daysCarriedForward: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $eq: [
                          "$LeaveLedgers.TransactionType",
                          TransactionType.CreditedReset,
                        ],
                      },
                      {
                        $regexMatch: {
                          input: "$LeaveLedgers.Remarks",
                          regex: "carry forward",
                          options: "i",
                        },
                      },
                    ],
                  },
                  { $abs: "$LeaveLedgers.LeaveUsedNum" },
                  0,
                ],
              },
            },
            daysTaken: {
              $sum: {
                $cond: [
                  { $eq: ["$LeaveLedgers.TransactionType", TransactionType.LeaveBooked] },
                  "$LeaveLedgers.LeaveUsedNum",
                  0,
                ],
              },
            },

            // ----------------------
            // Transaction Breakdown
            // ----------------------
            notApplicable: {
              $sum: {
                $cond: [
                  { $eq: ["$LeaveLedgers.TransactionType", TransactionType.NotApplicable] },
                  1,
                  0,
                ],
              },
            },
            accrual: {
              $sum: {
                $cond: [
                  { $eq: ["$LeaveLedgers.TransactionType", TransactionType.Accrual] },
                  1,
                  0,
                ],
              },
            },
            creditedReset: {
              $sum: {
                $cond: [
                  { $eq: ["$LeaveLedgers.TransactionType", TransactionType.CreditedReset] },
                  1,
                  0,
                ],
              },
            },
            leaveAttached: {
              $sum: {
                $cond: [
                  { $eq: ["$LeaveLedgers.TransactionType", TransactionType.LeaveAttached] },
                  1,
                  0,
                ],
              },
            },
            policyStart: {
              $sum: {
                $cond: [
                  { $eq: ["$LeaveLedgers.TransactionType", TransactionType.PolicyStart] },
                  1,
                  0,
                ],
              },
            },
            carryForwardExpiry: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$LeaveLedgers.TransactionType", TransactionType.CarryForwardExpiry],
                  },
                  1,
                  0,
                ],
              },
            },
            leaveBooked: {
              $sum: {
                $cond: [
                  { $eq: ["$LeaveLedgers.TransactionType", TransactionType.LeaveBooked] },
                  1,
                  0,
                ],
              },
            },
            leaveCancelled: {
              $sum: {
                $cond: [
                  { $eq: ["$LeaveLedgers.TransactionType", TransactionType.LeaveCancelled] },
                  1,
                  0,
                ],
              },
            },
            leaveBalanceReset: {
              $sum: {
                $cond: [
                  { $eq: ["$LeaveLedgers.TransactionType", TransactionType.LeaveBalanceReset] },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            leaveTypeId: "$_id",
            leaveTypeName: 1,
            currentBalance: { $toInt: "$currentBalance" },
            daysCredited: { $toInt: "$daysCredited" },
            daysEncashed: { $toInt: "$daysEncashed" },
            daysExpired: { $toInt: "$daysExpired" },
            daysCarriedForward: { $toInt: "$daysCarriedForward" },
            daysTaken: { $toInt: "$daysTaken" },

            // summary text
            summaryText: {
              $trim: {
                input: {
                  $concat: [
                    { $toString: "$daysCredited" },
                    " days credited",
                    {
                      $cond: [
                        { $gt: ["$daysEncashed", 0] },
                        {
                          $concat: [
                            " | ",
                            { $toString: "$daysEncashed" },
                            " days encashed",
                          ],
                        },
                        "",
                      ],
                    },
                    {
                      $cond: [
                        { $gt: ["$daysExpired", 0] },
                        {
                          $concat: [
                            " | ",
                            { $toString: "$daysExpired" },
                            " days expired",
                          ],
                        },
                        "",
                      ],
                    },
                    {
                      $cond: [
                        { $gt: ["$daysCarriedForward", 0] },
                        {
                          $concat: [
                            " | ",
                            { $toString: "$daysCarriedForward" },
                            " days carry forward",
                          ],
                        },
                        "",
                      ],
                    },
                  ],
                },
              },
            },

            // transaction summary
            transactionSummary: {
              totalCredits: "$daysCredited",
              totalEncashed: "$daysEncashed",
              totalExpired: "$daysExpired",
              totalCarriedForward: "$daysCarriedForward",
              totalTaken: "$daysTaken",
              netBalance: "$currentBalance",
            },

            // breakdown
            transactionTypeBreakdown: {
              notApplicable: "$notApplicable",
              accrual: "$accrual",
              creditedReset: "$creditedReset",
              leaveAttached: "$leaveAttached",
              policyStart: "$policyStart",
              carryForwardExpiry: "$carryForwardExpiry",
              leaveBooked: "$leaveBooked",
              leaveCancelled: "$leaveCancelled",
              leaveBalanceReset: "$leaveBalanceReset",
            },
          },
        },
        { $sort: { leaveTypeName: 1 } },
      ];

      const result = await db
        .collection("EmployeeLeaveLedgerCollection")
        .aggregate(aggregationPipeline)
        .toArray();
      console.log("Leave Balance Aggregation Result:", result);

      const leaveTypesWithBase64 = result.map((r: any) => ({
        ...r,
        leaveTypeId: r.leaveTypeId
          ? Buffer.from(r.leaveTypeId.buffer).toString("base64")
          : null,
      }));

      return {
        employeeId: args.employeeIdBase64,
        employeeLeaveTypes: leaveTypesWithBase64,
      };
    },
    // Get My Pending Applications
    getMyPendingApplications: async (
      _parent: any,
      args: { companyIdBase64: string; employeeIdBase64: string; isPending: boolean }
    ) => {
      await connectDB(TASK_DB_NAME);
      const db = getDb(TASK_DB_NAME);

      // Convert inputs properly
      const companyId = new Binary(Buffer.from(args.companyIdBase64, "base64"), 3);
      const employeeId = new Binary(Buffer.from(args.employeeIdBase64, "base64"), 3);

      // Build match
      const matchStage: any = {
        CompanyId: companyId,
        "Employee.EmployeeId": employeeId,
        $or: [{ IsDeleted: false }, { IsDeleted: { $exists: false } }],
      };

      if (args.isPending) {
        matchStage.ApprovalStatus = { $in: [1, "1", "Pending"] };
      }

      const aggregationPipeline = [
        { $match: matchStage },
        {
          $project: {
            _id: 1,
            CompanyId: 1,
            EmployeeId: "$Employee.EmployeeId",
            ApprovalStatus: 1,
            TaskName: { $ifNull: ["$TaskDefinition.TaskName", "$ModuleData.TaskName"] },
            TaskModule: "$TaskModule.Name",
            CreationTime: 1,
            TotalApprovalStages: 1,
            LeaveType: "$ModuleData.keyValuePair.Leave Type",
            LeavePeriod: "$ModuleData.keyValuePair.Leave Period",
            ResumptionDate: "$ModuleData.keyValuePair.Resumption Date",
          },
        },
        { $sort: { CreationTime: -1 } },
        { $limit: 50 },
      ];

      // console.log("Aggregation Pipeline:", JSON.stringify(aggregationPipeline, null, 2));

      const result = await db
        .collection("TaskApprovals")
        .aggregate(aggregationPipeline)
        .toArray();

      // console.log("Aggregation result:", result);

      return result.map((doc: any) => ({
        _id: doc._id?.buffer?.toString("base64") || null,
        companyId: doc.CompanyId?.buffer?.toString("base64") || null,
        employeeId: doc.EmployeeId?.buffer?.toString("base64") || null,
        status:
          doc.ApprovalStatus === 1 || doc.ApprovalStatus === "1" || doc.ApprovalStatus === "Pending"
            ? "Pending"
            : doc.ApprovalStatus === 2 || doc.ApprovalStatus === "2"
              ? "Approved"
              : doc.ApprovalStatus === 3 || doc.ApprovalStatus === "3"
                ? "Rejected"
                : "Unknown",
        TaskName: doc.TaskName || {},
        taskModule: doc.TaskModule || null,
        totalApprovalStages: doc.TotalApprovalStages || null,
        leaveType: doc.LeaveType || {},
        leavePeriod: doc.LeavePeriod || {},
        resumptionDate: doc.ResumptionDate || {},
        createdAt: doc.CreationTime ? new Date(doc.CreationTime).toISOString() : null,
      }));
    },
    // Get Leave Application History
    getApplicationHistory: async (
      _parent: any,
      args: {
        tenantIdBase64: string;
        companyIdBase64: string;
        employeeIdBase64?: string;
        employeeCode?: string; // <-- new
        filter?: string;
        leaveTypeIdBase64?: string;
        employeeLeaveTypeIdBase64?: string;
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

      // ------------------ Build match stage ------------------
      const matchStage: any = {
        TenantId: new Binary(Buffer.from(args.tenantIdBase64, "base64"), 3),
        CompanyId: new Binary(Buffer.from(args.companyIdBase64, "base64"), 3),
      };

      // Employee filter: ID or Code
      if (args.employeeIdBase64) {
        matchStage.EmployeeId = new Binary(
          Buffer.from(args.employeeIdBase64, "base64"),
          3
        );
      } else if (args.employeeCode) {
        matchStage.EmployeeCode = args.employeeCode;
      }

      // Text filter (name or code)
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

      // Leave type filters
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

      // Other filters
      if (args.unitOfLeave !== undefined) matchStage.UnitOfLeave = args.unitOfLeave;
      if (args.payType !== undefined) matchStage.PayType = args.payType;
      if (args.approvalStatus) matchStage.ApprovalStatus = parseInt(args.approvalStatus, 10);

      // Employee placeholder IDs
      if (args.employeePlaceholderIdsBase64) {
        matchStage.EmployeePlaceholderId = {
          $in: args.employeePlaceholderIdsBase64.map(
            (id) => new Binary(Buffer.from(id, "base64"), 3)
          ),
        };
      }

      // Leave period filter
      if (args.startDate && args.endDate) {
        matchStage["LeavePeriod.StartDate"] = { $gte: new Date(args.startDate) };
        matchStage["LeavePeriod.EndDate"] = { $lt: new Date(args.endDate) };
      }

      // Application date filter
      if (args.applicationDate) {
        const start = new Date(args.applicationDate);
        const end = new Date(args.applicationDate);
        end.setDate(end.getDate() + 1);
        matchStage.AppliedOn = { $gte: start, $lt: end };
      }

      // ------------------ Aggregation pipeline ------------------
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

      // ------------------ Map results ------------------
      return result.map((app: any) => ({
        applicationId: app._id.toString("base64"),
        status: app.ApprovalStatus?.toString(),
        leaveTypeName: app.LeaveTypeName?.en?.Name || "N/A",
        appliedOn: app.AppliedOn?.toISOString(),
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
    // Dashboard API
    getDashboardData: async (_parent: any, args: { tenantIdBase64: string; companyIdBase64: string; employeeIdBase64: string }) => {
      try {
        const [todoList, pendingApplications, leaveBalance, applicationHistory, encashmentApplications] = await Promise.all([
          resolvers.Query.getTodoList(_parent, { companyIdBase64: args.companyIdBase64, employeeIdBase64: args.employeeIdBase64 }),
          resolvers.Query.getMyPendingApplications(_parent, { companyIdBase64: args.companyIdBase64, employeeIdBase64: args.employeeIdBase64, isPending: true }),
          resolvers.Query.getLeaveBalance(_parent, { tenantIdBase64: args.tenantIdBase64, companyIdBase64: args.companyIdBase64, employeeIdBase64: args.employeeIdBase64 }),
          resolvers.Query.getApplicationHistory(_parent, { tenantIdBase64: args.tenantIdBase64, companyIdBase64: args.companyIdBase64, employeeIdBase64: args.employeeIdBase64 }),
          resolvers.Query.getEncashmentApplications(_parent, { tenantIdBase64: args.tenantIdBase64, companyIdBase64: args.companyIdBase64, employeeIdBase64: args.employeeIdBase64 }),
        ]);

        return {
          todoList,
          pendingApplications,
          leaveBalance,
          applicationHistory,
          encashmentApplications,
        };
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        throw new Error("Failed to fetch dashboard data");
      }
    },
  },
};
