import { z } from "zod";

export interface Organization {
  id: string;
  name: string;
  logoUrl?: string;
}

export interface User {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Inspector";
}

export interface Client {
  id: string;
  organizationId: string;
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
  borough: string;
  bin: string;
  dobJobNumber: string;
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
  codeType: "BC" | "AC";
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
  severity: "Low" | "Medium" | "High";
  status: "Open" | "In progress" | "Corrected" | "Verified";
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

export const insertClientSchema = z.object({
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
  borough: z.string().min(1, "Borough is required"),
  bin: z.string().min(1, "BIN is required"),
  dobJobNumber: z.string().min(1, "DOB job number is required"),
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

export const insertObservationSchema = z.object({
  inspectionId: z.string().min(1),
  jobsiteId: z.string().min(1),
  location: z.string().min(1, "Location is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  severity: z.enum(["Low", "Medium", "High"]),
  status: z.enum(["Open", "In progress", "Corrected", "Verified"]).default("Open"),
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

export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertJobsite = z.infer<typeof insertJobsiteSchema>;
export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type InsertObservation = z.infer<typeof insertObservationSchema>;
export type InsertEmployeeProfile = z.infer<typeof insertEmployeeProfileSchema>;
export type InsertScheduleEntry = z.infer<typeof insertScheduleEntrySchema>;
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
export type InsertTimesheetEntry = z.infer<typeof insertTimesheetEntrySchema>;
