// src/constants/transactionTypes.ts

export enum TransactionType {
   None = 0,
   Accrual = 1,
   Reset = 2,
   LeaveAttached = 3,
   PolicyStart = 4,
   CarryForwardExpiry = 5,
   LeaveBooked = 6,
   LeaveCancelled = 7,
   LeaveBalanceReset=8,
   LeaveEncashment=9,
   LeaveEncashmentCancelled =10,
}

// Optional: human-readable labels for UI or logs
export const TransactionTypeLabels: Record<TransactionType, string> = {
  [TransactionType.None]: "None",
  [TransactionType.Accrual]: "Accrual",
  [TransactionType.Reset]: "Reset",
  [TransactionType.LeaveAttached]: "Leave Attached",
  [TransactionType.PolicyStart]: "Policy Start",
  [TransactionType.CarryForwardExpiry]: "Carry Forward Expiry",
  [TransactionType.LeaveBooked]: "Leave Booked",
  [TransactionType.LeaveCancelled]: "Leave Cancelled",
  [TransactionType.LeaveBalanceReset]: "Leave Balance Reset",
  [TransactionType.LeaveEncashment]: "Leave Encashment",
  [TransactionType.LeaveEncashmentCancelled]: "Leave Encashment Cancelled",
};
