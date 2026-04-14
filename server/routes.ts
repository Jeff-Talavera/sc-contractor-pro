import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertClientSchema, insertJobsiteSchema, insertInspectionSchema, insertObservationSchema,
  insertEmployeeProfileSchema, insertScheduleEntrySchema, insertTimesheetSchema, insertTimesheetEntrySchema,
  updateInspectionReportSchema, insertSafetyReportSchema, updateSafetySettingsSchema, updateOrganizationSchema
} from "@shared/schema";
import type { AiFinding, EmployeeProfile, ScheduleEntry, Timesheet, TimesheetEntry } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/me", async (_req, res) => {
    try {
      const user = await storage.getCurrentUser();
      const org = await storage.getOrganization(user.organizationId);
      res.json({ user, organization: org });
    } catch (err) {
      res.status(500).json({ message: "Failed to load current user" });
    }
  });

  app.put("/api/organization", async (req, res) => {
    const user = await storage.getCurrentUser();
    if (user.role !== "Owner" && user.role !== "Admin") {
      return res.status(403).json({ message: "Admin or Owner role required" });
    }
    const parsed = updateOrganizationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateOrganization(user.organizationId, parsed.data);
    if (!updated) return res.status(404).json({ message: "Organization not found" });
    res.json(updated);
  });

  app.get("/api/users", async (_req, res) => {
    const user = await storage.getCurrentUser();
    res.json(await storage.getUsersByOrg(user.organizationId));
  });

  app.get("/api/clients", async (req, res) => {
    const user = await storage.getCurrentUser();
    const all = await storage.getClientsByOrg(user.organizationId);
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
    res.json(client);
  });

  app.get("/api/clients/:id/subcontractors", async (req, res) => {
    res.json(await storage.getSubcontractors(req.params.id));
  });

  app.post("/api/clients", async (req, res) => {
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const user = await storage.getCurrentUser();
    if (parsed.data.parentClientId) {
      const parent = await storage.getClient(parsed.data.parentClientId);
      if (!parent) return res.status(400).json({ message: "Parent client not found" });
      if (parent.parentClientId) return res.status(400).json({ message: "Cannot assign a subcontractor as a parent (nesting limited to one level)" });
    }
    const client = await storage.createClient(user.organizationId, parsed.data);
    res.status(201).json(client);
  });

  app.get("/api/jobsites", async (_req, res) => {
    const user = await storage.getCurrentUser();
    res.json(await storage.getJobsitesByOrg(user.organizationId));
  });

  app.get("/api/jobsites/:id", async (req, res) => {
    const jobsite = await storage.getJobsite(req.params.id);
    if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
    res.json(jobsite);
  });

  app.post("/api/jobsites", async (req, res) => {
    const parsed = insertJobsiteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const user = await storage.getCurrentUser();
    const jobsite = await storage.createJobsite(user.organizationId, parsed.data);
    res.status(201).json(jobsite);
  });

  app.patch("/api/jobsites/:id", async (req, res) => {
    const updated = await storage.updateJobsite(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Jobsite not found" });
    res.json(updated);
  });

  app.get("/api/clients/:id/jobsites", async (req, res) => {
    res.json(await storage.getJobsitesByClient(req.params.id));
  });

  app.get("/api/code-references", async (_req, res) => {
    res.json(await storage.getCodeReferences());
  });

  app.get("/api/code-references/:id", async (req, res) => {
    const ref = await storage.getCodeReference(req.params.id);
    if (!ref) return res.status(404).json({ message: "Code reference not found" });
    res.json(ref);
  });

  app.get("/api/templates", async (_req, res) => {
    const user = await storage.getCurrentUser();
    res.json(await storage.getTemplatesByOrg(user.organizationId));
  });

  app.get("/api/inspections", async (_req, res) => {
    const user = await storage.getCurrentUser();
    res.json(await storage.getInspectionsByOrg(user.organizationId));
  });

  app.get("/api/inspections/:id", async (req, res) => {
    const insp = await storage.getInspection(req.params.id);
    if (!insp) return res.status(404).json({ message: "Inspection not found" });
    res.json(insp);
  });

  app.post("/api/inspections", async (req, res) => {
    const parsed = insertInspectionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const user = await storage.getCurrentUser();
    const inspection = await storage.createInspection(user.organizationId, user.id, parsed.data);
    res.status(201).json(inspection);
  });

  app.patch("/api/inspections/:id/status", async (req, res) => {
    const { status } = req.body;
    if (!["Draft", "Submitted"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const updated = await storage.updateInspectionStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ message: "Inspection not found" });
    res.json(updated);
  });

  app.patch("/api/inspections/:id/report-details", async (req, res) => {
    const parsed = updateInspectionReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const insp = await storage.getInspection(req.params.id);
    if (!insp) return res.status(404).json({ message: "Inspection not found" });
    const user = await storage.getCurrentUser();
    if (insp.organizationId !== user.organizationId) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateInspection(req.params.id, parsed.data);
    res.json(updated);
  });

  app.get("/api/jobsites/:id/inspections", async (req, res) => {
    res.json(await storage.getInspectionsByJobsite(req.params.id));
  });

  app.get("/api/inspections/:id/observations", async (req, res) => {
    res.json(await storage.getObservationsByInspection(req.params.id));
  });

  app.get("/api/observations/:id", async (req, res) => {
    const obs = await storage.getObservation(req.params.id);
    if (!obs) return res.status(404).json({ message: "Observation not found" });
    res.json(obs);
  });

  app.post("/api/observations", async (req, res) => {
    const parsed = insertObservationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const user = await storage.getCurrentUser();
    const observation = await storage.createObservation(user.organizationId, user.id, parsed.data);
    res.status(201).json(observation);
  });

  app.patch("/api/observations/:id", async (req, res) => {
    const updated = await storage.updateObservation(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Observation not found" });
    res.json(updated);
  });

  app.get("/api/jobsites/:id/permits", async (req, res) => {
    res.json(await storage.getPermitsByJobsite(req.params.id));
  });

  app.get("/api/jobsites/:id/external-events", async (req, res) => {
    res.json(await storage.getExternalEventsByJobsite(req.params.id));
  });

  app.get("/api/employees", async (_req, res) => {
    const user = await storage.getCurrentUser();
    res.json(await storage.getEmployeeProfilesByOrg(user.organizationId));
  });

  app.get("/api/employees/:id", async (req, res) => {
    const profile = await storage.getEmployeeProfile(req.params.id);
    if (!profile) return res.status(404).json({ message: "Employee not found" });
    const user = await storage.getCurrentUser();
    if (profile.organizationId !== user.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(profile);
  });

  app.post("/api/employees", async (req, res) => {
    const parsed = insertEmployeeProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const user = await storage.getCurrentUser();
    const profile = await storage.createEmployeeProfile(user.organizationId, parsed.data);
    res.status(201).json(profile);
  });

  app.patch("/api/employees/:id", async (req, res) => {
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
    const profile = await storage.getEmployeeProfile(req.params.id);
    if (!profile) return res.status(404).json({ message: "Employee not found" });
    const user = await storage.getCurrentUser();
    if (profile.organizationId !== user.organizationId) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateEmployeeProfile(req.params.id, updates);
    res.json(updated);
  });

  app.get("/api/schedule", async (req, res) => {
    const user = await storage.getCurrentUser();
    const { startDate, endDate } = req.query;
    if (startDate && endDate) {
      res.json(await storage.getScheduleEntriesByDateRange(user.organizationId, startDate as string, endDate as string));
    } else {
      res.json(await storage.getScheduleEntriesByOrg(user.organizationId));
    }
  });

  app.get("/api/schedule/employee/:employeeId", async (req, res) => {
    const emp = await storage.getEmployeeProfile(req.params.employeeId);
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    const user = await storage.getCurrentUser();
    if (emp.organizationId !== user.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getScheduleEntriesByEmployee(req.params.employeeId));
  });

  app.post("/api/schedule", async (req, res) => {
    const parsed = insertScheduleEntrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const user = await storage.getCurrentUser();
    const entry = await storage.createScheduleEntry(user.organizationId, parsed.data);
    res.status(201).json(entry);
  });

  app.patch("/api/schedule/:id", async (req, res) => {
    const entry = await storage.getScheduleEntry(req.params.id);
    if (!entry) return res.status(404).json({ message: "Schedule entry not found" });
    const user = await storage.getCurrentUser();
    if (entry.organizationId !== user.organizationId) return res.status(403).json({ message: "Forbidden" });
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
    const user = await storage.getCurrentUser();
    if (entry.organizationId !== user.organizationId) return res.status(403).json({ message: "Forbidden" });
    const deleted = await storage.deleteScheduleEntry(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Schedule entry not found" });
    res.json({ success: true });
  });

  app.get("/api/timesheets", async (_req, res) => {
    const user = await storage.getCurrentUser();
    res.json(await storage.getTimesheetsByOrg(user.organizationId));
  });

  app.get("/api/timesheets/:id", async (req, res) => {
    const ts = await storage.getTimesheet(req.params.id);
    if (!ts) return res.status(404).json({ message: "Timesheet not found" });
    const user = await storage.getCurrentUser();
    if (ts.organizationId !== user.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(ts);
  });

  app.get("/api/timesheets/employee/:employeeId", async (req, res) => {
    const emp = await storage.getEmployeeProfile(req.params.employeeId);
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    const user = await storage.getCurrentUser();
    if (emp.organizationId !== user.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getTimesheetsByEmployee(req.params.employeeId));
  });

  app.post("/api/timesheets", async (req, res) => {
    const parsed = insertTimesheetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const user = await storage.getCurrentUser();
    const ts = await storage.createTimesheet(user.organizationId, parsed.data);
    res.status(201).json(ts);
  });

  app.patch("/api/timesheets/:id", async (req, res) => {
    const ts = await storage.getTimesheet(req.params.id);
    if (!ts) return res.status(404).json({ message: "Timesheet not found" });
    const user = await storage.getCurrentUser();
    if (ts.organizationId !== user.organizationId) return res.status(403).json({ message: "Forbidden" });
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
    const user = await storage.getCurrentUser();
    if (ts.organizationId !== user.organizationId) return res.status(403).json({ message: "Forbidden" });
    res.json(await storage.getTimesheetEntriesByTimesheet(req.params.id));
  });

  app.post("/api/timesheet-entries", async (req, res) => {
    const parsed = insertTimesheetEntrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const ts = await storage.getTimesheet(parsed.data.timesheetId);
    if (!ts) return res.status(404).json({ message: "Timesheet not found" });
    const user = await storage.getCurrentUser();
    if (ts.organizationId !== user.organizationId) return res.status(403).json({ message: "Forbidden" });
    const entry = await storage.createTimesheetEntry(parsed.data);
    res.status(201).json(entry);
  });

  app.patch("/api/timesheet-entries/:id", async (req, res) => {
    const entry = await storage.getTimesheetEntry(req.params.id);
    if (!entry) return res.status(404).json({ message: "Timesheet entry not found" });
    const ts = await storage.getTimesheet(entry.timesheetId);
    if (!ts) return res.status(404).json({ message: "Timesheet not found" });
    const user = await storage.getCurrentUser();
    if (ts.organizationId !== user.organizationId) return res.status(403).json({ message: "Forbidden" });
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
    const user = await storage.getCurrentUser();
    if (ts.organizationId !== user.organizationId) return res.status(403).json({ message: "Forbidden" });
    const deleted = await storage.deleteTimesheetEntry(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Timesheet entry not found" });
    res.json({ success: true });
  });

  // ─── Safety Reports ──────────────────────────────────────────────────────────

  app.get("/api/safety-reports", async (_req, res) => {
    const user = await storage.getCurrentUser();
    res.json(await storage.getSafetyReportsByOrg(user.organizationId));
  });

  app.get("/api/safety-reports/:id", async (req, res) => {
    const report = await storage.getSafetyReport(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  });

  app.get("/api/safety-reports/client/:clientId", async (req, res) => {
    res.json(await storage.getSafetyReportsByClient(req.params.clientId));
  });

  app.post("/api/safety-reports", async (req, res) => {
    const user = await storage.getCurrentUser();
    if (user.role !== "Owner" && user.role !== "Admin") {
      return res.status(403).json({ message: "Admin or Owner role required to create safety reports" });
    }
    const parsed = insertSafetyReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const report = await storage.createSafetyReport(user.organizationId, parsed.data);
    res.status(201).json(report);
  });

  app.get("/api/safety-settings", async (_req, res) => {
    const user = await storage.getCurrentUser();
    res.json(await storage.getSafetySettings(user.organizationId));
  });

  app.put("/api/safety-settings", async (req, res) => {
    const user = await storage.getCurrentUser();
    if (user.role !== "Owner" && user.role !== "Admin") {
      return res.status(403).json({ message: "Admin or Owner role required to update scoring weights" });
    }
    const parsed = updateSafetySettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const settings = await storage.updateSafetySettings(user.organizationId, parsed.data);
    res.json(settings);
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
