import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, createNotificationForOrgAdmins } from "./storage";
import bcrypt from "bcrypt";
import { z } from "zod";
import {
  insertClientSchema, insertJobsiteSchema, insertInspectionSchema, insertObservationSchema,
  insertEmployeeProfileSchema, insertScheduleEntrySchema, insertTimesheetSchema, insertTimesheetEntrySchema,
  updateInspectionReportSchema, insertSafetyReportSchema, updateSafetySettingsSchema, updateOrganizationSchema,
  insertIndependentContractorSchema, insertContractorAssignmentSchema,
  insertTradeCompanySchema, insertJobsiteTradeAssignmentSchema,
  insertContactSchema, insertContactAssociationSchema,
  insertContractorCompanySchema, updateContractorCompanySchema,
  insertWorkerCertificationSchema, updateWorkerCertificationSchema,
  insertCertificateOfInsuranceSchema, updateCertificateOfInsuranceSchema,
  insertOshaIncidentSchema, updateOshaIncidentSchema,
  insertWorkHoursLogSchema, updateWorkHoursLogSchema,
  insertDriverSchema, updateDriverSchema,
  insertDeliveryRequestSchema, updateDeliveryRequestSchema, updateDeliveryStatusSchema,
  insertDeliveryNfcEventSchema,
  insertInventoryItemSchema, updateInventoryItemSchema,
  insertInventoryCheckoutSchema, closeInventoryCheckoutSchema,
  insertInventoryConditionReportSchema,
  insertInventoryServiceTicketSchema, updateInventoryServiceTicketSchema,
  insertPortfolioShareSchema,
  insertProcurementRequestSchema, updateProcurementRequestSchema, updateProcurementStatusSchema,
  insertProcurementRequestItemSchema, updateProcurementRequestItemSchema,
  insertInviteSchema, updateUserRoleSchema,
  insertJobsiteWorkerAssignmentSchema,
  insertJobsiteViolationSchema, updateJobsiteViolationSchema,
} from "@shared/schema";
import type { VisibleSections } from "@shared/schema";
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

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
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

  // ─── Public Portfolio Share Route (Phase 7F) ───────────────────────────────
  // Registered BEFORE the global /api requireAuth so unauthenticated visitors
  // can view a shared portfolio via the token. Token is the only credential.

  app.get("/api/public/portfolio/:token", async (req, res) => {
    try {
      const share = await storage.getPortfolioShareByToken(req.params.token);
      if (!share) return res.status(404).json({ error: "Share not found" });
      if (share.revokedAt) return res.status(410).json({ error: "This link has been revoked" });
      const now = new Date().toISOString();
      if (share.expiresAt < now) return res.status(410).json({ error: "This link has expired" });
      const snapshot = await storage.getPortfolioSnapshot(share.organizationId, share.visibleSections);
      res.json(snapshot);
    } catch {
      res.status(500).json({ message: "Failed to load shared portfolio" });
    }
  });

  // ─── Public Invite Accept Route (Phase 10) ─────────────────────────────────
  // Registered BEFORE the global /api requireAuth so unauthenticated invitees
  // can mark their invite accepted. Token is the only credential.

  app.get("/api/invites/accept/:token", async (req, res) => {
    try {
      const invite = await storage.getInviteByToken(req.params.token);
      if (!invite) return res.status(404).json({ message: "Invite not found" });
      if (invite.acceptedAt) return res.status(410).json({ message: "Invite has already been accepted" });
      const now = new Date().toISOString();
      if (invite.expiresAt < now) return res.status(410).json({ message: "Invite has expired" });
      const accepted = await storage.acceptInvite(req.params.token);
      if (!accepted) return res.status(404).json({ message: "Invite not found" });
      res.json({ invite: accepted, message: "Invite accepted. Please register or log in to join the organization." });
    } catch {
      res.status(500).json({ message: "Failed to accept invite" });
    }
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

  app.get("/api/users", requireRole("Admin", "Owner"), async (req, res) => {
    res.json(await storage.getUsersByOrg(req.user!.organizationId));
  });

  app.patch("/api/users/:id/role", requireRole("Owner"), async (req, res) => {
    try {
      const parsed = updateUserRoleSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      if (req.user!.id === req.params.id) {
        return res.status(400).json({ message: "Cannot change your own role" });
      }
      const orgId = req.user!.organizationId;
      const target = await storage.getUser(req.params.id);
      if (!target || target.organizationId !== orgId) {
        return res.status(404).json({ message: "User not found" });
      }
      if (target.role === "Owner" && parsed.data.role !== "Owner") {
        const orgUsers = await storage.getUsersByOrg(orgId);
        const remainingOwners = orgUsers.filter(u => u.role === "Owner" && u.id !== target.id).length;
        if (remainingOwners < 1) {
          return res.status(400).json({ message: "Cannot demote the last Owner" });
        }
      }
      const updated = await storage.updateUserRole(orgId, req.params.id, parsed.data.role);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.delete("/api/users/:id", requireRole("Owner"), async (req, res) => {
    try {
      if (req.user!.id === req.params.id) {
        return res.status(400).json({ message: "Cannot remove yourself" });
      }
      const orgId = req.user!.organizationId;
      const target = await storage.getUser(req.params.id);
      if (!target || target.organizationId !== orgId) {
        return res.status(404).json({ message: "User not found" });
      }
      if (target.role === "Owner") {
        const orgUsers = await storage.getUsersByOrg(orgId);
        const remainingOwners = orgUsers.filter(u => u.role === "Owner" && u.id !== target.id).length;
        if (remainingOwners < 1) {
          return res.status(400).json({ message: "Cannot remove the last Owner" });
        }
      }
      const removed = await storage.removeUserFromOrg(orgId, req.params.id);
      if (!removed) return res.status(404).json({ message: "User not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to remove user" });
    }
  });

  // ─── Invites (Phase 10) ────────────────────────────────────────────────────

  app.get("/api/invites", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const invites = await storage.getInvites(req.user!.organizationId);
      res.json(invites);
    } catch {
      res.status(500).json({ message: "Failed to fetch invites" });
    }
  });

  app.post("/api/invites", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const parsed = insertInviteSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgId = req.user!.organizationId;
      const existing = await storage.getInvites(orgId);
      const duplicate = existing.find(
        i => i.email.toLowerCase() === parsed.data.email.toLowerCase() && !i.acceptedAt
      );
      if (duplicate) {
        return res.status(409).json({ message: "A pending invite already exists for this email" });
      }
      const invite = await storage.createInvite(orgId, parsed.data, req.user!.id);
      res.status(201).json(invite);
    } catch {
      res.status(500).json({ message: "Failed to create invite" });
    }
  });

  app.delete("/api/invites/:id", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const deleted = await storage.deleteInvite(req.user!.organizationId, req.params.id);
      if (!deleted) return res.status(404).json({ message: "Invite not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete invite" });
    }
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

  app.post("/api/contractor-companies", requireRole("Admin", "Owner"), async (req, res) => {
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

  app.patch("/api/contractor-companies/:id", requireRole("Admin", "Owner"), async (req, res) => {
    const company = await storage.getContractorCompany(req.params.id);
    if (!company) return res.status(404).json({ message: "Contractor company not found" });
    const parsed = updateContractorCompanySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateContractorCompany(req.params.id, parsed.data);
    res.json(updated);
  });

  // ─── Worker Certifications (Phase 7B) ─────────────────────────────────────

  app.get("/api/worker-certifications", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      const { userId, certType } = req.query as { userId?: string; certType?: string };
      const filters: { userId?: string; certType?: string } = {};
      if (typeof userId === "string" && userId) filters.userId = userId;
      if (typeof certType === "string" && certType) filters.certType = certType;
      res.json(await storage.getWorkerCertifications(orgId, filters));
    } catch {
      res.status(500).json({ message: "Failed to fetch worker certifications" });
    }
  });

  app.get("/api/worker-certifications/:id", async (req, res) => {
    try {
      const cert = await storage.getWorkerCertification(req.user!.organizationId, req.params.id);
      if (!cert) return res.status(404).json({ message: "Worker certification not found" });
      res.json(cert);
    } catch {
      res.status(500).json({ message: "Failed to fetch worker certification" });
    }
  });

  app.post("/api/worker-certifications", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const parsed = insertWorkerCertificationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgId = req.user!.organizationId;
      const targetUser = await storage.getUser(parsed.data.userId);
      if (!targetUser) return res.status(400).json({ message: "User not found" });
      if (targetUser.organizationId !== orgId) return res.status(403).json({ message: "Forbidden" });
      const cert = await storage.createWorkerCertification(orgId, parsed.data);
      if (cert.expiryDate) {
        const days = Math.floor((new Date(cert.expiryDate).getTime() - Date.now()) / 86400000);
        if (days <= 30) {
          createNotificationForOrgAdmins(
            orgId,
            "cert_expiring",
            "Worker Certification Expiring",
            `${cert.certType} certification for worker expires in ${days} day(s)`,
            "worker_certification",
            cert.id,
          ).catch(console.error);
        }
      }
      res.status(201).json(cert);
    } catch {
      res.status(500).json({ message: "Failed to create worker certification" });
    }
  });

  app.patch("/api/worker-certifications/:id", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const parsed = updateWorkerCertificationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgId = req.user!.organizationId;
      if (parsed.data.userId) {
        const targetUser = await storage.getUser(parsed.data.userId);
        if (!targetUser) return res.status(400).json({ message: "User not found" });
        if (targetUser.organizationId !== orgId) return res.status(403).json({ message: "Forbidden" });
      }
      const updated = await storage.updateWorkerCertification(orgId, req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Worker certification not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update worker certification" });
    }
  });

  app.delete("/api/worker-certifications/:id", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const deleted = await storage.deleteWorkerCertification(req.user!.organizationId, req.params.id);
      if (!deleted) return res.status(404).json({ message: "Worker certification not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete worker certification" });
    }
  });

  // ─── Certificates of Insurance (Phase 7B) ─────────────────────────────────

  app.get("/api/certificates-of-insurance", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      const { tradeCompanyId, linkedOrganizationId, coverageType } = req.query as {
        tradeCompanyId?: string; linkedOrganizationId?: string; coverageType?: string;
      };
      const filters: { tradeCompanyId?: string; linkedOrganizationId?: string; coverageType?: string } = {};
      if (typeof tradeCompanyId === "string" && tradeCompanyId) filters.tradeCompanyId = tradeCompanyId;
      if (typeof linkedOrganizationId === "string" && linkedOrganizationId) filters.linkedOrganizationId = linkedOrganizationId;
      if (typeof coverageType === "string" && coverageType) filters.coverageType = coverageType;
      res.json(await storage.getCertificatesOfInsurance(orgId, filters));
    } catch {
      res.status(500).json({ message: "Failed to fetch certificates of insurance" });
    }
  });

  app.get("/api/certificates-of-insurance/:id", async (req, res) => {
    try {
      const coi = await storage.getCertificateOfInsurance(req.user!.organizationId, req.params.id);
      if (!coi) return res.status(404).json({ message: "Certificate of insurance not found" });
      res.json(coi);
    } catch {
      res.status(500).json({ message: "Failed to fetch certificate of insurance" });
    }
  });

  app.post("/api/certificates-of-insurance", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const parsed = insertCertificateOfInsuranceSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgId = req.user!.organizationId;
      if (parsed.data.tradeCompanyId) {
        const trade = await storage.getTrade(parsed.data.tradeCompanyId);
        if (!trade) return res.status(400).json({ message: "Trade company not found" });
        if (trade.organizationId !== orgId) return res.status(403).json({ message: "Forbidden" });
      }
      const coi = await storage.createCertificateOfInsurance(orgId, parsed.data);
      if (coi.expiryDate) {
        const days = Math.floor((new Date(coi.expiryDate).getTime() - Date.now()) / 86400000);
        if (days <= 30) {
          createNotificationForOrgAdmins(
            orgId,
            "coi_expiring",
            "Certificate of Insurance Expiring",
            `COI for ${coi.companyName} expires in ${days} day(s)`,
            "certificate_of_insurance",
            coi.id,
          ).catch(console.error);
        }
      }
      res.status(201).json(coi);
    } catch {
      res.status(500).json({ message: "Failed to create certificate of insurance" });
    }
  });

  app.patch("/api/certificates-of-insurance/:id", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const parsed = updateCertificateOfInsuranceSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgId = req.user!.organizationId;
      if (parsed.data.tradeCompanyId) {
        const trade = await storage.getTrade(parsed.data.tradeCompanyId);
        if (!trade) return res.status(400).json({ message: "Trade company not found" });
        if (trade.organizationId !== orgId) return res.status(403).json({ message: "Forbidden" });
      }
      const updated = await storage.updateCertificateOfInsurance(orgId, req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Certificate of insurance not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update certificate of insurance" });
    }
  });

  app.delete("/api/certificates-of-insurance/:id", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const deleted = await storage.deleteCertificateOfInsurance(req.user!.organizationId, req.params.id);
      if (!deleted) return res.status(404).json({ message: "Certificate of insurance not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete certificate of insurance" });
    }
  });

  // ─── OSHA Incidents (Phase 7C) ────────────────────────────────────────────

  app.get("/api/osha-incidents", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      const { jobsiteId, caseType, recordableCase } = req.query as {
        jobsiteId?: string; caseType?: string; recordableCase?: string;
      };
      const filters: { jobsiteId?: string; caseType?: string; recordableCase?: string } = {};
      if (typeof jobsiteId === "string" && jobsiteId) filters.jobsiteId = jobsiteId;
      if (typeof caseType === "string" && caseType) filters.caseType = caseType;
      if (typeof recordableCase === "string" && recordableCase) filters.recordableCase = recordableCase;
      res.json(await storage.getOshaIncidents(orgId, filters));
    } catch {
      res.status(500).json({ message: "Failed to fetch OSHA incidents" });
    }
  });

  app.get("/api/osha-incidents/:id", async (req, res) => {
    try {
      const incident = await storage.getOshaIncident(req.user!.organizationId, req.params.id);
      if (!incident) return res.status(404).json({ message: "OSHA incident not found" });
      res.json(incident);
    } catch {
      res.status(500).json({ message: "Failed to fetch OSHA incident" });
    }
  });

  app.post("/api/osha-incidents", async (req, res) => {
    try {
      const parsed = insertOshaIncidentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgId = req.user!.organizationId;
      if (parsed.data.jobsiteId) {
        const jobsite = await storage.getJobsite(parsed.data.jobsiteId);
        if (!jobsite) return res.status(400).json({ message: "Jobsite not found" });
        if (jobsite.organizationId !== orgId) return res.status(403).json({ message: "Forbidden" });
      }
      const incident = await storage.createOshaIncident(orgId, parsed.data);
      createNotificationForOrgAdmins(
        orgId,
        "osha_incident_filed",
        "New OSHA Incident Filed",
        `A new ${incident.caseType} incident was filed for ${incident.employeeName}`,
        "osha_incident",
        incident.id,
      ).catch(console.error);
      res.status(201).json(incident);
    } catch {
      res.status(500).json({ message: "Failed to create OSHA incident" });
    }
  });

  app.patch("/api/osha-incidents/:id", async (req, res) => {
    try {
      const parsed = updateOshaIncidentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgId = req.user!.organizationId;
      if (parsed.data.jobsiteId) {
        const jobsite = await storage.getJobsite(parsed.data.jobsiteId);
        if (!jobsite) return res.status(400).json({ message: "Jobsite not found" });
        if (jobsite.organizationId !== orgId) return res.status(403).json({ message: "Forbidden" });
      }
      const updated = await storage.updateOshaIncident(orgId, req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ message: "OSHA incident not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update OSHA incident" });
    }
  });

  app.delete("/api/osha-incidents/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteOshaIncident(req.user!.organizationId, req.params.id);
      if (!deleted) return res.status(404).json({ message: "OSHA incident not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete OSHA incident" });
    }
  });

  // ─── Work Hours Log (Phase 7C) ────────────────────────────────────────────

  app.get("/api/work-hours-log", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      const { periodStart, periodEnd } = req.query as { periodStart?: string; periodEnd?: string };
      const filters: { periodStart?: string; periodEnd?: string } = {};
      if (typeof periodStart === "string" && periodStart) filters.periodStart = periodStart;
      if (typeof periodEnd === "string" && periodEnd) filters.periodEnd = periodEnd;
      res.json(await storage.getWorkHoursLog(orgId, filters));
    } catch {
      res.status(500).json({ message: "Failed to fetch work hours log" });
    }
  });

  app.get("/api/work-hours-log/:id", async (req, res) => {
    try {
      const entry = await storage.getWorkHoursLogEntry(req.user!.organizationId, req.params.id);
      if (!entry) return res.status(404).json({ message: "Work hours log entry not found" });
      res.json(entry);
    } catch {
      res.status(500).json({ message: "Failed to fetch work hours log entry" });
    }
  });

  app.post("/api/work-hours-log", async (req, res) => {
    try {
      const parsed = insertWorkHoursLogSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const entry = await storage.createWorkHoursLogEntry(req.user!.organizationId, parsed.data);
      res.status(201).json(entry);
    } catch {
      res.status(500).json({ message: "Failed to create work hours log entry" });
    }
  });

  app.patch("/api/work-hours-log/:id", async (req, res) => {
    try {
      const parsed = updateWorkHoursLogSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const updated = await storage.updateWorkHoursLogEntry(req.user!.organizationId, req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Work hours log entry not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update work hours log entry" });
    }
  });

  app.delete("/api/work-hours-log/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteWorkHoursLogEntry(req.user!.organizationId, req.params.id);
      if (!deleted) return res.status(404).json({ message: "Work hours log entry not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete work hours log entry" });
    }
  });

  // ─── EMR / TRIR (Phase 7C) ────────────────────────────────────────────────

  app.get("/api/emr/trir", async (req, res) => {
    try {
      const result = await storage.computeTrir(req.user!.organizationId);
      res.json(result);
    } catch {
      res.status(500).json({ message: "Failed to compute TRIR" });
    }
  });

  // ─── Drivers (Phase 7D) ───────────────────────────────────────────────────

  app.get("/api/drivers", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      const { status } = req.query as { status?: string };
      const filters: { status?: string } = {};
      if (typeof status === "string" && status) filters.status = status;
      res.json(await storage.getDrivers(orgId, filters));
    } catch {
      res.status(500).json({ message: "Failed to fetch drivers" });
    }
  });

  app.get("/api/drivers/:id/workload", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      const driver = await storage.getDriver(orgId, req.params.id);
      if (!driver) return res.status(404).json({ message: "Driver not found" });
      const workload = await storage.getDriverWorkload(orgId, req.params.id);
      res.json(workload);
    } catch {
      res.status(500).json({ message: "Failed to fetch driver workload" });
    }
  });

  app.get("/api/drivers/:id", async (req, res) => {
    try {
      const driver = await storage.getDriver(req.user!.organizationId, req.params.id);
      if (!driver) return res.status(404).json({ message: "Driver not found" });
      res.json(driver);
    } catch {
      res.status(500).json({ message: "Failed to fetch driver" });
    }
  });

  app.post("/api/drivers", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const parsed = insertDriverSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const driver = await storage.createDriver(req.user!.organizationId, parsed.data);
      res.status(201).json(driver);
    } catch {
      res.status(500).json({ message: "Failed to create driver" });
    }
  });

  app.patch("/api/drivers/:id", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const parsed = updateDriverSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const updated = await storage.updateDriver(req.user!.organizationId, req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Driver not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update driver" });
    }
  });

  app.delete("/api/drivers/:id", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const deleted = await storage.deleteDriver(req.user!.organizationId, req.params.id);
      if (!deleted) return res.status(404).json({ message: "Driver not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete driver" });
    }
  });

  // ─── Delivery Requests (Phase 7D) ─────────────────────────────────────────

  app.get("/api/delivery-requests", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      const { jobsiteId, driverId, status } = req.query as {
        jobsiteId?: string; driverId?: string; status?: string;
      };
      const filters: { jobsiteId?: string; driverId?: string; status?: string } = {};
      if (typeof jobsiteId === "string" && jobsiteId) filters.jobsiteId = jobsiteId;
      if (typeof driverId === "string" && driverId) filters.driverId = driverId;
      if (typeof status === "string" && status) filters.status = status;
      res.json(await storage.getDeliveryRequests(orgId, filters));
    } catch {
      res.status(500).json({ message: "Failed to fetch delivery requests" });
    }
  });

  app.get("/api/delivery-requests/:id", async (req, res) => {
    try {
      const dr = await storage.getDeliveryRequest(req.user!.organizationId, req.params.id);
      if (!dr) return res.status(404).json({ message: "Delivery request not found" });
      res.json(dr);
    } catch {
      res.status(500).json({ message: "Failed to fetch delivery request" });
    }
  });

  app.post("/api/delivery-requests", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const parsed = insertDeliveryRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const dr = await storage.createDeliveryRequest(req.user!.organizationId, parsed.data);
      res.status(201).json(dr);
    } catch {
      res.status(500).json({ message: "Failed to create delivery request" });
    }
  });

  app.patch("/api/delivery-requests/:id", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const parsed = updateDeliveryRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const updated = await storage.updateDeliveryRequest(req.user!.organizationId, req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Delivery request not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update delivery request" });
    }
  });

  app.patch("/api/delivery-requests/:id/status", async (req, res) => {
    try {
      const parsed = updateDeliveryStatusSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgId = req.user!.organizationId;
      const updated = await storage.updateDeliveryStatus(orgId, req.params.id, parsed.data.status);
      if (!updated) return res.status(404).json({ message: "Delivery request not found" });
      if (updated.requestedBy && updated.requestedBy !== req.user!.id) {
        storage.createNotification({
          organizationId: orgId,
          userId: updated.requestedBy,
          type: "delivery_status_changed",
          title: "Delivery Status Updated",
          message: `Your delivery request status changed to ${parsed.data.status}`,
          entityType: "delivery_request",
          entityId: updated.id,
        }).catch(console.error);
      }
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update delivery status" });
    }
  });

  app.delete("/api/delivery-requests/:id", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const deleted = await storage.deleteDeliveryRequest(req.user!.organizationId, req.params.id);
      if (!deleted) return res.status(404).json({ message: "Delivery request not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete delivery request" });
    }
  });

  // ─── Delivery NFC Events (Phase 7D) ───────────────────────────────────────

  app.get("/api/delivery-nfc-events", async (req, res) => {
    try {
      const { deliveryRequestId } = req.query as { deliveryRequestId?: string };
      if (typeof deliveryRequestId !== "string" || !deliveryRequestId) {
        return res.status(400).json({ message: "deliveryRequestId is required" });
      }
      const events = await storage.getDeliveryNfcEvents(req.user!.organizationId, deliveryRequestId);
      res.json(events);
    } catch {
      res.status(500).json({ message: "Failed to fetch NFC events" });
    }
  });

  app.post("/api/delivery-nfc-events", async (req, res) => {
    try {
      const parsed = insertDeliveryNfcEventSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgId = req.user!.organizationId;
      const dr = await storage.getDeliveryRequest(orgId, parsed.data.deliveryRequestId);
      if (!dr) return res.status(404).json({ message: "Delivery request not found" });
      const event = await storage.createDeliveryNfcEvent(orgId, parsed.data);
      res.status(201).json(event);
    } catch {
      res.status(500).json({ message: "Failed to create NFC event" });
    }
  });

  // ─── Inventory Items (Phase 7E) ───────────────────────────────────────────

  app.get("/api/inventory-items", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      const { category, condition, currentJobsiteId, assignedTo } = req.query as {
        category?: string; condition?: string; currentJobsiteId?: string; assignedTo?: string;
      };
      const filters: { category?: string; condition?: string; currentJobsiteId?: string; assignedTo?: string } = {};
      if (typeof category === "string" && category) filters.category = category;
      if (typeof condition === "string" && condition) filters.condition = condition;
      if (typeof currentJobsiteId === "string" && currentJobsiteId) filters.currentJobsiteId = currentJobsiteId;
      if (typeof assignedTo === "string" && assignedTo) filters.assignedTo = assignedTo;
      res.json(await storage.getInventoryItems(orgId, filters));
    } catch {
      res.status(500).json({ message: "Failed to fetch inventory items" });
    }
  });

  app.get("/api/inventory-items/by-nfc/:nfcTagId", async (req, res) => {
    try {
      const item = await storage.getInventoryItemByNfcTag(req.user!.organizationId, req.params.nfcTagId);
      if (!item) return res.status(404).json({ message: "Inventory item not found" });
      res.json(item);
    } catch {
      res.status(500).json({ message: "Failed to fetch inventory item" });
    }
  });

  app.get("/api/inventory-items/:id", async (req, res) => {
    try {
      const item = await storage.getInventoryItem(req.user!.organizationId, req.params.id);
      if (!item) return res.status(404).json({ message: "Inventory item not found" });
      res.json(item);
    } catch {
      res.status(500).json({ message: "Failed to fetch inventory item" });
    }
  });

  app.post("/api/inventory-items", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const parsed = insertInventoryItemSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const item = await storage.createInventoryItem(req.user!.organizationId, parsed.data);
      res.status(201).json(item);
    } catch {
      res.status(500).json({ message: "Failed to create inventory item" });
    }
  });

  app.patch("/api/inventory-items/:id", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const parsed = updateInventoryItemSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const updated = await storage.updateInventoryItem(req.user!.organizationId, req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Inventory item not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update inventory item" });
    }
  });

  app.delete("/api/inventory-items/:id", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const deleted = await storage.deleteInventoryItem(req.user!.organizationId, req.params.id);
      if (!deleted) return res.status(404).json({ message: "Inventory item not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete inventory item" });
    }
  });

  // ─── Inventory Checkouts (Phase 7E) ───────────────────────────────────────

  app.get("/api/inventory-checkouts", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      const { inventoryItemId, jobsiteId, open } = req.query as {
        inventoryItemId?: string; jobsiteId?: string; open?: string;
      };
      const filters: { inventoryItemId?: string; jobsiteId?: string; open?: boolean } = {};
      if (typeof inventoryItemId === "string" && inventoryItemId) filters.inventoryItemId = inventoryItemId;
      if (typeof jobsiteId === "string" && jobsiteId) filters.jobsiteId = jobsiteId;
      if (open === "true") filters.open = true;
      res.json(await storage.getInventoryCheckouts(orgId, filters));
    } catch {
      res.status(500).json({ message: "Failed to fetch inventory checkouts" });
    }
  });

  app.get("/api/inventory-checkouts/:id", async (req, res) => {
    try {
      const checkout = await storage.getInventoryCheckout(req.user!.organizationId, req.params.id);
      if (!checkout) return res.status(404).json({ message: "Inventory checkout not found" });
      res.json(checkout);
    } catch {
      res.status(500).json({ message: "Failed to fetch inventory checkout" });
    }
  });

  app.post("/api/inventory-checkouts", async (req, res) => {
    try {
      const parsed = insertInventoryCheckoutSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgId = req.user!.organizationId;
      const item = await storage.getInventoryItem(orgId, parsed.data.inventoryItemId);
      if (!item) return res.status(404).json({ message: "Inventory item not found" });
      const checkout = await storage.createInventoryCheckout(orgId, parsed.data);
      res.status(201).json(checkout);
    } catch {
      res.status(500).json({ message: "Failed to create inventory checkout" });
    }
  });

  app.post("/api/inventory-checkouts/:id/close", async (req, res) => {
    try {
      const parsed = closeInventoryCheckoutSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgId = req.user!.organizationId;
      const existing = await storage.getInventoryCheckout(orgId, req.params.id);
      if (!existing) return res.status(404).json({ message: "Inventory checkout not found" });
      if (existing.returnedAt) return res.status(400).json({ message: "Checkout already closed" });
      const closed = await storage.closeInventoryCheckout(orgId, req.params.id, parsed.data);
      if (!closed) return res.status(404).json({ message: "Inventory checkout not found" });
      res.json(closed);
    } catch {
      res.status(500).json({ message: "Failed to close inventory checkout" });
    }
  });

  // ─── Inventory Condition Reports (Phase 7E) ───────────────────────────────

  app.get("/api/inventory-condition-reports", async (req, res) => {
    try {
      const { inventoryItemId } = req.query as { inventoryItemId?: string };
      if (typeof inventoryItemId !== "string" || !inventoryItemId) {
        return res.status(400).json({ message: "inventoryItemId is required" });
      }
      const reports = await storage.getInventoryConditionReports(req.user!.organizationId, inventoryItemId);
      res.json(reports);
    } catch {
      res.status(500).json({ message: "Failed to fetch condition reports" });
    }
  });

  app.post("/api/inventory-condition-reports", async (req, res) => {
    try {
      const parsed = insertInventoryConditionReportSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgId = req.user!.organizationId;
      const item = await storage.getInventoryItem(orgId, parsed.data.inventoryItemId);
      if (!item) return res.status(404).json({ message: "Inventory item not found" });
      const report = await storage.createInventoryConditionReport(orgId, parsed.data);
      res.status(201).json(report);
    } catch {
      res.status(500).json({ message: "Failed to create condition report" });
    }
  });

  // ─── Inventory Service Tickets (Phase 7E) ─────────────────────────────────

  app.get("/api/inventory-service-tickets", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      const { inventoryItemId, status } = req.query as {
        inventoryItemId?: string; status?: string;
      };
      const filters: { inventoryItemId?: string; status?: string } = {};
      if (typeof inventoryItemId === "string" && inventoryItemId) filters.inventoryItemId = inventoryItemId;
      if (typeof status === "string" && status) filters.status = status;
      res.json(await storage.getInventoryServiceTickets(orgId, filters));
    } catch {
      res.status(500).json({ message: "Failed to fetch service tickets" });
    }
  });

  app.get("/api/inventory-service-tickets/:id", async (req, res) => {
    try {
      const ticket = await storage.getInventoryServiceTicket(req.user!.organizationId, req.params.id);
      if (!ticket) return res.status(404).json({ message: "Service ticket not found" });
      res.json(ticket);
    } catch {
      res.status(500).json({ message: "Failed to fetch service ticket" });
    }
  });

  app.post("/api/inventory-service-tickets", async (req, res) => {
    try {
      const parsed = insertInventoryServiceTicketSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgId = req.user!.organizationId;
      const item = await storage.getInventoryItem(orgId, parsed.data.inventoryItemId);
      if (!item) return res.status(404).json({ message: "Inventory item not found" });
      const ticket = await storage.createInventoryServiceTicket(orgId, parsed.data);
      res.status(201).json(ticket);
    } catch {
      res.status(500).json({ message: "Failed to create service ticket" });
    }
  });

  app.patch("/api/inventory-service-tickets/:id", async (req, res) => {
    try {
      const parsed = updateInventoryServiceTicketSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const updated = await storage.updateInventoryServiceTicket(req.user!.organizationId, req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Service ticket not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update service ticket" });
    }
  });

  // ─── Portfolio (Phase 7F) ───────────────────────────────────────────────────

  app.get("/api/portfolio", async (req, res) => {
    try {
      const allSectionsTrue: VisibleSections = {
        trir: true, workerCerts: true, coi: true,
        jobsites: true, oshaIncidents: true, inventory: true,
      };
      const snapshot = await storage.getPortfolioSnapshot(req.user!.organizationId, allSectionsTrue);
      res.json(snapshot);
    } catch {
      res.status(500).json({ message: "Failed to load portfolio" });
    }
  });

  app.get("/api/portfolio-shares", async (req, res) => {
    try {
      const shares = await storage.getPortfolioShares(req.user!.organizationId);
      res.json(shares);
    } catch {
      res.status(500).json({ message: "Failed to fetch portfolio shares" });
    }
  });

  app.post("/api/portfolio-shares", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const parsed = insertPortfolioShareSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const data = { ...parsed.data, createdBy: parsed.data.createdBy ?? req.user!.id };
      const share = await storage.createPortfolioShare(req.user!.organizationId, data);
      res.status(201).json({ ...share, shareUrl: `/api/public/portfolio/${share.token}` });
    } catch {
      res.status(500).json({ message: "Failed to create portfolio share" });
    }
  });

  app.delete("/api/portfolio-shares/:id", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const revoked = await storage.revokePortfolioShare(req.user!.organizationId, req.params.id);
      if (!revoked) return res.status(404).json({ message: "Portfolio share not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to revoke portfolio share" });
    }
  });

  // ─── Notifications (Phase 8) ────────────────────────────────────────────────

  app.get("/api/notifications", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      const userId = req.user!.id;
      const unreadOnly = req.query.unreadOnly === "true";
      const notifications = await storage.getNotifications(orgId, userId, { unreadOnly });
      const unreadCount = await storage.getUnreadNotificationCount(orgId, userId);
      res.json({ notifications, unreadCount });
    } catch (e) {
      console.error("GET /api/notifications failed:", e);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/count", async (req, res) => {
    try {
      const unreadCount = await storage.getUnreadNotificationCount(req.user!.organizationId, req.user!.id);
      res.json({ unreadCount });
    } catch (e) {
      console.error("GET /api/notifications/count failed:", e);
      res.status(500).json({ message: "Failed to fetch notification count" });
    }
  });

  app.patch("/api/notifications/read-all", async (req, res) => {
    try {
      await storage.markAllNotificationsRead(req.user!.organizationId, req.user!.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to mark all notifications read" });
    }
  });

  app.post("/api/notifications/scan", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      let created = 0;
      const now = Date.now();
      const cutoff = now + 30 * 86400000;

      const certs = await storage.getWorkerCertifications(orgId);
      for (const cert of certs) {
        if (!cert.expiryDate) continue;
        const exp = new Date(cert.expiryDate).getTime();
        if (isNaN(exp) || exp > cutoff) continue;
        const existing = await storage.getNotificationByEntity(orgId, "cert_expiring", cert.id);
        if (existing) continue;
        const days = Math.floor((exp - now) / 86400000);
        await createNotificationForOrgAdmins(
          orgId,
          "cert_expiring",
          "Worker Certification Expiring",
          `${cert.certType} certification for worker expires in ${days} day(s)`,
          "worker_certification",
          cert.id,
        );
        created++;
      }

      const cois = await storage.getCertificatesOfInsurance(orgId);
      for (const coi of cois) {
        if (!coi.expiryDate) continue;
        const exp = new Date(coi.expiryDate).getTime();
        if (isNaN(exp) || exp > cutoff) continue;
        const existing = await storage.getNotificationByEntity(orgId, "coi_expiring", coi.id);
        if (existing) continue;
        const days = Math.floor((exp - now) / 86400000);
        await createNotificationForOrgAdmins(
          orgId,
          "coi_expiring",
          "Certificate of Insurance Expiring",
          `COI for ${coi.companyName} expires in ${days} day(s)`,
          "certificate_of_insurance",
          coi.id,
        );
        created++;
      }

      const today = new Date().toISOString().slice(0, 10);
      const checkouts = await storage.getInventoryCheckouts(orgId, { open: true });
      for (const co of checkouts) {
        if (!co.expectedReturnDate || co.returnedAt) continue;
        if (co.expectedReturnDate >= today) continue;
        const existing = await storage.getNotificationByEntity(orgId, "inventory_overdue", co.inventoryItemId);
        if (existing) continue;
        const item = await storage.getInventoryItem(orgId, co.inventoryItemId);
        const itemName = item?.name ?? "Inventory item";
        await createNotificationForOrgAdmins(
          orgId,
          "inventory_overdue",
          "Inventory Checkout Overdue",
          `${itemName} was due back on ${co.expectedReturnDate}`,
          "inventory_item",
          co.inventoryItemId,
        );
        created++;
      }

      res.json({ scanned: true, created });
    } catch {
      res.status(500).json({ message: "Failed to scan for notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const updated = await storage.markNotificationRead(req.user!.organizationId, req.user!.id, req.params.id);
      if (!updated) return res.status(404).json({ message: "Notification not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to mark notification read" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteNotification(req.user!.organizationId, req.user!.id, req.params.id);
      if (!deleted) return res.status(404).json({ message: "Notification not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // ─── Procurement Requests (Phase 9) ──────────────────────────────────────

  app.get("/api/procurement-requests", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      const { status, jobsiteId, requestedBy } = req.query as {
        status?: string; jobsiteId?: string; requestedBy?: string;
      };
      const filters: { status?: string; jobsiteId?: string; requestedBy?: string } = {};
      if (typeof status === "string" && status) filters.status = status;
      if (typeof jobsiteId === "string" && jobsiteId) filters.jobsiteId = jobsiteId;
      if (typeof requestedBy === "string" && requestedBy) filters.requestedBy = requestedBy;
      res.json(await storage.getProcurementRequests(orgId, filters));
    } catch {
      res.status(500).json({ message: "Failed to fetch procurement requests" });
    }
  });

  app.get("/api/procurement-requests/:id", async (req, res) => {
    try {
      const pr = await storage.getProcurementRequest(req.user!.organizationId, req.params.id);
      if (!pr) return res.status(404).json({ message: "Procurement request not found" });
      res.json(pr);
    } catch {
      res.status(500).json({ message: "Failed to fetch procurement request" });
    }
  });

  app.post("/api/procurement-requests", async (req, res) => {
    try {
      const parsed = insertProcurementRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const pr = await storage.createProcurementRequest(req.user!.organizationId, parsed.data);
      res.status(201).json(pr);
    } catch {
      res.status(500).json({ message: "Failed to create procurement request" });
    }
  });

  app.patch("/api/procurement-requests/:id", async (req, res) => {
    try {
      const parsed = updateProcurementRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const updated = await storage.updateProcurementRequest(req.user!.organizationId, req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Procurement request not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update procurement request" });
    }
  });

  app.delete("/api/procurement-requests/:id", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      const existing = await storage.getProcurementRequest(orgId, req.params.id);
      if (!existing) return res.status(404).json({ message: "Procurement request not found" });
      if (existing.status !== "draft" && existing.status !== "cancelled") {
        return res.status(400).json({ message: "Only draft or cancelled requests can be deleted" });
      }
      const deleted = await storage.deleteProcurementRequest(orgId, req.params.id);
      if (!deleted) return res.status(404).json({ message: "Procurement request not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete procurement request" });
    }
  });

  app.patch("/api/procurement-requests/:id/status", async (req, res) => {
    try {
      const parsed = updateProcurementStatusSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgId = req.user!.organizationId;
      const existing = await storage.getProcurementRequest(orgId, req.params.id);
      if (!existing) return res.status(404).json({ message: "Procurement request not found" });

      const isAdminOrOwner = req.user!.role === "Admin" || req.user!.role === "Owner";
      const newStatus = parsed.data.status;

      if (newStatus === "approved" || newStatus === "rejected" || newStatus === "dispatched" || newStatus === "delivered") {
        if (!isAdminOrOwner) return res.status(403).json({ message: "Forbidden" });
      } else if (newStatus === "cancelled") {
        if (!isAdminOrOwner && existing.requestedBy !== req.user!.id) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      const updated = await storage.transitionProcurementStatus(orgId, req.params.id, parsed.data, req.user!.id);
      if (!updated) return res.status(404).json({ message: "Procurement request not found" });

      const reqId = updated.id;
      if (newStatus === "submitted") {
        createNotificationForOrgAdmins(
          orgId,
          "procurement_submitted",
          "New Procurement Request",
          `A new procurement request has been submitted`,
          "procurement_request",
          reqId,
        ).catch(console.error);
      } else if (newStatus === "approved") {
        storage.createNotification({
          organizationId: orgId,
          userId: updated.requestedBy,
          type: "procurement_approved",
          title: "Request Approved",
          message: "Your procurement request has been approved",
          entityType: "procurement_request",
          entityId: reqId,
        }).catch(console.error);
      } else if (newStatus === "rejected") {
        storage.createNotification({
          organizationId: orgId,
          userId: updated.requestedBy,
          type: "procurement_rejected",
          title: "Request Rejected",
          message: "Your procurement request has been rejected",
          entityType: "procurement_request",
          entityId: reqId,
        }).catch(console.error);
      } else if (newStatus === "dispatched") {
        storage.createNotification({
          organizationId: orgId,
          userId: updated.requestedBy,
          type: "procurement_dispatched",
          title: "Request Dispatched",
          message: "Your procurement request has been dispatched",
          entityType: "procurement_request",
          entityId: reqId,
        }).catch(console.error);
      } else if (newStatus === "delivered") {
        storage.createNotification({
          organizationId: orgId,
          userId: updated.requestedBy,
          type: "procurement_delivered",
          title: "Request Delivered",
          message: "Your procurement request has been delivered",
          entityType: "procurement_request",
          entityId: reqId,
        }).catch(console.error);
      }

      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update procurement status" });
    }
  });

  // ─── Procurement Request Items (Phase 9) ─────────────────────────────────

  app.get("/api/procurement-requests/:id/items", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      const pr = await storage.getProcurementRequest(orgId, req.params.id);
      if (!pr) return res.status(404).json({ message: "Procurement request not found" });
      const items = await storage.getProcurementRequestItems(orgId, req.params.id);
      res.json(items);
    } catch {
      res.status(500).json({ message: "Failed to fetch procurement items" });
    }
  });

  app.post("/api/procurement-requests/:id/items", async (req, res) => {
    try {
      const parsed = insertProcurementRequestItemSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgId = req.user!.organizationId;
      const pr = await storage.getProcurementRequest(orgId, req.params.id);
      if (!pr) return res.status(404).json({ message: "Procurement request not found" });
      const item = await storage.createProcurementRequestItem(orgId, req.params.id, parsed.data);
      res.status(201).json(item);
    } catch {
      res.status(500).json({ message: "Failed to create procurement item" });
    }
  });

  app.get("/api/procurement-request-items/:id", async (req, res) => {
    try {
      const item = await storage.getProcurementRequestItem(req.user!.organizationId, req.params.id);
      if (!item) return res.status(404).json({ message: "Procurement item not found" });
      res.json(item);
    } catch {
      res.status(500).json({ message: "Failed to fetch procurement item" });
    }
  });

  app.patch("/api/procurement-request-items/:id", async (req, res) => {
    try {
      const parsed = updateProcurementRequestItemSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const updated = await storage.updateProcurementRequestItem(req.user!.organizationId, req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Procurement item not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update procurement item" });
    }
  });

  app.delete("/api/procurement-request-items/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProcurementRequestItem(req.user!.organizationId, req.params.id);
      if (!deleted) return res.status(404).json({ message: "Procurement item not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete procurement item" });
    }
  });

  // ─── Delivery Assignments (Phase 9) ──────────────────────────────────────

  app.get("/api/delivery-assignments", async (req, res) => {
    try {
      const orgId = req.user!.organizationId;
      const { procurementRequestId, deliveryRequestId } = req.query as {
        procurementRequestId?: string; deliveryRequestId?: string;
      };
      const filters: { procurementRequestId?: string; deliveryRequestId?: string } = {};
      if (typeof procurementRequestId === "string" && procurementRequestId) filters.procurementRequestId = procurementRequestId;
      if (typeof deliveryRequestId === "string" && deliveryRequestId) filters.deliveryRequestId = deliveryRequestId;
      res.json(await storage.getDeliveryAssignments(orgId, filters));
    } catch {
      res.status(500).json({ message: "Failed to fetch delivery assignments" });
    }
  });

  // ─── Compliance Engine (Phase 11) ───────────────────────────────────────────

  app.get("/api/jobsites/:id/workers", async (req, res) => {
    try {
      const jobsite = await storage.getJobsite(req.params.id);
      if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
      if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
      const workers = await storage.getJobsiteWorkerAssignments(req.params.id, req.user!.organizationId);
      res.json(workers);
    } catch {
      res.status(500).json({ message: "Failed to fetch worker assignments" });
    }
  });

  app.post("/api/jobsites/:id/workers", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const jobsite = await storage.getJobsite(req.params.id);
      if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
      if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
      const parsed = insertJobsiteWorkerAssignmentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const orgUsers = await storage.getUsersByOrg(req.user!.organizationId);
      if (!orgUsers.find(u => u.id === parsed.data.userId)) {
        return res.status(400).json({ message: "User not found in your organization" });
      }
      const assignment = await storage.createJobsiteWorkerAssignment(req.params.id, req.user!.organizationId, parsed.data);
      res.status(201).json(assignment);
    } catch {
      res.status(500).json({ message: "Failed to create worker assignment" });
    }
  });

  app.delete("/api/jobsites/:id/workers/:assignmentId", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const jobsite = await storage.getJobsite(req.params.id);
      if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
      if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteJobsiteWorkerAssignment(req.params.assignmentId, req.user!.organizationId);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete worker assignment" });
    }
  });

  app.get("/api/jobsites/:id/compliance", async (req, res) => {
    try {
      const jobsite = await storage.getJobsite(req.params.id);
      if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
      if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
      const audit = await storage.getJobsiteComplianceAudit(req.params.id, req.user!.organizationId);
      if (!audit) return res.status(404).json({ message: "Jobsite not found" });
      res.json(audit);
    } catch {
      res.status(500).json({ message: "Failed to fetch compliance audit" });
    }
  });

  app.get("/api/compliance/summary", async (req, res) => {
    try {
      const summary = await storage.getOrgComplianceSummary(req.user!.organizationId);
      res.json(summary);
    } catch {
      res.status(500).json({ message: "Failed to fetch compliance summary" });
    }
  });

  app.get("/api/jobsites/:id/violations", async (req, res) => {
    try {
      const jobsite = await storage.getJobsite(req.params.id);
      if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
      if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
      const violations = await storage.getJobsiteViolations(req.params.id, req.user!.organizationId);
      res.json(violations);
    } catch {
      res.status(500).json({ message: "Failed to fetch violations" });
    }
  });

  app.post("/api/jobsites/:id/violations", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const jobsite = await storage.getJobsite(req.params.id);
      if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
      if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
      const parsed = insertJobsiteViolationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const violation = await storage.createJobsiteViolation(req.params.id, req.user!.organizationId, parsed.data);
      res.status(201).json(violation);
    } catch {
      res.status(500).json({ message: "Failed to create violation" });
    }
  });

  app.patch("/api/jobsites/:id/violations/:vid", requireRole("Admin", "Owner"), async (req, res) => {
    try {
      const jobsite = await storage.getJobsite(req.params.id);
      if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
      if (jobsite.organizationId !== req.user!.organizationId) return res.status(403).json({ message: "Forbidden" });
      const parsed = updateJobsiteViolationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const updated = await storage.updateJobsiteViolation(req.params.vid, req.user!.organizationId, parsed.data);
      if (!updated) return res.status(404).json({ message: "Violation not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update violation" });
    }
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
