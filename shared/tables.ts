import {
  pgTable, text, integer, boolean, real, json
} from "drizzle-orm/pg-core";
import type { AiFinding } from "./schema";

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at"),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  passwordHash: text("password_hash"),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  userStatus: text("user_status").notNull().default("active"),
});

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  parentClientId: text("parent_client_id"),
  name: text("name").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone").notNull(),
  notes: text("notes"),
});

export const jobsites = pgTable("jobsites", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  clientId: text("client_id").notNull().references(() => clients.id),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state"),
  bin: text("bin"),
  dobJobNumber: text("dob_job_number"),
  projectType: text("project_type").notNull(),
  buildingType: text("building_type"),
  stories: integer("stories"),
  hasScaffold: boolean("has_scaffold").notNull().default(false),
  hasHoist: boolean("has_hoist").notNull().default(false),
  hasCrane: boolean("has_crane").notNull().default(false),
  hasExcavation: boolean("has_excavation").notNull().default(false),
  monitorPublicRecords: boolean("monitor_public_records").notNull().default(false),
  primaryInspectorId: text("primary_inspector_id"),
});

export const codeReferences = pgTable("code_references", {
  id: text("id").primaryKey(),
  codeType: text("code_type").notNull(),
  chapter: integer("chapter"),
  sectionNumber: text("section_number").notNull(),
  title: text("title").notNull(),
  plainSummary: text("plain_summary").notNull(),
  tags: json("tags").notNull().$type<string[]>(),
  officialUrl: text("official_url").notNull(),
});

export const inspectionTemplates = pgTable("inspection_templates", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
});

export const inspections = pgTable("inspections", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  jobsiteId: text("jobsite_id").notNull().references(() => jobsites.id),
  templateId: text("template_id").notNull().references(() => inspectionTemplates.id),
  date: text("date").notNull(),
  inspectorUserId: text("inspector_user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("Draft"),
  scopeOfWork: text("scope_of_work"),
  ccList: json("cc_list").$type<string[]>(),
  recipientName: text("recipient_name"),
  recipientTitle: text("recipient_title"),
  recipientCompany: text("recipient_company"),
  recipientAddress: text("recipient_address"),
});

export const observations = pgTable("observations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  inspectionId: text("inspection_id").notNull().references(() => inspections.id),
  jobsiteId: text("jobsite_id").notNull().references(() => jobsites.id),
  createdAt: text("created_at").notNull(),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  location: text("location").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  correctedOnSite: boolean("corrected_on_site").default(false),
  assignedTo: text("assigned_to"),
  dueDate: text("due_date"),
  photoUrls: json("photo_urls").notNull().$type<string[]>(),
  linkedCodeReferenceIds: json("linked_code_reference_ids").notNull().$type<string[]>(),
  recommendedActions: json("recommended_actions").notNull().$type<string[]>(),
  source: text("source").notNull(),
  aiFindings: json("ai_findings").$type<AiFinding[]>(),
});

