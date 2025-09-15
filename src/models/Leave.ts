import mongoose, { Schema } from 'mongoose';

// Sub-schemas
const nameSchema = new Schema({
    Name: { type: String, required: true }
});

const employeeNameSchema = new Schema({
    FirstName: { type: String, required: true },
    LastName: { type: String, required: true },
    FamilyName: { type: String, required: true },
    FullName: { type: String, required: true }
});

const dateRangeSchema = new Schema({
    StartDate: { type: Date, required: true },
    EndDate: { type: Date, required: true }
});

const binaryIdSchema = {
    base64: { type: String, required: true },
    subType: { type: String, required: true }
};

// Leave Type Sub-schemas
const accrualDetailsSchema = new Schema({
    MonthlyAccrual: {
        AccrualOn: { type: Number, required: true },
        Quantity: { type: String, required: true },
        AddedTo: { type: Number, required: true }
    },
    YearlyAccrual: {
        AccrualOn: { type: Number },
        AccrualOnOption: { type: Number },
        Quantity: { type: String },
        AddedTo: { type: Number }
    }
});

const accrualSchema = new Schema({
    Frequency: { type: Number, required: true },
    AccrualDetails: { type: accrualDetailsSchema, required: true }
});

const advanceOptionsSchema = new Schema({
    OpeningBalance: { type: Number, required: true },
    MaximumBalance: { type: Number, required: true }
});

const limitSchema = new Schema({
    IsAllowed: { type: Boolean, required: true },
    Limit: { type: Number, required: true }
});

const grantFrequencyLimitSchema = new Schema({
    Limit: { type: Number, required: true },
    Period: { type: Number, required: true }
});

const fixedLeaveEntitlementSchema = new Schema({
    _id: { type: Schema.Types.Mixed, required: true },
    CreationTime: { type: Date, required: true },
    IsDeleted: { type: Boolean, required: true },
    EntitlementName: {
        en: { type: nameSchema },
        ar: { type: nameSchema }
    },
    EffectiveAfter: { type: Date, required: true },
    IsEncashmentAllowed: { type: Boolean, required: true },
    Accrual: { type: accrualSchema, required: true },
    IsResetAllowed: { type: Boolean, required: true },
    AdvanceOptions: { type: advanceOptionsSchema, required: true }
});

const leaveGrantEntitlementSchema = new Schema({
    _id: { type: Schema.Types.Mixed, required: true },
    CreationTime: { type: Date, required: true },
    IsDeleted: { type: Boolean, required: true },
    EffectiveAfter: { type: Date, required: true },
    IsGrantCreditRequired: { type: Boolean, required: true },
    IsLimitedOnFrequency: { type: Boolean, required: true },
    GrantFrequencyLimit: { type: grantFrequencyLimitSchema, required: true },
    IsResetAllowed: { type: Boolean, required: true }
});

const restrictionsSchema = new Schema({
    _id: { type: Schema.Types.Mixed, required: true },
    CreationTime: { type: Date, required: true },
    IsDeleted: { type: Boolean, required: true },
    CountDayAs: { type: Number, required: true },
    WeekendAfterLeavePeriod: {
        IsCountedAsLeave: { type: Boolean, required: true },
        CountedAfter: { type: Number, required: true }
    },
    HolidaysAfterLeavePeriod: {
        IsCountedAsLeave: { type: Boolean, required: true },
        CountedAfter: { type: Number, required: true }
    },
    HolidayBetweenLeave: {
        IsCountedAsLeave: { type: Boolean, required: true },
        CountedAfter: { type: Number, required: true }
    },
    WeekendBetweenLeave: {
        IsCountedAsLeave: { type: Boolean, required: true },
        CountedAfter: { type: Number, required: true }
    },
    ExceedLeaveBalanceOption: {
        IsAllowed: { type: Boolean, required: true },
        AllowedOption: { type: Number, required: true }
    },
    LeaveDurationsAllowed: {
        IsFullDayAllowed: { type: Boolean, required: true },
        IsHalfDayAllowed: { type: Boolean, required: true },
        IsQuarterDayAllowed: { type: Boolean, required: true },
        IsHourlyAllowed: { type: Boolean, required: true }
    },
    AnnualVacationRuleKSA: {
        AllowAdvancePay: { type: Boolean, required: true },
        MinimumAllowed: { type: limitSchema, required: true },
        MaximumAllowed: { type: limitSchema, required: true },
        IsAirTicketRequestAllowed: { type: Boolean, required: true },
        IsVisaRequestAllowed: { type: Boolean, required: true }
    },
    PastDateRule: {
        IsAllowed: { type: Boolean, required: true },
        Limit: { type: Number, required: true }
    },
    FutureDateRules: {
        IsAllowed: { type: Boolean, required: true },
        Limit: { type: Number, required: true },
        LeadTimeRequired: { type: Number, required: true }
    },
    MinimumLeavePerApplication: {
        IsAllowed: { type: Boolean, required: true },
        Limit: { type: Number, required: true }
    },
    MaximumLeavePerApplication: {
        IsAllowed: { type: Boolean, required: true },
        Limit: { type: Number, required: true }
    },
    MinimumGapBetweenTwoApplication: {
        IsAllowed: { type: Boolean, required: true },
        Limit: { type: Number, required: true }
    },
    MaximumApplicationAllowed: {
        Period: { type: Number, required: true },
        Quantity: { type: Number, required: true }
    },
    IsRestrictedAppliedOn: { type: Boolean, required: true },
    LeaveCanOnlyBeAppliedOn: [{ type: Schema.Types.Mixed }],
    IsRestrictedCannotTakeWith: { type: Boolean, required: true },
    LeaveCannotBeTakenWith: [{ type: Schema.Types.Mixed }],
    IsRejoiningConfirmationRequired: { type: Boolean, required: true },
    UploadFileIfLeaveExceeds: {
        IsAllowed: { type: Boolean, required: true },
        Limit: { type: Number, required: true }
    }
});

