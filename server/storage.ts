import type {
  Organization, User, Client, Jobsite, CodeReference,
  InspectionTemplate, Inspection, Observation,
  InsertClient, InsertJobsite, InsertInspection, InsertObservation
} from "@shared/schema";
import { randomUUID } from "crypto";
import {
  mockOrganizations, mockUsers, currentUser as mockCurrentUser,
  mockClients, mockJobsites, mockCodeReferences,
  mockInspectionTemplates, mockInspections, mockObservations
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

  constructor() {
    this.organizations = new Map(mockOrganizations.map(o => [o.id, o]));
    this.users = new Map(mockUsers.map(u => [u.id, u]));
    this.clients = new Map(mockClients.map(c => [c.id, c]));
    this.jobsites = new Map(mockJobsites.map(j => [j.id, j]));
    this.codeReferences = new Map(mockCodeReferences.map(cr => [cr.id, cr]));
    this.templates = new Map(mockInspectionTemplates.map(t => [t.id, t]));
    this.inspections = new Map(mockInspections.map(i => [i.id, i]));
    this.observations = new Map(mockObservations.map(o => [o.id, o]));
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
}

export const storage = new MemStorage();
