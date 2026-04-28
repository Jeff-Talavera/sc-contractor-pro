import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { z } from "zod";
import {
  insertClientSchema, insertJobsiteSchema, insertInspectionSchema, insertObservationSchema,
  insertEmployeeProfileSchema, insertScheduleEntrySchema, insertTimesheetSchema, insertTimesheetEntrySchema,
  updateInspectionReportSchema, insertSafetyReportSchema, updateSafetySettingsSchema, updateOrganizationSchema,
  insertIndependentContractorSchema, insertContractorAssignmentSchema,
  insertTradeCompanySchema, insertJobsiteTradeAssignmentSchema,
  insertContactSchema, insertContactAssociationSchema,
  insertContractorCompanySchema, updateContractorCompanySchema
} from "@shared/schema";
import type { AiFinding, User, EmployeeProfile, ScheduleEntry, Timesheet, TimesheetEntry } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const user = await storage.getCurrentUser(req.session.userId);
    if (user.userStatus === "inactive") {
      req.session.destroy(() => {});
      return res.status(403).json({ message: "Your account has been deactivated" });
    }
    if (!user.isSuperAdmin) {
      const org = await storage.getOrganization(user.organizationId);
      if (org?.status === "suspended") {
        req.session.destroy(() => {});
        return res.status(403).json({ message: "Your organization account has been suspended" });
      }
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ─── Public auth routes ─────────────────────────────────────────────────────

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const userWithHash = await storage.getUserByEmail(email);
    if (!userWithHash) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!userWithHash.passwordHash) {
      return res.status(401).json({ message: "Account not configured — contact your administrator" });
    }
    const valid = await bcrypt.compare(password, userWithHash.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (userWithHash.userStatus === "inactive") {
      return res.status(403).json({ message: "Your account has been deactivated. Contact your administrator." });
    }
    // Check org suspension (skip for super admins)
    if (!userWithHash.isSuperAdmin) {
      const org = await storage.getOrganization(userWithHash.organizationId);
      if (org?.status === "suspended") {
        return res.status(403).json({ message: "Your firm's account has been suspended. Contact SafeSite support." });
      }
    }
    req.session.userId = userWithHash.id;
    const { passwordHash: _ignored, ...safeUser } = userWithHash;
    res.json({ user: safeUser });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // ─── Global auth guard for all remaining /api/* routes ─────────────────────

  app.use("/api", requireAuth);

  // ─── Current user ───────────────────────────────────────────────────────────

  app.get("/api/me", async (req, res) => {
    try {
      const org = await storage.getOrganization(req.user!.organizationId);
      res.json({ user: req.user, organization: org });
    } catch {
      res.status(500).json({ message: "Failed to load current user" });
    }
  });

  // ─── Organization ───────────────────────────────────────────────────────────

  app.put("/api/organization", async (req, res) => {
    if (req.user!.role !== "Owner" && req.user!.role !== "Admin") {
      return res.status(403).json({ message: "Admin or Owner role required" });
    }
    const parsed = updateOrganizationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateOrganization(req.user!.organizationId, parsed.data);
    if (!updated) return res.status(404).json({ message: "Organization not found" });
    res.json(updated);
  });

  // ─── Users ──────────────────────────────────────────────────────────────────

  app.get("/api/users", async (req, res) => {
    res.json(await storage.getUsersByOrg(req.user!.organizationId));
  });

  // ─── Clients ────────────────────────────────────────────────────────────────

  app.get("/api/clients", async (req, res) => {
    const all = await storage.getClientsByOrg(req.user!.organizationId);
    const { parentClientId } = req.query;
    if (typeof parentClientId === "string") {
      res.json(all.filter(c => c.parentClientId === parentClientId));
    } else {
      res.json(all);
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    const client = await storage.getClient(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    if (client.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(client);
  });

  app.get("/api/clients/:id/subcontractors", async (req, res) => {
    const parent = await storage.getClient(req.params.id);
    if (!parent) return res.status(404).json({ message: "Client not found" });
    if (parent.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getSubcontractors(req.params.id));
  });

  app.post("/api/clients", async (req, res) => {
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    if (parsed.data.parentClientId) {
      const parent = await storage.getClient(parsed.data.parentClientId);
      if (!parent) return res.status(400).json({ message: "Parent client not found" });
      if (parent.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
      if (parent.parentClientId) return res.status(400).json({ message: "Cannot assign a subcontractor as a parent (nesting limited to one level)" });
    }
    const client = await storage.createClient(req.user!.organizationId, parsed.data);
    res.status(201).json(client);
  });

  // ─── Jobsites ────────────────────────────────────────────────────────────────

  app.get("/api/jobsites", async (req, res) => {
    res.json(await storage.getJobsitesByOrg(req.user!.organizationId));
  });

  app.get("/api/jobsites/:id", async (req, res) => {
    const jobsite = await storage.getJobsite(req.params.id);
    if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
    if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(jobsite);
  });

  app.post("/api/jobsites", async (req, res) => {
    const parsed = insertJobsiteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const client = await storage.getClient(parsed.data.clientId);
    if (!client) return res.status(400).json({ message: "Client not found" });
    if (client.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const jobsite = await storage.createJobsite(req.user!.organizationId, parsed.data);
    res.status(201).json(jobsite);
  });

  app.patch("/api/jobsites/:id", async (req, res) => {
    const jobsite = await storage.getJobsite(req.params.id);
    if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
    if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateJobsite(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Jobsite not found" });
    res.json(updated);
  });

  app.get("/api/clients/:id/jobsites", async (req, res) => {
    const client = await storage.getClient(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    if (client.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getJobsitesByClient(req.params.id));
  });

  // ─── Code References (shared, no org isolation) ─────────────────────────────

  app.get("/api/code-references", async (_req, res) => {
    res.json(await storage.getCodeReferences());
  });

  app.get("/api/code-references/:id", async (req, res) => {
    const ref = await storage.getCodeReference(req.params.id);
    if (!ref) return res.status(404).json({ message: "Code reference not found" });
    res.json(ref);
  });

  // ─── Templates ──────────────────────────────────────────────────────────────

  app.get("/api/templates", async (req, res) => {
    res.json(await storage.getTemplatesByOrg(req.user!.organizationId));
  });

  // ─── Inspections ────────────────────────────────────────────────────────────

  app.get("/api/inspections", async (req, res) => {
    res.json(await storage.getInspectionsByOrg(req.user!.organizationId));
  });

  app.get("/api/inspections/:id", async (req, res) => {
    const insp = await storage.getInspection(req.params.id);
    if (!insp) return res.status(404).json({ message: "Inspection not found" });
    if (insp.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(insp);
  });

  app.post("/api/inspections", async (req, res) => {
    const parsed = insertInspectionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const jobsite = await storage.getJobsite(parsed.data.jobsiteId);
    if (!jobsite) return res.status(400).json({ message: "Jobsite not found" });
    if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const template = await storage.getTemplate(parsed.data.templateId);
    if (!template) return res.status(400).json({ message: "Template not found" });
    if (template.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const inspection = await storage.createInspection(req.user!.organizationId, req.user!.id, parsed.data);
    res.status(201).json(inspection);
  });

  app.patch("/api/inspections/:id/status", async (req, res) => {
    const { status } = req.body;
    if (!["Draft", "Submitted"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const insp = await storage.getInspection(req.params.id);
    if (!insp) return res.status(404).json({ message: "Inspection not found" });
    if (insp.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateInspectionStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ message: "Inspection not found" });
    res.json(updated);
  });

  app.patch("/api/inspections/:id/report-details", async (req, res) => {
    const parsed = updateInspectionReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const insp = await storage.getInspection(req.params.id);
    if (!insp) return res.status(404).json({ message: "Inspection not found" });
    if (insp.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateInspection(req.params.id, parsed.data);
    res.json(updated);
  });

  app.get("/api/jobsites/:id/inspections", async (req, res) => {
    const jobsite = await storage.getJobsite(req.params.id);
    if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
    if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getInspectionsByJobsite(req.params.id));
  });

  // ─── Observations ────────────────────────────────────────────────────────────

  app.get("/api/inspections/:id/observations", async (req, res) => {
    const insp = await storage.getInspection(req.params.id);
    if (!insp) return res.status(404).json({ message: "Inspection not found" });
    if (insp.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getObservationsByInspection(req.params.id));
  });

  app.get("/api/observations/:id", async (req, res) => {
    const obs = await storage.getObservation(req.params.id);
    if (!obs) return res.status(404).json({ message: "Observation not found" });
    if (obs.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(obs);
  });

  app.post("/api/observations", async (req, res) => {
    const parsed = insertObservationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const insp = await storage.getInspection(parsed.data.inspectionId);
    if (!insp) return res.status(400).json({ message: "Inspection not found" });
    if (insp.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const jobsite = await storage.getJobsite(parsed.data.jobsiteId);
    if (!jobsite) return res.status(400).json({ message: "Jobsite not found" });
    if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const observation = await storage.createObservation(req.user!.organizationId, req.user!.id, parsed.data);
    res.status(201).json(observation);
  });

  app.patch("/api/observations/:id", async (req, res) => {
    const obs = await storage.getObservation(req.params.id);
    if (!obs) return res.status(404).json({ message: "Observation not found" });
    if (obs.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateObservation(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Observation not found" });
    res.json(updated);
  });

  // ─── Permits & External Events ───────────────────────────────────────────────

  app.get("/api/jobsites/:id/permits", async (req, res) => {
    const jobsite = await storage.getJobsite(req.params.id);
    if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
    if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getPermitsByJobsite(req.params.id));
  });

  app.get("/api/jobsites/:id/external-events", async (req, res) => {
    const jobsite = await storage.getJobsite(req.params.id);
    if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
    if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getExternalEventsByJobsite(req.params.id));
  });

  // ─── Employees ──────────────────────────────────────────────────────────────

  app.get("/api/employees", async (req, res) => {
    res.json(await storage.getEmployeeProfilesByOrg(req.user!.organizationId));
  });

  app.get("/api/employees/:id", async (req, res) => {
    const profile = await storage.getEmployeeProfile(req.params.id);
    if (!profile) return res.status(404).json({ message: "Employee not found" });
    if (profile.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(profile);
  });

  app.post("/api/employees", async (req, res) => {
    const parsed = insertEmployeeProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const targetUser = await storage.getUser(parsed.data.userId);
    if (!targetUser) return res.status(400).json({ message: "User not found" });
    if (targetUser.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const profile = await storage.createEmployeeProfile(req.user!.organizationId, parsed.data);
    res.status(201).json(profile);
  });

  app.patch("/api/employees/:id", async (req, res) => {
    const profile = await storage.getEmployeeProfile(req.params.id);
    if (!profile) return res.status(404).json({ message: "Employee not found" });
    if (profile.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const { title, phone, status, hireDate, certifications, licenseNumbers, emergencyContact, emergencyPhone, hourlyRate, notes } = req.body;
    const updates: Partial<Omit<EmployeeProfile, "id" | "organizationId" | "userId">> = {};
    if (title !== undefined) updates.title = title;
    if (phone !== undefined) updates.phone = phone;
    if (status !== undefined) updates.status = status;
    if (hireDate !== undefined) updates.hireDate = hireDate;
    if (certifications !== undefined) updates.certifications = certifications;
    if (licenseNumbers !== undefined) updates.licenseNumbers = licenseNumbers;
    if (emergencyContact !== undefined) updates.emergencyContact = emergencyContact;
    if (emergencyPhone !== undefined) updates.emergencyPhone = emergencyPhone;
    if (hourlyRate !== undefined) updates.hourlyRate = hourlyRate;
    if (notes !== undefined) updates.notes = notes;
    const updated = await storage.updateEmployeeProfile(req.params.id, updates);
    res.json(updated);
  });

  // ─── Schedule ────────────────────────────────────────────────────────────────

  app.get("/api/schedule", async (req, res) => {
    const { startDate, endDate } = req.query;
    if (startDate && endDate) {
      res.json(await storage.getScheduleEntriesByDateRange(req.user!.organizationId, startDate as string, endDate as string));
    } else {
      res.json(await storage.getScheduleEntriesByOrg(req.user!.organizationId));
    }
  });

  app.get("/api/schedule/employee/:employeeId", async (req, res) => {
    const emp = await storage.getEmployeeProfile(req.params.employeeId);
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    if (emp.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getScheduleEntriesByEmployee(req.params.employeeId));
  });

  app.post("/api/schedule", async (req, res) => {
    const parsed = insertScheduleEntrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const emp = await storage.getEmployeeProfile(parsed.data.employeeId);
    if (!emp) return res.status(400).json({ message: "Employee not found" });
    if (emp.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const jobsite = await storage.getJobsite(parsed.data.jobsiteId);
    if (!jobsite) return res.status(400).json({ message: "Jobsite not found" });
    if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const entry = await storage.createScheduleEntry(req.user!.organizationId, parsed.data);
    res.status(201).json(entry);
  });

  app.patch("/api/schedule/:id", async (req, res) => {
    const entry = await storage.getScheduleEntry(req.params.id);
    if (!entry) return res.status(404).json({ message: "Schedule entry not found" });
    if (entry.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const { status, shiftStart, shiftEnd, notes } = req.body;
    const updates: Partial<Omit<ScheduleEntry, "id" | "organizationId" | "employeeId" | "jobsiteId" | "date">> = {};
    if (status !== undefined) updates.status = status;
    if (shiftStart !== undefined) updates.shiftStart = shiftStart;
    if (shiftEnd !== undefined) updates.shiftEnd = shiftEnd;
    if (notes !== undefined) updates.notes = notes;
    const updated = await storage.updateScheduleEntry(req.params.id, updates);
    if (!updated) return res.status(404).json({ message: "Schedule entry not found" });
    res.json(updated);
  });

  app.delete("/api/schedule/:id", async (req, res) => {
    const entry = await storage.getScheduleEntry(req.params.id);
    if (!entry) return res.status(404).json({ message: "Schedule entry not found" });
    if (entry.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const deleted = await storage.deleteScheduleEntry(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Schedule entry not found" });
    res.json({ success: true });
  });

  // ─── Timesheets ──────────────────────────────────────────────────────────────

  app.get("/api/timesheets", async (req, res) => {
    res.json(await storage.getTimesheetsByOrg(req.user!.organizationId));
  });

  app.get("/api/timesheets/:id", async (req, res) => {
    const ts = await storage.getTimesheet(req.params.id);
    if (!ts) return res.status(404).json({ message: "Timesheet not found" });
    if (ts.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(ts);
  });

  app.get("/api/timesheets/employee/:employeeId", async (req, res) => {
    const emp = await storage.getEmployeeProfile(req.params.employeeId);
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    if (emp.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getTimesheetsByEmployee(req.params.employeeId));
  });

  app.post("/api/timesheets", async (req, res) => {
    const parsed = insertTimesheetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const emp = await storage.getEmployeeProfile(parsed.data.employeeId);
    if (!emp) return res.status(400).json({ message: "Employee not found" });
    if (emp.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const ts = await storage.createTimesheet(req.user!.organizationId, parsed.data);
    res.status(201).json(ts);
  });

  app.patch("/api/timesheets/:id", async (req, res) => {
    const ts = await storage.getTimesheet(req.params.id);
    if (!ts) return res.status(404).json({ message: "Timesheet not found" });
    if (ts.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const { status, submittedAt, approvedBy, approvedAt, notes } = req.body;
    const updates: Partial<Omit<Timesheet, "id" | "organizationId" | "employeeId" | "weekStartDate" | "totalHours">> = {};
    if (status !== undefined) updates.status = status;
    if (submittedAt !== undefined) updates.submittedAt = submittedAt;
    if (approvedBy !== undefined) updates.approvedBy = approvedBy;
    if (approvedAt !== undefined) updates.approvedAt = approvedAt;
    if (notes !== undefined) updates.notes = notes;
    const updated = await storage.updateTimesheet(req.params.id, updates);
    if (!updated) return res.status(404).json({ message: "Timesheet not found" });
    res.json(updated);
  });

  app.get("/api/timesheets/:id/entries", async (req, res) => {
    const ts = await storage.getTimesheet(req.params.id);
    if (!ts) return res.status(404).json({ message: "Timesheet not found" });
    if (ts.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getTimesheetEntriesByTimesheet(req.params.id));
  });

  app.post("/api/timesheet-entries", async (req, res) => {
    const parsed = insertTimesheetEntrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const ts = await storage.getTimesheet(parsed.data.timesheetId);
    if (!ts) return res.status(404).json({ message: "Timesheet not found" });
    if (ts.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    if (parsed.data.jobsiteId) {
      const jobsite = await storage.getJobsite(parsed.data.jobsiteId);
      if (!jobsite) return res.status(400).json({ message: "Jobsite not found" });
      if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    }
    const entry = await storage.createTimesheetEntry(parsed.data);
    res.status(201).json(entry);
  });

  app.patch("/api/timesheet-entries/:id", async (req, res) => {
    const entry = await storage.getTimesheetEntry(req.params.id);
    if (!entry) return res.status(404).json({ message: "Timesheet entry not found" });
    const ts = await storage.getTimesheet(entry.timesheetId);
    if (!ts) return res.status(404).json({ message: "Timesheet not found" });
    if (ts.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const { hours, description, jobsiteId } = req.body;
    const updates: Partial<Omit<TimesheetEntry, "id" | "timesheetId" | "date">> = {};
    if (hours !== undefined) updates.hours = hours;
    if (description !== undefined) updates.description = description;
    if (jobsiteId !== undefined) updates.jobsiteId = jobsiteId;
    const updated = await storage.updateTimesheetEntry(req.params.id, updates);
    if (!updated) return res.status(404).json({ message: "Timesheet entry not found" });
    res.json(updated);
  });

  app.delete("/api/timesheet-entries/:id", async (req, res) => {
    const entry = await storage.getTimesheetEntry(req.params.id);
    if (!entry) return res.status(404).json({ message: "Timesheet entry not found" });
    const ts = await storage.getTimesheet(entry.timesheetId);
    if (!ts) return res.status(404).json({ message: "Timesheet not found" });
    if (ts.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const deleted = await storage.deleteTimesheetEntry(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Timesheet entry not found" });
    res.json({ success: true });
  });

  // ─── Safety Reports ──────────────────────────────────────────────────────────

  app.get("/api/safety-reports", async (req, res) => {
    res.json(await storage.getSafetyReportsByOrg(req.user!.organizationId));
  });

  app.get("/api/safety-reports/:id", async (req, res) => {
    const report = await storage.getSafetyReport(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (report.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(report);
  });

  app.get("/api/safety-reports/client/:clientId", async (req, res) => {
    const client = await storage.getClient(req.params.clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });
    if (client.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getSafetyReportsByClient(req.params.clientId));
  });

  app.post("/api/safety-reports", async (req, res) => {
    if (req.user!.role !== "Owner" && req.user!.role !== "Admin") {
      return res.status(403).json({ message: "Admin or Owner role required to create safety reports" });
    }
    const parsed = insertSafetyReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const client = await storage.getClient(parsed.data.clientId);
    if (!client) return res.status(400).json({ message: "Client not found" });
    if (client.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const report = await storage.createSafetyReport(req.user!.organizationId, parsed.data);
    res.status(201).json(report);
  });

  app.get("/api/safety-settings", async (req, res) => {
    res.json(await storage.getSafetySettings(req.user!.organizationId));
  });

  app.put("/api/safety-settings", async (req, res) => {
    if (req.user!.role !== "Owner" && req.user!.role !== "Admin") {
      return res.status(403).json({ message: "Admin or Owner role required to update scoring weights" });
    }
    const parsed = updateSafetySettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const settings = await storage.updateSafetySettings(req.user!.organizationId, parsed.data);
    res.json(settings);
  });

  // ─── Admin routes (super-admin only) ────────────────────────────────────────

  app.get("/api/admin/analytics", requireSuperAdmin, async (_req, res) => {
    const analytics = await storage.adminGetAnalytics();
    res.json(analytics);
  });

  app.get("/api/admin/orgs", requireSuperAdmin, async (_req, res) => {
    const orgs = await storage.adminListOrgs();
    res.json(orgs);
  });

  app.post("/api/admin/orgs", requireSuperAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Firm name is required" });
    }
    const org = await storage.adminCreateOrg(name.trim());
    res.status(201).json(org);
  });

  app.get("/api/admin/orgs/:orgId", requireSuperAdmin, async (req, res) => {
    const orgId = String(req.params.orgId);
    const result = await storage.adminGetOrgWithUsers(orgId);
    if (!result) return res.status(404).json({ message: "Firm not found" });
    res.json(result);
  });

  app.patch("/api/admin/orgs/:orgId/status", requireSuperAdmin, async (req, res) => {
    const { status } = req.body;
    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'active' or 'suspended'" });
    }
    const org = await storage.adminUpdateOrgStatus(String(req.params.orgId), status);
    if (!org) return res.status(404).json({ message: "Firm not found" });
    res.json(org);
  });

  app.post("/api/admin/orgs/:orgId/users", requireSuperAdmin, async (req, res) => {
    const orgId = String(req.params.orgId);
    const { name, email, role, password } = req.body;
    if (!name || !email || !role || !password) {
      return res.status(400).json({ message: "Name, email, role, and password are required" });
    }
    if (!["Owner", "Admin", "Inspector"].includes(role)) {
      return res.status(400).json({ message: "Role must be Owner, Admin, or Inspector" });
    }
    const orgData = await storage.adminGetOrgWithUsers(orgId);
    if (!orgData) return res.status(404).json({ message: "Firm not found" });
    const user = await storage.adminCreateUser(orgId, name, email, role, password);
    res.status(201).json(user);
  });

  app.patch("/api/admin/users/:userId", requireSuperAdmin, async (req, res) => {
    const userId = String(req.params.userId);
    const { name, email, role, userStatus } = req.body;
    const updates: Record<string, string> = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (role && ["Owner", "Admin", "Inspector"].includes(role)) updates.role = role;
    if (userStatus && ["active", "inactive"].includes(userStatus)) updates.userStatus = userStatus;
    const user = await storage.adminUpdateUser(userId, updates);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  });

  app.post("/api/admin/users/:userId/reset-password", requireSuperAdmin, async (req, res) => {
    const userId = String(req.params.userId);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }
    await storage.adminResetPassword(userId, newPassword);
    res.json({ success: true });
  });

  app.get("/api/admin/orgs/:orgId/support", requireSuperAdmin, async (req, res) => {
    const orgId = String(req.params.orgId);
    const [clients, jobsites, inspections] = await Promise.all([
      storage.adminGetOrgClients(orgId),
      storage.adminGetOrgJobsites(orgId),
      storage.adminGetOrgInspections(orgId),
    ]);
    res.json({ clients, jobsites, inspections });
  });

  // ─── Contractors ────────────────────────────────────────────────────────────

  // ─── Trade Companies ──────────────────────────────────────────────────────

  app.get("/api/trades", async (req, res) => {
    const { jobsiteId } = req.query as { jobsiteId?: string };
    let trades = await storage.getTradesByOrg(req.user!.organizationId);
    if (jobsiteId) {
      const assignments = await storage.getTradesByJobsite(jobsiteId);
      const assignedIds = new Set(assignments.map(a => a.tradeCompanyId));
      trades = trades.filter(t => assignedIds.has(t.id));
    }
    res.json(trades);
  });

  app.get("/api/trades/counts", async (req, res) => {
    const assignments = await storage.getAllTradeAssignmentsByOrg(req.user!.organizationId);
    const counts: Record<string, number> = {};
    for (const a of assignments) {
      counts[a.tradeCompanyId] = (counts[a.tradeCompanyId] ?? 0) + 1;
    }
    res.json(counts);
  });

  app.get("/api/trades/:id", async (req, res) => {
    const trade = await storage.getTrade(req.params.id);
    if (!trade) return res.status(404).json({ message: "Trade company not found" });
    if (trade.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(trade);
  });

  app.post("/api/trades", async (req, res) => {
    const parsed = insertTradeCompanySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const trade = await storage.createTrade(req.user!.organizationId, parsed.data);
    res.status(201).json(trade);
  });

  app.patch("/api/trades/:id", async (req, res) => {
    const trade = await storage.getTrade(req.params.id);
    if (!trade) return res.status(404).json({ message: "Trade company not found" });
    if (trade.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const parsed = insertTradeCompanySchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateTrade(req.params.id, parsed.data);
    res.json(updated);
  });

  app.delete("/api/trades/:id", async (req, res) => {
    const trade = await storage.getTrade(req.params.id);
    if (!trade) return res.status(404).json({ message: "Trade company not found" });
    if (trade.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteTrade(req.params.id);
    res.status(204).end();
  });

  app.get("/api/trades/:id/assignments", async (req, res) => {
    const trade = await storage.getTrade(req.params.id);
    if (!trade) return res.status(404).json({ message: "Trade company not found" });
    if (trade.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getTradeAssignmentsByTrade(req.params.id));
  });

  app.post("/api/trades/:id/assign", async (req, res) => {
    const trade = await storage.getTrade(req.params.id);
    if (!trade) return res.status(404).json({ message: "Trade company not found" });
    if (trade.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const assignSchema = z.object({
      jobsiteId: z.string().min(1, "jobsiteId is required"),
      clientId: z.string().optional(),
      scopeOfWork: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    });
    const bodyParsed = assignSchema.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json({ message: bodyParsed.error.message });
    const { jobsiteId, clientId, scopeOfWork, startDate, endDate } = bodyParsed.data;
    const jobsiteRecord = await storage.getJobsite(jobsiteId);
    if (!jobsiteRecord) return res.status(404).json({ message: "Jobsite not found" });
    if (jobsiteRecord.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const existing = await storage.getTradeAssignmentsByTrade(req.params.id);
    if (existing.some(a => a.jobsiteId === jobsiteId)) {
      return res.status(409).json({ message: "Trade company is already assigned to this jobsite" });
    }
    const assignment = await storage.createTradeAssignment(jobsiteId, {
      tradeCompanyId: req.params.id, clientId, scopeOfWork, startDate, endDate,
    });
    res.status(201).json(assignment);
  });

  app.get("/api/jobsites/:id/trades", async (req, res) => {
    const jobsite = await storage.getJobsite(req.params.id);
    if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
    if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getTradesWithDetailsByJobsite(req.params.id));
  });

  app.delete("/api/jobsite-trade-assignments/:id", async (req, res) => {
    const assignment = await storage.getTradeAssignment(req.params.id);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    const trade = await storage.getTrade(assignment.tradeCompanyId);
    if (!trade || trade.organizationId !== req.user!.organizationId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteTradeAssignment(req.params.id);
    res.status(204).end();
  });

  // ─── Contractors ──────────────────────────────────────────────────────────

  app.get("/api/contractors", async (req, res) => {
    res.json(await storage.getContractorsByOrg(req.user!.organizationId));
  });

  app.get("/api/contractors/:id", async (req, res) => {
    const contractor = await storage.getContractor(req.params.id);
    if (!contractor) return res.status(404).json({ message: "Contractor not found" });
    if (contractor.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(contractor);
  });

  app.post("/api/contractors", async (req, res) => {
    const parsed = insertIndependentContractorSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const contractor = await storage.createContractor(req.user!.organizationId, parsed.data);
    res.status(201).json(contractor);
  });

  app.patch("/api/contractors/:id", async (req, res) => {
    const contractor = await storage.getContractor(req.params.id);
    if (!contractor) return res.status(404).json({ message: "Contractor not found" });
    if (contractor.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const parsed = insertIndependentContractorSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateContractor(req.params.id, parsed.data);
    res.json(updated);
  });

  app.delete("/api/contractors/:id", async (req, res) => {
    const contractor = await storage.getContractor(req.params.id);
    if (!contractor) return res.status(404).json({ message: "Contractor not found" });
    if (contractor.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteContractor(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/contractors/:id/assignments", async (req, res) => {
    const contractor = await storage.getContractor(req.params.id);
    if (!contractor) return res.status(404).json({ message: "Contractor not found" });
    if (contractor.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getAssignmentsByContractor(req.params.id));
  });

  app.post("/api/contractors/:id/assignments", async (req, res) => {
    const contractor = await storage.getContractor(req.params.id);
    if (!contractor) return res.status(404).json({ message: "Contractor not found" });
    if (contractor.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const parsed = insertContractorAssignmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const jobsite = await storage.getJobsite(parsed.data.jobsiteId);
    if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
    if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const existing = await storage.getAssignmentsByContractor(req.params.id);
    if (existing.some(a => a.jobsiteId === parsed.data.jobsiteId)) {
      return res.status(409).json({ message: "Contractor is already assigned to this jobsite" });
    }
    const assignment = await storage.createContractorAssignment(req.params.id, parsed.data);
    res.status(201).json(assignment);
  });

  app.delete("/api/contractors/:id/assignments/:assignmentId", async (req, res) => {
    const contractor = await storage.getContractor(req.params.id);
    if (!contractor) return res.status(404).json({ message: "Contractor not found" });
    if (contractor.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const assignments = await storage.getAssignmentsByContractor(req.params.id);
    const target = assignments.find(a => a.id === req.params.assignmentId);
    if (!target) return res.status(404).json({ message: "Assignment not found" });
    await storage.deleteContractorAssignment(req.params.assignmentId);
    res.json({ success: true });
  });

  app.get("/api/jobsites/:id/contractors", async (req, res) => {
    const jobsite = await storage.getJobsite(req.params.id);
    if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
    if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getAssignmentsByJobsite(req.params.id));
  });

  // ─── Contacts ─────────────────────────────────────────────────────────────

  app.get("/api/contacts/counts", async (req, res) => {
    res.json(await storage.getContactAssociationCountsByOrg(req.user!.organizationId));
  });

  app.get("/api/contacts", async (req, res) => {
    const orgId = req.user!.organizationId;
    const { entityType, entityId } = req.query as { entityType?: string; entityId?: string };
    if (entityType && entityId) {
      return res.json(await storage.getContactsByEntity(entityType, entityId, orgId));
    }
    res.json(await storage.getContactsByOrg(orgId));
  });

  app.post("/api/contacts", async (req, res) => {
    const parsed = insertContactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const contact = await storage.createContact(req.user!.organizationId, parsed.data);
    res.status(201).json(contact);
  });

  app.get("/api/contacts/:id", async (req, res) => {
    const contact = await storage.getContactWithAssociations(req.params.id);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    if (contact.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(contact);
  });

  app.patch("/api/contacts/:id", async (req, res) => {
    const contact = await storage.getContact(req.params.id);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    if (contact.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    const parsed = insertContactSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateContact(req.params.id, parsed.data);
    res.json(updated);
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    const contact = await storage.getContact(req.params.id);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    if (contact.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteContact(req.params.id);
    res.status(204).send();
  });

  app.post("/api/contacts/:id/associations", async (req, res) => {
    const orgId = req.user!.organizationId;
    const contact = await storage.getContact(req.params.id);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    if (contact.organizationId !== orgId) return res.status(403).json({ message: "Forbidden" });
    const parsed = insertContactAssociationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const entityOrgId = await storage.getEntityOrgId(parsed.data.entityType, parsed.data.entityId);
    if (!entityOrgId || entityOrgId !== orgId) return res.status(403).json({ message: "Target entity not found or forbidden" });
    const assoc = await storage.createContactAssociation(req.params.id, parsed.data);
    res.status(201).json(assoc);
  });

  app.delete("/api/contact-associations/:id", async (req, res) => {
    const assoc = await storage.getContactAssociation(req.params.id);
    if (!assoc) return res.status(404).json({ message: "Association not found" });
    const contact = await storage.getContact(assoc.contactId);
    if (!contact || contact.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteContactAssociation(req.params.id);
    res.status(204).send();
  });

  app.get("/api/entities/:entityType/:entityId/contacts", async (req, res) => {
    const { entityType, entityId } = req.params;
    const orgId = req.user!.organizationId;
    const entityOrgId = await storage.getEntityOrgId(entityType, entityId);
    if (!entityOrgId || entityOrgId !== orgId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getContactsByEntity(entityType, entityId, orgId));
  });

  // ─── Contractor Companies (Phase 7A) ──────────────────────────────────────
  // Global registry — any authenticated user can read/create.
  // No org-scope on reads (global by design). Write access requires auth only.
  // linkedOrganizationId is never set via this API — super-admin only operation.

  app.get("/api/contractor-companies", async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const companies = await storage.getContractorCompanies(search);
    res.json(companies);
  });

  app.get("/api/contractor-companies/:id", async (req, res) => {
    const company = await storage.getContractorCompany(req.params.id);
    if (!company) return res.status(404).json({ message: "Contractor company not found" });
    res.json(company);
  });

  app.post("/api/contractor-companies", async (req, res) => {
    const parsed = insertContractorCompanySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    // Prevent duplicate names (case-insensitive check)
    const existing = await storage.getContractorCompanies(parsed.data.name);
    const duplicate = existing.find(
      c => c.name.toLowerCase() === parsed.data.name.toLowerCase()
    );
    if (duplicate) return res.status(409).json({ message: "A company with this name already exists", existing: duplicate });
    const company = await storage.createContractorCompany(parsed.data);
    res.status(201).json(company);
  });

  app.patch("/api/contractor-companies/:id", async (req, res) => {
    const company = await storage.getContractorCompany(req.params.id);
    if (!company) return res.status(404).json({ message: "Contractor company not found" });
    const parsed = updateContractorCompanySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateContractorCompany(req.params.id, parsed.data);
    res.json(updated);
  });

  // ─── AI Photo Analysis ──────────────────────────────────────────────────────

  app.post("/api/ai/analyze-photo", (_req, res) => {
    const findingPool: AiFinding[] = [
      { id: `ai-${Date.now()}-1`, label: "No guardrails at open edge", confidence: 0.92, suggestedCodeReferenceIds: ["BC-3314.1", "BC-3306.5"] },
      { id: `ai-${Date.now()}-2`, label: "Debris accumulation in walkway", confidence: 0.87, suggestedCodeReferenceIds: ["BC-3316.1"] },
      { id: `ai-${Date.now()}-3`, label: "Missing toe board on scaffold platform", confidence: 0.79, suggestedCodeReferenceIds: ["BC-3306.1", "BC-3306.5"] },
      { id: `ai-${Date.now()}-4`, label: "Unsecured construction fence section", confidence: 0.84, suggestedCodeReferenceIds: ["BC-3302.1", "BC-3301.9"] },
      { id: `ai-${Date.now()}-5`, label: "Workers at height without fall arrest system", confidence: 0.95, suggestedCodeReferenceIds: ["BC-3314.1"] },
      { id: `ai-${Date.now()}-6`, label: "Sidewalk shed lighting deficiency", confidence: 0.73, suggestedCodeReferenceIds: ["BC-3303.1"] },
    ];
    const count = 2 + Math.floor(Math.random() * 3);
    const shuffled = findingPool.sort(() => Math.random() - 0.5);
    const findings = shuffled.slice(0, count).map((f, i) => ({
      ...f,
      id: `ai-${Date.now()}-${i}`,
      confidence: Math.round((f.confidence + (Math.random() * 0.1 - 0.05)) * 100) / 100,
    }));
    res.json({ findings });
  });

  return httpServer;
}
