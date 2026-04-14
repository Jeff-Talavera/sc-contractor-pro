import type {
  Organization, User, Client, Jobsite, CodeReference,
  InspectionTemplate, Inspection, Observation, AiFinding,
  JobsitePermit, JobsiteExternalEvent,
  EmployeeProfile, ScheduleEntry, Timesheet, TimesheetEntry,
  SafetyReport, SafetyReportSettings,
  InsertClient, InsertJobsite, InsertInspection, InsertObservation,
  InsertEmployeeProfile, InsertScheduleEntry, InsertTimesheet, InsertTimesheetEntry,
  InsertSafetyReport, UpdateSafetySettings, UpdateOrganization,
  UpdateInspectionReport
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import * as t from "@shared/tables";
import { eq, and, gte, lte } from "drizzle-orm";

// ─── Drizzle insert/update row types ─────────────────────────────────────────

type OrgRow            = typeof t.organizations.$inferInsert;
type UserRow           = typeof t.users.$inferInsert;
type ClientRow         = typeof t.clients.$inferInsert;
type JobsiteRow        = typeof t.jobsites.$inferInsert;
type InspectionRow     = typeof t.inspections.$inferInsert;
type ObservationRow    = typeof t.observations.$inferInsert;
type EmployeeRow       = typeof t.employeeProfiles.$inferInsert;
type ScheduleRow       = typeof t.scheduleEntries.$inferInsert;
type TimesheetRow      = typeof t.timesheets.$inferInsert;
type TimesheetEntryRow = typeof t.timesheetEntries.$inferInsert;
type SafetyReportRow   = typeof t.safetyReports.$inferInsert;
type SafetySettingsRow = typeof t.safetyReportSettings.$inferInsert;

// ─── Scoring logic ────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 1;
}

