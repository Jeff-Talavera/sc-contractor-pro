import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import {
  insertClientSchema, insertJobsiteSchema, insertInspectionSchema, insertObservationSchema,
  insertEmployeeProfileSchema, insertScheduleEntrySchema, insertTimesheetSchema, insertTimesheetEntrySchema,
  updateInspectionReportSchema, insertSafetyReportSchema, updateSafetySettingsSchema, updateOrganizationSchema
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
