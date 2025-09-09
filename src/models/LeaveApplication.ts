import { Schema, model } from 'mongoose';

const LeaveApplicationSchema = new Schema({
    applicationId: { type: String, required: true },
    employeeId: { type: String, required: true },
    companyId: { type: String, required: true },
    status: { type: String, required: true },
    type: { type: String, required: true },
    appliedDate: { type: String, required: true }
});

export const LeaveApplication = model('LeaveApplication', LeaveApplicationSchema);
