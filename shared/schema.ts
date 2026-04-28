import { z } from "zod";

export interface Organization {
  id: string;
  name: string;
  logoUrl?: string;
  status: string;
  orgType: "ssm_firm" | "subcontractor" | "general_contractor";
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
  primaryInspectorId?: string;
}

export interface IndependentContractor {
  id: string;
  organizationId: string;
  name: string;
  email?: string;
  phone?: string;
  licenseType: string;
  licenseNumber?: string;
  certifications: string[];
  plCarrier?: string;
  plPolicyNumber?: string;
  plExpiryDate?: string;
  glCarrier?: string;
  glPolicyNumber?: string;
  glExpiryDate?: string;
  status: "active" | "inactive";
  notes?: string;
}

export interface ContractorJobsiteAssignment {
  id: string;
  contractorId: string;
  jobsiteId: string;
  startDate?: string;
  endDate?: string;
  role?: string;
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

export interface TradeCompany {
  id: string;
  organizationId: string;
  name: string;
  tradeType: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  licenseNumber?: string;
  coiCarrier?: string;
  coiPolicyNumber?: string;
  coiExpiryDate?: string;
  wcCarrier?: string;
  wcPolicyNumber?: string;
  wcExpiryDate?: string;
  status: "active" | "inactive";
  notes?: string;
}

export interface JobsiteTradeAssignment {
  id: string;
  jobsiteId: string;
  tradeCompanyId: string;
  clientId?: string;
  scopeOfWork?: string;
  startDate?: string;
  endDate?: string;
}

export const TRADE_TYPES = [
  "Concrete", "Demolition", "Electrical", "Elevator", "Excavation",
  "Fire Protection", "HVAC", "Masonry", "Mechanical", "Plumbing",
  "Roofing", "Scaffold", "Steel / Structural", "Waterproofing", "Other",
] as const;

export type TradeType = typeof TRADE_TYPES[number];

export interface TradeAssignmentWithDetails {
  assignment: JobsiteTradeAssignment;
  company: TradeCompany;
}

export const insertTradeCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  tradeType: z.enum(TRADE_TYPES),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Valid email required").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  licenseNumber: z.string().optional(),
  coiCarrier: z.string().optional(),
  coiPolicyNumber: z.string().optional(),
  coiExpiryDate: z.string().optional(),
  wcCarrier: z.string().optional(),
  wcPolicyNumber: z.string().optional(),
  wcExpiryDate: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  notes: z.string().optional(),
});

export const insertJobsiteTradeAssignmentSchema = z.object({
  tradeCompanyId: z.string().min(1, "Trade company is required"),
  clientId: z.string().optional(),
  scopeOfWork: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const insertIndependentContractorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
  phone: z.string().optional(),
  licenseType: z.string().min(1, "License type is required"),
  licenseNumber: z.string().optional(),
  certifications: z.array(z.string()).default([]),
  plCarrier: z.string().optional(),
  plPolicyNumber: z.string().optional(),
  plExpiryDate: z.string().optional(),
  glCarrier: z.string().optional(),
  glPolicyNumber: z.string().optional(),
  glExpiryDate: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  notes: z.string().optional(),
});

export const insertContractorAssignmentSchema = z.object({
  jobsiteId: z.string().min(1, "Jobsite is required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  role: z.string().optional(),
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

// ─── Contacts ─────────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  organizationId: string;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
}

export interface ContactAssociation {
  id: string;
  contactId: string;
  entityType: string;
  entityId: string;
  relationship?: string | null;
}

export interface ContactAssociationEnriched extends ContactAssociation {
  entityName?: string | null;
}

export interface ContactWithAssociations extends Contact {
  associations: ContactAssociationEnriched[];
}

export const ENTITY_TYPES = ["jobsite", "client", "trade_company", "contractor"] as const;
export type EntityType = typeof ENTITY_TYPES[number];

export const insertContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  title: z.string().optional(),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
});

export const insertContactAssociationSchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().min(1),
  relationship: z.string().optional(),
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type InsertContactAssociation = z.infer<typeof insertContactAssociationSchema>;

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
export type InsertIndependentContractor = z.infer<typeof insertIndependentContractorSchema>;
export type InsertContractorAssignment = z.infer<typeof insertContractorAssignmentSchema>;
export type InsertTradeCompany = z.infer<typeof insertTradeCompanySchema>;
export type InsertJobsiteTradeAssignment = z.infer<typeof insertJobsiteTradeAssignmentSchema>;

