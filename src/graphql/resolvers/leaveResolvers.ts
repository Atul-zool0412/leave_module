import { getDb } from '../../config/db';
import { Binary } from 'mongodb';
import GraphQLJSON from 'graphql-type-json';

export const resolvers = {
    JSON: GraphQLJSON,
    Query: {
   getLeaveBalance: async (
      _parent: any,
      args: {
        tenantIdBase64: string;
        companyIdBase64: string;
        employeeIdBase64: string;
        leaveTypeIdBase64?: string;
      }
    ) => {
      const db = getDb();

      // Step 1: Aggregate EmployeeLeaveMap
      const aggregationPipeline = [
        {
          $match: {
            TenantId: new Binary(Buffer.from(args.tenantIdBase64, 'base64'), 3),
            CompanyId: new Binary(Buffer.from(args.companyIdBase64, 'base64'), 3),
            EmployeeId: new Binary(Buffer.from(args.employeeIdBase64, 'base64'), 3),
          },
        },
        {
          $project: {
            EmployeeId: 1,
            EmployeeLeaveTypes: {
              $cond: {
                if: { $eq: [args.leaveTypeIdBase64 || null, null] }, 
                then: '$EmployeeLeaveTypes',
                else: {
                  $filter: {
                    input: '$EmployeeLeaveTypes',
                    as: 'elt',
                    cond: {
                      $eq: [
                        '$$elt.LeaveTypeId',
                        new Binary(Buffer.from(args.leaveTypeIdBase64!, 'base64'), 3),
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      ];
console.log('Aggregation Pipeline:', JSON.stringify(aggregationPipeline, null, 2));
      const result = await db
        .collection('EmployeeLeaveMapCollection')
        .aggregate(aggregationPipeline)
        .toArray();
      console.log('Leave Balance Result:', result[0].EmployeeLeaveTypes);
      if (result.length === 0) return null;

      const leaveMap = result[0];

      // Step 2: Get all LeaveTypeIds for parallel query
      const leaveTypeIds = leaveMap.EmployeeLeaveTypes.map(
        (lt: any) => lt.LeaveTypeId
      );

      // Step 3: Fetch Leave Balances from EmployeeLeaveLedger
      const leaveBalances = await db
        .collection('EmployeeLeaveLedger')
        .find({
          EmployeeLeaveTypeId: { $in: leaveTypeIds },
        })
        .toArray();

      // Step 4: Merge balances into EmployeeLeaveTypes
      const employeeLeaveTypesWithBalance = leaveMap.EmployeeLeaveTypes.map(
        (elt: any) => {
          const balanceEntry = leaveBalances.find(
            (lb: any) =>
              lb.EmployeeLeaveTypeId.toString() === elt.LeaveTypeId.toString()
          );
          return {
            leaveTypeId: elt.LeaveTypeId.buffer.toString('base64'),
            leaveTypeName: elt.LeaveTypeName,
            payType: elt.PayType,
            unitOfLeave: elt.UnitOfLeave,
            entitlementType: elt.LeaveEntitlementType,
            validity: elt.Validity,
            isActive: elt.IsActive,
            currentBalance: balanceEntry ? balanceEntry.Balance : 0, // Add balance
          };
        }
      );

      return {
        employeeId: leaveMap.EmployeeId.buffer.toString('base64'),
        employeeLeaveTypes: employeeLeaveTypesWithBalance,
      };
    },


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
      const db = getDb();

      const matchStage: any = {
        TenantId: new Binary(Buffer.from(args.tenantIdBase64, 'base64'), 3),
        CompanyId: new Binary(Buffer.from(args.companyIdBase64, 'base64'), 3),
        // IsDeleted: false,
      };

      if (args.employeeIdBase64) {
        matchStage.EmployeeId = new Binary(Buffer.from(args.employeeIdBase64, 'base64'), 3);
      }

      if (args.filter) {
        matchStage['$or'] = [
          { 'EmployeeName.en.FullName': { $regex: `.*${args.filter}.*`, $options: 'i' } },
          { EmployeeCode: { $regex: `^${args.filter}$`, $options: 'i' } }
        ];
      }

      if (args.leaveTypeIdBase64) {
        matchStage.LeaveTypeId = new Binary(Buffer.from(args.leaveTypeIdBase64, 'base64'), 3);
      }

      if (args.employeeLeaveTypeIdBase64) {
        matchStage.EmployeeLeaveTypeId = new Binary(Buffer.from(args.employeeLeaveTypeIdBase64, 'base64'), 3);
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
            id => new Binary(Buffer.from(id, 'base64'), 3)
          )
        };
      }

      if (args.startDate && args.endDate) {
        matchStage['LeavePeriod.StartDate'] = { $gte: new Date(args.startDate) };
        matchStage['LeavePeriod.EndDate'] = { $lt: new Date(args.endDate) };
      }

      if (args.applicationDate) {
        const start = new Date(args.applicationDate);
        const end = new Date(args.applicationDate);
        end.setDate(end.getDate() + 1);
        matchStage.AppliedOn = { $gte: start, $lt: end };
      }

      console.log('Match Stage:', matchStage);

      const aggregationPipeline = [
        { $match: matchStage },
        {
          $project: {
            _id: 1,
            ApprovalStatus: 1,
            LeaveTypeName: 1,
            AppliedOn: 1,
            ApprovedOn: 1,
          }
        },
        { $sort: { AppliedOn: -1 } }, // Sorting by application date descending
        { $skip: args.skipCount || 0 },
        { $limit: args.maxResultCount || 10 }
      ]; 
      
      console.log('Aggregation Pipeline:', JSON.stringify(aggregationPipeline, null, 2));
      const result = await db
        .collection('EmployeeLeaveApplications')
        .aggregate(aggregationPipeline)
        .toArray();

      console.log('Application History Result:', result);

      return result.map((app: any) => ({
        applicationId: app._id.toString('base64'),
        status: app.ApprovalStatus.toString(),
        leaveTypeName: app.LeaveTypeName?.en?.Name || 'N/A',
        appliedOn: app.AppliedOn.toISOString(),
        approvedOn: app.ApprovedOn ? app.ApprovedOn.toISOString() : null
      }));
    },

        // getPendingTasks: async (_parent: any, args: { companyId: string; userId: string }) => {
        //   const db = getDb();

        //   const tasks = await db.collection('Tasks').find({
        //     companyId: args.companyId,
        //     userId: args.userId
        //   }).toArray();

        //   return tasks.map(task => ({
        //     taskId: task.taskId,
        //     description: task.description,
        //     status: task.status
        //   }));
        // },

        // getPendingApplications: async (_parent: any, args: { companyId: string; userId: string }) => {
        //   const db = getDb();

        //   const applications = await db.collection('LeaveApplications').find({
        //     companyId: args.companyId,
        //     employeeId: args.userId,
        //     status: 'Pending'
        //   }).toArray();

        //   return applications.map(app => ({
        //     applicationId: app.applicationId,
        //     status: app.status,
        //     type: app.type,
        //     appliedDate: app.appliedDate
        //   }));
        // },

        // getApplicationHistory: async (_parent: any, args: { companyId: string; employeeId: string }) => {
        //   const db = getDb();

        //   const history = await db.collection('LeaveApplications').find({
        //     companyId: args.companyId,
        //     employeeId: args.employeeId
        //   }).toArray();

        //   return history.map(app => ({
        //     applicationId: app.applicationId,
        //     status: app.status,
        //     type: app.type,
        //     appliedDate: app.appliedDate
        //   }));
        // }
    }

};
