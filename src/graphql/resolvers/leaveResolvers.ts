import { Leave } from '../../models/Leave';
import { Task } from '../../models/Task';
import { LeaveApplication } from '../../models/LeaveApplication';

export const resolvers = {
    Query: {
        getLeaveBalance: async (_parent: any, args: { employeeId: string }) => {
            const leave = await Leave.findOne({ employeeId: args.employeeId });
            if (!leave) return null;

            return {
                employeeId: leave.employeeId,
                annualLeaveCreditBalance: leave.annualLeaveCreditBalance
            };
        },

        getPendingTasks: async (_parent: any, args: { companyId: string; userId: string }) => {
            const tasks = await Task.find({ companyId: args.companyId, userId: args.userId });
            return tasks.map(task => ({
                taskId: task.taskId,
                description: task.description,
                status: task.status
            }));
        },

        getPendingApplications: async (_parent: any, args: { companyId: string; userId: string }) => {
            const applications = await LeaveApplication.find({
                companyId: args.companyId,
                employeeId: args.userId,
                status: 'Pending'
            });

            return applications.map(app => ({
                applicationId: app.applicationId,
                status: app.status,
                type: app.type,
                appliedDate: app.appliedDate
            }));
        },

        getApplicationHistory: async (_parent: any, args: { companyId: string; employeeId: string }) => {
            const history = await LeaveApplication.find({
                companyId: args.companyId,
                employeeId: args.employeeId
            });

            return history.map(app => ({
                applicationId: app.applicationId,
                status: app.status,
                type: app.type,
                appliedDate: app.appliedDate
            }));
        }
    }
};
