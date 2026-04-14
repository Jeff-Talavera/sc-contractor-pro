import type {
  Organization, User, Client, Jobsite, CodeReference,
  InspectionTemplate, Inspection, Observation,
  JobsitePermit, JobsiteExternalEvent,
  EmployeeProfile, ScheduleEntry, Timesheet, TimesheetEntry,
  SafetyReport, SafetyReportSettings,
  InsertClient, InsertJobsite, InsertInspection, InsertObservation,
  InsertEmployeeProfile, InsertScheduleEntry, InsertTimesheet, InsertTimesheetEntry,
  InsertSafetyReport, UpdateSafetySettings, UpdateOrganization,
  UpdateInspectionReport
} from "@shared/schema";
import { randomUUID } from "crypto";
import {
  mockOrganizations, mockUsers, currentUser as mockCurrentUser,
  mockClients, mockJobsites, mockCodeReferences,
  mockInspectionTemplates, mockInspections, mockObservations,
  mockPermits, mockExternalEvents,
  mockEmployeeProfiles, mockScheduleEntries, mockTimesheets, mockTimesheetEntries,
  mockSafetyReports, mockSafetyReportSettings
} from "./mockData";

// ─── Scoring logic ────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function safeDivide(numerator: number, denominator: number, fallback = 1): number {
  return denominator > 0 ? numerator / denominator : fallback;
}

