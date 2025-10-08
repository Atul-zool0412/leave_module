import dotenv from "dotenv";
dotenv.config();
import GraphQLJSON from "graphql-type-json";
import connectDB, { getDb } from "../../config/db";
import { TransactionType } from "../../enum/TransactionType";
import { TodoStatus } from "../../enum/TodoStatus";
import { IQueryContext } from "interface/interface";
import { binaryToUUID, guidToBinary } from "../../utills/idConversion";
// import { Binary } from "mongodb";


const LEAVE_DB_NAME = process.env.LEAVE_DB_NAME || "LeaveSvcNET8test";
const TASK_DB_NAME = process.env.TASK_DB_NAME || "TaskMgmtSvcNET8test";

export const resolvers = {
  JSON: GraphQLJSON,

  Query: {
    // Get Todo List
    getTodoList: async (
      _parent: any,
      args: {
        tenantId: string,
        companyId: string,
        employeeId: string,
        todoStatus: number
      },
      // context: IQueryContext
    ) => {

      // Convert token UUIDs to MongoDB Binary
      const tenantId = guidToBinary(args.tenantId);
      const companyId = guidToBinary(args.companyId)
      const employeeId = guidToBinary(args.employeeId);
      // Connect to MongoDB and get DB instance
      await connectDB(TASK_DB_NAME);
      const db = getDb(TASK_DB_NAME);

      // Build match stage
      const matchStage: any = {
        TenantId: tenantId,
        CompanyId: companyId,
        "Employee.EmployeeId": employeeId,
        IsDeleted: false,
        Status: TodoStatus.Pending, // default Pending
      };

      // Aggregation pipeline
      const aggregationPipeline = [
        { $match: matchStage },
        {
          $addFields: {
            assignedOnDate: {
              $dateFromString: {
                dateString: "$ModuleData.keyValuePair['Assigned on'].en",
                format: "%d %b %Y",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        { $sort: { assignedOnDate: -1 } },
        { $limit: 50 },
      ];
      
      // Execute aggregation
      const result = await db
        .collection("TodoTaskApproval")
        .aggregate(aggregationPipeline)
        .toArray();
        // console.log(aggregationPipeline); 

      // Map DB results to GraphQL response
      const items = result.map((todo: any) => ({
        createdBy: todo.CreatedBy
          ? {
            type: "user",
            loginId: todo.CreatedBy?.LoginId || null,
            loginName: todo.CreatedBy?.LoginName || null,
            isEmployee: todo.CreatedBy?.IsEmployee ?? true,
            employee: {
              en: todo.CreatedBy?.IsEmployee
                ? todo.CreatedBy?.Name?.en?.FullName || ""
                : "",
              ar: todo.CreatedBy?.IsEmployee
                ? todo.CreatedBy?.Name?.ar?.FullName || ""
                : "",
            },
          }
          : null,

        assignedTo: todo.AssignedTo
          ? {
            loginId: todo.AssignedTo?.LoginId || null,
            loginName: todo.AssignedTo?.LoginName || null,
            isEmployee: todo.AssignedTo?.IsEmployee ?? true,
            employee: {
              en: todo.AssignedTo?.Name?.en?.FullName || "",
              ar: todo.AssignedTo?.Name?.ar?.FullName || "",
            },
          }
          : null,

        todoType: todo.TodoType,
        recordSource: todo.RecordSource,
        appService: todo.TaskDefinition?.TaskModule?.AppService || null,
        moduleData: todo.ModuleData,
        isEmployeeSpecificTodo: todo.IsEmployeeSpecificTodo,
        employeeId: todo.Employee?.EmployeeId
          ? binaryToUUID(todo.Employee.EmployeeId) // Convert to Binary here
          : null,
        EmployeeName: todo.Employee?.Name || null,
        externalId: todo.Externald || null,
        formUrl: todo.FormUrl,
        status: todo.Status,
        priority: todo.Priority,
      }));

      return {
        items,
        totalCount: items.length,
      };
    },
    // get leave balance
    getLeaveBalance: async (
      _parent: any,
      args: {
        tenantId: string,
        companyId: string,
        employeeId: string,
        isActive?: boolean
      },
      context: IQueryContext
    ) => {
      // await connectDB(LEAVE_DB_NAME);
      const db = getDb(LEAVE_DB_NAME);
      // const today = new Date();
      const today = new Date("2025-10-19T04:55:52.156Z");

      // const args = context.tokenData;

      // Convert token UUIDs to MongoDB Binary
      const tenantId = guidToBinary(args.tenantId);
      const companyId = guidToBinary(args.companyId)
      const employeeId = guidToBinary(args.employeeId);

      //  console.log("emp", args);

      //  console.log("scadca", tenantId , companyId, employeeId);
      // 1. Fetch employee details
      const employeeLeaveType = await db
        .collection("EmployeeLeaveMapCollection")
        .findOne({
          TenantId: tenantId,
          CompanyId: companyId,
          EmployeeId: employeeId,
          IsDeleted: false,
        });
      // console.log("scacas", employeeLeaveType);
      if (!employeeLeaveType) throw new Error("Employee not found");

      const activeLeaveTypes = employeeLeaveType.EmployeeLeaveTypes.filter(
        (leaveTypes: any) => leaveTypes.IsActive == args.isActive
      );

      // 2. Aggregate leave transactions per leave type
      const aggregationPipeline: any[] = [
        {
          $match: {
            EmployeeId: employeeId,
            IsDeleted: false,
            EmployeeLeaveTypeId: { $in: activeLeaveTypes.map((elt: any) => elt._id) },
          },
        },
        { $unwind: "$LeaveLedgers" },
        {
          $match: {
            "LeaveLedgers.Date": { $lte: today },
            "LeaveLedgers.TransactionType": { $in: [1, 6] },
            $expr: {
              $and: [
                { $eq: [{ $year: "$LeaveLedgers.Date" }, today.getFullYear()] },
                { $eq: [{ $month: "$LeaveLedgers.Date" }, today.getMonth() + 1] },
              ],
            },
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
              $cond: [{ $eq: ["$LeaveLedgers.TransactionType", 2] }, "$LeaveLedgers.LeaveUsed", 0],
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
            currentBalance: { $first: "$lastLeaveBalance" },
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
                  TenantId: tenantId,
                  CompanyId: companyId,
                  EmployeeId: employeeId,
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
                  LeaveTypeName: "$EmployeeLeaveTypes.LeaveTypeName",
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
            LeaveTypeName: {
              en: "$leaveTypeName.en.Name",
              ar: "$leaveTypeName.ar.Name",
            },
            Year: 1,
            Month: 1,
            PayType: "$leaveMap.PayType",
            LeaveEntitlementType: "$leaveMap.LeaveEntitlementType",
            IsSystemDefault: "$leaveMap.IsSystemDefault",
            IsCountrySpecific: "$leaveMap.IsCountrySpecific",
            CountryCode: "$leaveMap.CountryCode",
            IsCustomized: "$leaveMap.IsCustomized",
            currentBalance: 1,
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
      console.log("leave types", leaveTypes);

      const employeeLeaveTypes = leaveTypes.map((lt: any) => ({
        ...lt,
        EmployeeLeaveTypeId: lt.EmployeeLeaveTypeId ? binaryToUUID(lt.EmployeeLeaveTypeId) : null,

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
        EmployeeId: binaryToUUID(employeeLeaveType._id.toString("hex")),
        EmployeeName: {
          en: employeeLeaveType?.EmployeeName?.en?.FullName ?? "N/A",
          ar: employeeLeaveType?.EmployeeName?.ar?.FullName ?? "N/A",
        },

        EmployeeCode: employeeLeaveType.EmployeeCode,
        LeaveBalanceAsOn: today.toISOString().split("T")[0],
        employeeLeaveTypes,
      };
    },
    // Get My Pending Applications
    getMyPendingApplications: async (
      _parent: any,
      args: {
        tenantId: string,
        companyId: string,
        employeeId: string
        ApprovalStatus: number;
        skipCount?: number;
        maxResultCount?: number;
      },
      context: IQueryContext
    ) => {
      // const args = context.tokenData;

      // Convert token UUIDs to MongoDB Binary
      const tenantId = guidToBinary(args.tenantId);
      const companyId = guidToBinary(args.companyId)
      const employeeId = guidToBinary(args.employeeId);


      // Connect to MongoDB and get DB instance
      await connectDB(TASK_DB_NAME);
      const db = getDb(TASK_DB_NAME);

      const aggregationPipeline: any[] = [
        {
          $match: {
            TenantId: tenantId,
            CompanyId: companyId,
            "Employee.EmployeeId": employeeId,
            IsApprovalForEmployee: true,
            ApprovalStatus: args.ApprovalStatus,
            $or: [{ IsDeleted: false }, { IsDeleted: { $exists: false } }],
          },
        },
        { $sort: { CreationTime: -1 } },
      ];

      // Add skip and limit dynamically
      if (args.skipCount) {
        aggregationPipeline.push({ $skip: args.skipCount });
      }
      if (args.maxResultCount) {
        aggregationPipeline.push({ $limit: args.maxResultCount });
      } else {
        aggregationPipeline.push({ $limit: 5 }); // default limit
      }

      // Rest of your stages
      aggregationPipeline.push(
        {
          $addFields: {
            employeeNameEn: { $ifNull: ["$Employee.Name.en.FullName", ""] },
            employeeNameAr: { $ifNull: ["$Employee.Name.ar.FullName", ""] },
            createdByEmployee: {
              en: { $ifNull: ["$CreatedBy.Employee.Name.en.FullName", ""] },
              ar: { $ifNull: ["$CreatedBy.Employee.Name.ar.FullName", ""] },
            },
            pendingEmployeeName: {
              en: { $ifNull: ["$PendingAt.Employee.Name.en.FullName", ""] },
              ar: { $ifNull: ["$PendingAt.Employee.Name.ar.FullName", ""] },
            },
            leaveType: { $ifNull: ["$ModuleData.keyValuePair.Leave Type.en", ""] },
          },
        },
        {
          $project: {
            createdBy: {
              type: "user",
              loginId: "$CreatedBy.LoginId",
              loginName: "$CreatedBy.LoginName",
              isEmployee: "$CreatedBy.IsEmployee",
              employee: "$createdByEmployee",
            },
            recordSource: { $ifNull: ["$RecordSource", null] },
            appService: { $ifNull: ["$AppService", null] },
            isApprovalForEmployee: { $ifNull: ["$IsApprovalForEmployee", null] },
            employeeId: "$Employee.EmployeeId",
            EmployeeName: { en: "$employeeNameEn", ar: "$employeeNameAr" },
            EmployeeCode: "$Employee.EmployeeCode",
            ModuleData: 1,
            formUrl: { $ifNull: ["$FormUrl", ""] },
            processingMode: { $ifNull: ["$ProcessingMode", null] },
            taskApprovalStatus: "$ApprovalStatus",
            totalApprovalStages: { $ifNull: ["$TotalApprovalStages", null] },
            currentApprovalStage: { $ifNull: ["$PendingAt.SerialNo", null] },
            PendingAt: {
              LoginId: "$PendingAt.LoginId",
              LoginName: "$PendingAt.LoginName",
              SerialNo: "$PendingAt.SerialNo",
              IsEmployee: "$PendingAt.IsEmployee",
              EmployeeName: "$pendingEmployeeName",
              EmployeeCode: "$PendingAt.Employee.EmployeeCode",
              AssignedOn: { $ifNull: ["$PendingAt.AssignedOn", null] },
              DueDate: { $ifNull: ["$PendingAt.DueDate", null] },
              IsSendBackTask: { $ifNull: ["$PendingAt.IsSendBackTask", false] },
              IsFinalApprover: { $ifNull: ["$PendingAt.IsFinalApprover", false] },
            },
            leaveType: 1,
          },
        }
      );

      const result = await db
        .collection("TaskApprovals")
        .aggregate(aggregationPipeline)
        .toArray();
      // console.log("result", result);

      return {
        items: result.map((doc: any) => ({
          ...doc,
          SmartSummary: `Your ${doc.leaveType} application has been applied and is currently pending at ${doc.PendingAt.EmployeeName.en || ""} (${doc.PendingAt.EmployeeCode || ""})`,
        })),
        totalCount: result.length,
      };
    },
    // Get Leave Application History
    getLeaveApplicationHistory: async (
      _parent: any,
      args: {
        tenantId: string,
        companyId: string,
        employeeId: string
        employeeCode?: string;
        leaveTypeId?: string;
        approvalStatus?: string;
        skipCount?: number;
        maxResultCount?: number;
      }, context: IQueryContext
    ) => {
      // const args = context.tokenData;

      // Convert token UUIDs to MongoDB Binary
      const tenantId = guidToBinary(args.tenantId);
      const companyId = guidToBinary(args.companyId)
      const employeeId = guidToBinary(args.employeeId);



      await connectDB(LEAVE_DB_NAME);
      const db = getDb(LEAVE_DB_NAME);

      // ------------------ Build match stage ------------------
      const matchStage: any = {
        TenantId: tenantId,
        CompanyId: companyId,
      };
      // Employee filter: ID or Code
      if (args.employeeId) {
        matchStage.EmployeeId = employeeId; // assign token EmployeeId
      } else if (args.employeeCode) {
        matchStage.EmployeeCode = args.employeeCode;
      }



      if (args.leaveTypeId) {
        matchStage.LeaveTypeId = guidToBinary(args.leaveTypeId);
      }

      if (args.approvalStatus) {
        matchStage.ApprovalStatus = args.approvalStatus;
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
            LeaveTypeShortCode: 1,
            EmployeeId: 1,
            EmployeeName: 1,
            EmployeeCode: 1,
            ThumbnailPicture: 1,
            LeavePeriod: 1,
            DurationApplied: 1,
            RejoinConfRequired: 1,
            IsRejoined: 1,
            RejoiningStatus: 1,
            RejoiningDate: 1,
            RejoinedOn: 1,
            LeaveEntitlementType: 1,
            PayType: 1,
            UnitOfLeave: 1,
          },
        },
        { $sort: { AppliedOn: -1 } },
        { $skip: args.skipCount || 0 },
        { $limit: args.maxResultCount || 5 },
      ];

      const result = await db
        .collection("EmployeeLeaveApplications")
        .aggregate(aggregationPipeline)
        .toArray();
      // console.log("Application History Result:", result);
      const mappedItems = result.map((app: any) => ({
        id: binaryToUUID(app._id), // convert Binary/UUID to string
        creationTime: app.AppliedOn?.toISOString() || null,
        employeeLeaveMapId: binaryToUUID(app._id),
        leaveTypeShortCode: app.LeaveTypeShortCode || "N/A",
        employeeLeaveTypeId: binaryToUUID(app._id),
        leaveTypeName: {
          en: app.LeaveTypeName?.en?.Name || "N/A",
          ar: app.LeaveTypeName?.ar?.Name || "N/A",
        },
        employeeId: app.EmployeeId ? binaryToUUID(app.EmployeeId) : null,
        employeePlaceholderId: app.EmployeeId ? binaryToUUID(app.EmployeeId) : null,
        thumbnailPicture: app.ThumbnailPicture || null,
        employeeCode: app.EmployeeCode || null,
        employeeName: {
          en: app.EmployeeName?.en?.FullName || "N/A",
          ar: app.EmployeeName?.ar?.FullName || "N/A",
        },
        leaveEntitlementType: app.LeaveEntitlementType || 0,
        payType: app.PayType || 0,
        unitOfLeave: app.UnitOfLeave || 0,
        leavePeriod:
          app.LeavePeriod?.StartDate && app.LeavePeriod?.EndDate
            ? `${new Date(app.LeavePeriod.StartDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            })} - ${new Date(app.LeavePeriod.EndDate).toLocaleDateString(
              "en-GB",
              { day: "2-digit", month: "short", year: "numeric" }
            )}`
            : null,
        durationApplied: app.DurationApplied || 0,
        rejoinConfRequired: app.RejoinConfRequired || false,
        isRejoined: app.IsRejoined || false,
        rejoiningStatus:
          typeof app.RejoiningStatus === "number" ? app.RejoiningStatus : 0,
        approvalStatus: app.ApprovalStatus || 0,
        appliedOn: app.AppliedOn?.toISOString() || null,
        approvedOn: app.ApprovedOn?.toISOString() || null,
        rejoiningDate: app.RejoiningDate?.toISOString() || null,
        rejoinedOn: app.RejoinedOn?.toISOString() || null,
      }));

      // total count for pagination
      const totalCount = await db
        .collection("EmployeeLeaveApplications")
        .countDocuments(matchStage);

      // return wrapper with leaveApplications
      return {
        items: mappedItems,
        totalCount,
      };
    },
    // Get Leave Resumption Applications
    getLeaveResumptionApplicationsHistory: async (
      _parent: any,
      args: {
        tenantId: string,
        companyId: string,
        employeeId: string
        employeeCode?: string;
        leaveTypeId?: string;
        approvalStatus?: string;
        skipCount?: number;
        maxResultCount?: number;
      }, context: IQueryContext
    ) => {
      // const args = context.tokenData;

      // Convert token UUIDs to MongoDB Binary
      const tenantId = guidToBinary(args.tenantId);
      const companyId = guidToBinary(args.companyId)
      const employeeId = guidToBinary(args.employeeId);



      await connectDB(LEAVE_DB_NAME);
      const db = getDb(LEAVE_DB_NAME);

      // ------------------ Build match stage ------------------
      const matchStage: any = {
        TenantId: tenantId,
        CompanyId: companyId,
      };
      // Employee filter: ID or Code
      if (args.employeeId) {
        matchStage.EmployeeId = employeeId; // assign token EmployeeId
      } else if (args.employeeCode) {
        matchStage.EmployeeCode = args.employeeCode;
      }



      if (args.leaveTypeId) {
        matchStage.LeaveTypeId = guidToBinary(args.leaveTypeId);
      }

      if (args.approvalStatus) {
        matchStage.ApprovalStatus = args.approvalStatus;
      }
      // ------------------ Aggregation Pipeline ------------------
      const aggregationPipeline = [
        { $match: matchStage },
        {
          $project: {
            _id: 1,
            CreationTime: 1,
            EmployeeId: 1,
            EmployeePlaceholderId: 1,
            EmployeeCode: 1,
            EmployeeName: 1,
            ThumbnailPicture: 1,
            LeaveTypeShortCode: 1,
            LeaveTypeName: 1,
            LeaveEntitlementType: 1,
            PayType: 1,
            UnitOfLeave: 1,
            LeavePeriod: 1,
            DurationApproved: 1,
            RejoinConfRequired: 1,
            IsRejoined: 1,
            RejoiningStatus: 1,
            RejoiningDate: 1,
            RejoinedOn: 1,
            ApprovalStatus: 1,
          },
        },
        { $sort: { CreationTime: -1 } },
        { $skip: args.skipCount || 0 },
        { $limit: args.maxResultCount || 5 }, // last 5 resumption applications
      ];

      const result = await db
        .collection("LeaveResumptions")
        .aggregate(aggregationPipeline)
        .toArray();

      // ------------------ Mapping to DTO ------------------
      const mappedItems = result.map((res: any) => ({
        id: res._id?.toString("hex") || null,
        creationTime: res.CreationTime?.toISOString() || null,
        employeeLeaveMapId: res._id?.toString("hex") || null,
        leaveTypeShortCode: res.LeaveTypeShortCode || "N/A",
        employeeLeaveTypeId: res._id?.toString("hex") || null,
        leaveTypeName: {
          en: res.LeaveTypeName?.en?.Name || "N/A",
          ar: res.LeaveTypeName?.ar?.Name || "N/A",
        },
        employeeId: res.EmployeeId?.toString("hex") || null,
        employeePlaceholderId: res.EmployeePlaceholderId?.toString("hex") || null,
        thumbnailPicture: res.ThumbnailPicture || null,
        employeeCode: res.EmployeeCode || "N/A",
        employeeName: {
          en: res.EmployeeName?.en?.FullName || "N/A",
          ar: res.EmployeeName?.ar?.FullName || "N/A",
        },
        leaveEntitlementType: res.LeaveEntitlementType || 0,
        payType: res.PayType || 0,
        unitOfLeave: res.UnitOfLeave || 0,
        leavePeriod:
          res.LeavePeriod?.StartDate && res.LeavePeriod?.EndDate
            ? `${new Date(res.LeavePeriod.StartDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            })} - ${new Date(res.LeavePeriod.EndDate).toLocaleDateString(
              "en-GB",
              { day: "2-digit", month: "short", year: "numeric" }
            )}`
            : null,
        durationApproved: res.DurationApproved || 0,
        rejoinConfRequired: res.RejoinConfRequired || false,
        isRejoined: res.IsRejoined || false,
        rejoiningStatus:
          typeof res.RejoiningStatus === "number" ? res.RejoiningStatus : 0,
        rejoiningDate: res.RejoiningDate?.toISOString()|| null,
        rejoinedOn: res.RejoinedOn?.toISOString()|| null,
        approvalStatus: res.ApprovalStatus ?? 0,
      }));

      // ------------------ Total Count ------------------
      const totalCount = await db
        .collection("LeaveResumptions")
        .countDocuments(matchStage);

      // ------------------ Return Wrapper ------------------
      return {
        items: mappedItems,
        totalCount,
      };
    },
    // Get Encashment Applications
    getEncashmentApplicationsHistory: async (
      _parent: any,
      args: {
        tenantId: string,
        companyId: string,
        employeeId: string
        employeeCode?: string;
        leaveTypeId?: string;
        approvalStatus?: string;
        skipCount?: number;
        maxResultCount?: number;
      }, context: IQueryContext
    ) => {
      // const args = context.tokenData;

      // Convert token UUIDs to MongoDB Binary
      const tenantId = guidToBinary(args.tenantId);
      const companyId = guidToBinary(args.companyId)
      const employeeId = guidToBinary(args.employeeId);



      await connectDB(LEAVE_DB_NAME);
      const db = getDb(LEAVE_DB_NAME);

      // ------------------ Build match stage ------------------
      const matchStage: any = {
        TenantId: tenantId,
        CompanyId: companyId,
      };
      // Employee filter: ID or Code
      if (args.employeeId) {
        matchStage.EmployeeId = employeeId; // assign token EmployeeId
      } else if (args.employeeCode) {
        matchStage.EmployeeCode = args.employeeCode;
      }



      if (args.leaveTypeId) {
        matchStage.LeaveTypeId = guidToBinary(args.leaveTypeId);
      }

      if (args.approvalStatus) {
        matchStage.ApprovalStatus = args.approvalStatus;
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
            EncashmentQuantityApproved: 1,
            AppliedOn: 1,
            ApprovalStatus: 1,
            IsPaid: 1,
            LeaveTypeShortCode: 1,
            EmployeeId: 1,
            EmployeePlaceholderId: 1,
            ThumbnailPicture: 1,
            LeaveEntitlementType: 1,
            PayType: 1,
            UnitOfLeave: 1,
            ApprovedOn: 1,
          },
        },
        { $sort: { AppliedOn: -1 } },
        { $skip: args.skipCount || 0 },
        { $limit: args.maxResultCount || 5 },
      ];

      const result = await db
        .collection("EmployeeLeaveEncashments")
        .aggregate(aggregationPipeline)
        .toArray();
      // console.log("Encashment Applications Result:", result);


      const mappedItems = result.map((encash: any) => ({
        id: encash._id ? binaryToUUID(encash._id) : null,
        CreationTime: encash.AppliedOn?.toISOString() || null,
        employeeLeaveMapId: encash._id ? binaryToUUID(encash._id) : null,
        leaveTypeShortCode: encash.LeaveTypeShortCode || "N/A",
        employeeLeaveTypeId: encash._id ? binaryToUUID(encash._id) : null,
        leaveTypeName: {
          en: encash.LeaveTypeName?.en?.Name || "N/A",
          ar: encash.LeaveTypeName?.ar?.Name || "N/A",
        },
        employeeId: encash.EmployeeId ? binaryToUUID(encash.EmployeeId) : null,
        employeePlaceholderId: encash.EmployeePlaceholderId
          ? binaryToUUID(encash.EmployeePlaceholderId)
          : null,
        thumbnailPicture: encash.ThumbnailPicture || null,
        employeeCode: encash.EmployeeCode || "N/A",
        employeeName: {
          en: encash.EmployeeName?.en?.FullName || "N/A",
          ar: encash.EmployeeName?.ar?.FullName || "N/A",
        },
        leaveEntitlementType: encash.LeaveEntitlementType || 0,
        payType: encash.PayType || 0,
        unitOfLeave: encash.UnitOfLeave || 0,
        applicationDate: encash.AppliedOn?.toISOString() || null,
        encashBalanceAsOn: encash.AppliedOn?.toISOString() || null,
        encashmentQuantityApplied: encash.EncashmentQuantityApplied?.toString() || "0",
        encashmentQuantityApproved: encash.EncashmentQuantityApproved?.toString() || "0",
        isPaid: encash.IsPaid ?? false,
        approvalStatus: encash.ApprovalStatus ?? 0,
        approvedOn: encash.ApprovedOn?.toISOString().split("T")[0] || null,
      }));

      // console.log("Mapped Encashment Items:", mappedItems);
      // total count for pagination
      const totalCount = await db
        .collection("EmployeeLeaveEncashments")
        .countDocuments(matchStage);

      // return wrapper with leaveEncashmentApplications
      return {
        items: mappedItems,
        totalCount,
      };
    },




    // Dashboard API
    // getDashboardData: async (
    //   _parent: any,
    //   args: {
    //     tenantIdBase64: string;
    //     companyIdBase64: string;
    //     employeeIdBase64: string;
    //   }
    // ) => {
    //   try {
    //     const [
    //       todoList,
    //       pendingApplications,
    //       leaveBalance,
    //       applicationHistory,
    //       encashmentApplications,
    //     ] = await Promise.all([
    //       resolvers.Query.getTodoList(_parent, {
    //         companyIdBase64: args.companyIdBase64,
    //         employeeIdBase64: args.employeeIdBase64,
    //       }),
    //       resolvers.Query.getMyPendingApplications(_parent, {
    //         companyIdBase64: args.companyIdBase64,
    //         employeeIdBase64: args.employeeIdBase64,
    //         isPending: true,
    //       }),
    //       resolvers.Query.getLeaveBalance(_parent, {
    //         tenantIdBase64: args.tenantIdBase64,
    //         companyIdBase64: args.companyIdBase64,
    //         employeeIdBase64: args.employeeIdBase64,
    //       }),
    //       resolvers.Query.getApplicationHistory(_parent, {
    //         tenantIdBase64: args.tenantIdBase64,
    //         companyIdBase64: args.companyIdBase64,
    //         employeeIdBase64: args.employeeIdBase64,
    //       }),
    //       resolvers.Query.getEncashmentApplications(_parent, {
    //         tenantIdBase64: args.tenantIdBase64,
    //         companyIdBase64: args.companyIdBase64,
    //         employeeIdBase64: args.employeeIdBase64,
    //       }),
    //     ]);

    //     return {
    //       todoList,
    //       pendingApplications,
    //       leaveBalance,
    //       applicationHistory,
    //       encashmentApplications,
    //     };
    //   } catch (error) {
    //     console.error("Error fetching dashboard data:", error);
    //     throw new Error("Failed to fetch dashboard data");
    //   }
    // },
  },
};
