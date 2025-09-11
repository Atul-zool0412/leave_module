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

      const result = await db
        .collection('EmployeeLeaveMapCollection')
        .aggregate(aggregationPipeline)
        .toArray();

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
            leaveTypeName: elt.LeaveTypeName, // full object
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
