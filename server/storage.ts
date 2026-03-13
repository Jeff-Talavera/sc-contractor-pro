import type {
  Organization, User, Client, Jobsite, CodeReference,
  InspectionTemplate, Inspection, Observation,
  JobsitePermit, JobsiteExternalEvent,
  EmployeeProfile, ScheduleEntry, Timesheet, TimesheetEntry,
  InsertClient, InsertJobsite, InsertInspection, InsertObservation,
  InsertEmployeeProfile, InsertScheduleEntry, InsertTimesheet, InsertTimesheetEntry
} from "@shared/schema";
import { randomUUID } from "crypto";
import {
  mockOrganizations, mockUsers, currentUser as mockCurrentUser,
  mockClients, mockJobsites, mockCodeReferences,
  mockInspectionTemplates, mockInspections, mockObservations,
  mockPermits, mockExternalEvents,
  mockEmployeeProfiles, mockScheduleEntries, mockTimesheets, mockTimesheetEntries
} from "./mockData";

export interface IStorage {
  getCurrentUser(): User;
  getOrganization(id: string): Organization | undefined;
  getUsersByOrg(orgId: string): User[];
  getUser(id: string): User | undefined;

  getClientsByOrg(orgId: string): Client[];
  getClient(id: string): Client | undefined;
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
}

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
  }

  getCurrentUser(): User {
    return mockCurrentUser;
  }

  getOrganization(id: string): Organization | undefined {
    return this.organizations.get(id);
  }

  getUsersByOrg(orgId: string): User[] {
    return Array.from(this.users.values()).filter(u => u.organizationId === orgId);
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  getClientsByOrg(orgId: string): Client[] {
    return Array.from(this.clients.values()).filter(c => c.organizationId === orgId);
  }

  getClient(id: string): Client | undefined {
    return this.clients.get(id);
  }

  createClient(orgId: string, data: InsertClient): Client {
    const client: Client = { id: `client-${randomUUID().slice(0, 8)}`, organizationId: orgId, ...data };
    this.clients.set(client.id, client);
    return client;
  }

  getJobsitesByOrg(orgId: string): Jobsite[] {
    return Array.from(this.jobsites.values()).filter(j => j.organizationId === orgId);
  }

  getJobsitesByClient(clientId: string): Jobsite[] {
    return Array.from(this.jobsites.values()).filter(j => j.clientId === clientId);
  }

  getJobsite(id: string): Jobsite | undefined {
    return this.jobsites.get(id);
  }

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

  getCodeReferences(): CodeReference[] {
    return Array.from(this.codeReferences.values());
  }

  getCodeReference(id: string): CodeReference | undefined {
    return this.codeReferences.get(id);
  }

  getTemplatesByOrg(orgId: string): InspectionTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.organizationId === orgId);
  }

  getTemplate(id: string): InspectionTemplate | undefined {
    return this.templates.get(id);
  }

  getInspectionsByOrg(orgId: string): Inspection[] {
    return Array.from(this.inspections.values()).filter(i => i.organizationId === orgId);
  }

  getInspectionsByJobsite(jobsiteId: string): Inspection[] {
    return Array.from(this.inspections.values()).filter(i => i.jobsiteId === jobsiteId);
  }

  getInspection(id: string): Inspection | undefined {
    return this.inspections.get(id);
  }

  createInspection(orgId: string, inspectorUserId: string, data: InsertInspection): Inspection {
    const inspection: Inspection = {
      id: `insp-${randomUUID().slice(0, 8)}`,
      organizationId: orgId,
      inspectorUserId,
      status: "Draft",
      ...data,
    };
    this.inspections.set(inspection.id, inspection);
    return inspection;
  }

  updateInspectionStatus(id: string, status: "Draft" | "Submitted"): Inspection | undefined {
    const insp = this.inspections.get(id);
    if (!insp) return undefined;
    insp.status = status;
    return insp;
  }

  getObservationsByInspection(inspectionId: string): Observation[] {
    return Array.from(this.observations.values()).filter(o => o.inspectionId === inspectionId);
  }

  getObservationsByOrg(orgId: string): Observation[] {
    return Array.from(this.observations.values()).filter(o => o.organizationId === orgId);
  }

  getObservation(id: string): Observation | undefined {
    return this.observations.get(id);
  }

  createObservation(orgId: string, userId: string, data: InsertObservation): Observation {
    const observation: Observation = {
      id: `obs-${randomUUID().slice(0, 8)}`,
      organizationId: orgId,
      createdByUserId: userId,
      createdAt: new Date().toISOString(),
      ...data,
    };
    this.observations.set(observation.id, observation);
    return observation;
  }

  updateObservation(id: string, updates: Partial<Observation>): Observation | undefined {
    const obs = this.observations.get(id);
    if (!obs) return undefined;
    Object.assign(obs, updates);
    return obs;
  }

  getPermitsByJobsite(jobsiteId: string): JobsitePermit[] {
    return Array.from(this.permits.values()).filter(p => p.jobsiteId === jobsiteId);
  }

  getExternalEventsByJobsite(jobsiteId: string): JobsiteExternalEvent[] {
    return Array.from(this.externalEvents.values()).filter(e => e.jobsiteId === jobsiteId);
  }

  getEmployeeProfilesByOrg(orgId: string): EmployeeProfile[] {
    return Array.from(this.employeeProfiles.values()).filter(ep => ep.organizationId === orgId);
  }

  getEmployeeProfile(id: string): EmployeeProfile | undefined {
    return this.employeeProfiles.get(id);
  }

  createEmployeeProfile(orgId: string, data: InsertEmployeeProfile): EmployeeProfile {
    const profile: EmployeeProfile = {
      id: `emp-${randomUUID().slice(0, 8)}`,
      organizationId: orgId,
      ...data,
    };
    this.employeeProfiles.set(profile.id, profile);
    return profile;
  }

  updateEmployeeProfile(id: string, updates: Partial<EmployeeProfile>): EmployeeProfile | undefined {
    const profile = this.employeeProfiles.get(id);
    if (!profile) return undefined;
    Object.assign(profile, updates);
    return profile;
  }

  getScheduleEntry(id: string): ScheduleEntry | undefined {
    return this.scheduleEntries.get(id);
  }

  getScheduleEntriesByOrg(orgId: string): ScheduleEntry[] {
    return Array.from(this.scheduleEntries.values()).filter(se => se.organizationId === orgId);
  }

  getScheduleEntriesByEmployee(employeeId: string): ScheduleEntry[] {
    return Array.from(this.scheduleEntries.values()).filter(se => se.employeeId === employeeId);
  }

  getScheduleEntriesByDateRange(orgId: string, startDate: string, endDate: string): ScheduleEntry[] {
    return Array.from(this.scheduleEntries.values()).filter(se =>
      se.organizationId === orgId && se.date >= startDate && se.date <= endDate
    );
  }

  createScheduleEntry(orgId: string, data: InsertScheduleEntry): ScheduleEntry {
    const entry: ScheduleEntry = {
      id: `sched-${randomUUID().slice(0, 8)}`,
      organizationId: orgId,
      ...data,
    };
    this.scheduleEntries.set(entry.id, entry);
    return entry;
  }

  updateScheduleEntry(id: string, updates: Partial<ScheduleEntry>): ScheduleEntry | undefined {
    const entry = this.scheduleEntries.get(id);
    if (!entry) return undefined;
    Object.assign(entry, updates);
    return entry;
  }

  deleteScheduleEntry(id: string): boolean {
    return this.scheduleEntries.delete(id);
  }

  getTimesheetsByOrg(orgId: string): Timesheet[] {
    return Array.from(this.timesheets.values()).filter(ts => ts.organizationId === orgId);
  }

  getTimesheetsByEmployee(employeeId: string): Timesheet[] {
    return Array.from(this.timesheets.values()).filter(ts => ts.employeeId === employeeId);
  }

  getTimesheet(id: string): Timesheet | undefined {
    return this.timesheets.get(id);
  }

  createTimesheet(orgId: string, data: InsertTimesheet): Timesheet {
    const timesheet: Timesheet = {
      id: `ts-${randomUUID().slice(0, 8)}`,
      organizationId: orgId,
      status: "Draft",
      totalHours: 0,
      ...data,
    };
    this.timesheets.set(timesheet.id, timesheet);
    return timesheet;
  }

  updateTimesheet(id: string, updates: Partial<Timesheet>): Timesheet | undefined {
    const ts = this.timesheets.get(id);
    if (!ts) return undefined;
    Object.assign(ts, updates);
    return ts;
  }

  getTimesheetEntry(id: string): TimesheetEntry | undefined {
    return this.timesheetEntries.get(id);
  }

  getTimesheetEntriesByTimesheet(timesheetId: string): TimesheetEntry[] {
    return Array.from(this.timesheetEntries.values()).filter(te => te.timesheetId === timesheetId);
  }

  createTimesheetEntry(data: InsertTimesheetEntry): TimesheetEntry {
    const entry: TimesheetEntry = {
      id: `tse-${randomUUID().slice(0, 8)}`,
      ...data,
    };
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
}

export const storage = new MemStorage();