// ─── Phase 7A: Contractor Company Registry ───────────────────────────────────

export const ORG_TYPES = [
  "ssm_firm",
  "subcontractor",
  "general_contractor",
] as const;
export type OrgType = typeof ORG_TYPES[number];

export interface ContractorCompany {
  id: string;
  name: string;
  tradeType?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  licenseNumber?: string;
  insuranceCarrier?: string;
  insuranceExpiry?: string;
  notes?: string;
  status: "active" | "inactive";
  linkedOrganizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export const insertContractorCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  tradeType: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Valid email required").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  licenseNumber: z.string().optional(),
  insuranceCarrier: z.string().optional(),
  insuranceExpiry: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const updateContractorCompanySchema = z.object({
  name: z.string().min(1).optional(),
  tradeType: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  licenseNumber: z.string().optional(),
  insuranceCarrier: z.string().optional(),
  insuranceExpiry: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export type InsertContractorCompany = z.infer<typeof insertContractorCompanySchema>;
export type UpdateContractorCompany = z.infer<typeof updateContractorCompanySchema>;

// ─── Phase 7B: Worker Certifications ─────────────────────────────────────────

export const CERT_TYPES = [
  "sst_card",
  "osha_10",
  "osha_30",
  "osha_500",
  "osha_510",
  "ssm_license",
  "ssic_card",
  "chapter_33_8hr",
  "first_aid_cpr",
  "scaffold_user",
  "scaffold_supervisor",
  "confined_space",
  "fall_protection",
  "rigging",
  "crane_operator",
  "forklift",
  "asbestos_handler",
  "lead_handler",
  "other",
] as const;
export type CertType = typeof CERT_TYPES[number];

export const CERT_EXPIRY_STATUSES = [
  "expired",
  "expiring_soon",
  "valid",
  "no_expiry",
] as const;

export interface WorkerCertification {
  id: string;
  organizationId: string;
  userId: string;
  certType: string;
  certNumber?: string;
  issuingBody?: string;
  issueDate: string;
  expiryDate?: string;
  documentUrl?: string;
  notes?: string;
  createdAt: string;
  status?: string;
}

export const insertWorkerCertificationSchema = z.object({
  userId: z.string().min(1, "User is required"),
  certType: z.enum(CERT_TYPES),
  certNumber: z.string().optional(),
  issuingBody: z.string().optional(),
  issueDate: z.string().min(1, "Issue date is required"),
  expiryDate: z.string().optional(),
  documentUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const updateWorkerCertificationSchema = insertWorkerCertificationSchema.partial();

export type InsertWorkerCertification = z.infer<typeof insertWorkerCertificationSchema>;
export type UpdateWorkerCertification = z.infer<typeof updateWorkerCertificationSchema>;

// ─── Phase 7B: Certificates of Insurance ─────────────────────────────────────

export const COI_COVERAGE_TYPES = [
  "gl",
  "workers_comp",
  "umbrella",
  "professional",
  "other",
] as const;
export type CoiCoverageType = typeof COI_COVERAGE_TYPES[number];

export interface CertificateOfInsurance {
  id: string;
  organizationId: string;
  companyName: string;
  tradeCompanyId?: string;
  linkedOrganizationId?: string;
  coverageType: string;
  insurer?: string;
  policyNumber?: string;
  coverageLimit?: string;
  effectiveDate?: string;
  expiryDate?: string;
  documentUrl?: string;
  notes?: string;
  createdAt: string;
  status?: string;
}

export const insertCertificateOfInsuranceSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  tradeCompanyId: z.string().optional(),
  linkedOrganizationId: z.string().optional(),
  coverageType: z.enum(COI_COVERAGE_TYPES),
  insurer: z.string().optional(),
  policyNumber: z.string().optional(),
  coverageLimit: z.string().optional(),
  effectiveDate: z.string().optional(),
  expiryDate: z.string().optional(),
  documentUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const updateCertificateOfInsuranceSchema = insertCertificateOfInsuranceSchema.partial();

export type InsertCertificateOfInsurance = z.infer<typeof insertCertificateOfInsuranceSchema>;
export type UpdateCertificateOfInsurance = z.infer<typeof updateCertificateOfInsuranceSchema>;

// ─── Phase 7C: OSHA Incidents ────────────────────────────────────────────────

export const OSHA_CASE_TYPES = [
  "death",
  "days_away",
  "restricted_transfer",
  "other_recordable",
] as const;
export type OshaCaseType = typeof OSHA_CASE_TYPES[number];

export interface OshaIncident {
  id: string;
  organizationId: string;
  jobsiteId?: string;
  incidentDate: string;
  employeeName: string;
  jobTitle?: string;
  department?: string;
  incidentDescription: string;
  bodyPart?: string;
  injuryType?: string;
  caseType: string;
  daysAway?: string;
  daysRestricted?: string;
  isPrivacyCase: string;
  reportedBy?: string;
  witnessNames?: string;
  rootCause?: string;
  correctiveActions?: string;
  recordableCase: string;
  createdAt: string;
}

export const insertOshaIncidentSchema = z.object({
  jobsiteId: z.string().optional(),
  incidentDate: z.string().min(1, "Incident date is required"),
  employeeName: z.string().min(1, "Employee name is required"),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  incidentDescription: z.string().min(1, "Incident description is required"),
  bodyPart: z.string().optional(),
  injuryType: z.string().optional(),
  caseType: z.enum(OSHA_CASE_TYPES),
  daysAway: z.string().optional(),
  daysRestricted: z.string().optional(),
  isPrivacyCase: z.string().optional().default("false"),
  reportedBy: z.string().optional(),
  witnessNames: z.string().optional(),
  rootCause: z.string().optional(),
  correctiveActions: z.string().optional(),
  recordableCase: z.string().optional().default("true"),
});

export const updateOshaIncidentSchema = insertOshaIncidentSchema.partial();

export type InsertOshaIncident = z.infer<typeof insertOshaIncidentSchema>;
export type UpdateOshaIncident = z.infer<typeof updateOshaIncidentSchema>;

// ─── Phase 7C: Work Hours Log ────────────────────────────────────────────────

export interface WorkHoursLog {
  id: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  hoursWorked: string;
  employeeCount?: string;
  notes?: string;
  createdAt: string;
}

export const insertWorkHoursLogSchema = z.object({
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  hoursWorked: z.string().min(1, "Hours worked is required"),
  employeeCount: z.string().optional(),
  notes: z.string().optional(),
});

export const updateWorkHoursLogSchema = insertWorkHoursLogSchema.partial();

export type InsertWorkHoursLog = z.infer<typeof insertWorkHoursLogSchema>;
export type UpdateWorkHoursLog = z.infer<typeof updateWorkHoursLogSchema>;

// ─── Phase 7C: TRIR Result ───────────────────────────────────────────────────

export interface TrirResult {
  trir: number;
  recordableCases: number;
  totalHours: number;
  periodStart: string;
  periodEnd: string;
}

// ─── Phase 7D: Drivers ───────────────────────────────────────────────────────

export const DRIVER_STATUSES = ["active", "inactive"] as const;
export type DriverStatus = typeof DRIVER_STATUSES[number];

export interface Driver {
  id: string;
  organizationId: string;
  userId?: string;
  name: string;
  licenseNumber?: string;
  phone?: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export const insertDriverSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  licenseNumber: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(DRIVER_STATUSES).optional().default("active"),
  notes: z.string().optional(),
});

export const updateDriverSchema = insertDriverSchema.partial();

export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type UpdateDriver = z.infer<typeof updateDriverSchema>;

// ─── Phase 7D: Delivery Requests ─────────────────────────────────────────────

export const DELIVERY_STATUSES = [
  "requested",
  "approved",
  "dispatched",
  "in_transit",
  "arrived",
  "departed",
] as const;
export type DeliveryStatus = typeof DELIVERY_STATUSES[number];

export interface DeliveryRequest {
  id: string;
  organizationId: string;
  jobsiteId?: string;
  requestedBy?: string;
  approvedBy?: string;
  driverId?: string;
  description: string;
  status: string;
  scheduledDate?: string;
  notes?: string;
  createdAt: string;
}

export const insertDeliveryRequestSchema = z.object({
  jobsiteId: z.string().optional(),
  requestedBy: z.string().optional(),
  approvedBy: z.string().optional(),
  driverId: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  status: z.enum(DELIVERY_STATUSES).optional(),
  scheduledDate: z.string().optional(),
  notes: z.string().optional(),
});

export const updateDeliveryRequestSchema = insertDeliveryRequestSchema.partial();

export const updateDeliveryStatusSchema = z.object({
  status: z.enum(DELIVERY_STATUSES),
});

export type InsertDeliveryRequest = z.infer<typeof insertDeliveryRequestSchema>;
export type UpdateDeliveryRequest = z.infer<typeof updateDeliveryRequestSchema>;
export type UpdateDeliveryStatus = z.infer<typeof updateDeliveryStatusSchema>;

// ─── Phase 7D: Delivery NFC Events ───────────────────────────────────────────

export const NFC_EVENT_TYPES = ["dispatched", "arrived", "departed"] as const;
export type NfcEventType = typeof NFC_EVENT_TYPES[number];

export interface DeliveryNfcEvent {
  id: string;
  organizationId: string;
  deliveryRequestId: string;
  eventType: string;
  scannedBy?: string;
  jobsiteId?: string;
  notes?: string;
  createdAt: string;
}

export const insertDeliveryNfcEventSchema = z.object({
  deliveryRequestId: z.string().min(1, "Delivery request is required"),
  eventType: z.enum(NFC_EVENT_TYPES),
  scannedBy: z.string().optional(),
  jobsiteId: z.string().optional(),
  notes: z.string().optional(),
});

export type InsertDeliveryNfcEvent = z.infer<typeof insertDeliveryNfcEventSchema>;

// ─── Phase 7E: Inventory Items ───────────────────────────────────────────────

export const INVENTORY_CONDITIONS = [
  "new",
  "good",
  "fair",
  "poor",
  "out_of_service",
] as const;
export type InventoryCondition = typeof INVENTORY_CONDITIONS[number];

export const INVENTORY_CATEGORIES = [
  "power_tool",
  "hand_tool",
  "ppe",
  "equipment",
  "other",
] as const;
export type InventoryCategory = typeof INVENTORY_CATEGORIES[number];

export interface InventoryItem {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  category?: string;
  serialNumber?: string;
  assetTag?: string;
  nfcTagId?: string;
  condition: string;
  currentJobsiteId?: string;
  assignedTo?: string;
  purchaseDate?: string;
  purchasePrice?: string;
  notes?: string;
  createdAt: string;
}

export const insertInventoryItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.enum(INVENTORY_CATEGORIES).optional(),
  serialNumber: z.string().optional(),
  assetTag: z.string().optional(),
  nfcTagId: z.string().optional(),
  condition: z.enum(INVENTORY_CONDITIONS).optional().default("good"),
  currentJobsiteId: z.string().optional(),
  assignedTo: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.string().optional(),
  notes: z.string().optional(),
});

export const updateInventoryItemSchema = insertInventoryItemSchema.partial();

export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type UpdateInventoryItem = z.infer<typeof updateInventoryItemSchema>;

// ─── Phase 7E: Inventory Checkouts ───────────────────────────────────────────

export interface InventoryCheckout {
  id: string;
  organizationId: string;
  inventoryItemId: string;
  checkedOutBy?: string;
  jobsiteId?: string;
  checkedOutAt: string;
  expectedReturnDate?: string;
  returnedAt?: string;
  returnCondition?: string;
  returnNotes?: string;
  createdAt: string;
}

export const insertInventoryCheckoutSchema = z.object({
  inventoryItemId: z.string().min(1, "Inventory item is required"),
  checkedOutBy: z.string().optional(),
  jobsiteId: z.string().optional(),
  expectedReturnDate: z.string().optional(),
});

export const closeInventoryCheckoutSchema = z.object({
  returnedAt: z.string().optional(),
  returnCondition: z.enum(INVENTORY_CONDITIONS).optional(),
  returnNotes: z.string().optional(),
});

export type InsertInventoryCheckout = z.infer<typeof insertInventoryCheckoutSchema>;
export type CloseInventoryCheckout = z.infer<typeof closeInventoryCheckoutSchema>;

// ─── Phase 7E: Inventory Condition Reports ───────────────────────────────────

export interface InventoryConditionReport {
  id: string;
  organizationId: string;
  inventoryItemId: string;
  checkoutId?: string;
  reportedBy?: string;
  condition: string;
  notes?: string;
  photoUrls?: string;
  createdAt: string;
}

export const insertInventoryConditionReportSchema = z.object({
  inventoryItemId: z.string().min(1, "Inventory item is required"),
  checkoutId: z.string().optional(),
  reportedBy: z.string().optional(),
  condition: z.enum(INVENTORY_CONDITIONS),
  notes: z.string().optional(),
  photoUrls: z.string().optional(),
});

export type InsertInventoryConditionReport = z.infer<typeof insertInventoryConditionReportSchema>;

// ─── Phase 7E: Inventory Service Tickets ─────────────────────────────────────

export const SERVICE_TICKET_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "closed",
] as const;
export type ServiceTicketStatus = typeof SERVICE_TICKET_STATUSES[number];

export interface InventoryServiceTicket {
  id: string;
  organizationId: string;
  inventoryItemId: string;
  reportedBy?: string;
  issueDescription: string;
  status: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: string;
}

export const insertInventoryServiceTicketSchema = z.object({
  inventoryItemId: z.string().min(1, "Inventory item is required"),
  reportedBy: z.string().optional(),
  issueDescription: z.string().min(1, "Issue description is required"),
  status: z.enum(SERVICE_TICKET_STATUSES).optional().default("open"),
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
  resolutionNotes: z.string().optional(),
});

export const updateInventoryServiceTicketSchema = insertInventoryServiceTicketSchema.partial();

export type InsertInventoryServiceTicket = z.infer<typeof insertInventoryServiceTicketSchema>;
export type UpdateInventoryServiceTicket = z.infer<typeof updateInventoryServiceTicketSchema>;

// ─── Phase 7F: Portfolio Shares & Snapshot ───────────────────────────────────

export const PORTFOLIO_SECTIONS = ["trir", "workerCerts", "coi", "jobsites", "oshaIncidents", "inventory"] as const;
export type PortfolioSection = typeof PORTFOLIO_SECTIONS[number];
export type VisibleSections = Record<PortfolioSection, boolean>;

export interface PortfolioShare {
  id: string;
  organizationId: string;
  token: string;
  expiresAt: string;
  revokedAt?: string;
  visibleSections: VisibleSections;
  createdBy?: string;
  createdAt: string;
}

export const insertPortfolioShareSchema = z.object({
  expiresAt: z.string().min(1, "Expiry date is required"),
  visibleSections: z.record(z.enum(PORTFOLIO_SECTIONS), z.boolean()).optional().default({}),
  createdBy: z.string().optional(),
});

export type InsertPortfolioShare = z.infer<typeof insertPortfolioShareSchema>;

export interface PortfolioSnapshot {
  org: { id: string; name: string; orgType: string; logoUrl?: string };
  generatedAt: string;
  visibleSections: VisibleSections;
  trir?: { trir: number; recordableCases: number; totalHours: number; periodStart: string; periodEnd: string };
  workerCerts?: { total: number; valid: number; expiringSoon: number; expired: number; noExpiry: number };
  coi?: Array<{ id: string; companyName: string; coverageType: string; insurer?: string; expiryDate?: string; status: string }>;
  jobsites?: Array<{ id: string; name: string; address?: string; status: string }>;
  oshaIncidents?: Array<{ id: string; incidentDate: string; caseType: string; recordableCase: string }>;
  inventory?: { total: number; checkedOut: number; outOfService: number };
}

// ─── Phase 8: Notifications ──────────────────────────────────────────────────

export const NOTIFICATION_TYPES = [
  "cert_expiring",
  "coi_expiring",
  "osha_incident_filed",
  "delivery_status_changed",
  "inventory_overdue",
] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export interface Notification {
  id: string;
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export const insertNotificationSchema = z.object({
  organizationId: z.string().min(1, "Organization is required"),
  userId: z.string().min(1, "User is required"),
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
  entityType: z.string().optional().nullable(),
  entityId: z.string().optional().nullable(),
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
