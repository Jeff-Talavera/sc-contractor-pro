import { db } from "./db";
import * as t from "@shared/tables";
import { eq, isNull } from "drizzle-orm";
import bcrypt from "bcrypt";
import {
  mockOrganizations, mockUsers, mockClients, mockJobsites, mockCodeReferences,
  mockInspectionTemplates, mockInspections, mockObservations,
  mockPermits, mockExternalEvents,
  mockEmployeeProfiles, mockScheduleEntries, mockTimesheets, mockTimesheetEntries,
  mockSafetyReports, mockSafetyReportSettings
} from "./mockData";

const SEED_VERSION = "v1";

export async function seed() {
  // Check seed completion marker — more reliable than checking entity presence
  const marker = await db.select().from(t.seedMeta).where(eq(t.seedMeta.key, SEED_VERSION)).limit(1);
  if (marker.length > 0) {
    console.log("Database already seeded — skipping.");
    return;
  }

  console.log("Seeding database...");

  for (const org of mockOrganizations) {
    await db.insert(t.organizations).values({
      id: org.id, name: org.name, logoUrl: org.logoUrl ?? null,
    }).onConflictDoNothing();
  }

  for (const user of mockUsers) {
    await db.insert(t.users).values({
      id: user.id, organizationId: user.organizationId,
      name: user.name, email: user.email, role: user.role,
    }).onConflictDoNothing();
  }

  for (const client of mockClients) {
    await db.insert(t.clients).values({
      id: client.id, organizationId: client.organizationId,
      parentClientId: client.parentClientId ?? null,
      name: client.name, contactName: client.contactName,
      contactEmail: client.contactEmail, contactPhone: client.contactPhone,
      notes: client.notes ?? null,
    }).onConflictDoNothing();
  }

  for (const jobsite of mockJobsites) {
    await db.insert(t.jobsites).values({
      id: jobsite.id, organizationId: jobsite.organizationId, clientId: jobsite.clientId,
      name: jobsite.name, address: jobsite.address, city: jobsite.city,
      state: jobsite.state ?? null, bin: jobsite.bin ?? null,
      dobJobNumber: jobsite.dobJobNumber ?? null,
      projectType: jobsite.projectType, buildingType: jobsite.buildingType ?? null,
      stories: jobsite.stories ?? null,
      hasScaffold: jobsite.hasScaffold, hasHoist: jobsite.hasHoist,
      hasCrane: jobsite.hasCrane, hasExcavation: jobsite.hasExcavation,
      monitorPublicRecords: jobsite.monitorPublicRecords,
    }).onConflictDoNothing();
  }

  for (const cr of mockCodeReferences) {
    await db.insert(t.codeReferences).values({
      id: cr.id, codeType: cr.codeType,
      chapter: cr.chapter ?? null, sectionNumber: cr.sectionNumber,
      title: cr.title, plainSummary: cr.plainSummary,
      tags: cr.tags, officialUrl: cr.officialUrl,
    }).onConflictDoNothing();
  }

  for (const tmpl of mockInspectionTemplates) {
    await db.insert(t.inspectionTemplates).values({
      id: tmpl.id, organizationId: tmpl.organizationId,
      name: tmpl.name, description: tmpl.description, category: tmpl.category,
    }).onConflictDoNothing();
  }

  for (const insp of mockInspections) {
    await db.insert(t.inspections).values({
      id: insp.id, organizationId: insp.organizationId,
      jobsiteId: insp.jobsiteId, templateId: insp.templateId,
      date: insp.date, inspectorUserId: insp.inspectorUserId, status: insp.status,
      scopeOfWork: insp.scopeOfWork ?? null,
      ccList: insp.ccList ?? null,
      recipientName: insp.recipientName ?? null,
      recipientTitle: insp.recipientTitle ?? null,
      recipientCompany: insp.recipientCompany ?? null,
      recipientAddress: insp.recipientAddress ?? null,
    }).onConflictDoNothing();
  }

  for (const obs of mockObservations) {
    await db.insert(t.observations).values({
      id: obs.id, organizationId: obs.organizationId,
      inspectionId: obs.inspectionId, jobsiteId: obs.jobsiteId,
      createdAt: obs.createdAt, createdByUserId: obs.createdByUserId,
      location: obs.location, description: obs.description, category: obs.category,
      type: obs.type, severity: obs.severity, status: obs.status,
      correctedOnSite: obs.correctedOnSite ?? false,
      assignedTo: obs.assignedTo ?? null, dueDate: obs.dueDate ?? null,
      photoUrls: obs.photoUrls, linkedCodeReferenceIds: obs.linkedCodeReferenceIds,
      recommendedActions: obs.recommendedActions,
      source: obs.source, aiFindings: obs.aiFindings ?? null,
    }).onConflictDoNothing();
  }

  for (const pmt of mockPermits) {
    await db.insert(t.jobsitePermits).values({
      id: pmt.id, jobsiteId: pmt.jobsiteId, source: pmt.source,
      permitNumber: pmt.permitNumber, jobFilingNumber: pmt.jobFilingNumber ?? null,
      workType: pmt.workType, permitType: pmt.permitType ?? null,
      status: pmt.status, issueDate: pmt.issueDate ?? null,
      expirationDate: pmt.expirationDate ?? null,
      description: pmt.description ?? null, rawLocation: pmt.rawLocation ?? null,
      externalUrl: pmt.externalUrl ?? null,
      createdAt: pmt.createdAt, updatedAt: pmt.updatedAt,
    }).onConflictDoNothing();
  }

  for (const evt of mockExternalEvents) {
    await db.insert(t.jobsiteExternalEvents).values({
      id: evt.id, jobsiteId: evt.jobsiteId, source: evt.source,
      eventType: evt.eventType, externalId: evt.externalId, status: evt.status,
      category: evt.category ?? null, description: evt.description ?? null,
      issuedDate: evt.issuedDate ?? null, lastUpdatedDate: evt.lastUpdatedDate ?? null,
      rawLocation: evt.rawLocation ?? null, externalUrl: evt.externalUrl ?? null,
      isNew: evt.isNew ?? false, createdAt: evt.createdAt,
    }).onConflictDoNothing();
  }

  for (const emp of mockEmployeeProfiles) {
    await db.insert(t.employeeProfiles).values({
      id: emp.id, organizationId: emp.organizationId, userId: emp.userId,
      title: emp.title, phone: emp.phone, hireDate: emp.hireDate, status: emp.status,
      certifications: emp.certifications, licenseNumbers: emp.licenseNumbers,
      emergencyContact: emp.emergencyContact ?? null,
      emergencyPhone: emp.emergencyPhone ?? null,
      hourlyRate: emp.hourlyRate ?? null, notes: emp.notes ?? null,
    }).onConflictDoNothing();
  }

  for (const se of mockScheduleEntries) {
    await db.insert(t.scheduleEntries).values({
      id: se.id, organizationId: se.organizationId,
      employeeId: se.employeeId, jobsiteId: se.jobsiteId, date: se.date,
      shiftStart: se.shiftStart ?? null, shiftEnd: se.shiftEnd ?? null,
      status: se.status, notes: se.notes ?? null,
    }).onConflictDoNothing();
  }

  for (const ts of mockTimesheets) {
    await db.insert(t.timesheets).values({
      id: ts.id, organizationId: ts.organizationId,
      employeeId: ts.employeeId, weekStartDate: ts.weekStartDate,
      status: ts.status, submittedAt: ts.submittedAt ?? null,
      approvedBy: ts.approvedBy ?? null, approvedAt: ts.approvedAt ?? null,
      totalHours: ts.totalHours, notes: ts.notes ?? null,
    }).onConflictDoNothing();
  }

  for (const te of mockTimesheetEntries) {
    await db.insert(t.timesheetEntries).values({
      id: te.id, timesheetId: te.timesheetId, date: te.date,
      jobsiteId: te.jobsiteId ?? null, hours: te.hours,
      description: te.description ?? null,
    }).onConflictDoNothing();
  }

  for (const s of mockSafetyReportSettings) {
    await db.insert(t.safetyReportSettings).values({
      organizationId: s.organizationId,
      incidentHistoryWeight: s.incidentHistoryWeight,
      trainingComplianceWeight: s.trainingComplianceWeight,
      hazardManagementWeight: s.hazardManagementWeight,
      permitPreTaskWeight: s.permitPreTaskWeight,
      reportingCultureWeight: s.reportingCultureWeight,
    }).onConflictDoNothing();
  }

  for (const sr of mockSafetyReports) {
    await db.insert(t.safetyReports).values({
      id: sr.id, organizationId: sr.organizationId, clientId: sr.clientId,
      periodType: sr.periodType, periodStart: sr.periodStart, periodEnd: sr.periodEnd,
      totalManhours: sr.totalManhours, totalHeadcount: sr.totalHeadcount,
      projectRiskTier: sr.projectRiskTier, newHirePercent: sr.newHirePercent,
      recordableIncidents: sr.recordableIncidents, dartCases: sr.dartCases,
      lostTimeIncidents: sr.lostTimeIncidents, emr: sr.emr,
      oshaWillfulCitations: sr.oshaWillfulCitations,
      oshaSeriousCitations: sr.oshaSeriousCitations,
      oshaOtherCitations: sr.oshaOtherCitations, openWcClaims: sr.openWcClaims,
      inspectionsCompleted: sr.inspectionsCompleted,
      inspectionsScheduled: sr.inspectionsScheduled,
      correctiveActionsClosed: sr.correctiveActionsClosed,
      correctiveActionsOpened: sr.correctiveActionsOpened,
      avgCorrectiveActionDays: sr.avgCorrectiveActionDays,
      nearMissReports: sr.nearMissReports,
      toolboxTalksCompleted: sr.toolboxTalksCompleted,
      toolboxTalksScheduled: sr.toolboxTalksScheduled,
      certifiedWorkforcePercent: sr.certifiedWorkforcePercent,
      jhaCompliancePercent: sr.jhaCompliancePercent,
      permitCompliancePercent: sr.permitCompliancePercent,
      overallScore: sr.overallScore,
      incidentHistoryScore: sr.incidentHistoryScore,
      trainingComplianceScore: sr.trainingComplianceScore,
      hazardManagementScore: sr.hazardManagementScore,
      permitPreTaskScore: sr.permitPreTaskScore,
      reportingCultureScore: sr.reportingCultureScore,
      letterGrade: sr.letterGrade,
      topRiskAreas: sr.topRiskAreas, recommendedActions: sr.recommendedActions,
      photos: sr.photos, createdAt: sr.createdAt,
    }).onConflictDoNothing();
  }

  // Write completion marker — this is what idempotency checks on subsequent startups
  await db.insert(t.seedMeta).values({
    key: SEED_VERSION,
    seededAt: new Date().toISOString(),
  }).onConflictDoNothing();

  console.log("Seed complete.");
}

// Default password for all seeded users (change per user in production)
const DEFAULT_PASSWORDS: Record<string, string> = {
  "user-1": "SafeSite2024!",
  "user-2": "SafeSite2024!",
  "user-3": "SafeSite2024!",
};

export async function seedPasswords() {
  const users = await db.select().from(t.users).where(isNull(t.users.passwordHash));
  if (users.length === 0) return;

  console.log(`Setting passwords for ${users.length} user(s)...`);
  for (const user of users) {
    const plain = DEFAULT_PASSWORDS[user.id] ?? "SafeSite2024!";
    const hash = await bcrypt.hash(plain, 10);
    await db.update(t.users).set({ passwordHash: hash }).where(eq(t.users.id, user.id));
  }
  console.log("Passwords set.");
}
