import { z } from "zod";

export interface Organization {
  id: string;
  name: string;
  logoUrl?: string;
  status: string;
  createdAt?: string;
}

export interface User {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Inspector";
  isSuperAdmin?: boolean;
  userStatus?: string;
}

export interface Client {
  id: string;
  organizationId: string;
  parentClientId?: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes?: string;
}

export interface Jobsite {
  id: string;
  organizationId: string;
  clientId: string;
  name: string;
  address: string;
  city: string;
  state?: string;
  bin?: string;
  dobJobNumber?: string;
  projectType: string;
  buildingType?: string;
  stories?: number;
  hasScaffold: boolean;
  hasHoist: boolean;
  hasCrane: boolean;
  hasExcavation: boolean;
  monitorPublicRecords: boolean;
}

export interface CodeReference {
  id: string;
  codeType: "BC" | "AC" | "OSHA";
  chapter?: number;
  sectionNumber: string;
  title: string;
  plainSummary: string;
  tags: string[];
  officialUrl: string;
}

export interface InspectionTemplate {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  category: string;
}

export interface Inspection {
  id: string;
  organizationId: string;
  jobsiteId: string;
  templateId: string;
  date: string;
  inspectorUserId: string;
  status: "Draft" | "Submitted";
  scopeOfWork?: string;
  ccList?: string[];
  recipientName?: string;
  recipientTitle?: string;
  recipientCompany?: string;
  recipientAddress?: string;
}

export interface AiFinding {
  id: string;
  label: string;
  confidence: number;
  suggestedCodeReferenceIds: string[];
}

export interface Observation {
  id: string;
  organizationId: string;
  inspectionId: string;
  jobsiteId: string;
  createdAt: string;
  createdByUserId: string;
  location: string;
  description: string;
  category: string;
  type: "issue" | "positive";
  severity: "Low" | "Medium" | "High";
  status: "Open" | "In progress" | "Corrected" | "Verified";
  correctedOnSite?: boolean;
  assignedTo?: string;
  dueDate?: string;
  photoUrls: string[];
  linkedCodeReferenceIds: string[];
  recommendedActions: string[];
  source: "manual" | "ai";
  aiFindings?: AiFinding[];
}

export interface JobsitePermit {
  id: string;
  jobsiteId: string;
  source: "DOB_NOW" | "BIS" | "NYC_OPEN_DATA";
  permitNumber: string;
  jobFilingNumber?: string;
  workType: string;
  permitType?: string;
  status: "ISSUED" | "EXPIRED" | "REVOKED" | "IN_PROGRESS" | "OTHER";
  issueDate?: string;
  expirationDate?: string;
  description?: string;
  rawLocation?: string;
  externalUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobsiteExternalEvent {
  id: string;
  jobsiteId: string;
  source: "DOB_COMPLAINT" | "DOB_ECB_VIOLATION" | "OTHER";
  eventType: "Complaint" | "Violation";
  externalId: string;
  status: string;
  category?: string;
  description?: string;
  issuedDate?: string;
  lastUpdatedDate?: string;
  rawLocation?: string;
  externalUrl?: string;
  isNew?: boolean;
  createdAt: string;
}

export interface EmployeeProfile {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  phone: string;
  hireDate: string;
  status: "Active" | "Inactive" | "On Leave";
  certifications: string[];
  licenseNumbers: Record<string, string>;
  emergencyContact?: string;
  emergencyPhone?: string;
  hourlyRate?: number;
  notes?: string;
}

export interface ScheduleEntry {
  id: string;
  organizationId: string;
  employeeId: string;
  jobsiteId: string;
  date: string;
  shiftStart?: string;
  shiftEnd?: string;
  status: "Scheduled" | "Confirmed" | "Completed" | "Cancelled";
  notes?: string;
}

export interface Timesheet {
  id: string;
  organizationId: string;
  employeeId: string;
  weekStartDate: string;
  status: "Draft" | "Submitted" | "Approved" | "Rejected";
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  totalHours: number;
  notes?: string;
}

export interface TimesheetEntry {
  id: string;
  timesheetId: string;
  date: string;
  jobsiteId?: string;
  hours: number;
  description?: string;
}

// ─── Safety Rating ──────────────────────────────────────────────────────────

export interface SafetyReport {
  id: string;
  organizationId: string;
  clientId: string;
  periodType: "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;

