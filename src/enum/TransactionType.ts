// src/constants/transactionTypes.ts

export enum TransactionType {
  NotApplicable = 0,
  Accrual = 1,             // Credited
  CreditedReset = 2,
  LeaveAttached = 3,
  PolicyStart = 4,
  CarryForwardExpiry = 5,
  LeaveBooked = 6,
  LeaveCancelled = 7,
  LeaveBalanceReset = 8,
}

// Optional: human-readable labels for UI or logs
export const TransactionTypeLabels: Record<TransactionType, string> = {
  [TransactionType.NotApplicable]: "Not Applicable",
  [TransactionType.Accrual]: "Accrual",
  [TransactionType.CreditedReset]: "Credited Reset",
  [TransactionType.LeaveAttached]: "Leave Attached",
  [TransactionType.PolicyStart]: "Policy Start",
  [TransactionType.CarryForwardExpiry]: "Carry Forward Expiry",
  [TransactionType.LeaveBooked]: "Leave Booked",
  [TransactionType.LeaveCancelled]: "Leave Cancelled",
  [TransactionType.LeaveBalanceReset]: "Leave Balance Reset",
};
