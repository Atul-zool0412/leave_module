import { Schema, model } from 'mongoose';

const TaskSchema = new Schema({
    taskId: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, required: true },
    userId: { type: String, required: true },
    companyId: { type: String, required: true }
});

export const Task = model('Task', TaskSchema);