  // Normalizing inputs
  totalManhours: number;
  totalHeadcount: number;
  projectRiskTier: "Low" | "Medium" | "High";
  newHirePercent: number;

  // Lagging indicators
  recordableIncidents: number;
  dartCases: number;
  lostTimeIncidents: number;
  emr: number;
  oshaWillfulCitations: number;
  oshaSeriousCitations: number;
  oshaOtherCitations: number;
  openWcClaims: number;

  // Leading indicators
  inspectionsCompleted: number;
  inspectionsScheduled: number;
  correctiveActionsClosed: number;
  correctiveActionsOpened: number;
  avgCorrectiveActionDays: number;
  nearMissReports: number;
  toolboxTalksCompleted: number;
  toolboxTalksScheduled: number;
  certifiedWorkforcePercent: number;
  jhaCompliancePercent: number;
  permitCompliancePercent: number;

  // Computed scores (0-100)
  overallScore: number;
  incidentHistoryScore: number;
  trainingComplianceScore: number;
  hazardManagementScore: number;
  permitPreTaskScore: number;
  reportingCultureScore: number;
  letterGrade: "A" | "B" | "C" | "D";

  // Risk summary
  topRiskAreas: string;
  recommendedActions: string;

  // Photo attachments (base64 data URIs)
  photos: string[];

  createdAt: string;
}

export interface SafetyReportSettings {
  organizationId: string;
  incidentHistoryWeight: number;
  trainingComplianceWeight: number;
  hazardManagementWeight: number;
  permitPreTaskWeight: number;
  reportingCultureWeight: number;
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

export const insertClientSchema = z.object({
  parentClientId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  contactName: z.string().min(1, "Contact name is required"),
  contactEmail: z.string().email("Valid email required"),
  contactPhone: z.string().min(1, "Phone is required"),
  notes: z.string().optional(),
});

export const insertJobsiteSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  bin: z.string().optional(),
  dobJobNumber: z.string().optional(),
  projectType: z.string().min(1, "Project type is required"),
  buildingType: z.string().optional(),
  stories: z.number().optional(),
  hasScaffold: z.boolean().default(false),
  hasHoist: z.boolean().default(false),
  hasCrane: z.boolean().default(false),
  hasExcavation: z.boolean().default(false),
  monitorPublicRecords: z.boolean().default(false),
});

export const insertInspectionSchema = z.object({
  jobsiteId: z.string().min(1, "Jobsite is required"),
  templateId: z.string().min(1, "Template is required"),
  date: z.string().min(1, "Date is required"),
});

export const updateInspectionReportSchema = z.object({
  scopeOfWork: z.string().optional(),
  ccList: z.array(z.string()).optional(),
  recipientName: z.string().optional(),
  recipientTitle: z.string().optional(),
  recipientCompany: z.string().optional(),
  recipientAddress: z.string().optional(),
});

export const insertObservationSchema = z.object({
  inspectionId: z.string().min(1),
  jobsiteId: z.string().min(1),
  location: z.string().min(1, "Location is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  type: z.enum(["issue", "positive"]).default("issue"),
  severity: z.enum(["Low", "Medium", "High"]).default("Low"),
  status: z.enum(["Open", "In progress", "Corrected", "Verified"]).default("Open"),
  correctedOnSite: z.boolean().default(false),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  photoUrls: z.array(z.string()).default([]),
  linkedCodeReferenceIds: z.array(z.string()).default([]),
  recommendedActions: z.array(z.string()).default([]),
  source: z.enum(["manual", "ai"]).default("manual"),
  aiFindings: z.array(z.object({
    id: z.string(),
    label: z.string(),
    confidence: z.number(),
    suggestedCodeReferenceIds: z.array(z.string()),
  })).optional(),
});

export const insertEmployeeProfileSchema = z.object({
  userId: z.string().min(1, "User is required"),
  title: z.string().min(1, "Title is required"),
  phone: z.string().min(1, "Phone is required"),
  hireDate: z.string().min(1, "Hire date is required"),
  status: z.enum(["Active", "Inactive", "On Leave"]).default("Active"),
  certifications: z.array(z.string()).default([]),
  licenseNumbers: z.record(z.string(), z.string()).default({}),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  hourlyRate: z.number().optional(),
  notes: z.string().optional(),
});

export const insertScheduleEntrySchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  jobsiteId: z.string().min(1, "Jobsite is required"),
  date: z.string().min(1, "Date is required"),
  shiftStart: z.string().optional(),
  shiftEnd: z.string().optional(),
  status: z.enum(["Scheduled", "Confirmed", "Completed", "Cancelled"]).default("Scheduled"),
  notes: z.string().optional(),
});

