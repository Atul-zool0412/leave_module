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
            CompanyId: new Binary(
              Buffer.from(args.companyIdBase64, "base64"),
              3
            ),
            "Employee.EmployeeId": new Binary(
              Buffer.from(args.employeeIdBase64, "base64"),
              3
            ),
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
            ExpectedResumptionDate:
              "$ModuleData.keyValuePair.Expected Resumption Date", // Extract Leave Period
          },
        },
        { $sort: { CreationTime: -1 } },
        { $limit: 50 },
      ];

      const result = await db
        .collection("TodoTaskApproval")
        .aggregate(aggregationPipeline)
        .toArray();

      return result.map((todo: any) => ({
        _id: todo._id.toString("base64"),
        companyId: todo.CompanyId?.buffer?.toString("base64") || null,
        employeeId: todo.EmployeeId?.buffer?.toString("base64") || null,
        status: todo.Status === 1 ? "Pending" : "Completed",
        taskName: todo.TaskName || {}, // Return the whole JSON object
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
      const today = new Date();

      // 1. Fetch employee details
      const employee = await db
        .collection("EmployeeLeaveMapCollection")
        .findOne({
          TenantId: new Binary(Buffer.from(args.tenantIdBase64, "base64"), 3),
          CompanyId: new Binary(Buffer.from(args.companyIdBase64, "base64"), 3),
          EmployeeCode: args.employeeIdBase64,
          IsDeleted: false,
        });
      if (!employee) throw new Error("Employee not found");

      const activeLeaveTypes = employee.EmployeeLeaveTypes.filter(
        (leaveTypes: any) => leaveTypes.IsActive === true
      );

      // 2. Aggregate leave transactions per leave type
      const aggregationPipeline: any[] = [
        {
          $match: {
            EmployeeCode: employee.EmployeeCode,
            IsDeleted: false,
            EmployeeLeaveTypeId: { $in: activeLeaveTypes.map((elt: any) => elt._id) }
          },
        },
        { $unwind: "$LeaveLedgers" },
        {
          $match: {
            "LeaveLedgers.Date": { $lte: today },
            "LeaveLedgers.TransactionType": { $nin: [3, 4, 9, 10] },
            $expr: {
              $and: [
                { $eq: [{ $year: "$LeaveLedgers.Date" }, today.getFullYear()] },
                { $eq: [{ $month: "$LeaveLedgers.Date" }, today.getMonth() + 1] }
              ]
            }
          },
        },
        { $sort: { "LeaveLedgers.Date": -1 } },
        {
          $addFields: {
            leaveAddedNum: { $toDouble: { $ifNull: ["$LeaveLedgers.LeaveAdded", 0] } },
            leaveUsedNum: { $toDouble: { $ifNull: ["$LeaveLedgers.LeaveUsed", 0] } },
            unitOfLeave: { $toInt: { $ifNull: ["$LeaveLedgers.UnitOfLeave", 1] } },
            year: { $year: "$LeaveLedgers.Date" },
            month: { $month: "$LeaveLedgers.Date" },
            leaveExpiredNum: {
              $cond: [{ $eq: ["$LeaveLedgers.TransactionType", 2] }, "$LeaveLedgers.LeaveUsed", 0]
            },
            leaveBalanceNum: { $toDouble: { $ifNull: ["$LeaveLedgers.LeaveBalance", 0] } },
          },
        },
        // Group by leaveType + month + transactionType
        {
          $group: {
            _id: {
              leaveTypeId: "$LeaveTypeId",
              year: "$year",
              month: "$month",
              transactionType: "$LeaveLedgers.TransactionType",
            },
            leaveTypeName: { $first: "$LeaveTypeName" },
            totalAdded: { $sum: "$leaveAddedNum" },
            totalUsed: { $sum: "$leaveUsedNum" },
            unitOfLeave: { $first: "$unitOfLeave" },
            leaveExpiredNum: { $sum: "$leaveExpiredNum" },
            lastLeaveBalance: { $first: "$leaveBalanceNum" },
            lastDate: { $first: "$LeaveLedgers.Date" },
          },
        },
        { $sort: { "lastDate": -1 } },
        // Group again by leaveType + month
        {
          $group: {
            _id: {
              leaveTypeId: "$_id.leaveTypeId",
              year: "$_id.year",
              month: "$_id.month",
            },
            leaveTypeName: { $first: "$leaveTypeName" },
            transactionCounts: {
              $push: {
                transactionType: "$_id.transactionType",
                leaveAdded: "$totalAdded",
                leaveUsed: "$totalUsed",
                unitOfLeave: "$unitOfLeave",
              },
            },
            totalCredit: {
              $sum: {
                $cond: [
                  { $in: ["$_id.transactionType", [TransactionType.Accrual, TransactionType.Reset]] },
                  "$totalAdded",
                  0,
                ],
              },
            },
            totalDebit: {
              $sum: {
                $cond: [
                  { $not: { $in: ["$_id.transactionType", [TransactionType.Accrual, TransactionType.Reset]] } },
                  "$totalUsed",
                  0,
                ],
              },
            },
            leaveExpired: { $sum: "$leaveExpiredNum" },
            lastLeaveBalance: { $first: "$lastLeaveBalance" },
            lastDate: { $first: "$lastDate" },
          },
        },
        // // Sort by year + month (latest first)
        // // { $sort: { "_id.year": -1, "_id.month": -1 } },

        // // {$sort: { "lastDate": -1 }},
        // // Keep only the latest month per leaveType
        {
          $group: {
            _id: "$_id.leaveTypeId",
            leaveTypeName: { $first: "$leaveTypeName" },
            Year: { $first: "$_id.year" },
            Month: { $first: "$_id.month" },
            transactionCounts: { $first: "$transactionCounts" },
            totalCredit: { $first: "$totalCredit" },
            totalDebit: { $first: "$totalDebit" },
            leaveExpired: { $first: "$leaveExpired" },
            currentBalance: { $first: "$lastLeaveBalance" }, // ✅ updated to reflect balance as of today
          },
        },
        // Lookup PayType + LeaveEntitlementType
        {
          $lookup: {
            from: "EmployeeLeaveMapCollection",
            let: { leaveTypeId: "$_id" },
            pipeline: [
              {
                $match: {
                  TenantId: new Binary(Buffer.from(args.tenantIdBase64, "base64"), 3),
                  CompanyId: new Binary(Buffer.from(args.companyIdBase64, "base64"), 3),
                  EmployeeCode: args.employeeIdBase64,
                  IsDeleted: false,
                },
              },
              { $unwind: "$EmployeeLeaveTypes" },
              {
                $match: {
                  $expr: { $eq: ["$EmployeeLeaveTypes.LeaveTypeId", "$$leaveTypeId"] },
                },
              },
              {
                $project: {
                  PayType: "$EmployeeLeaveTypes.PayType",
                  LeaveEntitlementType: "$EmployeeLeaveTypes.LeaveEntitlementType",
                  IsActive: "$EmployeeLeaveTypes.IsActive",
                  IsSystemDefault: "$EmployeeLeaveTypes.IsSystemDefault",
                  IsCountrySpecific: "$EmployeeLeaveTypes.IsCountrySpecific",
                  CountryCode: "$EmployeeLeaveTypes.CountryCode",
                  IsCustomized: "$EmployeeLeaveTypes.IsCustomized",
                  _id: 0,
                },
              },
            ],
            as: "leaveMap",
          },
        },
        { $unwind: { path: "$leaveMap", preserveNullAndEmptyArrays: true } },
        // Final shape
        {
          $project: {
            EmployeeLeaveTypeId: "$_id",
            LeaveTypeName: "$leaveTypeName.en",
            Year: 1,
            Month: 1,
            PayType: "$leaveMap.PayType",
            LeaveEntitlementType: "$leaveMap.LeaveEntitlementType",
            IsSystemDefault: "$leaveMap.IsSystemDefault",
            IsCountrySpecific: "$leaveMap.IsCountrySpecific",
            CountryCode: "$leaveMap.CountryCode",
            IsCustomized: "$leaveMap.IsCustomized",
            currentBalance: 1, // ✅ reflects leave balance as of today
            transactionCounts: 1,
            leaveExpired: 1,
            _id: 0,
          },
        },
      ];

      const leaveTypes = await db
        .collection("EmployeeLeaveLedgerCollection")
        .aggregate(aggregationPipeline)
        .toArray();
      console.log("leaveTypes:", leaveTypes);
      // Map transactionCounts with CreditOrDebit dynamically
      const employeeLeaveTypes = leaveTypes.map((lt: any) => ({
        ...lt,
        EmployeeLeaveTypeId: lt.EmployeeLeaveTypeId
          ? Buffer.from(lt.EmployeeLeaveTypeId.buffer).toString("base64")
          : null,
        transactionCounts: lt.transactionCounts.map((tx: any) => ({
          ...tx,
          CreditOrDebit:
            tx.transactionType === TransactionType.Accrual ||
              tx.transactionType === TransactionType.Reset
              ? "Credit"
              : tx.leaveUsed > 0
                ? "Debit"
                : "Credit",
          leaveAdded: tx.leaveAdded.toString(),
          leaveUsed: tx.leaveUsed.toString(),
          LeaveExpired: tx.transactionType === 2 ? tx.leaveUsed.toString() : "0",
        })),
      }));

      return {
        EmployeeId: employee._id.toString(),
        EmployeeName: {
          en: employee.EmployeeName.en.FullName,
          ar: employee.EmployeeName.ar.FullName,
        },
        EmployeeCode: employee.EmployeeCode,
        LeaveBalanceAsOn: today.toISOString().split("T")[0],
        employeeLeaveTypes,
      };
    },

    // Get My Pending Applications
    getMyPendingApplications: async (
      _parent: any,
      args: {
        companyIdBase64: string;
        employeeIdBase64: string;
        isPending: boolean;
      }
    ) => {
      await connectDB(TASK_DB_NAME);
      const db = getDb(TASK_DB_NAME);

      // Convert inputs properly
      const companyId = new Binary(
        Buffer.from(args.companyIdBase64, "base64"),
        3
      );
      const employeeId = new Binary(
        Buffer.from(args.employeeIdBase64, "base64"),
        3
      );

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
            TaskName: {
              $ifNull: ["$TaskDefinition.TaskName", "$ModuleData.TaskName"],
            },
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
          doc.ApprovalStatus === 1 ||
            doc.ApprovalStatus === "1" ||
            doc.ApprovalStatus === "Pending"
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
        createdAt: doc.CreationTime
          ? new Date(doc.CreationTime).toISOString()
          : null,
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
      if (args.unitOfLeave !== undefined)
        matchStage.UnitOfLeave = args.unitOfLeave;
      if (args.payType !== undefined) matchStage.PayType = args.payType;
      if (args.approvalStatus)
        matchStage.ApprovalStatus = parseInt(args.approvalStatus, 10);

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
        matchStage["LeavePeriod.StartDate"] = {
          $gte: new Date(args.startDate),
        };
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
    getDashboardData: async (
      _parent: any,
      args: {
        tenantIdBase64: string;
        companyIdBase64: string;
        employeeIdBase64: string;
      }
    ) => {
      try {
        const [
          todoList,
          pendingApplications,
          leaveBalance,
          applicationHistory,
          encashmentApplications,
        ] = await Promise.all([
          resolvers.Query.getTodoList(_parent, {
            companyIdBase64: args.companyIdBase64,
            employeeIdBase64: args.employeeIdBase64,
          }),
          resolvers.Query.getMyPendingApplications(_parent, {
            companyIdBase64: args.companyIdBase64,
            employeeIdBase64: args.employeeIdBase64,
            isPending: true,
          }),
          resolvers.Query.getLeaveBalance(_parent, {
            tenantIdBase64: args.tenantIdBase64,
            companyIdBase64: args.companyIdBase64,
            employeeIdBase64: args.employeeIdBase64,
          }),
          resolvers.Query.getApplicationHistory(_parent, {
            tenantIdBase64: args.tenantIdBase64,
            companyIdBase64: args.companyIdBase64,
            employeeIdBase64: args.employeeIdBase64,
          }),
          resolvers.Query.getEncashmentApplications(_parent, {
            tenantIdBase64: args.tenantIdBase64,
            companyIdBase64: args.companyIdBase64,
            employeeIdBase64: args.employeeIdBase64,
          }),
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
