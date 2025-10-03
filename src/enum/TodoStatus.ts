export enum TodoStatus {
  Pending = 1,              // New / Pending
  InitiatedTaskCreation = 2,
  AutoApproved = 3,
  InProgress = 1||4,           // This will be used to fetch My Pending Task
  Approved = 5,
  Rejected = 6,
  Cancelled = 7,
  Withdrawn = 8,
}