const employeeLeaveTypeSchema = new Schema({
    _id: { type: Schema.Types.Mixed, required: true },
    CreationTime: { type: Date, required: true },
    IsDeleted: { type: Boolean, required: true },
    LeaveTypeId: { type: Schema.Types.Mixed, required: true },
    LeaveTypeName: {
        en: { type: nameSchema },
        ar: { type: nameSchema }
    },
    LeaveCode: { type: String, required: true },
    LeaveColor: { type: String, required: true },
    LeaveIcon: { type: String, required: true },
    PayType: { type: Number, required: true },
    LeaveEntitlementType: { type: Number, required: true },
    UnitOfLeave: { type: Number, required: true },
    Description: {
        en: { type: nameSchema },
        ar: { type: nameSchema }
    },
    Validity: { type: dateRangeSchema, required: true },
    ApplicableDateRange: { type: dateRangeSchema, required: true },
    IsActive: { type: Boolean, required: true },
    IsSystemDefault: { type: Boolean, required: true },
    IsCountrySpecific: { type: Boolean, required: true },
    IsCustomized: { type: Boolean, required: true },
    IsAccrualBalanceTracking: { type: Boolean, required: true },
    FixedLeaveEntitlements: [{ type: fixedLeaveEntitlementSchema }],
    LeaveGrantEntitlement: [{ type: leaveGrantEntitlementSchema }],
    Restrictions: { type: restrictionsSchema, required: true }
});

// Main Schema
const employeeSchema = new Schema({
    _id: { type: Schema.Types.Mixed, required: true },
    CreationTime: { type: Date, required: true },
    IsDeleted: { type: Boolean, required: true },
    TenantId: { type: Schema.Types.Mixed, required: true },
    CompanyId: { type: Schema.Types.Mixed, required: true },
    CompanyName: {
        en: { type: nameSchema },
        ar: { type: nameSchema }
    },
    EmployeeId: { type: Schema.Types.Mixed, required: true },
    EmployeeCode: { type: String, required: true },
    EmployeePlaceholderId: { type: Schema.Types.Mixed, required: true },
    EmployeeName: {
        en: { type: employeeNameSchema },
        ar: { type: employeeNameSchema }
    },
    EmployeeStatus: { type: Number, required: true },
    EmploymentType: { type: Number, required: true },
    DateOfJoining: { type: Date, required: true },
    DateOfConfirmation: { type: Date, required: true },
    DateOfBirth: { type: Date, required: true },
    IsActive: { type: Boolean, required: true },
    LastWorkingDate: { type: Date, required: true },
    SeparatedOn: { type: Date, required: true },
    HolidayCalendarId: { type: Schema.Types.Mixed, required: true },
    WorkScheduleId: { type: Schema.Types.Mixed, required: true },
    EmployeeLeaveTypes: [{ type: employeeLeaveTypeSchema }]
}, {
    timestamps: true,
    collection: 'employees'
});

const Employee = mongoose.model('Employee', employeeSchema);

export default Employee;