export function calculateSafetyScores(data: InsertSafetyReport, settings: SafetyReportSettings) {
  const mh = Math.max(data.totalManhours, 1);
  const hc = Math.max(data.totalHeadcount, 1);

  // ── Incident History (lagging) ────────────────────────────────────────────
  const trir = (data.recordableIncidents / mh) * 200000;
  const trirScore = clamp(100 - trir * 25, 0, 100);

  const dart = (data.dartCases / mh) * 200000;
  const dartScore = clamp(100 - dart * 33, 0, 100);

  const ltir = (data.lostTimeIncidents / mh) * 200000;
  const ltirScore = clamp(100 - ltir * 50, 0, 100);

  const emrScore = data.emr > 0
    ? clamp((1.5 - data.emr) / 0.7 * 100, 0, 100)
    : 80; // neutral if not entered

  const citationScore = clamp(
    100 - data.oshaWillfulCitations * 40 - data.oshaSeriousCitations * 15 - data.oshaOtherCitations * 5,
    0, 100
  );

  const wcScore = clamp(100 - data.openWcClaims * 15, 0, 100);

  const incidentHistoryScore = Math.round(
    (trirScore + dartScore + ltirScore + emrScore + citationScore + wcScore) / 6
  );

  // ── Training Compliance (leading) ─────────────────────────────────────────
  const certScore = data.certifiedWorkforcePercent;
  const toolboxScore = data.toolboxTalksScheduled > 0
    ? clamp(safeDivide(data.toolboxTalksCompleted, data.toolboxTalksScheduled) * 100, 0, 100)
    : 100;
  const trainingComplianceScore = Math.round((certScore + toolboxScore) / 2);

  // ── Hazard Management (leading) ───────────────────────────────────────────
  const inspectionRatioScore = data.inspectionsScheduled > 0
    ? clamp(safeDivide(data.inspectionsCompleted, data.inspectionsScheduled) * 100, 0, 100)
    : 100;
  const caClosureScore = data.correctiveActionsOpened > 0
    ? clamp(safeDivide(data.correctiveActionsClosed, data.correctiveActionsOpened) * 100, 0, 100)
    : 100;
  const caTimeScore = clamp(100 - (data.avgCorrectiveActionDays / 30) * 100, 0, 100);
  const hazardManagementScore = Math.round((inspectionRatioScore + caClosureScore + caTimeScore) / 3);

  // ── Permit & Pre-Task (leading) ───────────────────────────────────────────
  const permitPreTaskScore = Math.round((data.jhaCompliancePercent + data.permitCompliancePercent) / 2);

  // ── Reporting Culture (leading) ───────────────────────────────────────────
  const nearMissRate = (data.nearMissReports / hc) * 100;
  const reportingCultureScore = Math.round(clamp(30 + (Math.min(nearMissRate, 3) / 3) * 70, 0, 100));

  // ── Overall ───────────────────────────────────────────────────────────────
  const total = settings.incidentHistoryWeight + settings.trainingComplianceWeight +
    settings.hazardManagementWeight + settings.permitPreTaskWeight + settings.reportingCultureWeight;
  const safeTotal = total > 0 ? total : 100;

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

// ─── IStorage interface ───────────────────────────────────────────────────────

export interface IStorage {
  getCurrentUser(): User;
  getOrganization(id: string): Organization | undefined;
  updateOrganization(id: string, data: UpdateOrganization): Organization | undefined;
  getUsersByOrg(orgId: string): User[];
  getUser(id: string): User | undefined;

  getClientsByOrg(orgId: string): Client[];
  getClient(id: string): Client | undefined;
  getSubcontractors(parentClientId: string): Client[];
  createClient(orgId: string, data: InsertClient): Client;

  getJobsitesByOrg(orgId: string): Jobsite[];
  getJobsitesByClient(clientId: string): Jobsite[];
  getJobsite(id: string): Jobsite | undefined;
  createJobsite(orgId: string, data: InsertJobsite): Jobsite;
  updateJobsite(id: string, updates: Partial<Jobsite>): Jobsite | undefined;

  getCodeReferences(): CodeReference[];
  getCodeReference(id: string): CodeReference | undefined;

  getTemplatesByOrg(orgId: string): InspectionTemplate[];
  getTemplate(id: string): InspectionTemplate | undefined;

  getInspectionsByOrg(orgId: string): Inspection[];
  getInspectionsByJobsite(jobsiteId: string): Inspection[];
  getInspection(id: string): Inspection | undefined;
  createInspection(orgId: string, inspectorUserId: string, data: InsertInspection): Inspection;
  updateInspectionStatus(id: string, status: "Draft" | "Submitted"): Inspection | undefined;
  updateInspection(id: string, updates: UpdateInspectionReport): Inspection | undefined;

  getObservationsByInspection(inspectionId: string): Observation[];
  getObservationsByOrg(orgId: string): Observation[];
  getObservation(id: string): Observation | undefined;
  createObservation(orgId: string, userId: string, data: InsertObservation): Observation;
  updateObservation(id: string, updates: Partial<Observation>): Observation | undefined;

  getPermitsByJobsite(jobsiteId: string): JobsitePermit[];
  getExternalEventsByJobsite(jobsiteId: string): JobsiteExternalEvent[];

  getEmployeeProfilesByOrg(orgId: string): EmployeeProfile[];
  getEmployeeProfile(id: string): EmployeeProfile | undefined;
  createEmployeeProfile(orgId: string, data: InsertEmployeeProfile): EmployeeProfile;
  updateEmployeeProfile(id: string, updates: Partial<EmployeeProfile>): EmployeeProfile | undefined;

  getScheduleEntry(id: string): ScheduleEntry | undefined;
  getScheduleEntriesByOrg(orgId: string): ScheduleEntry[];
  getScheduleEntriesByEmployee(employeeId: string): ScheduleEntry[];
  getScheduleEntriesByDateRange(orgId: string, startDate: string, endDate: string): ScheduleEntry[];
  createScheduleEntry(orgId: string, data: InsertScheduleEntry): ScheduleEntry;
  updateScheduleEntry(id: string, updates: Partial<ScheduleEntry>): ScheduleEntry | undefined;
  deleteScheduleEntry(id: string): boolean;

  getTimesheetsByOrg(orgId: string): Timesheet[];
  getTimesheetsByEmployee(employeeId: string): Timesheet[];
  getTimesheet(id: string): Timesheet | undefined;
  getTimesheetEntry(id: string): TimesheetEntry | undefined;
  createTimesheet(orgId: string, data: InsertTimesheet): Timesheet;
  updateTimesheet(id: string, updates: Partial<Timesheet>): Timesheet | undefined;

  getTimesheetEntriesByTimesheet(timesheetId: string): TimesheetEntry[];
  createTimesheetEntry(data: InsertTimesheetEntry): TimesheetEntry;
  updateTimesheetEntry(id: string, updates: Partial<TimesheetEntry>): TimesheetEntry | undefined;
  deleteTimesheetEntry(id: string): boolean;

  getSafetyReportsByOrg(orgId: string): SafetyReport[];
  getSafetyReportsByClient(clientId: string): SafetyReport[];
  getSafetyReport(id: string): SafetyReport | undefined;
  createSafetyReport(orgId: string, data: InsertSafetyReport): SafetyReport;

  getSafetySettings(orgId: string): SafetyReportSettings;
  updateSafetySettings(orgId: string, data: UpdateSafetySettings): SafetyReportSettings;
}

// ─── MemStorage implementation ────────────────────────────────────────────────

export class MemStorage implements IStorage {
  private organizations: Map<string, Organization>;
  private users: Map<string, User>;
  private clients: Map<string, Client>;
  private jobsites: Map<string, Jobsite>;
  private codeReferences: Map<string, CodeReference>;
  private templates: Map<string, InspectionTemplate>;
  private inspections: Map<string, Inspection>;
  private observations: Map<string, Observation>;
  private permits: Map<string, JobsitePermit>;
  private externalEvents: Map<string, JobsiteExternalEvent>;
  private employeeProfiles: Map<string, EmployeeProfile>;
  private scheduleEntries: Map<string, ScheduleEntry>;
  private timesheets: Map<string, Timesheet>;
  private timesheetEntries: Map<string, TimesheetEntry>;
  private safetyReports: Map<string, SafetyReport>;
  private safetySettings: Map<string, SafetyReportSettings>;

  constructor() {
    this.organizations = new Map(mockOrganizations.map(o => [o.id, o]));
    this.users = new Map(mockUsers.map(u => [u.id, u]));
    this.clients = new Map(mockClients.map(c => [c.id, c]));
    this.jobsites = new Map(mockJobsites.map(j => [j.id, j]));
    this.codeReferences = new Map(mockCodeReferences.map(cr => [cr.id, cr]));
    this.templates = new Map(mockInspectionTemplates.map(t => [t.id, t]));
    this.inspections = new Map(mockInspections.map(i => [i.id, i]));
    this.observations = new Map(mockObservations.map(o => [o.id, o]));
    this.permits = new Map(mockPermits.map(p => [p.id, p]));
    this.externalEvents = new Map(mockExternalEvents.map(e => [e.id, e]));
    this.employeeProfiles = new Map(mockEmployeeProfiles.map(ep => [ep.id, ep]));
    this.scheduleEntries = new Map(mockScheduleEntries.map(se => [se.id, se]));
    this.timesheets = new Map(mockTimesheets.map(ts => [ts.id, ts]));
    this.timesheetEntries = new Map(mockTimesheetEntries.map(te => [te.id, te]));
    this.safetyReports = new Map(mockSafetyReports.map(r => [r.id, r]));
    this.safetySettings = new Map(mockSafetyReportSettings.map(s => [s.organizationId, s]));
  }

  getCurrentUser(): User { return mockCurrentUser; }
  getOrganization(id: string): Organization | undefined { return this.organizations.get(id); }
  updateOrganization(id: string, data: UpdateOrganization): Organization | undefined {
    const org = this.organizations.get(id);
    if (!org) return undefined;
    if (data.logoUrl !== undefined) org.logoUrl = data.logoUrl;
    return org;
  }
  getUsersByOrg(orgId: string): User[] { return Array.from(this.users.values()).filter(u => u.organizationId === orgId); }
  getUser(id: string): User | undefined { return this.users.get(id); }

  getClientsByOrg(orgId: string): Client[] { return Array.from(this.clients.values()).filter(c => c.organizationId === orgId); }
  getClient(id: string): Client | undefined { return this.clients.get(id); }
  getSubcontractors(parentClientId: string): Client[] { return Array.from(this.clients.values()).filter(c => c.parentClientId === parentClientId); }

  createClient(orgId: string, data: InsertClient): Client {
    const client: Client = { id: `client-${randomUUID().slice(0, 8)}`, organizationId: orgId, ...data };
    this.clients.set(client.id, client);
    return client;
  }

  getJobsitesByOrg(orgId: string): Jobsite[] { return Array.from(this.jobsites.values()).filter(j => j.organizationId === orgId); }
  getJobsitesByClient(clientId: string): Jobsite[] { return Array.from(this.jobsites.values()).filter(j => j.clientId === clientId); }
  getJobsite(id: string): Jobsite | undefined { return this.jobsites.get(id); }

  createJobsite(orgId: string, data: InsertJobsite): Jobsite {
    const jobsite: Jobsite = { id: `job-${randomUUID().slice(0, 8)}`, organizationId: orgId, ...data };
    this.jobsites.set(jobsite.id, jobsite);
    return jobsite;
  }

  updateJobsite(id: string, updates: Partial<Jobsite>): Jobsite | undefined {
    const jobsite = this.jobsites.get(id);
    if (!jobsite) return undefined;
    Object.assign(jobsite, updates);
    return jobsite;
  }

  getCodeReferences(): CodeReference[] { return Array.from(this.codeReferences.values()); }
  getCodeReference(id: string): CodeReference | undefined { return this.codeReferences.get(id); }

  getTemplatesByOrg(orgId: string): InspectionTemplate[] { return Array.from(this.templates.values()).filter(t => t.organizationId === orgId); }
  getTemplate(id: string): InspectionTemplate | undefined { return this.templates.get(id); }

  getInspectionsByOrg(orgId: string): Inspection[] { return Array.from(this.inspections.values()).filter(i => i.organizationId === orgId); }
  getInspectionsByJobsite(jobsiteId: string): Inspection[] { return Array.from(this.inspections.values()).filter(i => i.jobsiteId === jobsiteId); }
  getInspection(id: string): Inspection | undefined { return this.inspections.get(id); }

  createInspection(orgId: string, inspectorUserId: string, data: InsertInspection): Inspection {
    const inspection: Inspection = { id: `insp-${randomUUID().slice(0, 8)}`, organizationId: orgId, inspectorUserId, status: "Draft", ...data };
    this.inspections.set(inspection.id, inspection);
    return inspection;
  }

  updateInspectionStatus(id: string, status: "Draft" | "Submitted"): Inspection | undefined {
    const insp = this.inspections.get(id);
    if (!insp) return undefined;
    insp.status = status;
    return insp;
  }

  updateInspection(id: string, updates: UpdateInspectionReport): Inspection | undefined {
    const insp = this.inspections.get(id);
    if (!insp) return undefined;
    if (updates.scopeOfWork !== undefined) insp.scopeOfWork = updates.scopeOfWork;
    if (updates.ccList !== undefined) insp.ccList = updates.ccList;
    if (updates.recipientName !== undefined) insp.recipientName = updates.recipientName;
    if (updates.recipientTitle !== undefined) insp.recipientTitle = updates.recipientTitle;
    if (updates.recipientCompany !== undefined) insp.recipientCompany = updates.recipientCompany;
    if (updates.recipientAddress !== undefined) insp.recipientAddress = updates.recipientAddress;
    return insp;
  }

  getObservationsByInspection(inspectionId: string): Observation[] { return Array.from(this.observations.values()).filter(o => o.inspectionId === inspectionId); }
  getObservationsByOrg(orgId: string): Observation[] { return Array.from(this.observations.values()).filter(o => o.organizationId === orgId); }
  getObservation(id: string): Observation | undefined { return this.observations.get(id); }

  createObservation(orgId: string, userId: string, data: InsertObservation): Observation {
    const observation: Observation = { id: `obs-${randomUUID().slice(0, 8)}`, organizationId: orgId, createdByUserId: userId, createdAt: new Date().toISOString(), ...data };
    this.observations.set(observation.id, observation);
    return observation;
  }

  updateObservation(id: string, updates: Partial<Observation>): Observation | undefined {
    const obs = this.observations.get(id);
    if (!obs) return undefined;
    Object.assign(obs, updates);
    return obs;
  }

  getPermitsByJobsite(jobsiteId: string): JobsitePermit[] { return Array.from(this.permits.values()).filter(p => p.jobsiteId === jobsiteId); }
  getExternalEventsByJobsite(jobsiteId: string): JobsiteExternalEvent[] { return Array.from(this.externalEvents.values()).filter(e => e.jobsiteId === jobsiteId); }

  getEmployeeProfilesByOrg(orgId: string): EmployeeProfile[] { return Array.from(this.employeeProfiles.values()).filter(ep => ep.organizationId === orgId); }
  getEmployeeProfile(id: string): EmployeeProfile | undefined { return this.employeeProfiles.get(id); }

  createEmployeeProfile(orgId: string, data: InsertEmployeeProfile): EmployeeProfile {
    const profile: EmployeeProfile = { id: `emp-${randomUUID().slice(0, 8)}`, organizationId: orgId, ...data };
    this.employeeProfiles.set(profile.id, profile);
    return profile;
  }

  updateEmployeeProfile(id: string, updates: Partial<EmployeeProfile>): EmployeeProfile | undefined {
    const profile = this.employeeProfiles.get(id);
    if (!profile) return undefined;
    Object.assign(profile, updates);
    return profile;
  }

  getScheduleEntry(id: string): ScheduleEntry | undefined { return this.scheduleEntries.get(id); }
  getScheduleEntriesByOrg(orgId: string): ScheduleEntry[] { return Array.from(this.scheduleEntries.values()).filter(se => se.organizationId === orgId); }
  getScheduleEntriesByEmployee(employeeId: string): ScheduleEntry[] { return Array.from(this.scheduleEntries.values()).filter(se => se.employeeId === employeeId); }
  getScheduleEntriesByDateRange(orgId: string, startDate: string, endDate: string): ScheduleEntry[] {
    return Array.from(this.scheduleEntries.values()).filter(se => se.organizationId === orgId && se.date >= startDate && se.date <= endDate);
  }

  createScheduleEntry(orgId: string, data: InsertScheduleEntry): ScheduleEntry {
    const entry: ScheduleEntry = { id: `sched-${randomUUID().slice(0, 8)}`, organizationId: orgId, ...data };
    this.scheduleEntries.set(entry.id, entry);
    return entry;
  }

  updateScheduleEntry(id: string, updates: Partial<ScheduleEntry>): ScheduleEntry | undefined {
    const entry = this.scheduleEntries.get(id);
    if (!entry) return undefined;
    Object.assign(entry, updates);
    return entry;
  }

  deleteScheduleEntry(id: string): boolean { return this.scheduleEntries.delete(id); }

  getTimesheetsByOrg(orgId: string): Timesheet[] { return Array.from(this.timesheets.values()).filter(ts => ts.organizationId === orgId); }
  getTimesheetsByEmployee(employeeId: string): Timesheet[] { return Array.from(this.timesheets.values()).filter(ts => ts.employeeId === employeeId); }
  getTimesheet(id: string): Timesheet | undefined { return this.timesheets.get(id); }

  createTimesheet(orgId: string, data: InsertTimesheet): Timesheet {
    const timesheet: Timesheet = { id: `ts-${randomUUID().slice(0, 8)}`, organizationId: orgId, status: "Draft", totalHours: 0, ...data };
    this.timesheets.set(timesheet.id, timesheet);
    return timesheet;
  }

  updateTimesheet(id: string, updates: Partial<Timesheet>): Timesheet | undefined {
    const ts = this.timesheets.get(id);
    if (!ts) return undefined;
    Object.assign(ts, updates);
    return ts;
  }

  getTimesheetEntry(id: string): TimesheetEntry | undefined { return this.timesheetEntries.get(id); }

  getTimesheetEntriesByTimesheet(timesheetId: string): TimesheetEntry[] {
    return Array.from(this.timesheetEntries.values()).filter(te => te.timesheetId === timesheetId);
  }

  createTimesheetEntry(data: InsertTimesheetEntry): TimesheetEntry {
    const entry: TimesheetEntry = { id: `tse-${randomUUID().slice(0, 8)}`, ...data };
    this.timesheetEntries.set(entry.id, entry);
    const ts = this.timesheets.get(data.timesheetId);
    if (ts) {
      const allEntries = this.getTimesheetEntriesByTimesheet(data.timesheetId);
      ts.totalHours = allEntries.reduce((sum, e) => sum + e.hours, 0);
    }
    return entry;
  }

  updateTimesheetEntry(id: string, updates: Partial<TimesheetEntry>): TimesheetEntry | undefined {
    const entry = this.timesheetEntries.get(id);
    if (!entry) return undefined;
    Object.assign(entry, updates);
    const ts = this.timesheets.get(entry.timesheetId);
    if (ts) {
      const allEntries = this.getTimesheetEntriesByTimesheet(entry.timesheetId);
      ts.totalHours = allEntries.reduce((sum, e) => sum + e.hours, 0);
    }
    return entry;
  }

  deleteTimesheetEntry(id: string): boolean {
    const entry = this.timesheetEntries.get(id);
    if (!entry) return false;
    this.timesheetEntries.delete(id);
    const ts = this.timesheets.get(entry.timesheetId);
    if (ts) {
      const allEntries = this.getTimesheetEntriesByTimesheet(entry.timesheetId);
      ts.totalHours = allEntries.reduce((sum, e) => sum + e.hours, 0);
    }
    return true;
  }

  // ─── Safety Reports ─────────────────────────────────────────────────────────

  getSafetyReportsByOrg(orgId: string): SafetyReport[] {
    return Array.from(this.safetyReports.values()).filter(r => r.organizationId === orgId);
  }

  getSafetyReportsByClient(clientId: string): SafetyReport[] {
    return Array.from(this.safetyReports.values())
      .filter(r => r.clientId === clientId)
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  }

  getSafetyReport(id: string): SafetyReport | undefined {
    return this.safetyReports.get(id);
  }

  createSafetyReport(orgId: string, data: InsertSafetyReport): SafetyReport {
    const settings = this.getSafetySettings(orgId);
    const scores = calculateSafetyScores(data, settings);
    const report: SafetyReport = {
      id: `sr-${randomUUID().slice(0, 8)}`,
      organizationId: orgId,
      createdAt: new Date().toISOString(),
      ...data,
      ...scores,
    };
    this.safetyReports.set(report.id, report);
    return report;
  }

  getSafetySettings(orgId: string): SafetyReportSettings {
    return this.safetySettings.get(orgId) ?? {
      organizationId: orgId,
      incidentHistoryWeight: 35,
      trainingComplianceWeight: 20,
      hazardManagementWeight: 20,
      permitPreTaskWeight: 15,
      reportingCultureWeight: 10,
    };
  }

  updateSafetySettings(orgId: string, data: UpdateSafetySettings): SafetyReportSettings {
    const settings: SafetyReportSettings = { organizationId: orgId, ...data };
    this.safetySettings.set(orgId, settings);
    return settings;
  }
}

export const storage = new MemStorage();
