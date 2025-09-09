import { Schema, model } from 'mongoose';

const LeaveSchema = new Schema({
    employeeId: { type: String, required: true },
    annualLeaveCreditBalance: { type: Number, required: true }
});

export const Leave = model('Leave', LeaveSchema);