export function calculateSafetyScores(data: InsertSafetyReport, settings: SafetyReportSettings) {
  const mh = Math.max(data.totalManhours, 1);
  const hc = Math.max(data.totalHeadcount, 1);

  const trir = (data.recordableIncidents / mh) * 200000;
  const trirScore = clamp(100 - trir * 25, 0, 100);
  const dart = (data.dartCases / mh) * 200000;
  const dartScore = clamp(100 - dart * 33, 0, 100);
  const ltir = (data.lostTimeIncidents / mh) * 200000;
  const ltirScore = clamp(100 - ltir * 50, 0, 100);
  const emrScore = data.emr > 0 ? clamp((1.5 - data.emr) / 0.7 * 100, 0, 100) : 80;
  const citationScore = clamp(
    100 - data.oshaWillfulCitations * 40 - data.oshaSeriousCitations * 15 - data.oshaOtherCitations * 5,
    0, 100
  );
  const wcScore = clamp(100 - data.openWcClaims * 15, 0, 100);
  const incidentHistoryScore = Math.round(
    (trirScore + dartScore + ltirScore + emrScore + citationScore + wcScore) / 6
  );

  const toolboxScore = data.toolboxTalksScheduled > 0
    ? clamp(safeDivide(data.toolboxTalksCompleted, data.toolboxTalksScheduled) * 100, 0, 100)
    : 100;
  const trainingComplianceScore = Math.round((data.certifiedWorkforcePercent + toolboxScore) / 2);

  const inspectionRatioScore = data.inspectionsScheduled > 0
    ? clamp(safeDivide(data.inspectionsCompleted, data.inspectionsScheduled) * 100, 0, 100)
    : 100;
  const caClosureScore = data.correctiveActionsOpened > 0
    ? clamp(safeDivide(data.correctiveActionsClosed, data.correctiveActionsOpened) * 100, 0, 100)
    : 100;
  const caTimeScore = clamp(100 - (data.avgCorrectiveActionDays / 30) * 100, 0, 100);
  const hazardManagementScore = Math.round((inspectionRatioScore + caClosureScore + caTimeScore) / 3);

  const permitPreTaskScore = Math.round((data.jhaCompliancePercent + data.permitCompliancePercent) / 2);

  const nearMissRate = (data.nearMissReports / hc) * 100;
  const reportingCultureScore = Math.round(clamp(30 + (Math.min(nearMissRate, 3) / 3) * 70, 0, 100));

  const totalWeight = settings.incidentHistoryWeight + settings.trainingComplianceWeight +
    settings.hazardManagementWeight + settings.permitPreTaskWeight + settings.reportingCultureWeight;
  const safeTotal = totalWeight > 0 ? totalWeight : 100;

  const overallScore = Math.round(
    (incidentHistoryScore * settings.incidentHistoryWeight +
      trainingComplianceScore * settings.trainingComplianceWeight +
      hazardManagementScore * settings.hazardManagementWeight +
      permitPreTaskScore * settings.permitPreTaskWeight +
      reportingCultureScore * settings.reportingCultureWeight) / safeTotal
  );

  const letterGrade: "A" | "B" | "C" | "D" =
    overallScore >= 90 ? "A" : overallScore >= 75 ? "B" : overallScore >= 60 ? "C" : "D";

  return {
    overallScore,
    incidentHistoryScore,
    trainingComplianceScore,
    hazardManagementScore,
    permitPreTaskScore,
    reportingCultureScore,
    letterGrade,
  };
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapOrg(row: typeof t.organizations.$inferSelect): Organization {
  return { id: row.id, name: row.name, logoUrl: row.logoUrl ?? undefined };
}

function mapUser(row: typeof t.users.$inferSelect): User {
  return {
    id: row.id, organizationId: row.organizationId,
    name: row.name, email: row.email,
    role: row.role as User["role"],
  };
}

function mapClient(row: typeof t.clients.$inferSelect): Client {
  return {
    id: row.id, organizationId: row.organizationId,
    parentClientId: row.parentClientId ?? undefined,
    name: row.name, contactName: row.contactName,
    contactEmail: row.contactEmail, contactPhone: row.contactPhone,
    notes: row.notes ?? undefined,
  };
}

function mapJobsite(row: typeof t.jobsites.$inferSelect): Jobsite {
  return {
    id: row.id, organizationId: row.organizationId, clientId: row.clientId,
    name: row.name, address: row.address, city: row.city,
    state: row.state ?? undefined, bin: row.bin ?? undefined,
    dobJobNumber: row.dobJobNumber ?? undefined,
    projectType: row.projectType, buildingType: row.buildingType ?? undefined,
    stories: row.stories ?? undefined,
    hasScaffold: row.hasScaffold, hasHoist: row.hasHoist,
    hasCrane: row.hasCrane, hasExcavation: row.hasExcavation,
    monitorPublicRecords: row.monitorPublicRecords,
  };
}

function mapCodeRef(row: typeof t.codeReferences.$inferSelect): CodeReference {
  return {
    id: row.id, codeType: row.codeType as CodeReference["codeType"],
    chapter: row.chapter ?? undefined, sectionNumber: row.sectionNumber,
    title: row.title, plainSummary: row.plainSummary,
    tags: row.tags as string[], officialUrl: row.officialUrl,
  };
}

function mapTemplate(row: typeof t.inspectionTemplates.$inferSelect): InspectionTemplate {
  return {
    id: row.id, organizationId: row.organizationId,
    name: row.name, description: row.description, category: row.category,
  };
}

function mapInspection(row: typeof t.inspections.$inferSelect): Inspection {
  return {
    id: row.id, organizationId: row.organizationId, jobsiteId: row.jobsiteId,
    templateId: row.templateId, date: row.date, inspectorUserId: row.inspectorUserId,
    status: row.status as Inspection["status"],
    scopeOfWork: row.scopeOfWork ?? undefined,
    ccList: (row.ccList as string[] | null) ?? undefined,
    recipientName: row.recipientName ?? undefined,
    recipientTitle: row.recipientTitle ?? undefined,
    recipientCompany: row.recipientCompany ?? undefined,
    recipientAddress: row.recipientAddress ?? undefined,
  };
}

function mapObservation(row: typeof t.observations.$inferSelect): Observation {
  return {
    id: row.id, organizationId: row.organizationId,
    inspectionId: row.inspectionId, jobsiteId: row.jobsiteId,
    createdAt: row.createdAt, createdByUserId: row.createdByUserId,
    location: row.location, description: row.description, category: row.category,
    type: row.type as Observation["type"],
    severity: row.severity as Observation["severity"],
    status: row.status as Observation["status"],
    correctedOnSite: row.correctedOnSite ?? undefined,
    assignedTo: row.assignedTo ?? undefined, dueDate: row.dueDate ?? undefined,
    photoUrls: (row.photoUrls as string[]) ?? [],
    linkedCodeReferenceIds: (row.linkedCodeReferenceIds as string[]) ?? [],
    recommendedActions: (row.recommendedActions as string[]) ?? [],
    source: row.source as Observation["source"],
    aiFindings: (row.aiFindings as AiFinding[] | null) ?? undefined,
  };
}

function mapPermit(row: typeof t.jobsitePermits.$inferSelect): JobsitePermit {
  return {
    id: row.id, jobsiteId: row.jobsiteId,
    source: row.source as JobsitePermit["source"],
    permitNumber: row.permitNumber,
    jobFilingNumber: row.jobFilingNumber ?? undefined,
    workType: row.workType, permitType: row.permitType ?? undefined,
    status: row.status as JobsitePermit["status"],
    issueDate: row.issueDate ?? undefined, expirationDate: row.expirationDate ?? undefined,
    description: row.description ?? undefined, rawLocation: row.rawLocation ?? undefined,
    externalUrl: row.externalUrl ?? undefined,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

function mapExternalEvent(row: typeof t.jobsiteExternalEvents.$inferSelect): JobsiteExternalEvent {
  return {
    id: row.id, jobsiteId: row.jobsiteId,
    source: row.source as JobsiteExternalEvent["source"],
    eventType: row.eventType as JobsiteExternalEvent["eventType"],
    externalId: row.externalId, status: row.status,
    category: row.category ?? undefined, description: row.description ?? undefined,
    issuedDate: row.issuedDate ?? undefined, lastUpdatedDate: row.lastUpdatedDate ?? undefined,
    rawLocation: row.rawLocation ?? undefined, externalUrl: row.externalUrl ?? undefined,
    isNew: row.isNew ?? undefined, createdAt: row.createdAt,
  };
}

function mapEmployee(row: typeof t.employeeProfiles.$inferSelect): EmployeeProfile {
  return {
    id: row.id, organizationId: row.organizationId, userId: row.userId,
    title: row.title, phone: row.phone, hireDate: row.hireDate,
    status: row.status as EmployeeProfile["status"],
    certifications: (row.certifications as string[]) ?? [],
    licenseNumbers: (row.licenseNumbers as Record<string, string>) ?? {},
    emergencyContact: row.emergencyContact ?? undefined,
    emergencyPhone: row.emergencyPhone ?? undefined,
    hourlyRate: row.hourlyRate ?? undefined, notes: row.notes ?? undefined,
  };
}

function mapScheduleEntry(row: typeof t.scheduleEntries.$inferSelect): ScheduleEntry {
  return {
    id: row.id, organizationId: row.organizationId,
    employeeId: row.employeeId, jobsiteId: row.jobsiteId, date: row.date,
    shiftStart: row.shiftStart ?? undefined, shiftEnd: row.shiftEnd ?? undefined,
    status: row.status as ScheduleEntry["status"], notes: row.notes ?? undefined,
  };
}

function mapTimesheet(row: typeof t.timesheets.$inferSelect): Timesheet {
  return {
    id: row.id, organizationId: row.organizationId,
    employeeId: row.employeeId, weekStartDate: row.weekStartDate,
    status: row.status as Timesheet["status"],
    submittedAt: row.submittedAt ?? undefined, approvedBy: row.approvedBy ?? undefined,
    approvedAt: row.approvedAt ?? undefined, totalHours: row.totalHours ?? 0,
    notes: row.notes ?? undefined,
  };
}

function mapTimesheetEntry(row: typeof t.timesheetEntries.$inferSelect): TimesheetEntry {
  return {
    id: row.id, timesheetId: row.timesheetId, date: row.date,
    jobsiteId: row.jobsiteId ?? undefined, hours: row.hours,
    description: row.description ?? undefined,
  };
}

function mapSafetyReport(row: typeof t.safetyReports.$inferSelect): SafetyReport {
  return {
    id: row.id, organizationId: row.organizationId, clientId: row.clientId,
    periodType: row.periodType as SafetyReport["periodType"],
    periodStart: row.periodStart, periodEnd: row.periodEnd,
    totalManhours: row.totalManhours, totalHeadcount: row.totalHeadcount,
    projectRiskTier: row.projectRiskTier as SafetyReport["projectRiskTier"],
    newHirePercent: row.newHirePercent,
    recordableIncidents: row.recordableIncidents, dartCases: row.dartCases,
    lostTimeIncidents: row.lostTimeIncidents, emr: row.emr,
    oshaWillfulCitations: row.oshaWillfulCitations,
    oshaSeriousCitations: row.oshaSeriousCitations,
    oshaOtherCitations: row.oshaOtherCitations, openWcClaims: row.openWcClaims,
    inspectionsCompleted: row.inspectionsCompleted,
    inspectionsScheduled: row.inspectionsScheduled,
    correctiveActionsClosed: row.correctiveActionsClosed,
    correctiveActionsOpened: row.correctiveActionsOpened,
    avgCorrectiveActionDays: row.avgCorrectiveActionDays,
    nearMissReports: row.nearMissReports,
    toolboxTalksCompleted: row.toolboxTalksCompleted,
    toolboxTalksScheduled: row.toolboxTalksScheduled,
    certifiedWorkforcePercent: row.certifiedWorkforcePercent,
    jhaCompliancePercent: row.jhaCompliancePercent,
    permitCompliancePercent: row.permitCompliancePercent,
    overallScore: row.overallScore, incidentHistoryScore: row.incidentHistoryScore,
    trainingComplianceScore: row.trainingComplianceScore,
    hazardManagementScore: row.hazardManagementScore,
    permitPreTaskScore: row.permitPreTaskScore,
    reportingCultureScore: row.reportingCultureScore,
    letterGrade: row.letterGrade as SafetyReport["letterGrade"],
    topRiskAreas: row.topRiskAreas, recommendedActions: row.recommendedActions,
    photos: (row.photos as string[]) ?? [], createdAt: row.createdAt,
  };
}

function mapSafetySettings(row: typeof t.safetyReportSettings.$inferSelect): SafetyReportSettings {
  return {
    organizationId: row.organizationId,
    incidentHistoryWeight: row.incidentHistoryWeight,
    trainingComplianceWeight: row.trainingComplianceWeight,
    hazardManagementWeight: row.hazardManagementWeight,
    permitPreTaskWeight: row.permitPreTaskWeight,
    reportingCultureWeight: row.reportingCultureWeight,
  };
}

// ─── IStorage interface ───────────────────────────────────────────────────────

export interface IStorage {
  getCurrentUser(): Promise<User>;
  getOrganization(id: string): Promise<Organization | undefined>;
  updateOrganization(id: string, data: UpdateOrganization): Promise<Organization | undefined>;
  getUsersByOrg(orgId: string): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;

  getClientsByOrg(orgId: string): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getSubcontractors(parentClientId: string): Promise<Client[]>;
  createClient(orgId: string, data: InsertClient): Promise<Client>;

  getJobsitesByOrg(orgId: string): Promise<Jobsite[]>;
  getJobsitesByClient(clientId: string): Promise<Jobsite[]>;
  getJobsite(id: string): Promise<Jobsite | undefined>;
  createJobsite(orgId: string, data: InsertJobsite): Promise<Jobsite>;
  updateJobsite(id: string, updates: Partial<Jobsite>): Promise<Jobsite | undefined>;

  getCodeReferences(): Promise<CodeReference[]>;
  getCodeReference(id: string): Promise<CodeReference | undefined>;

  getTemplatesByOrg(orgId: string): Promise<InspectionTemplate[]>;
  getTemplate(id: string): Promise<InspectionTemplate | undefined>;

  getInspectionsByOrg(orgId: string): Promise<Inspection[]>;
  getInspectionsByJobsite(jobsiteId: string): Promise<Inspection[]>;
  getInspection(id: string): Promise<Inspection | undefined>;
  createInspection(orgId: string, inspectorUserId: string, data: InsertInspection): Promise<Inspection>;
  updateInspectionStatus(id: string, status: "Draft" | "Submitted"): Promise<Inspection | undefined>;
  updateInspection(id: string, updates: UpdateInspectionReport): Promise<Inspection | undefined>;

  getObservationsByInspection(inspectionId: string): Promise<Observation[]>;
  getObservationsByOrg(orgId: string): Promise<Observation[]>;
  getObservation(id: string): Promise<Observation | undefined>;
  createObservation(orgId: string, userId: string, data: InsertObservation): Promise<Observation>;
  updateObservation(id: string, updates: Partial<Observation>): Promise<Observation | undefined>;

  getPermitsByJobsite(jobsiteId: string): Promise<JobsitePermit[]>;
  getExternalEventsByJobsite(jobsiteId: string): Promise<JobsiteExternalEvent[]>;

  getEmployeeProfilesByOrg(orgId: string): Promise<EmployeeProfile[]>;
  getEmployeeProfile(id: string): Promise<EmployeeProfile | undefined>;
  createEmployeeProfile(orgId: string, data: InsertEmployeeProfile): Promise<EmployeeProfile>;
  updateEmployeeProfile(id: string, updates: Partial<EmployeeProfile>): Promise<EmployeeProfile | undefined>;

  getScheduleEntry(id: string): Promise<ScheduleEntry | undefined>;
  getScheduleEntriesByOrg(orgId: string): Promise<ScheduleEntry[]>;
  getScheduleEntriesByEmployee(employeeId: string): Promise<ScheduleEntry[]>;
  getScheduleEntriesByDateRange(orgId: string, startDate: string, endDate: string): Promise<ScheduleEntry[]>;
  createScheduleEntry(orgId: string, data: InsertScheduleEntry): Promise<ScheduleEntry>;
  updateScheduleEntry(id: string, updates: Partial<ScheduleEntry>): Promise<ScheduleEntry | undefined>;
  deleteScheduleEntry(id: string): Promise<boolean>;

  getTimesheetsByOrg(orgId: string): Promise<Timesheet[]>;
  getTimesheetsByEmployee(employeeId: string): Promise<Timesheet[]>;
  getTimesheet(id: string): Promise<Timesheet | undefined>;
  getTimesheetEntry(id: string): Promise<TimesheetEntry | undefined>;
  createTimesheet(orgId: string, data: InsertTimesheet): Promise<Timesheet>;
  updateTimesheet(id: string, updates: Partial<Timesheet>): Promise<Timesheet | undefined>;

  getTimesheetEntriesByTimesheet(timesheetId: string): Promise<TimesheetEntry[]>;
  createTimesheetEntry(data: InsertTimesheetEntry): Promise<TimesheetEntry>;
  updateTimesheetEntry(id: string, updates: Partial<TimesheetEntry>): Promise<TimesheetEntry | undefined>;
  deleteTimesheetEntry(id: string): Promise<boolean>;

  getSafetyReportsByOrg(orgId: string): Promise<SafetyReport[]>;
  getSafetyReportsByClient(clientId: string): Promise<SafetyReport[]>;
  getSafetyReport(id: string): Promise<SafetyReport | undefined>;
  createSafetyReport(orgId: string, data: InsertSafetyReport): Promise<SafetyReport>;

  getSafetySettings(orgId: string): Promise<SafetyReportSettings>;
  updateSafetySettings(orgId: string, data: UpdateSafetySettings): Promise<SafetyReportSettings>;
}

// ─── DatabaseStorage implementation ──────────────────────────────────────────

export class DatabaseStorage implements IStorage {

  async getCurrentUser(): Promise<User> {
    const rows = await db.select().from(t.users).where(eq(t.users.id, "user-1"));
    if (!rows[0]) throw new Error("Default user not found — did you run the seed?");
    return mapUser(rows[0]);
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const rows = await db.select().from(t.organizations).where(eq(t.organizations.id, id));
    return rows[0] ? mapOrg(rows[0]) : undefined;
  }

  async updateOrganization(id: string, data: UpdateOrganization): Promise<Organization | undefined> {
    const existing = await this.getOrganization(id);
    if (!existing) return undefined;
    const set: Partial<OrgRow> = {
      logoUrl: data.logoUrl !== undefined ? (data.logoUrl ?? null) : (existing.logoUrl ?? null),
    };
    const rows = await db.update(t.organizations).set(set).where(eq(t.organizations.id, id)).returning();
    return rows[0] ? mapOrg(rows[0]) : undefined;
  }

  async getUsersByOrg(orgId: string): Promise<User[]> {
    const rows = await db.select().from(t.users).where(eq(t.users.organizationId, orgId));
    return rows.map(mapUser);
  }

  async getUser(id: string): Promise<User | undefined> {
    const rows = await db.select().from(t.users).where(eq(t.users.id, id));
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async getClientsByOrg(orgId: string): Promise<Client[]> {
    const rows = await db.select().from(t.clients).where(eq(t.clients.organizationId, orgId));
    return rows.map(mapClient);
  }

  async getClient(id: string): Promise<Client | undefined> {
    const rows = await db.select().from(t.clients).where(eq(t.clients.id, id));
    return rows[0] ? mapClient(rows[0]) : undefined;
  }

  async getSubcontractors(parentClientId: string): Promise<Client[]> {
    const rows = await db.select().from(t.clients).where(eq(t.clients.parentClientId, parentClientId));
    return rows.map(mapClient);
  }

  async createClient(orgId: string, data: InsertClient): Promise<Client> {
    const id = `client-${randomUUID().slice(0, 8)}`;
    const row: ClientRow = {
      id, organizationId: orgId,
      parentClientId: data.parentClientId ?? null,
      name: data.name, contactName: data.contactName,
      contactEmail: data.contactEmail, contactPhone: data.contactPhone,
      notes: data.notes ?? null,
    };
    const rows = await db.insert(t.clients).values(row).returning();
    return mapClient(rows[0]);
  }

  async getJobsitesByOrg(orgId: string): Promise<Jobsite[]> {
    const rows = await db.select().from(t.jobsites).where(eq(t.jobsites.organizationId, orgId));
    return rows.map(mapJobsite);
  }

  async getJobsitesByClient(clientId: string): Promise<Jobsite[]> {
    const rows = await db.select().from(t.jobsites).where(eq(t.jobsites.clientId, clientId));
    return rows.map(mapJobsite);
  }

  async getJobsite(id: string): Promise<Jobsite | undefined> {
    const rows = await db.select().from(t.jobsites).where(eq(t.jobsites.id, id));
    return rows[0] ? mapJobsite(rows[0]) : undefined;
  }

  async createJobsite(orgId: string, data: InsertJobsite): Promise<Jobsite> {
    const id = `job-${randomUUID().slice(0, 8)}`;
    const row: JobsiteRow = {
      id, organizationId: orgId, clientId: data.clientId,
      name: data.name, address: data.address, city: data.city,
      state: data.state ?? null, bin: data.bin ?? null,
      dobJobNumber: data.dobJobNumber ?? null,
      projectType: data.projectType, buildingType: data.buildingType ?? null,
      stories: data.stories ?? null,
      hasScaffold: data.hasScaffold, hasHoist: data.hasHoist,
      hasCrane: data.hasCrane, hasExcavation: data.hasExcavation,
      monitorPublicRecords: data.monitorPublicRecords,
    };
    const rows = await db.insert(t.jobsites).values(row).returning();
    return mapJobsite(rows[0]);
  }

  async updateJobsite(id: string, updates: Partial<Jobsite>): Promise<Jobsite | undefined> {
    const set: Partial<JobsiteRow> = {};
    if (updates.name !== undefined) set.name = updates.name;
    if (updates.address !== undefined) set.address = updates.address;
    if (updates.city !== undefined) set.city = updates.city;
    if (updates.state !== undefined) set.state = updates.state ?? null;
    if (updates.bin !== undefined) set.bin = updates.bin ?? null;
    if (updates.dobJobNumber !== undefined) set.dobJobNumber = updates.dobJobNumber ?? null;
    if (updates.projectType !== undefined) set.projectType = updates.projectType;
    if (updates.buildingType !== undefined) set.buildingType = updates.buildingType ?? null;
    if (updates.stories !== undefined) set.stories = updates.stories ?? null;
    if (updates.hasScaffold !== undefined) set.hasScaffold = updates.hasScaffold;
    if (updates.hasHoist !== undefined) set.hasHoist = updates.hasHoist;
    if (updates.hasCrane !== undefined) set.hasCrane = updates.hasCrane;
    if (updates.hasExcavation !== undefined) set.hasExcavation = updates.hasExcavation;
    if (updates.monitorPublicRecords !== undefined) set.monitorPublicRecords = updates.monitorPublicRecords;
    if (Object.keys(set).length === 0) return this.getJobsite(id);
    const rows = await db.update(t.jobsites).set(set).where(eq(t.jobsites.id, id)).returning();
    return rows[0] ? mapJobsite(rows[0]) : undefined;
  }

  async getCodeReferences(): Promise<CodeReference[]> {
    const rows = await db.select().from(t.codeReferences);
    return rows.map(mapCodeRef);
  }

  async getCodeReference(id: string): Promise<CodeReference | undefined> {
    const rows = await db.select().from(t.codeReferences).where(eq(t.codeReferences.id, id));
    return rows[0] ? mapCodeRef(rows[0]) : undefined;
  }

  async getTemplatesByOrg(orgId: string): Promise<InspectionTemplate[]> {
    const rows = await db.select().from(t.inspectionTemplates).where(eq(t.inspectionTemplates.organizationId, orgId));
    return rows.map(mapTemplate);
  }

  async getTemplate(id: string): Promise<InspectionTemplate | undefined> {
    const rows = await db.select().from(t.inspectionTemplates).where(eq(t.inspectionTemplates.id, id));
    return rows[0] ? mapTemplate(rows[0]) : undefined;
  }

  async getInspectionsByOrg(orgId: string): Promise<Inspection[]> {
    const rows = await db.select().from(t.inspections).where(eq(t.inspections.organizationId, orgId));
    return rows.map(mapInspection);
  }

  async getInspectionsByJobsite(jobsiteId: string): Promise<Inspection[]> {
    const rows = await db.select().from(t.inspections).where(eq(t.inspections.jobsiteId, jobsiteId));
    return rows.map(mapInspection);
  }

  async getInspection(id: string): Promise<Inspection | undefined> {
    const rows = await db.select().from(t.inspections).where(eq(t.inspections.id, id));
    return rows[0] ? mapInspection(rows[0]) : undefined;
  }

  async createInspection(orgId: string, inspectorUserId: string, data: InsertInspection): Promise<Inspection> {
    const id = `insp-${randomUUID().slice(0, 8)}`;
    const row: InspectionRow = {
      id, organizationId: orgId, inspectorUserId, status: "Draft",
      jobsiteId: data.jobsiteId, templateId: data.templateId, date: data.date,
      scopeOfWork: null, ccList: null,
      recipientName: null, recipientTitle: null, recipientCompany: null, recipientAddress: null,
    };
    const rows = await db.insert(t.inspections).values(row).returning();
    return mapInspection(rows[0]);
  }

  async updateInspectionStatus(id: string, status: "Draft" | "Submitted"): Promise<Inspection | undefined> {
    const set: Partial<InspectionRow> = { status };
    const rows = await db.update(t.inspections).set(set).where(eq(t.inspections.id, id)).returning();
    return rows[0] ? mapInspection(rows[0]) : undefined;
  }

  async updateInspection(id: string, updates: UpdateInspectionReport): Promise<Inspection | undefined> {
    const set: Partial<InspectionRow> = {};
    if (updates.scopeOfWork !== undefined) set.scopeOfWork = updates.scopeOfWork ?? null;
    if (updates.ccList !== undefined) set.ccList = updates.ccList ?? null;
    if (updates.recipientName !== undefined) set.recipientName = updates.recipientName ?? null;
    if (updates.recipientTitle !== undefined) set.recipientTitle = updates.recipientTitle ?? null;
    if (updates.recipientCompany !== undefined) set.recipientCompany = updates.recipientCompany ?? null;
    if (updates.recipientAddress !== undefined) set.recipientAddress = updates.recipientAddress ?? null;
    if (Object.keys(set).length === 0) return this.getInspection(id);
    const rows = await db.update(t.inspections).set(set).where(eq(t.inspections.id, id)).returning();
    return rows[0] ? mapInspection(rows[0]) : undefined;
  }

  async getObservationsByInspection(inspectionId: string): Promise<Observation[]> {
    const rows = await db.select().from(t.observations).where(eq(t.observations.inspectionId, inspectionId));
    return rows.map(mapObservation);
  }

  async getObservationsByOrg(orgId: string): Promise<Observation[]> {
    const rows = await db.select().from(t.observations).where(eq(t.observations.organizationId, orgId));
    return rows.map(mapObservation);
  }

  async getObservation(id: string): Promise<Observation | undefined> {
    const rows = await db.select().from(t.observations).where(eq(t.observations.id, id));
    return rows[0] ? mapObservation(rows[0]) : undefined;
  }

  async createObservation(orgId: string, userId: string, data: InsertObservation): Promise<Observation> {
    const id = `obs-${randomUUID().slice(0, 8)}`;
    const row: ObservationRow = {
      id, organizationId: orgId, createdByUserId: userId,
      createdAt: new Date().toISOString(),
      inspectionId: data.inspectionId, jobsiteId: data.jobsiteId,
      location: data.location, description: data.description, category: data.category,
      type: data.type, severity: data.severity, status: data.status,
      correctedOnSite: data.correctedOnSite ?? false,
      assignedTo: data.assignedTo ?? null, dueDate: data.dueDate ?? null,
      photoUrls: data.photoUrls,
      linkedCodeReferenceIds: data.linkedCodeReferenceIds,
      recommendedActions: data.recommendedActions,
      source: data.source,
      aiFindings: data.aiFindings ?? null,
    };
    const rows = await db.insert(t.observations).values(row).returning();
    return mapObservation(rows[0]);
  }

  async updateObservation(id: string, updates: Partial<Observation>): Promise<Observation | undefined> {
    const set: Partial<ObservationRow> = {};
    if (updates.description !== undefined) set.description = updates.description;
    if (updates.category !== undefined) set.category = updates.category;
    if (updates.type !== undefined) set.type = updates.type;
    if (updates.severity !== undefined) set.severity = updates.severity;
    if (updates.status !== undefined) set.status = updates.status;
    if (updates.correctedOnSite !== undefined) set.correctedOnSite = updates.correctedOnSite ?? false;
    if (updates.assignedTo !== undefined) set.assignedTo = updates.assignedTo ?? null;
    if (updates.dueDate !== undefined) set.dueDate = updates.dueDate ?? null;
    if (updates.photoUrls !== undefined) set.photoUrls = updates.photoUrls;
    if (updates.linkedCodeReferenceIds !== undefined) set.linkedCodeReferenceIds = updates.linkedCodeReferenceIds;
    if (updates.recommendedActions !== undefined) set.recommendedActions = updates.recommendedActions;
    if (updates.source !== undefined) set.source = updates.source;
    if (updates.aiFindings !== undefined) set.aiFindings = updates.aiFindings ?? null;
    if (Object.keys(set).length === 0) return this.getObservation(id);
    const rows = await db.update(t.observations).set(set).where(eq(t.observations.id, id)).returning();
    return rows[0] ? mapObservation(rows[0]) : undefined;
  }

  async getPermitsByJobsite(jobsiteId: string): Promise<JobsitePermit[]> {
    const rows = await db.select().from(t.jobsitePermits).where(eq(t.jobsitePermits.jobsiteId, jobsiteId));
    return rows.map(mapPermit);
  }

  async getExternalEventsByJobsite(jobsiteId: string): Promise<JobsiteExternalEvent[]> {
    const rows = await db.select().from(t.jobsiteExternalEvents).where(eq(t.jobsiteExternalEvents.jobsiteId, jobsiteId));
    return rows.map(mapExternalEvent);
  }

  async getEmployeeProfilesByOrg(orgId: string): Promise<EmployeeProfile[]> {
    const rows = await db.select().from(t.employeeProfiles).where(eq(t.employeeProfiles.organizationId, orgId));
    return rows.map(mapEmployee);
  }

  async getEmployeeProfile(id: string): Promise<EmployeeProfile | undefined> {
    const rows = await db.select().from(t.employeeProfiles).where(eq(t.employeeProfiles.id, id));
    return rows[0] ? mapEmployee(rows[0]) : undefined;
  }

  async createEmployeeProfile(orgId: string, data: InsertEmployeeProfile): Promise<EmployeeProfile> {
    const id = `emp-${randomUUID().slice(0, 8)}`;
    const row: EmployeeRow = {
      id, organizationId: orgId, userId: data.userId,
      title: data.title, phone: data.phone, hireDate: data.hireDate, status: data.status,
      certifications: data.certifications,
      licenseNumbers: data.licenseNumbers,
      emergencyContact: data.emergencyContact ?? null,
      emergencyPhone: data.emergencyPhone ?? null,
      hourlyRate: data.hourlyRate ?? null, notes: data.notes ?? null,
    };
    const rows = await db.insert(t.employeeProfiles).values(row).returning();
    return mapEmployee(rows[0]);
  }

  async updateEmployeeProfile(id: string, updates: Partial<EmployeeProfile>): Promise<EmployeeProfile | undefined> {
    const set: Partial<EmployeeRow> = {};
    if (updates.title !== undefined) set.title = updates.title;
    if (updates.phone !== undefined) set.phone = updates.phone;
    if (updates.status !== undefined) set.status = updates.status;
    if (updates.hireDate !== undefined) set.hireDate = updates.hireDate;
    if (updates.certifications !== undefined) set.certifications = updates.certifications;
    if (updates.licenseNumbers !== undefined) set.licenseNumbers = updates.licenseNumbers;
    if (updates.emergencyContact !== undefined) set.emergencyContact = updates.emergencyContact ?? null;
    if (updates.emergencyPhone !== undefined) set.emergencyPhone = updates.emergencyPhone ?? null;
    if (updates.hourlyRate !== undefined) set.hourlyRate = updates.hourlyRate ?? null;
    if (updates.notes !== undefined) set.notes = updates.notes ?? null;
    if (Object.keys(set).length === 0) return this.getEmployeeProfile(id);
    const rows = await db.update(t.employeeProfiles).set(set).where(eq(t.employeeProfiles.id, id)).returning();
    return rows[0] ? mapEmployee(rows[0]) : undefined;
  }

  async getScheduleEntry(id: string): Promise<ScheduleEntry | undefined> {
    const rows = await db.select().from(t.scheduleEntries).where(eq(t.scheduleEntries.id, id));
    return rows[0] ? mapScheduleEntry(rows[0]) : undefined;
  }

  async getScheduleEntriesByOrg(orgId: string): Promise<ScheduleEntry[]> {
    const rows = await db.select().from(t.scheduleEntries).where(eq(t.scheduleEntries.organizationId, orgId));
    return rows.map(mapScheduleEntry);
  }

  async getScheduleEntriesByEmployee(employeeId: string): Promise<ScheduleEntry[]> {
    const rows = await db.select().from(t.scheduleEntries).where(eq(t.scheduleEntries.employeeId, employeeId));
    return rows.map(mapScheduleEntry);
  }

  async getScheduleEntriesByDateRange(orgId: string, startDate: string, endDate: string): Promise<ScheduleEntry[]> {
    const rows = await db.select().from(t.scheduleEntries).where(
      and(
        eq(t.scheduleEntries.organizationId, orgId),
        gte(t.scheduleEntries.date, startDate),
        lte(t.scheduleEntries.date, endDate)
      )
    );
    return rows.map(mapScheduleEntry);
  }

  async createScheduleEntry(orgId: string, data: InsertScheduleEntry): Promise<ScheduleEntry> {
    const id = `sched-${randomUUID().slice(0, 8)}`;
    const row: ScheduleRow = {
      id, organizationId: orgId,
      employeeId: data.employeeId, jobsiteId: data.jobsiteId, date: data.date,
      shiftStart: data.shiftStart ?? null, shiftEnd: data.shiftEnd ?? null,
      status: data.status, notes: data.notes ?? null,
    };
    const rows = await db.insert(t.scheduleEntries).values(row).returning();
    return mapScheduleEntry(rows[0]);
  }

  async updateScheduleEntry(id: string, updates: Partial<ScheduleEntry>): Promise<ScheduleEntry | undefined> {
    const set: Partial<ScheduleRow> = {};
    if (updates.status !== undefined) set.status = updates.status;
    if (updates.shiftStart !== undefined) set.shiftStart = updates.shiftStart ?? null;
    if (updates.shiftEnd !== undefined) set.shiftEnd = updates.shiftEnd ?? null;
    if (updates.notes !== undefined) set.notes = updates.notes ?? null;
    if (Object.keys(set).length === 0) return this.getScheduleEntry(id);
    const rows = await db.update(t.scheduleEntries).set(set).where(eq(t.scheduleEntries.id, id)).returning();
    return rows[0] ? mapScheduleEntry(rows[0]) : undefined;
  }

  async deleteScheduleEntry(id: string): Promise<boolean> {
    const rows = await db.delete(t.scheduleEntries).where(eq(t.scheduleEntries.id, id)).returning();
    return rows.length > 0;
  }

  async getTimesheetsByOrg(orgId: string): Promise<Timesheet[]> {
    const rows = await db.select().from(t.timesheets).where(eq(t.timesheets.organizationId, orgId));
    return rows.map(mapTimesheet);
  }

  async getTimesheetsByEmployee(employeeId: string): Promise<Timesheet[]> {
    const rows = await db.select().from(t.timesheets).where(eq(t.timesheets.employeeId, employeeId));
    return rows.map(mapTimesheet);
  }

  async getTimesheet(id: string): Promise<Timesheet | undefined> {
    const rows = await db.select().from(t.timesheets).where(eq(t.timesheets.id, id));
    return rows[0] ? mapTimesheet(rows[0]) : undefined;
  }

  async getTimesheetEntry(id: string): Promise<TimesheetEntry | undefined> {
    const rows = await db.select().from(t.timesheetEntries).where(eq(t.timesheetEntries.id, id));
    return rows[0] ? mapTimesheetEntry(rows[0]) : undefined;
  }

  async createTimesheet(orgId: string, data: InsertTimesheet): Promise<Timesheet> {
    const id = `ts-${randomUUID().slice(0, 8)}`;
    const row: TimesheetRow = {
      id, organizationId: orgId, employeeId: data.employeeId,
      weekStartDate: data.weekStartDate, status: "Draft", totalHours: 0,
      submittedAt: null, approvedBy: null, approvedAt: null,
      notes: data.notes ?? null,
    };
    const rows = await db.insert(t.timesheets).values(row).returning();
    return mapTimesheet(rows[0]);
  }

  async updateTimesheet(id: string, updates: Partial<Timesheet>): Promise<Timesheet | undefined> {
    const set: Partial<TimesheetRow> = {};
    if (updates.status !== undefined) set.status = updates.status;
    if (updates.submittedAt !== undefined) set.submittedAt = updates.submittedAt ?? null;
    if (updates.approvedBy !== undefined) set.approvedBy = updates.approvedBy ?? null;
    if (updates.approvedAt !== undefined) set.approvedAt = updates.approvedAt ?? null;
    if (updates.notes !== undefined) set.notes = updates.notes ?? null;
    if (Object.keys(set).length === 0) return this.getTimesheet(id);
    const rows = await db.update(t.timesheets).set(set).where(eq(t.timesheets.id, id)).returning();
    return rows[0] ? mapTimesheet(rows[0]) : undefined;
  }

  async getTimesheetEntriesByTimesheet(timesheetId: string): Promise<TimesheetEntry[]> {
    const rows = await db.select().from(t.timesheetEntries).where(eq(t.timesheetEntries.timesheetId, timesheetId));
    return rows.map(mapTimesheetEntry);
  }

  async createTimesheetEntry(data: InsertTimesheetEntry): Promise<TimesheetEntry> {
    const id = `tse-${randomUUID().slice(0, 8)}`;
    const row: TimesheetEntryRow = {
      id, timesheetId: data.timesheetId, date: data.date,
      jobsiteId: data.jobsiteId ?? null, hours: data.hours,
      description: data.description ?? null,
    };
    const rows = await db.insert(t.timesheetEntries).values(row).returning();
    const entry = mapTimesheetEntry(rows[0]);
    await this._recalcTotalHours(data.timesheetId);
    return entry;
  }

  async updateTimesheetEntry(id: string, updates: Partial<TimesheetEntry>): Promise<TimesheetEntry | undefined> {
    const set: Partial<TimesheetEntryRow> = {};
    if (updates.hours !== undefined) set.hours = updates.hours;
    if (updates.description !== undefined) set.description = updates.description ?? null;
    if (updates.jobsiteId !== undefined) set.jobsiteId = updates.jobsiteId ?? null;
    if (Object.keys(set).length === 0) return this.getTimesheetEntry(id);
    const rows = await db.update(t.timesheetEntries).set(set).where(eq(t.timesheetEntries.id, id)).returning();
    if (!rows[0]) return undefined;
    const entry = mapTimesheetEntry(rows[0]);
    await this._recalcTotalHours(entry.timesheetId);
    return entry;
  }

  async deleteTimesheetEntry(id: string): Promise<boolean> {
    const existing = await this.getTimesheetEntry(id);
    if (!existing) return false;
    await db.delete(t.timesheetEntries).where(eq(t.timesheetEntries.id, id));
    await this._recalcTotalHours(existing.timesheetId);
    return true;
  }

  private async _recalcTotalHours(timesheetId: string) {
    const entries = await this.getTimesheetEntriesByTimesheet(timesheetId);
    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
    const set: Partial<TimesheetRow> = { totalHours };
    await db.update(t.timesheets).set(set).where(eq(t.timesheets.id, timesheetId));
  }

  async getSafetyReportsByOrg(orgId: string): Promise<SafetyReport[]> {
    const rows = await db.select().from(t.safetyReports).where(eq(t.safetyReports.organizationId, orgId));
    return rows.map(mapSafetyReport);
  }

  async getSafetyReportsByClient(clientId: string): Promise<SafetyReport[]> {
    const rows = await db.select().from(t.safetyReports).where(eq(t.safetyReports.clientId, clientId));
    return rows.map(mapSafetyReport).sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  }

  async getSafetyReport(id: string): Promise<SafetyReport | undefined> {
    const rows = await db.select().from(t.safetyReports).where(eq(t.safetyReports.id, id));
    return rows[0] ? mapSafetyReport(rows[0]) : undefined;
  }

  async createSafetyReport(orgId: string, data: InsertSafetyReport): Promise<SafetyReport> {
    const settings = await this.getSafetySettings(orgId);
    const scores = calculateSafetyScores(data, settings);
    const id = `sr-${randomUUID().slice(0, 8)}`;
    const row: SafetyReportRow = {
      id, organizationId: orgId, clientId: data.clientId,
      periodType: data.periodType, periodStart: data.periodStart, periodEnd: data.periodEnd,
      totalManhours: data.totalManhours, totalHeadcount: data.totalHeadcount,
      projectRiskTier: data.projectRiskTier, newHirePercent: data.newHirePercent,
      recordableIncidents: data.recordableIncidents, dartCases: data.dartCases,
      lostTimeIncidents: data.lostTimeIncidents, emr: data.emr,
      oshaWillfulCitations: data.oshaWillfulCitations,
      oshaSeriousCitations: data.oshaSeriousCitations,
      oshaOtherCitations: data.oshaOtherCitations, openWcClaims: data.openWcClaims,
      inspectionsCompleted: data.inspectionsCompleted,
      inspectionsScheduled: data.inspectionsScheduled,
      correctiveActionsClosed: data.correctiveActionsClosed,
      correctiveActionsOpened: data.correctiveActionsOpened,
      avgCorrectiveActionDays: data.avgCorrectiveActionDays,
      nearMissReports: data.nearMissReports,
      toolboxTalksCompleted: data.toolboxTalksCompleted,
      toolboxTalksScheduled: data.toolboxTalksScheduled,
      certifiedWorkforcePercent: data.certifiedWorkforcePercent,
      jhaCompliancePercent: data.jhaCompliancePercent,
      permitCompliancePercent: data.permitCompliancePercent,
      topRiskAreas: data.topRiskAreas, recommendedActions: data.recommendedActions,
      photos: data.photos,
      createdAt: new Date().toISOString(),
      ...scores,
    };
    const rows = await db.insert(t.safetyReports).values(row).returning();
    return mapSafetyReport(rows[0]);
  }

  async getSafetySettings(orgId: string): Promise<SafetyReportSettings> {
    const rows = await db.select().from(t.safetyReportSettings).where(eq(t.safetyReportSettings.organizationId, orgId));
    if (rows[0]) return mapSafetySettings(rows[0]);
    return {
      organizationId: orgId,
      incidentHistoryWeight: 35,
      trainingComplianceWeight: 20,
      hazardManagementWeight: 20,
      permitPreTaskWeight: 15,
      reportingCultureWeight: 10,
    };
  }

  async updateSafetySettings(orgId: string, data: UpdateSafetySettings): Promise<SafetyReportSettings> {
    const existing = await db.select().from(t.safetyReportSettings).where(eq(t.safetyReportSettings.organizationId, orgId));
    const row: SafetySettingsRow = { organizationId: orgId, ...data };
    if (existing.length > 0) {
      const rows = await db.update(t.safetyReportSettings).set(row).where(eq(t.safetyReportSettings.organizationId, orgId)).returning();
      return mapSafetySettings(rows[0]);
    }
    const rows = await db.insert(t.safetyReportSettings).values(row).returning();
    return mapSafetySettings(rows[0]);
  }
}

export const storage = new DatabaseStorage();
