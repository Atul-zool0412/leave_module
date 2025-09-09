import mongoose from 'mongoose';
import { Leave } from './models/Leave';
import { Task } from './models/Task';
import { LeaveApplication } from './models/LeaveApplication';
import dotenv from 'dotenv';

dotenv.config();

async function seedData() {
    try {
        await mongoose.connect(process.env.MONGO_URI || '');
        console.log('✅ MongoDB Connected');

        // Clear existing data (optional)
        await Leave.deleteMany({});
        await Task.deleteMany({});
        await LeaveApplication.deleteMany({});

        // Insert Leave Balances
        await Leave.insertMany([
            { employeeId: 'EMP123', annualLeaveCreditBalance: 12.5 },
            { employeeId: 'EMP456', annualLeaveCreditBalance: 20.0 },
            { employeeId: 'EMP789', annualLeaveCreditBalance: 5.75 }
        ]);

        // Insert Tasks
        await Task.insertMany([
            { taskId: 'TASK001', description: 'Approve leave request', status: 'Pending', userId: 'EMP123', companyId: 'COMP123' },
            { taskId: 'TASK002', description: 'Review leave application', status: 'In Progress', userId: 'EMP456', companyId: 'COMP123' },
            { taskId: 'TASK003', description: 'Finalize leave balance', status: 'Completed', userId: 'EMP789', companyId: 'COMP123' }
        ]);

        // Insert Leave Applications
        await LeaveApplication.insertMany([
            { applicationId: 'APP001', employeeId: 'EMP123', companyId: 'COMP123', status: 'Pending', type: 'Annual Leave', appliedDate: '2025-09-08' },
            { applicationId: 'APP002', employeeId: 'EMP456', companyId: 'COMP123', status: 'Approved', type: 'Sick Leave', appliedDate: '2025-08-25' },
            { applicationId: 'APP003', employeeId: 'EMP789', companyId: 'COMP123', status: 'Rejected', type: 'Maternity Leave', appliedDate: '2025-07-10' }
        ]);

        console.log('✅ Multiple test data successfully inserted');
    } catch (error) {
        console.error('❌ Error seeding data:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ MongoDB Disconnected');
    }
}

seedData();