export const insertTimesheetSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  weekStartDate: z.string().min(1, "Week start date is required"),
  notes: z.string().optional(),
});

export const insertTimesheetEntrySchema = z.object({
  timesheetId: z.string().min(1, "Timesheet is required"),
  date: z.string().min(1, "Date is required"),
  jobsiteId: z.string().optional(),
  hours: z.number().min(0, "Hours must be non-negative").max(24, "Hours cannot exceed 24"),
  description: z.string().optional(),
});

export const insertSafetyReportSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  periodType: z.enum(["weekly", "monthly"]),
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  totalManhours: z.number().min(0),
  totalHeadcount: z.number().min(0),
  projectRiskTier: z.enum(["Low", "Medium", "High"]),
  newHirePercent: z.number().min(0).max(100),
  recordableIncidents: z.number().min(0),
  dartCases: z.number().min(0),
  lostTimeIncidents: z.number().min(0),
  emr: z.number().min(0),
  oshaWillfulCitations: z.number().min(0),
  oshaSeriousCitations: z.number().min(0),
  oshaOtherCitations: z.number().min(0),
  openWcClaims: z.number().min(0),
  inspectionsCompleted: z.number().min(0),
  inspectionsScheduled: z.number().min(0),
  correctiveActionsClosed: z.number().min(0),
  correctiveActionsOpened: z.number().min(0),
  avgCorrectiveActionDays: z.number().min(0),
  nearMissReports: z.number().min(0),
  toolboxTalksCompleted: z.number().min(0),
  toolboxTalksScheduled: z.number().min(0),
  certifiedWorkforcePercent: z.number().min(0).max(100),
  jhaCompliancePercent: z.number().min(0).max(100),
  permitCompliancePercent: z.number().min(0).max(100),
  topRiskAreas: z.string().default(""),
  recommendedActions: z.string().default(""),
  photos: z.array(z.string()).max(10).default([]),
});

export const updateOrganizationSchema = z.object({
  logoUrl: z.string().nullable().optional(),
});

export const updateSafetySettingsSchema = z.object({
  incidentHistoryWeight: z.number().min(0).max(100),
  trainingComplianceWeight: z.number().min(0).max(100),
  hazardManagementWeight: z.number().min(0).max(100),
  permitPreTaskWeight: z.number().min(0).max(100),
  reportingCultureWeight: z.number().min(0).max(100),
}).refine(
  data =>
    data.incidentHistoryWeight + data.trainingComplianceWeight +
    data.hazardManagementWeight + data.permitPreTaskWeight +
    data.reportingCultureWeight === 100,
  { message: "Scoring weights must sum to exactly 100" }
);

export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertJobsite = z.infer<typeof insertJobsiteSchema>;
export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type UpdateInspectionReport = z.infer<typeof updateInspectionReportSchema>;
export type InsertObservation = z.infer<typeof insertObservationSchema>;
export type InsertEmployeeProfile = z.infer<typeof insertEmployeeProfileSchema>;
export type InsertScheduleEntry = z.infer<typeof insertScheduleEntrySchema>;
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
export type InsertTimesheetEntry = z.infer<typeof insertTimesheetEntrySchema>;
export type InsertSafetyReport = z.infer<typeof insertSafetyReportSchema>;
export type UpdateSafetySettings = z.infer<typeof updateSafetySettingsSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