export const jobsitePermits = pgTable("jobsite_permits", {
  id: text("id").primaryKey(),
  jobsiteId: text("jobsite_id").notNull().references(() => jobsites.id),
  source: text("source").notNull(),
  permitNumber: text("permit_number").notNull(),
  jobFilingNumber: text("job_filing_number"),
  workType: text("work_type").notNull(),
  permitType: text("permit_type"),
  status: text("status").notNull(),
  issueDate: text("issue_date"),
  expirationDate: text("expiration_date"),
  description: text("description"),
  rawLocation: text("raw_location"),
  externalUrl: text("external_url"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const jobsiteExternalEvents = pgTable("jobsite_external_events", {
  id: text("id").primaryKey(),
  jobsiteId: text("jobsite_id").notNull().references(() => jobsites.id),
  source: text("source").notNull(),
  eventType: text("event_type").notNull(),
  externalId: text("external_id").notNull(),
  status: text("status").notNull(),
  category: text("category"),
  description: text("description"),
  issuedDate: text("issued_date"),
  lastUpdatedDate: text("last_updated_date"),
  rawLocation: text("raw_location"),
  externalUrl: text("external_url"),
  isNew: boolean("is_new").default(false),
  createdAt: text("created_at").notNull(),
});

export const employeeProfiles = pgTable("employee_profiles", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  userId: text("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  phone: text("phone").notNull(),
  hireDate: text("hire_date").notNull(),
  status: text("status").notNull(),
  certifications: json("certifications").notNull().$type<string[]>(),
  licenseNumbers: json("license_numbers").notNull().$type<Record<string, string>>(),
  emergencyContact: text("emergency_contact"),
  emergencyPhone: text("emergency_phone"),
  hourlyRate: real("hourly_rate"),
  notes: text("notes"),
});

export const scheduleEntries = pgTable("schedule_entries", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  employeeId: text("employee_id").notNull().references(() => employeeProfiles.id),
  jobsiteId: text("jobsite_id").notNull().references(() => jobsites.id),
  date: text("date").notNull(),
  shiftStart: text("shift_start"),
  shiftEnd: text("shift_end"),
  status: text("status").notNull(),
  notes: text("notes"),
});

export const timesheets = pgTable("timesheets", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  employeeId: text("employee_id").notNull().references(() => employeeProfiles.id),
  weekStartDate: text("week_start_date").notNull(),
  status: text("status").notNull(),
  submittedAt: text("submitted_at"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  totalHours: real("total_hours").notNull().default(0),
  notes: text("notes"),
});

export const timesheetEntries = pgTable("timesheet_entries", {
  id: text("id").primaryKey(),
  timesheetId: text("timesheet_id").notNull().references(() => timesheets.id),
  date: text("date").notNull(),
  jobsiteId: text("jobsite_id"),
  hours: real("hours").notNull(),
  description: text("description"),
});

export const safetyReports = pgTable("safety_reports", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  clientId: text("client_id").notNull().references(() => clients.id),
  periodType: text("period_type").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  totalManhours: real("total_manhours").notNull(),
  totalHeadcount: integer("total_headcount").notNull(),
  projectRiskTier: text("project_risk_tier").notNull(),
  newHirePercent: real("new_hire_percent").notNull(),
  recordableIncidents: integer("recordable_incidents").notNull(),
  dartCases: integer("dart_cases").notNull(),
  lostTimeIncidents: integer("lost_time_incidents").notNull(),
  emr: real("emr").notNull(),
  oshaWillfulCitations: integer("osha_willful_citations").notNull(),
  oshaSeriousCitations: integer("osha_serious_citations").notNull(),
  oshaOtherCitations: integer("osha_other_citations").notNull(),
  openWcClaims: integer("open_wc_claims").notNull(),
  inspectionsCompleted: integer("inspections_completed").notNull(),
  inspectionsScheduled: integer("inspections_scheduled").notNull(),
  correctiveActionsClosed: integer("corrective_actions_closed").notNull(),
  correctiveActionsOpened: integer("corrective_actions_opened").notNull(),
  avgCorrectiveActionDays: real("avg_corrective_action_days").notNull(),
  nearMissReports: integer("near_miss_reports").notNull(),
  toolboxTalksCompleted: integer("toolbox_talks_completed").notNull(),
  toolboxTalksScheduled: integer("toolbox_talks_scheduled").notNull(),
  certifiedWorkforcePercent: real("certified_workforce_percent").notNull(),
  jhaCompliancePercent: real("jha_compliance_percent").notNull(),
  permitCompliancePercent: real("permit_compliance_percent").notNull(),
  overallScore: integer("overall_score").notNull(),
  incidentHistoryScore: integer("incident_history_score").notNull(),
  trainingComplianceScore: integer("training_compliance_score").notNull(),
  hazardManagementScore: integer("hazard_management_score").notNull(),
  permitPreTaskScore: integer("permit_pre_task_score").notNull(),
  reportingCultureScore: integer("reporting_culture_score").notNull(),
  letterGrade: text("letter_grade").notNull(),
  topRiskAreas: text("top_risk_areas").notNull().default(""),
  recommendedActions: text("recommended_actions").notNull().default(""),
  photos: json("photos").notNull().$type<string[]>(),
  createdAt: text("created_at").notNull(),
});

export const seedMeta = pgTable("seed_meta", {
  key: text("key").primaryKey(),
  seededAt: text("seeded_at").notNull(),
});

export const safetyReportSettings = pgTable("safety_report_settings", {
  organizationId: text("organization_id").primaryKey().references(() => organizations.id),
  incidentHistoryWeight: integer("incident_history_weight").notNull().default(35),
  trainingComplianceWeight: integer("training_compliance_weight").notNull().default(20),
  hazardManagementWeight: integer("hazard_management_weight").notNull().default(20),
  permitPreTaskWeight: integer("permit_pre_task_weight").notNull().default(15),
  reportingCultureWeight: integer("reporting_culture_weight").notNull().default(10),
});

export const independentContractors = pgTable("independent_contractors", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  licenseType: text("license_type").notNull(),
  licenseNumber: text("license_number"),
  certifications: json("certifications").notNull().$type<string[]>(),
  plCarrier: text("pl_carrier"),
  plPolicyNumber: text("pl_policy_number"),
  plExpiryDate: text("pl_expiry_date"),
  glCarrier: text("gl_carrier"),
  glPolicyNumber: text("gl_policy_number"),
  glExpiryDate: text("gl_expiry_date"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
});

export const contractorJobsiteAssignments = pgTable("contractor_jobsite_assignments", {
  id: text("id").primaryKey(),
  contractorId: text("contractor_id").notNull().references(() => independentContractors.id),
  jobsiteId: text("jobsite_id").notNull().references(() => jobsites.id),
  startDate: text("start_date"),
  endDate: text("end_date"),
  role: text("role"),
});

export const tradeCompanies = pgTable("trade_companies", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  tradeType: text("trade_type").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  licenseNumber: text("license_number"),
  coiCarrier: text("coi_carrier"),
  coiPolicyNumber: text("coi_policy_number"),
  coiExpiryDate: text("coi_expiry_date"),
  wcCarrier: text("wc_carrier"),
  wcPolicyNumber: text("wc_policy_number"),
  wcExpiryDate: text("wc_expiry_date"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
});

export const jobsiteTradeAssignments = pgTable("jobsite_trade_assignments", {
  id: text("id").primaryKey(),
  jobsiteId: text("jobsite_id").notNull().references(() => jobsites.id),
  tradeCompanyId: text("trade_company_id").notNull().references(() => tradeCompanies.id),
  clientId: text("client_id").references(() => clients.id),
  scopeOfWork: text("scope_of_work"),
  startDate: text("start_date"),
  endDate: text("end_date"),
});

export const contacts = pgTable("contacts", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  notes: text("notes"),
});

export const contactAssociations = pgTable("contact_associations", {
  id: text("id").primaryKey(),
  contactId: text("contact_id").notNull().references(() => contacts.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  relationship: text("relationship"),
});
