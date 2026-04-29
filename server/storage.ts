import type {
  Organization, User, Client, Jobsite, CodeReference,
  InspectionTemplate, Inspection, Observation, AiFinding,
  JobsitePermit, JobsiteExternalEvent,
  EmployeeProfile, ScheduleEntry, Timesheet, TimesheetEntry,
  SafetyReport, SafetyReportSettings,
  IndependentContractor, ContractorJobsiteAssignment,
  TradeCompany, JobsiteTradeAssignment,
  Contact, ContactAssociation, ContactAssociationEnriched, ContactWithAssociations,
  ContractorCompany,
  WorkerCertification, CertificateOfInsurance,
  OshaIncident, WorkHoursLog, TrirResult,
  Driver, DeliveryRequest, DeliveryNfcEvent,
  InventoryItem, InventoryCheckout, InventoryConditionReport, InventoryServiceTicket,
  InsertClient, InsertJobsite, InsertInspection, InsertObservation,
  InsertEmployeeProfile, InsertScheduleEntry, InsertTimesheet, InsertTimesheetEntry,
  InsertSafetyReport, UpdateSafetySettings, UpdateOrganization,
  UpdateInspectionReport,
  InsertIndependentContractor, InsertContractorAssignment,
  InsertTradeCompany, InsertJobsiteTradeAssignment,
  InsertContact, InsertContactAssociation,
  InsertContractorCompany, UpdateContractorCompany,
  InsertWorkerCertification, UpdateWorkerCertification,
  InsertCertificateOfInsurance, UpdateCertificateOfInsurance,
  InsertOshaIncident, UpdateOshaIncident,
  InsertWorkHoursLog, UpdateWorkHoursLog,
  InsertDriver, UpdateDriver,
  InsertDeliveryRequest, UpdateDeliveryRequest,
  InsertDeliveryNfcEvent,
  InsertInventoryItem, UpdateInventoryItem,
  InsertInventoryCheckout, CloseInventoryCheckout,
  InsertInventoryConditionReport,
  InsertInventoryServiceTicket, UpdateInventoryServiceTicket,
  PortfolioShare, InsertPortfolioShare, VisibleSections, PortfolioSnapshot,
  Notification, InsertNotification,
} from "@shared/schema";
import { PORTFOLIO_SECTIONS } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { db } from "./db";
import * as t from "@shared/tables";
import { eq, and, gte, lte, inArray, isNull, desc, type SQL } from "drizzle-orm";

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
type ContractorCompanyRow = typeof t.contractorCompanies.$inferInsert;
type WorkerCertificationRow = typeof t.workerCertifications.$inferInsert;
type CertificateOfInsuranceRow = typeof t.certificatesOfInsurance.$inferInsert;
type OshaIncidentRow = typeof t.oshaIncidents.$inferInsert;
type WorkHoursLogRow = typeof t.workHoursLog.$inferInsert;
type DriverRow = typeof t.drivers.$inferInsert;
type DeliveryRequestRow = typeof t.deliveryRequests.$inferInsert;
type DeliveryNfcEventRow = typeof t.deliveryNfcEvents.$inferInsert;
type InventoryItemRow = typeof t.inventoryItems.$inferInsert;
type InventoryCheckoutRow = typeof t.inventoryCheckouts.$inferInsert;
type InventoryConditionReportRow = typeof t.inventoryConditionReports.$inferInsert;
type InventoryServiceTicketRow = typeof t.inventoryServiceTickets.$inferInsert;
type PortfolioShareRow = typeof t.portfolioShares.$inferInsert;
type NotificationRow = typeof t.notifications.$inferInsert;

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
  return { id: row.id, name: row.name, logoUrl: row.logoUrl ?? undefined, status: row.status, orgType: (row.orgType ?? "ssm_firm") as Organization["orgType"], createdAt: row.createdAt ?? undefined };
}

function mapUser(row: typeof t.users.$inferSelect): User {
  return {
    id: row.id, organizationId: row.organizationId,
    name: row.name, email: row.email,
    role: row.role as User["role"],
    isSuperAdmin: row.isSuperAdmin ?? false,
    userStatus: row.userStatus ?? "active",
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
    primaryInspectorId: row.primaryInspectorId ?? undefined,
  };
}

function mapContractor(row: typeof t.independentContractors.$inferSelect): IndependentContractor {
  return {
    id: row.id, organizationId: row.organizationId,
    name: row.name, email: row.email ?? undefined, phone: row.phone ?? undefined,
    licenseType: row.licenseType, licenseNumber: row.licenseNumber ?? undefined,
    certifications: (row.certifications as string[]) ?? [],
    plCarrier: row.plCarrier ?? undefined, plPolicyNumber: row.plPolicyNumber ?? undefined,
    plExpiryDate: row.plExpiryDate ?? undefined,
    glCarrier: row.glCarrier ?? undefined, glPolicyNumber: row.glPolicyNumber ?? undefined,
    glExpiryDate: row.glExpiryDate ?? undefined,
    status: (row.status as IndependentContractor["status"]) ?? "active",
    notes: row.notes ?? undefined,
  };
}

function mapContractorAssignment(row: typeof t.contractorJobsiteAssignments.$inferSelect): ContractorJobsiteAssignment {
  return {
    id: row.id, contractorId: row.contractorId, jobsiteId: row.jobsiteId,
    startDate: row.startDate ?? undefined, endDate: row.endDate ?? undefined,
    role: row.role ?? undefined,
  };
}

function mapTradeCompany(row: typeof t.tradeCompanies.$inferSelect): TradeCompany {
  return {
    id: row.id, organizationId: row.organizationId,
    name: row.name, tradeType: row.tradeType,
    contactName: row.contactName ?? undefined, contactEmail: row.contactEmail ?? undefined,
    contactPhone: row.contactPhone ?? undefined, licenseNumber: row.licenseNumber ?? undefined,
    coiCarrier: row.coiCarrier ?? undefined, coiPolicyNumber: row.coiPolicyNumber ?? undefined,
    coiExpiryDate: row.coiExpiryDate ?? undefined,
    wcCarrier: row.wcCarrier ?? undefined, wcPolicyNumber: row.wcPolicyNumber ?? undefined,
    wcExpiryDate: row.wcExpiryDate ?? undefined,
    status: (row.status as TradeCompany["status"]) ?? "active",
    notes: row.notes ?? undefined,
  };
}

function mapTradeAssignment(row: typeof t.jobsiteTradeAssignments.$inferSelect): JobsiteTradeAssignment {
  return {
    id: row.id, jobsiteId: row.jobsiteId, tradeCompanyId: row.tradeCompanyId,
    clientId: row.clientId ?? undefined, scopeOfWork: row.scopeOfWork ?? undefined,
    startDate: row.startDate ?? undefined, endDate: row.endDate ?? undefined,
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

function computeExpiryStatus(expiryDate: string | null | undefined): string {
  if (!expiryDate) return "no_expiry";
  const today = new Date();
  const expiry = new Date(expiryDate);
  if (expiry < today) return "expired";
  const thirtyDaysOut = new Date(today);
  thirtyDaysOut.setDate(today.getDate() + 30);
  if (expiry <= thirtyDaysOut) return "expiring_soon";
  return "valid";
}

function mapWorkerCertification(row: typeof t.workerCertifications.$inferSelect): WorkerCertification {
  return {
    id: row.id, organizationId: row.organizationId, userId: row.userId,
    certType: row.certType,
    certNumber: row.certNumber ?? undefined,
    issuingBody: row.issuingBody ?? undefined,
    issueDate: row.issueDate,
    expiryDate: row.expiryDate ?? undefined,
    documentUrl: row.documentUrl ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    status: computeExpiryStatus(row.expiryDate),
  };
}

function mapOshaIncident(row: typeof t.oshaIncidents.$inferSelect): OshaIncident {
  return {
    id: row.id,
    organizationId: row.organizationId,
    jobsiteId: row.jobsiteId ?? undefined,
    incidentDate: row.incidentDate,
    employeeName: row.employeeName,
    jobTitle: row.jobTitle ?? undefined,
    department: row.department ?? undefined,
    incidentDescription: row.incidentDescription,
    bodyPart: row.bodyPart ?? undefined,
    injuryType: row.injuryType ?? undefined,
    caseType: row.caseType,
    daysAway: row.daysAway ?? undefined,
    daysRestricted: row.daysRestricted ?? undefined,
    isPrivacyCase: row.isPrivacyCase,
    reportedBy: row.reportedBy ?? undefined,
    witnessNames: row.witnessNames ?? undefined,
    rootCause: row.rootCause ?? undefined,
    correctiveActions: row.correctiveActions ?? undefined,
    recordableCase: row.recordableCase,
    createdAt: row.createdAt,
  };
}

function mapWorkHoursLog(row: typeof t.workHoursLog.$inferSelect): WorkHoursLog {
  return {
    id: row.id,
    organizationId: row.organizationId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    hoursWorked: row.hoursWorked,
    employeeCount: row.employeeCount ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
  };
}

function mapDriver(row: typeof t.drivers.$inferSelect): Driver {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId ?? undefined,
    name: row.name,
    licenseNumber: row.licenseNumber ?? undefined,
    phone: row.phone ?? undefined,
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt ?? "",
  };
}

function mapDeliveryRequest(row: typeof t.deliveryRequests.$inferSelect): DeliveryRequest {
  return {
    id: row.id,
    organizationId: row.organizationId,
    jobsiteId: row.jobsiteId ?? undefined,
    requestedBy: row.requestedBy ?? undefined,
    approvedBy: row.approvedBy ?? undefined,
    driverId: row.driverId ?? undefined,
    description: row.description,
    status: row.status,
    scheduledDate: row.scheduledDate ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt ?? "",
  };
}

function mapDeliveryNfcEvent(row: typeof t.deliveryNfcEvents.$inferSelect): DeliveryNfcEvent {
  return {
    id: row.id,
    organizationId: row.organizationId,
    deliveryRequestId: row.deliveryRequestId,
    eventType: row.eventType,
    scannedBy: row.scannedBy ?? undefined,
    jobsiteId: row.jobsiteId ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt ?? "",
  };
}

function mapInventoryItem(row: typeof t.inventoryItems.$inferSelect): InventoryItem {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    serialNumber: row.serialNumber ?? undefined,
    assetTag: row.assetTag ?? undefined,
    nfcTagId: row.nfcTagId ?? undefined,
    condition: row.condition,
    currentJobsiteId: row.currentJobsiteId ?? undefined,
    assignedTo: row.assignedTo ?? undefined,
    purchaseDate: row.purchaseDate ?? undefined,
    purchasePrice: row.purchasePrice ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt ?? "",
  };
}

function mapInventoryCheckout(row: typeof t.inventoryCheckouts.$inferSelect): InventoryCheckout {
  return {
    id: row.id,
    organizationId: row.organizationId,
    inventoryItemId: row.inventoryItemId,
    checkedOutBy: row.checkedOutBy ?? undefined,
    jobsiteId: row.jobsiteId ?? undefined,
    checkedOutAt: row.checkedOutAt,
    expectedReturnDate: row.expectedReturnDate ?? undefined,
    returnedAt: row.returnedAt ?? undefined,
    returnCondition: row.returnCondition ?? undefined,
    returnNotes: row.returnNotes ?? undefined,
    createdAt: row.createdAt ?? "",
  };
}

function mapInventoryConditionReport(row: typeof t.inventoryConditionReports.$inferSelect): InventoryConditionReport {
  return {
    id: row.id,
    organizationId: row.organizationId,
    inventoryItemId: row.inventoryItemId,
    checkoutId: row.checkoutId ?? undefined,
    reportedBy: row.reportedBy ?? undefined,
    condition: row.condition,
    notes: row.notes ?? undefined,
    photoUrls: row.photoUrls ?? undefined,
    createdAt: row.createdAt ?? "",
  };
}

function mapInventoryServiceTicket(row: typeof t.inventoryServiceTickets.$inferSelect): InventoryServiceTicket {
  return {
    id: row.id,
    organizationId: row.organizationId,
    inventoryItemId: row.inventoryItemId,
    reportedBy: row.reportedBy ?? undefined,
    issueDescription: row.issueDescription,
    status: row.status,
    resolvedAt: row.resolvedAt ?? undefined,
    resolvedBy: row.resolvedBy ?? undefined,
    resolutionNotes: row.resolutionNotes ?? undefined,
    createdAt: row.createdAt ?? "",
  };
}

function mapCertificateOfInsurance(row: typeof t.certificatesOfInsurance.$inferSelect): CertificateOfInsurance {
  return {
    id: row.id, organizationId: row.organizationId,
    companyName: row.companyName,
    tradeCompanyId: row.tradeCompanyId ?? undefined,
    linkedOrganizationId: row.linkedOrganizationId ?? undefined,
    coverageType: row.coverageType,
    insurer: row.insurer ?? undefined,
    policyNumber: row.policyNumber ?? undefined,
    coverageLimit: row.coverageLimit ?? undefined,
    effectiveDate: row.effectiveDate ?? undefined,
    expiryDate: row.expiryDate ?? undefined,
    documentUrl: row.documentUrl ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    status: computeExpiryStatus(row.expiryDate),
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
  getCurrentUser(userId: string): Promise<User>;
  getUserByEmail(email: string): Promise<(User & { passwordHash: string | null }) | undefined>;
  setPasswordHash(userId: string, hash: string): Promise<void>;
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

  // ─── Trades ───────────────────────────────────────────────────────────────
  getTradesByOrg(orgId: string): Promise<TradeCompany[]>;
  getTradesByJobsite(jobsiteId: string): Promise<JobsiteTradeAssignment[]>;
  getTrade(id: string): Promise<TradeCompany | undefined>;
  createTrade(orgId: string, data: InsertTradeCompany): Promise<TradeCompany>;
  updateTrade(id: string, updates: Partial<TradeCompany>): Promise<TradeCompany | undefined>;
  deleteTrade(id: string): Promise<boolean>;
  createTradeAssignment(jobsiteId: string, data: InsertJobsiteTradeAssignment): Promise<JobsiteTradeAssignment>;
  deleteTradeAssignment(assignmentId: string): Promise<boolean>;
  getTradeAssignmentsByTrade(tradeId: string): Promise<JobsiteTradeAssignment[]>;
  getTradeAssignment(id: string): Promise<JobsiteTradeAssignment | undefined>;
  getAllTradeAssignmentsByOrg(orgId: string): Promise<JobsiteTradeAssignment[]>;
  getTradesWithDetailsByJobsite(jobsiteId: string): Promise<{ assignment: JobsiteTradeAssignment; company: TradeCompany }[]>;

  // ─── Contractors ──────────────────────────────────────────────────────────
  getContractorsByOrg(orgId: string): Promise<IndependentContractor[]>;
  getContractor(id: string): Promise<IndependentContractor | undefined>;
  createContractor(orgId: string, data: InsertIndependentContractor): Promise<IndependentContractor>;
  updateContractor(id: string, updates: Partial<IndependentContractor>): Promise<IndependentContractor | undefined>;
  deleteContractor(id: string): Promise<boolean>;
  getAssignmentsByContractor(contractorId: string): Promise<ContractorJobsiteAssignment[]>;
  getAssignmentsByJobsite(jobsiteId: string): Promise<ContractorJobsiteAssignment[]>;
  createContractorAssignment(contractorId: string, data: InsertContractorAssignment): Promise<ContractorJobsiteAssignment>;
  deleteContractorAssignment(assignmentId: string): Promise<boolean>;

  // ─── Contacts ─────────────────────────────────────────────────────────────
  getContactsByOrg(orgId: string): Promise<Contact[]>;
  getContactsByEntity(entityType: string, entityId: string, orgId: string): Promise<ContactWithAssociations[]>;
  getContactAssociationCountsByOrg(orgId: string): Promise<Record<string, { count: number; entityTypes: string[] }>>;
  getEntityOrgId(entityType: string, entityId: string): Promise<string | undefined>;
  getContact(id: string): Promise<Contact | undefined>;
  getContactWithAssociations(id: string): Promise<ContactWithAssociations | undefined>;
  createContact(orgId: string, data: InsertContact): Promise<Contact>;
  updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<boolean>;
  createContactAssociation(contactId: string, data: InsertContactAssociation): Promise<ContactAssociation>;
  deleteContactAssociation(id: string): Promise<boolean>;
  getContactAssociation(id: string): Promise<ContactAssociation | undefined>;

  // ─── Contractor Companies (Phase 7A) ───────────────────────────────────────
  // Global registry — not org-scoped at row level. Access controlled in route layer.
  getContractorCompanies(search?: string): Promise<ContractorCompany[]>;
  getContractorCompany(id: string): Promise<ContractorCompany | undefined>;
  createContractorCompany(data: InsertContractorCompany): Promise<ContractorCompany>;
  updateContractorCompany(id: string, updates: UpdateContractorCompany): Promise<ContractorCompany | undefined>;

  // ─── Worker Certifications (Phase 7B) ─────────────────────────────────────
  getWorkerCertifications(orgId: string, filters?: { userId?: string; certType?: string }): Promise<WorkerCertification[]>;
  getWorkerCertification(orgId: string, id: string): Promise<WorkerCertification | undefined>;
  createWorkerCertification(orgId: string, data: InsertWorkerCertification): Promise<WorkerCertification>;
  updateWorkerCertification(orgId: string, id: string, data: UpdateWorkerCertification): Promise<WorkerCertification | undefined>;
  deleteWorkerCertification(orgId: string, id: string): Promise<boolean>;

  // ─── Certificates of Insurance (Phase 7B) ─────────────────────────────────
  getCertificatesOfInsurance(orgId: string, filters?: { tradeCompanyId?: string; linkedOrganizationId?: string; coverageType?: string }): Promise<CertificateOfInsurance[]>;
  getCertificateOfInsurance(orgId: string, id: string): Promise<CertificateOfInsurance | undefined>;
  createCertificateOfInsurance(orgId: string, data: InsertCertificateOfInsurance): Promise<CertificateOfInsurance>;
  updateCertificateOfInsurance(orgId: string, id: string, data: UpdateCertificateOfInsurance): Promise<CertificateOfInsurance | undefined>;
  deleteCertificateOfInsurance(orgId: string, id: string): Promise<boolean>;

  // ─── OSHA Incidents (Phase 7C) ────────────────────────────────────────────
  getOshaIncidents(orgId: string, filters?: { jobsiteId?: string; caseType?: string; recordableCase?: string }): Promise<OshaIncident[]>;
  getOshaIncident(orgId: string, id: string): Promise<OshaIncident | undefined>;
  createOshaIncident(orgId: string, data: InsertOshaIncident): Promise<OshaIncident>;
  updateOshaIncident(orgId: string, id: string, data: UpdateOshaIncident): Promise<OshaIncident | undefined>;
  deleteOshaIncident(orgId: string, id: string): Promise<boolean>;

  // ─── Work Hours Log (Phase 7C) ────────────────────────────────────────────
  getWorkHoursLog(orgId: string, filters?: { periodStart?: string; periodEnd?: string }): Promise<WorkHoursLog[]>;
  getWorkHoursLogEntry(orgId: string, id: string): Promise<WorkHoursLog | undefined>;
  createWorkHoursLogEntry(orgId: string, data: InsertWorkHoursLog): Promise<WorkHoursLog>;
  updateWorkHoursLogEntry(orgId: string, id: string, data: UpdateWorkHoursLog): Promise<WorkHoursLog | undefined>;
  deleteWorkHoursLogEntry(orgId: string, id: string): Promise<boolean>;

  // ─── TRIR (Phase 7C) ──────────────────────────────────────────────────────
  computeTrir(orgId: string): Promise<TrirResult>;

  // ─── Drivers (Phase 7D) ───────────────────────────────────────────────────
  getDrivers(orgId: string, filters?: { status?: string }): Promise<Driver[]>;
  getDriver(orgId: string, id: string): Promise<Driver | undefined>;
  createDriver(orgId: string, data: InsertDriver): Promise<Driver>;
  updateDriver(orgId: string, id: string, data: UpdateDriver): Promise<Driver | undefined>;
  deleteDriver(orgId: string, id: string): Promise<boolean>;

  // ─── Delivery Requests (Phase 7D) ─────────────────────────────────────────
  getDeliveryRequests(orgId: string, filters?: { jobsiteId?: string; driverId?: string; status?: string }): Promise<DeliveryRequest[]>;
  getDeliveryRequest(orgId: string, id: string): Promise<DeliveryRequest | undefined>;
  createDeliveryRequest(orgId: string, data: InsertDeliveryRequest): Promise<DeliveryRequest>;
  updateDeliveryRequest(orgId: string, id: string, data: UpdateDeliveryRequest): Promise<DeliveryRequest | undefined>;
  updateDeliveryStatus(orgId: string, id: string, status: string): Promise<DeliveryRequest | undefined>;
  deleteDeliveryRequest(orgId: string, id: string): Promise<boolean>;

  // ─── Delivery NFC Events (Phase 7D) ───────────────────────────────────────
  getDeliveryNfcEvents(orgId: string, deliveryRequestId: string): Promise<DeliveryNfcEvent[]>;
  createDeliveryNfcEvent(orgId: string, data: InsertDeliveryNfcEvent): Promise<DeliveryNfcEvent>;

  // ─── Inventory Items (Phase 7E) ───────────────────────────────────────────
  getInventoryItems(orgId: string, filters?: { category?: string; condition?: string; currentJobsiteId?: string; assignedTo?: string }): Promise<InventoryItem[]>;
  getInventoryItem(orgId: string, id: string): Promise<InventoryItem | undefined>;
  getInventoryItemByNfcTag(orgId: string, nfcTagId: string): Promise<InventoryItem | undefined>;
  createInventoryItem(orgId: string, data: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(orgId: string, id: string, data: UpdateInventoryItem): Promise<InventoryItem | undefined>;
  deleteInventoryItem(orgId: string, id: string): Promise<boolean>;

  // ─── Inventory Checkouts (Phase 7E) ───────────────────────────────────────
  getInventoryCheckouts(orgId: string, filters?: { inventoryItemId?: string; jobsiteId?: string; open?: boolean }): Promise<InventoryCheckout[]>;
  getInventoryCheckout(orgId: string, id: string): Promise<InventoryCheckout | undefined>;
  createInventoryCheckout(orgId: string, data: InsertInventoryCheckout): Promise<InventoryCheckout>;
  closeInventoryCheckout(orgId: string, id: string, data: CloseInventoryCheckout): Promise<InventoryCheckout | undefined>;

  // ─── Inventory Condition Reports (Phase 7E) ───────────────────────────────
  getInventoryConditionReports(orgId: string, inventoryItemId: string): Promise<InventoryConditionReport[]>;
  createInventoryConditionReport(orgId: string, data: InsertInventoryConditionReport): Promise<InventoryConditionReport>;

  // ─── Inventory Service Tickets (Phase 7E) ─────────────────────────────────
  getInventoryServiceTickets(orgId: string, filters?: { inventoryItemId?: string; status?: string }): Promise<InventoryServiceTicket[]>;
  getInventoryServiceTicket(orgId: string, id: string): Promise<InventoryServiceTicket | undefined>;
  createInventoryServiceTicket(orgId: string, data: InsertInventoryServiceTicket): Promise<InventoryServiceTicket>;
  updateInventoryServiceTicket(orgId: string, id: string, data: UpdateInventoryServiceTicket): Promise<InventoryServiceTicket | undefined>;

  // ─── Portfolio Shares & Snapshot (Phase 7F) ───────────────────────────────
  getPortfolioShares(orgId: string): Promise<PortfolioShare[]>;
  getPortfolioShareByToken(token: string): Promise<PortfolioShare | undefined>;
  createPortfolioShare(orgId: string, data: InsertPortfolioShare): Promise<PortfolioShare>;
  revokePortfolioShare(orgId: string, id: string): Promise<PortfolioShare | undefined>;
  getPortfolioSnapshot(orgId: string, visibleSections: VisibleSections): Promise<PortfolioSnapshot>;

  // ─── Notifications (Phase 8) ──────────────────────────────────────────────
  getNotifications(orgId: string, userId: string, filters?: { unreadOnly?: boolean }): Promise<Notification[]>;
  getUnreadNotificationCount(orgId: string, userId: string): Promise<number>;
  createNotification(data: InsertNotification): Promise<Notification>;
  markNotificationRead(orgId: string, userId: string, id: string): Promise<Notification | undefined>;
  markAllNotificationsRead(orgId: string, userId: string): Promise<void>;
  deleteNotification(orgId: string, userId: string, id: string): Promise<boolean>;
  getNotificationByEntity(orgId: string, type: string, entityId: string): Promise<Notification | undefined>;

  // ─── Super-admin methods ──────────────────────────────────────────────────
  adminListOrgs(): Promise<Organization[]>;
  adminGetOrgWithUsers(orgId: string): Promise<{ org: Organization; users: User[] } | undefined>;
  adminCreateOrg(name: string): Promise<Organization>;
  adminUpdateOrgStatus(orgId: string, status: string): Promise<Organization | undefined>;
  adminCreateUser(orgId: string, name: string, email: string, role: string, password: string): Promise<User>;
  adminUpdateUser(userId: string, updates: { name?: string; email?: string; role?: string; userStatus?: string }): Promise<User | undefined>;
  adminResetPassword(userId: string, newPassword: string): Promise<void>;
  adminGetAnalytics(): Promise<{
    totalOrgs: number;
    totalUsers: number;
    totalInspections: number;
    totalSafetyReports: number;
    newOrgsLast30Days: number;
  }>;
  adminGetOrgClients(orgId: string): Promise<Client[]>;
  adminGetOrgJobsites(orgId: string): Promise<Jobsite[]>;
  adminGetOrgInspections(orgId: string): Promise<Inspection[]>;
}

// ─── DatabaseStorage implementation ──────────────────────────────────────────

export class DatabaseStorage implements IStorage {

  async getCurrentUser(userId: string): Promise<User> {
    const rows = await db.select().from(t.users).where(eq(t.users.id, userId));
    if (!rows[0]) throw new Error("User not found");
    return mapUser(rows[0]);
  }

  async getUserByEmail(email: string): Promise<(User & { passwordHash: string | null }) | undefined> {
    const rows = await db.select().from(t.users).where(eq(t.users.email, email));
    if (!rows[0]) return undefined;
    return { ...mapUser(rows[0]), passwordHash: rows[0].passwordHash ?? null };
  }

  async setPasswordHash(userId: string, hash: string): Promise<void> {
    await db.update(t.users).set({ passwordHash: hash }).where(eq(t.users.id, userId));
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

  // ─── Super-admin implementations ─────────────────────────────────────────

  async adminListOrgs(): Promise<Organization[]> {
    const rows = await db.select().from(t.organizations).orderBy(t.organizations.name);
    return rows.map(mapOrg);
  }

  async adminGetOrgWithUsers(orgId: string): Promise<{ org: Organization; users: User[] } | undefined> {
    const orgRows = await db.select().from(t.organizations).where(eq(t.organizations.id, orgId));
    if (!orgRows[0]) return undefined;
    const userRows = await db.select().from(t.users).where(eq(t.users.organizationId, orgId));
    return { org: mapOrg(orgRows[0]), users: userRows.map(mapUser) };
  }

  async adminCreateOrg(name: string): Promise<Organization> {
    const id = `org-${randomUUID().slice(0, 8)}`;
    const rows = await db.insert(t.organizations).values({
      id, name, status: "active", createdAt: new Date().toISOString(),
    }).returning();
    return mapOrg(rows[0]);
  }

  async adminUpdateOrgStatus(orgId: string, status: string): Promise<Organization | undefined> {
    const rows = await db.update(t.organizations).set({ status }).where(eq(t.organizations.id, orgId)).returning();
    return rows[0] ? mapOrg(rows[0]) : undefined;
  }

  async adminCreateUser(orgId: string, name: string, email: string, role: string, password: string): Promise<User> {
    const id = `user-${randomUUID().slice(0, 8)}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const rows = await db.insert(t.users).values({
      id, organizationId: orgId, name, email, role,
      passwordHash, isSuperAdmin: false, userStatus: "active",
    }).returning();
    return mapUser(rows[0]);
  }

  async adminUpdateUser(userId: string, updates: { name?: string; email?: string; role?: string; userStatus?: string }): Promise<User | undefined> {
    const rows = await db.update(t.users).set(updates).where(eq(t.users.id, userId)).returning();
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async adminResetPassword(userId: string, newPassword: string): Promise<void> {
    const hash = await bcrypt.hash(newPassword, 10);
    await db.update(t.users).set({ passwordHash: hash }).where(eq(t.users.id, userId));
  }

  async adminGetAnalytics(): Promise<{
    totalOrgs: number;
    totalUsers: number;
    totalInspections: number;
    totalSafetyReports: number;
    newOrgsLast30Days: number;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [orgs, users, inspections, safetyReports] = await Promise.all([
      db.select().from(t.organizations),
      db.select().from(t.users).where(eq(t.users.isSuperAdmin, false)),
      db.select().from(t.inspections),
      db.select().from(t.safetyReports),
    ]);
    const customerOrgs = orgs.filter(o => o.id !== "org-system");
    const newOrgsLast30Days = customerOrgs.filter(
      o => o.createdAt && o.createdAt >= thirtyDaysAgo
    ).length;
    return {
      totalOrgs: customerOrgs.length,
      totalUsers: users.filter(u => u.organizationId !== "org-system").length,
      totalInspections: inspections.length,
      totalSafetyReports: safetyReports.length,
      newOrgsLast30Days,
    };
  }

  async adminGetOrgClients(orgId: string): Promise<Client[]> {
    const rows = await db.select().from(t.clients).where(eq(t.clients.organizationId, orgId));
    return rows.map(mapClient);
  }

  async adminGetOrgJobsites(orgId: string): Promise<Jobsite[]> {
    const rows = await db.select().from(t.jobsites).where(eq(t.jobsites.organizationId, orgId));
    return rows.map(mapJobsite);
  }

  async adminGetOrgInspections(orgId: string): Promise<Inspection[]> {
    const { desc } = await import("drizzle-orm");
    const rows = await db.select().from(t.inspections)
      .where(eq(t.inspections.organizationId, orgId))
      .orderBy(desc(t.inspections.date));
    return rows.map(mapInspection);
  }

  // ─── Trades ───────────────────────────────────────────────────────────────

  async getTradesByOrg(orgId: string): Promise<TradeCompany[]> {
    const rows = await db.select().from(t.tradeCompanies)
      .where(eq(t.tradeCompanies.organizationId, orgId));
    return rows.map(mapTradeCompany);
  }

  async getTradesByJobsite(jobsiteId: string): Promise<JobsiteTradeAssignment[]> {
    const rows = await db.select().from(t.jobsiteTradeAssignments)
      .where(eq(t.jobsiteTradeAssignments.jobsiteId, jobsiteId));
    return rows.map(mapTradeAssignment);
  }

  async getTrade(id: string): Promise<TradeCompany | undefined> {
    const [row] = await db.select().from(t.tradeCompanies).where(eq(t.tradeCompanies.id, id));
    return row ? mapTradeCompany(row) : undefined;
  }

  async createTrade(orgId: string, data: InsertTradeCompany): Promise<TradeCompany> {
    const id = randomUUID();
    const [row] = await db.insert(t.tradeCompanies).values({ id, organizationId: orgId, ...data }).returning();
    return mapTradeCompany(row);
  }

  async updateTrade(id: string, updates: Partial<typeof t.tradeCompanies.$inferInsert>): Promise<TradeCompany | undefined> {
    const [row] = await db.update(t.tradeCompanies).set(updates).where(eq(t.tradeCompanies.id, id)).returning();
    return row ? mapTradeCompany(row) : undefined;
  }

  async deleteTrade(id: string): Promise<boolean> {
    await db.delete(t.jobsiteTradeAssignments).where(eq(t.jobsiteTradeAssignments.tradeCompanyId, id));
    const result = await db.delete(t.tradeCompanies).where(eq(t.tradeCompanies.id, id)).returning();
    return result.length > 0;
  }

  async createTradeAssignment(jobsiteId: string, data: InsertJobsiteTradeAssignment): Promise<JobsiteTradeAssignment> {
    const id = randomUUID();
    const [row] = await db.insert(t.jobsiteTradeAssignments)
      .values({ id, jobsiteId, ...data })
      .returning();
    return mapTradeAssignment(row);
  }

  async deleteTradeAssignment(assignmentId: string): Promise<boolean> {
    const result = await db.delete(t.jobsiteTradeAssignments)
      .where(eq(t.jobsiteTradeAssignments.id, assignmentId))
      .returning();
    return result.length > 0;
  }

  async getTradeAssignmentsByTrade(tradeId: string): Promise<JobsiteTradeAssignment[]> {
    const rows = await db.select().from(t.jobsiteTradeAssignments)
      .where(eq(t.jobsiteTradeAssignments.tradeCompanyId, tradeId));
    return rows.map(mapTradeAssignment);
  }

  async getTradeAssignment(id: string): Promise<JobsiteTradeAssignment | undefined> {
    const [row] = await db.select().from(t.jobsiteTradeAssignments)
      .where(eq(t.jobsiteTradeAssignments.id, id));
    return row ? mapTradeAssignment(row) : undefined;
  }

  async getAllTradeAssignmentsByOrg(orgId: string): Promise<JobsiteTradeAssignment[]> {
    const rows = await db.select({ assignment: t.jobsiteTradeAssignments })
      .from(t.jobsiteTradeAssignments)
      .innerJoin(t.tradeCompanies, eq(t.jobsiteTradeAssignments.tradeCompanyId, t.tradeCompanies.id))
      .where(eq(t.tradeCompanies.organizationId, orgId));
    return rows.map(r => mapTradeAssignment(r.assignment));
  }

  async getTradesWithDetailsByJobsite(jobsiteId: string): Promise<{ assignment: JobsiteTradeAssignment; company: TradeCompany }[]> {
    const rows = await db.select({
      assignment: t.jobsiteTradeAssignments,
      company: t.tradeCompanies,
    })
      .from(t.jobsiteTradeAssignments)
      .innerJoin(t.tradeCompanies, eq(t.jobsiteTradeAssignments.tradeCompanyId, t.tradeCompanies.id))
      .where(eq(t.jobsiteTradeAssignments.jobsiteId, jobsiteId));
    return rows.map(r => ({
      assignment: mapTradeAssignment(r.assignment),
      company: mapTradeCompany(r.company),
    }));
  }

  // ─── Contractors ──────────────────────────────────────────────────────────

  async getContractorsByOrg(orgId: string): Promise<IndependentContractor[]> {
    const rows = await db.select().from(t.independentContractors)
      .where(eq(t.independentContractors.organizationId, orgId));
    return rows.map(mapContractor);
  }

  async getContractor(id: string): Promise<IndependentContractor | undefined> {
    const rows = await db.select().from(t.independentContractors)
      .where(eq(t.independentContractors.id, id));
    return rows[0] ? mapContractor(rows[0]) : undefined;
  }

  async createContractor(orgId: string, data: InsertIndependentContractor): Promise<IndependentContractor> {
    const id = `ctr-${randomUUID().slice(0, 8)}`;
    const rows = await db.insert(t.independentContractors).values({
      id, organizationId: orgId,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      licenseType: data.licenseType,
      licenseNumber: data.licenseNumber || null,
      certifications: data.certifications ?? [],
      plCarrier: data.plCarrier || null,
      plPolicyNumber: data.plPolicyNumber || null,
      plExpiryDate: data.plExpiryDate || null,
      glCarrier: data.glCarrier || null,
      glPolicyNumber: data.glPolicyNumber || null,
      glExpiryDate: data.glExpiryDate || null,
      status: data.status ?? "active",
      notes: data.notes || null,
    }).returning();
    return mapContractor(rows[0]);
  }

  async updateContractor(id: string, updates: Partial<IndependentContractor>): Promise<IndependentContractor | undefined> {
    const dbUpdates: Partial<typeof t.independentContractors.$inferInsert> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.email !== undefined) dbUpdates.email = updates.email || null;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone || null;
    if (updates.licenseType !== undefined) dbUpdates.licenseType = updates.licenseType;
    if (updates.licenseNumber !== undefined) dbUpdates.licenseNumber = updates.licenseNumber || null;
    if (updates.certifications !== undefined) dbUpdates.certifications = updates.certifications;
    if (updates.plCarrier !== undefined) dbUpdates.plCarrier = updates.plCarrier || null;
    if (updates.plPolicyNumber !== undefined) dbUpdates.plPolicyNumber = updates.plPolicyNumber || null;
    if (updates.plExpiryDate !== undefined) dbUpdates.plExpiryDate = updates.plExpiryDate || null;
    if (updates.glCarrier !== undefined) dbUpdates.glCarrier = updates.glCarrier || null;
    if (updates.glPolicyNumber !== undefined) dbUpdates.glPolicyNumber = updates.glPolicyNumber || null;
    if (updates.glExpiryDate !== undefined) dbUpdates.glExpiryDate = updates.glExpiryDate || null;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes || null;
    const rows = await db.update(t.independentContractors)
      .set(dbUpdates)
      .where(eq(t.independentContractors.id, id))
      .returning();
    return rows[0] ? mapContractor(rows[0]) : undefined;
  }

  async deleteContractor(id: string): Promise<boolean> {
    await db.delete(t.contractorJobsiteAssignments)
      .where(eq(t.contractorJobsiteAssignments.contractorId, id));
    const result = await db.delete(t.independentContractors)
      .where(eq(t.independentContractors.id, id))
      .returning();
    return result.length > 0;
  }

  async getAssignmentsByContractor(contractorId: string): Promise<ContractorJobsiteAssignment[]> {
    const rows = await db.select().from(t.contractorJobsiteAssignments)
      .where(eq(t.contractorJobsiteAssignments.contractorId, contractorId));
    return rows.map(mapContractorAssignment);
  }

  async getAssignmentsByJobsite(jobsiteId: string): Promise<ContractorJobsiteAssignment[]> {
    const rows = await db.select().from(t.contractorJobsiteAssignments)
      .where(eq(t.contractorJobsiteAssignments.jobsiteId, jobsiteId));
    return rows.map(mapContractorAssignment);
  }

  async createContractorAssignment(contractorId: string, data: InsertContractorAssignment): Promise<ContractorJobsiteAssignment> {
    const id = `asgn-${randomUUID().slice(0, 8)}`;
    const rows = await db.insert(t.contractorJobsiteAssignments).values({
      id, contractorId,
      jobsiteId: data.jobsiteId,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      role: data.role || null,
    }).returning();
    return mapContractorAssignment(rows[0]);
  }

  async deleteContractorAssignment(assignmentId: string): Promise<boolean> {
    const result = await db.delete(t.contractorJobsiteAssignments)
      .where(eq(t.contractorJobsiteAssignments.id, assignmentId))
      .returning();
    return result.length > 0;
  }

  // ─── Contacts ─────────────────────────────────────────────────────────────

  async getContactsByOrg(orgId: string): Promise<Contact[]> {
    return db.select().from(t.contacts).where(eq(t.contacts.organizationId, orgId));
  }

  async getContactsByEntity(entityType: string, entityId: string, orgId: string): Promise<ContactWithAssociations[]> {
    const assocs = await db.select().from(t.contactAssociations)
      .where(and(eq(t.contactAssociations.entityType, entityType), eq(t.contactAssociations.entityId, entityId)));
    if (assocs.length === 0) return [];
    const contactIds = [...new Set(assocs.map(a => a.contactId))];
    const allContacts: Contact[] = [];
    for (const cid of contactIds) {
      const rows = await db.select().from(t.contacts)
        .where(and(eq(t.contacts.id, cid), eq(t.contacts.organizationId, orgId)));
      if (rows[0]) allContacts.push(rows[0]);
    }
    return allContacts.map(c => ({
      ...c,
      associations: assocs.filter(a => a.contactId === c.id),
    }));
  }

  async getContactAssociationCountsByOrg(orgId: string): Promise<Record<string, { count: number; entityTypes: string[] }>> {
    const contacts = await this.getContactsByOrg(orgId);
    const result: Record<string, { count: number; entityTypes: string[] }> = {};
    for (const c of contacts) {
      const rows = await db.select().from(t.contactAssociations)
        .where(eq(t.contactAssociations.contactId, c.id));
      result[c.id] = {
        count: rows.length,
        entityTypes: [...new Set(rows.map(r => r.entityType))],
      };
    }
    return result;
  }

  async getEntityOrgId(entityType: string, entityId: string): Promise<string | undefined> {
    if (entityType === "jobsite") {
      const rows = await db.select().from(t.jobsites).where(eq(t.jobsites.id, entityId));
      return rows[0]?.organizationId;
    }
    if (entityType === "client") {
      const rows = await db.select().from(t.clients).where(eq(t.clients.id, entityId));
      return rows[0]?.organizationId;
    }
    if (entityType === "trade_company") {
      const rows = await db.select().from(t.tradeCompanies).where(eq(t.tradeCompanies.id, entityId));
      return rows[0]?.organizationId;
    }
    if (entityType === "contractor") {
      const rows = await db.select().from(t.independentContractors).where(eq(t.independentContractors.id, entityId));
      return rows[0]?.organizationId;
    }
    return undefined;
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const rows = await db.select().from(t.contacts).where(eq(t.contacts.id, id));
    return rows[0];
  }

  async getContactWithAssociations(id: string): Promise<ContactWithAssociations | undefined> {
    const contact = await this.getContact(id);
    if (!contact) return undefined;
    const associations = await db.select().from(t.contactAssociations)
      .where(eq(t.contactAssociations.contactId, id));
    const byType: Record<string, string[]> = {};
    for (const a of associations) {
      if (!byType[a.entityType]) byType[a.entityType] = [];
      byType[a.entityType].push(a.entityId);
    }

    const nameMap: Record<string, string> = {};

    await Promise.all([
      (async () => {
        const ids = byType["jobsite"];
        if (ids?.length) {
          const rows = await db.select({ id: t.jobsites.id, name: t.jobsites.name }).from(t.jobsites).where(inArray(t.jobsites.id, ids));
          for (const r of rows) nameMap[r.id] = r.name;
        }
      })(),
      (async () => {
        const ids = byType["client"];
        if (ids?.length) {
          const rows = await db.select({ id: t.clients.id, name: t.clients.name }).from(t.clients).where(inArray(t.clients.id, ids));
          for (const r of rows) nameMap[r.id] = r.name;
        }
      })(),
      (async () => {
        const ids = byType["trade_company"];
        if (ids?.length) {
          const rows = await db.select({ id: t.tradeCompanies.id, name: t.tradeCompanies.name }).from(t.tradeCompanies).where(inArray(t.tradeCompanies.id, ids));
          for (const r of rows) nameMap[r.id] = r.name;
        }
      })(),
      (async () => {
        const ids = byType["contractor"];
        if (ids?.length) {
          const rows = await db.select({ id: t.independentContractors.id, name: t.independentContractors.name }).from(t.independentContractors).where(inArray(t.independentContractors.id, ids));
          for (const r of rows) nameMap[r.id] = r.name;
        }
      })(),
    ]);

    const enriched: ContactAssociationEnriched[] = associations.map((a) => ({
      ...a,
      entityName: nameMap[a.entityId] ?? null,
    }));
    return { ...contact, associations: enriched };
  }

  async createContact(orgId: string, data: InsertContact): Promise<Contact> {
    const id = randomUUID();
    const rows = await db.insert(t.contacts).values({ id, organizationId: orgId, ...data }).returning();
    return rows[0];
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined> {
    const { id: _id, organizationId: _org, ...safe } = updates as Contact;
    const rows = await db.update(t.contacts).set(safe).where(eq(t.contacts.id, id)).returning();
    return rows[0];
  }

  async deleteContact(id: string): Promise<boolean> {
    await db.delete(t.contactAssociations).where(eq(t.contactAssociations.contactId, id));
    const result = await db.delete(t.contacts).where(eq(t.contacts.id, id)).returning();
    return result.length > 0;
  }

  async createContactAssociation(contactId: string, data: InsertContactAssociation): Promise<ContactAssociation> {
    const id = randomUUID();
    const rows = await db.insert(t.contactAssociations).values({ id, contactId, ...data }).returning();
    return rows[0];
  }

  async deleteContactAssociation(id: string): Promise<boolean> {
    const result = await db.delete(t.contactAssociations).where(eq(t.contactAssociations.id, id)).returning();
    return result.length > 0;
  }

  async getContactAssociation(id: string): Promise<ContactAssociation | undefined> {
    const rows = await db.select().from(t.contactAssociations).where(eq(t.contactAssociations.id, id));
    return rows[0];
  }

  // ─── Contractor Companies (Phase 7A) ───────────────────────────────────────

  async getContractorCompanies(search?: string): Promise<ContractorCompany[]> {
    // Returns all active companies. Optional name search for the picker UI.
    // No org-scope filter — this is the global registry.
    // Route layer enforces requireAuth so unauthenticated callers are blocked.
    const rows = await db.select().from(t.contractorCompanies)
      .where(eq(t.contractorCompanies.status, "active"))
      .orderBy(t.contractorCompanies.name);
    if (!search) return rows as ContractorCompany[];
    const q = search.toLowerCase();
    return (rows as ContractorCompany[]).filter(c => c.name.toLowerCase().includes(q));
  }

  async getContractorCompany(id: string): Promise<ContractorCompany | undefined> {
    const rows = await db.select().from(t.contractorCompanies)
      .where(eq(t.contractorCompanies.id, id));
    return rows[0] as ContractorCompany | undefined;
  }

  async createContractorCompany(data: InsertContractorCompany): Promise<ContractorCompany> {
    const now = new Date().toISOString();
    const row: ContractorCompanyRow = {
      id: randomUUID(),
      name: data.name,
      tradeType: data.tradeType ?? null,
      contactName: data.contactName ?? null,
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
      address: data.address ?? null,
      licenseNumber: data.licenseNumber ?? null,
      insuranceCarrier: data.insuranceCarrier ?? null,
      insuranceExpiry: data.insuranceExpiry ?? null,
      notes: data.notes ?? null,
      status: data.status ?? "active",
      linkedOrganizationId: null,
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.insert(t.contractorCompanies).values(row).returning();
    return result[0] as ContractorCompany;
  }

  async updateContractorCompany(id: string, updates: UpdateContractorCompany): Promise<ContractorCompany | undefined> {
    const existing = await this.getContractorCompany(id);
    if (!existing) return undefined;
    const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (updates.name !== undefined) set.name = updates.name;
    if (updates.tradeType !== undefined) set.tradeType = updates.tradeType ?? null;
    if (updates.contactName !== undefined) set.contactName = updates.contactName ?? null;
    if (updates.contactEmail !== undefined) set.contactEmail = updates.contactEmail ?? null;
    if (updates.contactPhone !== undefined) set.contactPhone = updates.contactPhone ?? null;
    if (updates.address !== undefined) set.address = updates.address ?? null;
    if (updates.licenseNumber !== undefined) set.licenseNumber = updates.licenseNumber ?? null;
    if (updates.insuranceCarrier !== undefined) set.insuranceCarrier = updates.insuranceCarrier ?? null;
    if (updates.insuranceExpiry !== undefined) set.insuranceExpiry = updates.insuranceExpiry ?? null;
    if (updates.notes !== undefined) set.notes = updates.notes ?? null;
    if (updates.status !== undefined) set.status = updates.status;
    const result = await db.update(t.contractorCompanies)
      .set(set)
      .where(eq(t.contractorCompanies.id, id))
      .returning();
    return result[0] as ContractorCompany | undefined;
  }

  // ─── Worker Certifications (Phase 7B) ─────────────────────────────────────

  async getWorkerCertifications(orgId: string, filters?: { userId?: string; certType?: string }): Promise<WorkerCertification[]> {
    const conditions = [eq(t.workerCertifications.organizationId, orgId)];
    if (filters?.userId) conditions.push(eq(t.workerCertifications.userId, filters.userId));
    if (filters?.certType) conditions.push(eq(t.workerCertifications.certType, filters.certType));
    const rows = await db.select().from(t.workerCertifications).where(and(...conditions));
    return rows.map(mapWorkerCertification);
  }

  async getWorkerCertification(orgId: string, id: string): Promise<WorkerCertification | undefined> {
    const rows = await db.select().from(t.workerCertifications)
      .where(and(eq(t.workerCertifications.id, id), eq(t.workerCertifications.organizationId, orgId)));
    return rows[0] ? mapWorkerCertification(rows[0]) : undefined;
  }

  async createWorkerCertification(orgId: string, data: InsertWorkerCertification): Promise<WorkerCertification> {
    const row: WorkerCertificationRow = {
      id: randomUUID(),
      organizationId: orgId,
      userId: data.userId,
      certType: data.certType,
      certNumber: data.certNumber ?? null,
      issuingBody: data.issuingBody ?? null,
      issueDate: data.issueDate,
      expiryDate: data.expiryDate ?? null,
      documentUrl: data.documentUrl ?? null,
      notes: data.notes ?? null,
      createdAt: new Date().toISOString(),
    };
    const rows = await db.insert(t.workerCertifications).values(row).returning();
    return mapWorkerCertification(rows[0]);
  }

  async updateWorkerCertification(orgId: string, id: string, data: UpdateWorkerCertification): Promise<WorkerCertification | undefined> {
    const existing = await this.getWorkerCertification(orgId, id);
    if (!existing) return undefined;
    const set: Partial<WorkerCertificationRow> = {};
    if (data.userId !== undefined) set.userId = data.userId;
    if (data.certType !== undefined) set.certType = data.certType;
    if (data.certNumber !== undefined) set.certNumber = data.certNumber ?? null;
    if (data.issuingBody !== undefined) set.issuingBody = data.issuingBody ?? null;
    if (data.issueDate !== undefined) set.issueDate = data.issueDate;
    if (data.expiryDate !== undefined) set.expiryDate = data.expiryDate ?? null;
    if (data.documentUrl !== undefined) set.documentUrl = data.documentUrl ?? null;
    if (data.notes !== undefined) set.notes = data.notes ?? null;
    if (Object.keys(set).length === 0) return existing;
    const rows = await db.update(t.workerCertifications).set(set)
      .where(and(eq(t.workerCertifications.id, id), eq(t.workerCertifications.organizationId, orgId)))
      .returning();
    return rows[0] ? mapWorkerCertification(rows[0]) : undefined;
  }

  async deleteWorkerCertification(orgId: string, id: string): Promise<boolean> {
    const result = await db.delete(t.workerCertifications)
      .where(and(eq(t.workerCertifications.id, id), eq(t.workerCertifications.organizationId, orgId)))
      .returning();
    return result.length > 0;
  }

  // ─── Certificates of Insurance (Phase 7B) ─────────────────────────────────

  async getCertificatesOfInsurance(orgId: string, filters?: { tradeCompanyId?: string; linkedOrganizationId?: string; coverageType?: string }): Promise<CertificateOfInsurance[]> {
    const conditions = [eq(t.certificatesOfInsurance.organizationId, orgId)];
    if (filters?.tradeCompanyId) conditions.push(eq(t.certificatesOfInsurance.tradeCompanyId, filters.tradeCompanyId));
    if (filters?.linkedOrganizationId) conditions.push(eq(t.certificatesOfInsurance.linkedOrganizationId, filters.linkedOrganizationId));
    if (filters?.coverageType) conditions.push(eq(t.certificatesOfInsurance.coverageType, filters.coverageType));
    const rows = await db.select().from(t.certificatesOfInsurance).where(and(...conditions));
    return rows.map(mapCertificateOfInsurance);
  }

  async getCertificateOfInsurance(orgId: string, id: string): Promise<CertificateOfInsurance | undefined> {
    const rows = await db.select().from(t.certificatesOfInsurance)
      .where(and(eq(t.certificatesOfInsurance.id, id), eq(t.certificatesOfInsurance.organizationId, orgId)));
    return rows[0] ? mapCertificateOfInsurance(rows[0]) : undefined;
  }

  async createCertificateOfInsurance(orgId: string, data: InsertCertificateOfInsurance): Promise<CertificateOfInsurance> {
    const row: CertificateOfInsuranceRow = {
      id: randomUUID(),
      organizationId: orgId,
      companyName: data.companyName,
      tradeCompanyId: data.tradeCompanyId ?? null,
      linkedOrganizationId: data.linkedOrganizationId ?? null,
      coverageType: data.coverageType,
      insurer: data.insurer ?? null,
      policyNumber: data.policyNumber ?? null,
      coverageLimit: data.coverageLimit ?? null,
      effectiveDate: data.effectiveDate ?? null,
      expiryDate: data.expiryDate ?? null,
      documentUrl: data.documentUrl ?? null,
      notes: data.notes ?? null,
      createdAt: new Date().toISOString(),
    };
    const rows = await db.insert(t.certificatesOfInsurance).values(row).returning();
    return mapCertificateOfInsurance(rows[0]);
  }

  async updateCertificateOfInsurance(orgId: string, id: string, data: UpdateCertificateOfInsurance): Promise<CertificateOfInsurance | undefined> {
    const existing = await this.getCertificateOfInsurance(orgId, id);
    if (!existing) return undefined;
    const set: Partial<CertificateOfInsuranceRow> = {};
    if (data.companyName !== undefined) set.companyName = data.companyName;
    if (data.tradeCompanyId !== undefined) set.tradeCompanyId = data.tradeCompanyId ?? null;
    if (data.linkedOrganizationId !== undefined) set.linkedOrganizationId = data.linkedOrganizationId ?? null;
    if (data.coverageType !== undefined) set.coverageType = data.coverageType;
    if (data.insurer !== undefined) set.insurer = data.insurer ?? null;
    if (data.policyNumber !== undefined) set.policyNumber = data.policyNumber ?? null;
    if (data.coverageLimit !== undefined) set.coverageLimit = data.coverageLimit ?? null;
    if (data.effectiveDate !== undefined) set.effectiveDate = data.effectiveDate ?? null;
    if (data.expiryDate !== undefined) set.expiryDate = data.expiryDate ?? null;
    if (data.documentUrl !== undefined) set.documentUrl = data.documentUrl ?? null;
    if (data.notes !== undefined) set.notes = data.notes ?? null;
    if (Object.keys(set).length === 0) return existing;
    const rows = await db.update(t.certificatesOfInsurance).set(set)
      .where(and(eq(t.certificatesOfInsurance.id, id), eq(t.certificatesOfInsurance.organizationId, orgId)))
      .returning();
    return rows[0] ? mapCertificateOfInsurance(rows[0]) : undefined;
  }

  async deleteCertificateOfInsurance(orgId: string, id: string): Promise<boolean> {
    const result = await db.delete(t.certificatesOfInsurance)
      .where(and(eq(t.certificatesOfInsurance.id, id), eq(t.certificatesOfInsurance.organizationId, orgId)))
      .returning();
    return result.length > 0;
  }

  // ─── OSHA Incidents (Phase 7C) ────────────────────────────────────────────

  async getOshaIncidents(orgId: string, filters?: { jobsiteId?: string; caseType?: string; recordableCase?: string }): Promise<OshaIncident[]> {
    const conditions = [eq(t.oshaIncidents.organizationId, orgId)];
    if (filters?.jobsiteId) conditions.push(eq(t.oshaIncidents.jobsiteId, filters.jobsiteId));
    if (filters?.caseType) conditions.push(eq(t.oshaIncidents.caseType, filters.caseType));
    if (filters?.recordableCase) conditions.push(eq(t.oshaIncidents.recordableCase, filters.recordableCase));
    const rows = await db.select().from(t.oshaIncidents).where(and(...conditions));
    return rows.map(mapOshaIncident);
  }

  async getOshaIncident(orgId: string, id: string): Promise<OshaIncident | undefined> {
    const rows = await db.select().from(t.oshaIncidents)
      .where(and(eq(t.oshaIncidents.id, id), eq(t.oshaIncidents.organizationId, orgId)));
    return rows[0] ? mapOshaIncident(rows[0]) : undefined;
  }

  async createOshaIncident(orgId: string, data: InsertOshaIncident): Promise<OshaIncident> {
    const row: OshaIncidentRow = {
      id: randomUUID(),
      organizationId: orgId,
      jobsiteId: data.jobsiteId ?? null,
      incidentDate: data.incidentDate,
      employeeName: data.employeeName,
      jobTitle: data.jobTitle ?? null,
      department: data.department ?? null,
      incidentDescription: data.incidentDescription,
      bodyPart: data.bodyPart ?? null,
      injuryType: data.injuryType ?? null,
      caseType: data.caseType,
      daysAway: data.daysAway ?? null,
      daysRestricted: data.daysRestricted ?? null,
      isPrivacyCase: data.isPrivacyCase ?? "false",
      reportedBy: data.reportedBy ?? null,
      witnessNames: data.witnessNames ?? null,
      rootCause: data.rootCause ?? null,
      correctiveActions: data.correctiveActions ?? null,
      recordableCase: data.recordableCase ?? "true",
      createdAt: new Date().toISOString(),
    };
    const rows = await db.insert(t.oshaIncidents).values(row).returning();
    return mapOshaIncident(rows[0]);
  }

  async updateOshaIncident(orgId: string, id: string, data: UpdateOshaIncident): Promise<OshaIncident | undefined> {
    const existing = await this.getOshaIncident(orgId, id);
    if (!existing) return undefined;
    const set: Partial<OshaIncidentRow> = {};
    if (data.jobsiteId !== undefined) set.jobsiteId = data.jobsiteId ?? null;
    if (data.incidentDate !== undefined) set.incidentDate = data.incidentDate;
    if (data.employeeName !== undefined) set.employeeName = data.employeeName;
    if (data.jobTitle !== undefined) set.jobTitle = data.jobTitle ?? null;
    if (data.department !== undefined) set.department = data.department ?? null;
    if (data.incidentDescription !== undefined) set.incidentDescription = data.incidentDescription;
    if (data.bodyPart !== undefined) set.bodyPart = data.bodyPart ?? null;
    if (data.injuryType !== undefined) set.injuryType = data.injuryType ?? null;
    if (data.caseType !== undefined) set.caseType = data.caseType;
    if (data.daysAway !== undefined) set.daysAway = data.daysAway ?? null;
    if (data.daysRestricted !== undefined) set.daysRestricted = data.daysRestricted ?? null;
    if (data.isPrivacyCase !== undefined) set.isPrivacyCase = data.isPrivacyCase;
    if (data.reportedBy !== undefined) set.reportedBy = data.reportedBy ?? null;
    if (data.witnessNames !== undefined) set.witnessNames = data.witnessNames ?? null;
    if (data.rootCause !== undefined) set.rootCause = data.rootCause ?? null;
    if (data.correctiveActions !== undefined) set.correctiveActions = data.correctiveActions ?? null;
    if (data.recordableCase !== undefined) set.recordableCase = data.recordableCase;
    if (Object.keys(set).length === 0) return existing;
    const rows = await db.update(t.oshaIncidents).set(set)
      .where(and(eq(t.oshaIncidents.id, id), eq(t.oshaIncidents.organizationId, orgId)))
      .returning();
    return rows[0] ? mapOshaIncident(rows[0]) : undefined;
  }

  async deleteOshaIncident(orgId: string, id: string): Promise<boolean> {
    const result = await db.delete(t.oshaIncidents)
      .where(and(eq(t.oshaIncidents.id, id), eq(t.oshaIncidents.organizationId, orgId)))
      .returning();
    return result.length > 0;
  }

  // ─── Work Hours Log (Phase 7C) ────────────────────────────────────────────

  async getWorkHoursLog(orgId: string, filters?: { periodStart?: string; periodEnd?: string }): Promise<WorkHoursLog[]> {
    const conditions = [eq(t.workHoursLog.organizationId, orgId)];
    if (filters?.periodStart) conditions.push(gte(t.workHoursLog.periodStart, filters.periodStart));
    if (filters?.periodEnd) conditions.push(lte(t.workHoursLog.periodEnd, filters.periodEnd));
    const rows = await db.select().from(t.workHoursLog).where(and(...conditions));
    return rows.map(mapWorkHoursLog);
  }

  async getWorkHoursLogEntry(orgId: string, id: string): Promise<WorkHoursLog | undefined> {
    const rows = await db.select().from(t.workHoursLog)
      .where(and(eq(t.workHoursLog.id, id), eq(t.workHoursLog.organizationId, orgId)));
    return rows[0] ? mapWorkHoursLog(rows[0]) : undefined;
  }

  async createWorkHoursLogEntry(orgId: string, data: InsertWorkHoursLog): Promise<WorkHoursLog> {
    const row: WorkHoursLogRow = {
      id: randomUUID(),
      organizationId: orgId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      hoursWorked: data.hoursWorked,
      employeeCount: data.employeeCount ?? null,
      notes: data.notes ?? null,
      createdAt: new Date().toISOString(),
    };
    const rows = await db.insert(t.workHoursLog).values(row).returning();
    return mapWorkHoursLog(rows[0]);
  }

  async updateWorkHoursLogEntry(orgId: string, id: string, data: UpdateWorkHoursLog): Promise<WorkHoursLog | undefined> {
    const existing = await this.getWorkHoursLogEntry(orgId, id);
    if (!existing) return undefined;
    const set: Partial<WorkHoursLogRow> = {};
    if (data.periodStart !== undefined) set.periodStart = data.periodStart;
    if (data.periodEnd !== undefined) set.periodEnd = data.periodEnd;
    if (data.hoursWorked !== undefined) set.hoursWorked = data.hoursWorked;
    if (data.employeeCount !== undefined) set.employeeCount = data.employeeCount ?? null;
    if (data.notes !== undefined) set.notes = data.notes ?? null;
    if (Object.keys(set).length === 0) return existing;
    const rows = await db.update(t.workHoursLog).set(set)
      .where(and(eq(t.workHoursLog.id, id), eq(t.workHoursLog.organizationId, orgId)))
      .returning();
    return rows[0] ? mapWorkHoursLog(rows[0]) : undefined;
  }

  async deleteWorkHoursLogEntry(orgId: string, id: string): Promise<boolean> {
    const result = await db.delete(t.workHoursLog)
      .where(and(eq(t.workHoursLog.id, id), eq(t.workHoursLog.organizationId, orgId)))
      .returning();
    return result.length > 0;
  }

  // ─── TRIR (Phase 7C) ──────────────────────────────────────────────────────

  async computeTrir(orgId: string): Promise<TrirResult> {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const cutoff = threeYearsAgo.toISOString().split("T")[0];

    const incidents = await db.select().from(t.oshaIncidents).where(
      and(eq(t.oshaIncidents.organizationId, orgId), eq(t.oshaIncidents.recordableCase, "true"))
    );
    const recordableInPeriod = incidents.filter(i => i.incidentDate >= cutoff);

    const hoursRows = await db.select().from(t.workHoursLog).where(
      eq(t.workHoursLog.organizationId, orgId)
    );
    const hoursInPeriod = hoursRows.filter(r => r.periodStart >= cutoff);
    const totalHours = hoursInPeriod.reduce((sum, r) => sum + parseFloat(r.hoursWorked || "0"), 0);

    const trir = totalHours > 0 ? (recordableInPeriod.length * 200000) / totalHours : 0;

    return {
      trir: Math.round(trir * 100) / 100,
      recordableCases: recordableInPeriod.length,
      totalHours: Math.round(totalHours),
      periodStart: cutoff,
      periodEnd: new Date().toISOString().split("T")[0],
    };
  }

  // ─── Drivers (Phase 7D) ───────────────────────────────────────────────────

  async getDrivers(orgId: string, filters?: { status?: string }): Promise<Driver[]> {
    const conditions = [eq(t.drivers.organizationId, orgId)];
    if (filters?.status) conditions.push(eq(t.drivers.status, filters.status));
    const rows = await db.select().from(t.drivers).where(and(...conditions));
    return rows.map(mapDriver);
  }

  async getDriver(orgId: string, id: string): Promise<Driver | undefined> {
    const rows = await db.select().from(t.drivers)
      .where(and(eq(t.drivers.id, id), eq(t.drivers.organizationId, orgId)));
    return rows[0] ? mapDriver(rows[0]) : undefined;
  }

  async createDriver(orgId: string, data: InsertDriver): Promise<Driver> {
    const row: DriverRow = {
      id: randomUUID(),
      organizationId: orgId,
      userId: data.userId ?? null,
      name: data.name,
      licenseNumber: data.licenseNumber ?? null,
      phone: data.phone ?? null,
      status: data.status ?? "active",
      notes: data.notes ?? null,
      createdAt: new Date().toISOString(),
    };
    const rows = await db.insert(t.drivers).values(row).returning();
    return mapDriver(rows[0]);
  }

  async updateDriver(orgId: string, id: string, data: UpdateDriver): Promise<Driver | undefined> {
    const existing = await this.getDriver(orgId, id);
    if (!existing) return undefined;
    const set: Partial<DriverRow> = {};
    if (data.userId !== undefined) set.userId = data.userId ?? null;
    if (data.name !== undefined) set.name = data.name;
    if (data.licenseNumber !== undefined) set.licenseNumber = data.licenseNumber ?? null;
    if (data.phone !== undefined) set.phone = data.phone ?? null;
    if (data.status !== undefined) set.status = data.status;
    if (data.notes !== undefined) set.notes = data.notes ?? null;
    if (Object.keys(set).length === 0) return existing;
    const rows = await db.update(t.drivers).set(set)
      .where(and(eq(t.drivers.id, id), eq(t.drivers.organizationId, orgId)))
      .returning();
    return rows[0] ? mapDriver(rows[0]) : undefined;
  }

  async deleteDriver(orgId: string, id: string): Promise<boolean> {
    const result = await db.delete(t.drivers)
      .where(and(eq(t.drivers.id, id), eq(t.drivers.organizationId, orgId)))
      .returning();
    return result.length > 0;
  }

  // ─── Delivery Requests (Phase 7D) ─────────────────────────────────────────

  async getDeliveryRequests(orgId: string, filters?: { jobsiteId?: string; driverId?: string; status?: string }): Promise<DeliveryRequest[]> {
    const conditions = [eq(t.deliveryRequests.organizationId, orgId)];
    if (filters?.jobsiteId) conditions.push(eq(t.deliveryRequests.jobsiteId, filters.jobsiteId));
    if (filters?.driverId) conditions.push(eq(t.deliveryRequests.driverId, filters.driverId));
    if (filters?.status) conditions.push(eq(t.deliveryRequests.status, filters.status));
    const rows = await db.select().from(t.deliveryRequests).where(and(...conditions));
    return rows.map(mapDeliveryRequest);
  }

  async getDeliveryRequest(orgId: string, id: string): Promise<DeliveryRequest | undefined> {
    const rows = await db.select().from(t.deliveryRequests)
      .where(and(eq(t.deliveryRequests.id, id), eq(t.deliveryRequests.organizationId, orgId)));
    return rows[0] ? mapDeliveryRequest(rows[0]) : undefined;
  }

  async createDeliveryRequest(orgId: string, data: InsertDeliveryRequest): Promise<DeliveryRequest> {
    const row: DeliveryRequestRow = {
      id: randomUUID(),
      organizationId: orgId,
      jobsiteId: data.jobsiteId ?? null,
      requestedBy: data.requestedBy ?? null,
      approvedBy: data.approvedBy ?? null,
      driverId: data.driverId ?? null,
      description: data.description,
      status: data.status ?? "requested",
      scheduledDate: data.scheduledDate ?? null,
      notes: data.notes ?? null,
      createdAt: new Date().toISOString(),
    };
    const rows = await db.insert(t.deliveryRequests).values(row).returning();
    return mapDeliveryRequest(rows[0]);
  }

  async updateDeliveryRequest(orgId: string, id: string, data: UpdateDeliveryRequest): Promise<DeliveryRequest | undefined> {
    const existing = await this.getDeliveryRequest(orgId, id);
    if (!existing) return undefined;
    const set: Partial<DeliveryRequestRow> = {};
    if (data.jobsiteId !== undefined) set.jobsiteId = data.jobsiteId ?? null;
    if (data.requestedBy !== undefined) set.requestedBy = data.requestedBy ?? null;
    if (data.approvedBy !== undefined) set.approvedBy = data.approvedBy ?? null;
    if (data.driverId !== undefined) set.driverId = data.driverId ?? null;
    if (data.description !== undefined) set.description = data.description;
    if (data.status !== undefined) set.status = data.status;
    if (data.scheduledDate !== undefined) set.scheduledDate = data.scheduledDate ?? null;
    if (data.notes !== undefined) set.notes = data.notes ?? null;
    if (Object.keys(set).length === 0) return existing;
    const rows = await db.update(t.deliveryRequests).set(set)
      .where(and(eq(t.deliveryRequests.id, id), eq(t.deliveryRequests.organizationId, orgId)))
      .returning();
    return rows[0] ? mapDeliveryRequest(rows[0]) : undefined;
  }

  async updateDeliveryStatus(orgId: string, id: string, status: string): Promise<DeliveryRequest | undefined> {
    const existing = await this.getDeliveryRequest(orgId, id);
    if (!existing) return undefined;
    const rows = await db.update(t.deliveryRequests).set({ status })
      .where(and(eq(t.deliveryRequests.id, id), eq(t.deliveryRequests.organizationId, orgId)))
      .returning();
    return rows[0] ? mapDeliveryRequest(rows[0]) : undefined;
  }

  async deleteDeliveryRequest(orgId: string, id: string): Promise<boolean> {
    const result = await db.delete(t.deliveryRequests)
      .where(and(eq(t.deliveryRequests.id, id), eq(t.deliveryRequests.organizationId, orgId)))
      .returning();
    return result.length > 0;
  }

  // ─── Delivery NFC Events (Phase 7D) ───────────────────────────────────────

  async getDeliveryNfcEvents(orgId: string, deliveryRequestId: string): Promise<DeliveryNfcEvent[]> {
    const rows = await db.select().from(t.deliveryNfcEvents).where(and(
      eq(t.deliveryNfcEvents.organizationId, orgId),
      eq(t.deliveryNfcEvents.deliveryRequestId, deliveryRequestId),
    ));
    return rows.map(mapDeliveryNfcEvent);
  }

  async createDeliveryNfcEvent(orgId: string, data: InsertDeliveryNfcEvent): Promise<DeliveryNfcEvent> {
    const row: DeliveryNfcEventRow = {
      id: randomUUID(),
      organizationId: orgId,
      deliveryRequestId: data.deliveryRequestId,
      eventType: data.eventType,
      scannedBy: data.scannedBy ?? null,
      jobsiteId: data.jobsiteId ?? null,
      notes: data.notes ?? null,
      createdAt: new Date().toISOString(),
    };
    const rows = await db.insert(t.deliveryNfcEvents).values(row).returning();
    return mapDeliveryNfcEvent(rows[0]);
  }

  // ─── Inventory Items (Phase 7E) ───────────────────────────────────────────

  async getInventoryItems(orgId: string, filters?: { category?: string; condition?: string; currentJobsiteId?: string; assignedTo?: string }): Promise<InventoryItem[]> {
    const conditions = [eq(t.inventoryItems.organizationId, orgId)];
    if (filters?.category) conditions.push(eq(t.inventoryItems.category, filters.category));
    if (filters?.condition) conditions.push(eq(t.inventoryItems.condition, filters.condition));
    if (filters?.currentJobsiteId) conditions.push(eq(t.inventoryItems.currentJobsiteId, filters.currentJobsiteId));
    if (filters?.assignedTo) conditions.push(eq(t.inventoryItems.assignedTo, filters.assignedTo));
    const rows = await db.select().from(t.inventoryItems).where(and(...conditions));
    return rows.map(mapInventoryItem);
  }

  async getInventoryItem(orgId: string, id: string): Promise<InventoryItem | undefined> {
    const rows = await db.select().from(t.inventoryItems)
      .where(and(eq(t.inventoryItems.id, id), eq(t.inventoryItems.organizationId, orgId)));
    return rows[0] ? mapInventoryItem(rows[0]) : undefined;
  }

  async getInventoryItemByNfcTag(orgId: string, nfcTagId: string): Promise<InventoryItem | undefined> {
    const rows = await db.select().from(t.inventoryItems)
      .where(and(eq(t.inventoryItems.nfcTagId, nfcTagId), eq(t.inventoryItems.organizationId, orgId)));
    return rows[0] ? mapInventoryItem(rows[0]) : undefined;
  }

  async createInventoryItem(orgId: string, data: InsertInventoryItem): Promise<InventoryItem> {
    const row: InventoryItemRow = {
      id: randomUUID(),
      organizationId: orgId,
      name: data.name,
      description: data.description ?? null,
      category: data.category ?? null,
      serialNumber: data.serialNumber ?? null,
      assetTag: data.assetTag ?? null,
      nfcTagId: data.nfcTagId ?? null,
      condition: data.condition ?? "good",
      currentJobsiteId: data.currentJobsiteId ?? null,
      assignedTo: data.assignedTo ?? null,
      purchaseDate: data.purchaseDate ?? null,
      purchasePrice: data.purchasePrice ?? null,
      notes: data.notes ?? null,
      createdAt: new Date().toISOString(),
    };
    const rows = await db.insert(t.inventoryItems).values(row).returning();
    return mapInventoryItem(rows[0]);
  }

  async updateInventoryItem(orgId: string, id: string, data: UpdateInventoryItem): Promise<InventoryItem | undefined> {
    const existing = await this.getInventoryItem(orgId, id);
    if (!existing) return undefined;
    const set: Partial<InventoryItemRow> = {};
    if (data.name !== undefined) set.name = data.name;
    if (data.description !== undefined) set.description = data.description ?? null;
    if (data.category !== undefined) set.category = data.category ?? null;
    if (data.serialNumber !== undefined) set.serialNumber = data.serialNumber ?? null;
    if (data.assetTag !== undefined) set.assetTag = data.assetTag ?? null;
    if (data.nfcTagId !== undefined) set.nfcTagId = data.nfcTagId ?? null;
    if (data.condition !== undefined) set.condition = data.condition;
    if (data.currentJobsiteId !== undefined) set.currentJobsiteId = data.currentJobsiteId ?? null;
    if (data.assignedTo !== undefined) set.assignedTo = data.assignedTo ?? null;
    if (data.purchaseDate !== undefined) set.purchaseDate = data.purchaseDate ?? null;
    if (data.purchasePrice !== undefined) set.purchasePrice = data.purchasePrice ?? null;
    if (data.notes !== undefined) set.notes = data.notes ?? null;
    if (Object.keys(set).length === 0) return existing;
    const rows = await db.update(t.inventoryItems).set(set)
      .where(and(eq(t.inventoryItems.id, id), eq(t.inventoryItems.organizationId, orgId)))
      .returning();
    return rows[0] ? mapInventoryItem(rows[0]) : undefined;
  }

  async deleteInventoryItem(orgId: string, id: string): Promise<boolean> {
    const result = await db.delete(t.inventoryItems)
      .where(and(eq(t.inventoryItems.id, id), eq(t.inventoryItems.organizationId, orgId)))
      .returning();
    return result.length > 0;
  }

  // ─── Inventory Checkouts (Phase 7E) ───────────────────────────────────────

  async getInventoryCheckouts(orgId: string, filters?: { inventoryItemId?: string; jobsiteId?: string; open?: boolean }): Promise<InventoryCheckout[]> {
    const conditions = [eq(t.inventoryCheckouts.organizationId, orgId)];
    if (filters?.inventoryItemId) conditions.push(eq(t.inventoryCheckouts.inventoryItemId, filters.inventoryItemId));
    if (filters?.jobsiteId) conditions.push(eq(t.inventoryCheckouts.jobsiteId, filters.jobsiteId));
    if (filters?.open === true) conditions.push(isNull(t.inventoryCheckouts.returnedAt));
    const rows = await db.select().from(t.inventoryCheckouts).where(and(...conditions));
    return rows.map(mapInventoryCheckout);
  }

  async getInventoryCheckout(orgId: string, id: string): Promise<InventoryCheckout | undefined> {
    const rows = await db.select().from(t.inventoryCheckouts)
      .where(and(eq(t.inventoryCheckouts.id, id), eq(t.inventoryCheckouts.organizationId, orgId)));
    return rows[0] ? mapInventoryCheckout(rows[0]) : undefined;
  }

  async createInventoryCheckout(orgId: string, data: InsertInventoryCheckout): Promise<InventoryCheckout> {
    const now = new Date().toISOString();
    const row: InventoryCheckoutRow = {
      id: randomUUID(),
      organizationId: orgId,
      inventoryItemId: data.inventoryItemId,
      checkedOutBy: data.checkedOutBy ?? null,
      jobsiteId: data.jobsiteId ?? null,
      checkedOutAt: now,
      expectedReturnDate: data.expectedReturnDate ?? null,
      returnedAt: null,
      returnCondition: null,
      returnNotes: null,
      createdAt: now,
    };
    const rows = await db.insert(t.inventoryCheckouts).values(row).returning();
    await db.update(t.inventoryItems)
      .set({
        currentJobsiteId: data.jobsiteId ?? null,
        assignedTo: data.checkedOutBy ?? null,
      })
      .where(and(
        eq(t.inventoryItems.id, data.inventoryItemId),
        eq(t.inventoryItems.organizationId, orgId),
      ));
    return mapInventoryCheckout(rows[0]);
  }

  async closeInventoryCheckout(orgId: string, id: string, data: CloseInventoryCheckout): Promise<InventoryCheckout | undefined> {
    const existing = await this.getInventoryCheckout(orgId, id);
    if (!existing) return undefined;
    const set: Partial<InventoryCheckoutRow> = {
      returnedAt: data.returnedAt ?? new Date().toISOString(),
    };
    if (data.returnCondition !== undefined) set.returnCondition = data.returnCondition ?? null;
    if (data.returnNotes !== undefined) set.returnNotes = data.returnNotes ?? null;
    const rows = await db.update(t.inventoryCheckouts).set(set)
      .where(and(eq(t.inventoryCheckouts.id, id), eq(t.inventoryCheckouts.organizationId, orgId)))
      .returning();
    if (!rows[0]) return undefined;
    await db.update(t.inventoryItems)
      .set({ currentJobsiteId: null, assignedTo: null })
      .where(and(
        eq(t.inventoryItems.id, existing.inventoryItemId),
        eq(t.inventoryItems.organizationId, orgId),
      ));
    return mapInventoryCheckout(rows[0]);
  }

  // ─── Inventory Condition Reports (Phase 7E) ───────────────────────────────

  async getInventoryConditionReports(orgId: string, inventoryItemId: string): Promise<InventoryConditionReport[]> {
    const rows = await db.select().from(t.inventoryConditionReports).where(and(
      eq(t.inventoryConditionReports.organizationId, orgId),
      eq(t.inventoryConditionReports.inventoryItemId, inventoryItemId),
    ));
    return rows.map(mapInventoryConditionReport);
  }

  async createInventoryConditionReport(orgId: string, data: InsertInventoryConditionReport): Promise<InventoryConditionReport> {
    const row: InventoryConditionReportRow = {
      id: randomUUID(),
      organizationId: orgId,
      inventoryItemId: data.inventoryItemId,
      checkoutId: data.checkoutId ?? null,
      reportedBy: data.reportedBy ?? null,
      condition: data.condition,
      notes: data.notes ?? null,
      photoUrls: data.photoUrls ?? null,
      createdAt: new Date().toISOString(),
    };
    const rows = await db.insert(t.inventoryConditionReports).values(row).returning();
    return mapInventoryConditionReport(rows[0]);
  }

  // ─── Inventory Service Tickets (Phase 7E) ─────────────────────────────────

  async getInventoryServiceTickets(orgId: string, filters?: { inventoryItemId?: string; status?: string }): Promise<InventoryServiceTicket[]> {
    const conditions = [eq(t.inventoryServiceTickets.organizationId, orgId)];
    if (filters?.inventoryItemId) conditions.push(eq(t.inventoryServiceTickets.inventoryItemId, filters.inventoryItemId));
    if (filters?.status) conditions.push(eq(t.inventoryServiceTickets.status, filters.status));
    const rows = await db.select().from(t.inventoryServiceTickets).where(and(...conditions));
    return rows.map(mapInventoryServiceTicket);
  }

  async getInventoryServiceTicket(orgId: string, id: string): Promise<InventoryServiceTicket | undefined> {
    const rows = await db.select().from(t.inventoryServiceTickets)
      .where(and(eq(t.inventoryServiceTickets.id, id), eq(t.inventoryServiceTickets.organizationId, orgId)));
    return rows[0] ? mapInventoryServiceTicket(rows[0]) : undefined;
  }

  async createInventoryServiceTicket(orgId: string, data: InsertInventoryServiceTicket): Promise<InventoryServiceTicket> {
    const row: InventoryServiceTicketRow = {
      id: randomUUID(),
      organizationId: orgId,
      inventoryItemId: data.inventoryItemId,
      reportedBy: data.reportedBy ?? null,
      issueDescription: data.issueDescription,
      status: data.status ?? "open",
      resolvedAt: data.resolvedAt ?? null,
      resolvedBy: data.resolvedBy ?? null,
      resolutionNotes: data.resolutionNotes ?? null,
      createdAt: new Date().toISOString(),
    };
    const rows = await db.insert(t.inventoryServiceTickets).values(row).returning();
    return mapInventoryServiceTicket(rows[0]);
  }

  async updateInventoryServiceTicket(orgId: string, id: string, data: UpdateInventoryServiceTicket): Promise<InventoryServiceTicket | undefined> {
    const existing = await this.getInventoryServiceTicket(orgId, id);
    if (!existing) return undefined;
    const set: Partial<InventoryServiceTicketRow> = {};
    if (data.inventoryItemId !== undefined) set.inventoryItemId = data.inventoryItemId;
    if (data.reportedBy !== undefined) set.reportedBy = data.reportedBy ?? null;
    if (data.issueDescription !== undefined) set.issueDescription = data.issueDescription;
    if (data.status !== undefined) set.status = data.status;
    if (data.resolvedAt !== undefined) set.resolvedAt = data.resolvedAt ?? null;
    if (data.resolvedBy !== undefined) set.resolvedBy = data.resolvedBy ?? null;
    if (data.resolutionNotes !== undefined) set.resolutionNotes = data.resolutionNotes ?? null;
    if (Object.keys(set).length === 0) return existing;
    const rows = await db.update(t.inventoryServiceTickets).set(set)
      .where(and(eq(t.inventoryServiceTickets.id, id), eq(t.inventoryServiceTickets.organizationId, orgId)))
      .returning();
    return rows[0] ? mapInventoryServiceTicket(rows[0]) : undefined;
  }

  // ─── Portfolio Shares (Phase 7F) ──────────────────────────────────────────

  async getPortfolioShares(orgId: string): Promise<PortfolioShare[]> {
    const rows = await db.select().from(t.portfolioShares)
      .where(eq(t.portfolioShares.organizationId, orgId))
      .orderBy(desc(t.portfolioShares.createdAt));
    return rows.map(mapPortfolioShare);
  }

  async getPortfolioShareByToken(token: string): Promise<PortfolioShare | undefined> {
    const rows = await db.select().from(t.portfolioShares)
      .where(eq(t.portfolioShares.token, token));
    return rows[0] ? mapPortfolioShare(rows[0]) : undefined;
  }

  async createPortfolioShare(orgId: string, data: InsertPortfolioShare): Promise<PortfolioShare> {
    const defaults: VisibleSections = {
      trir: true, workerCerts: true, coi: true,
      jobsites: true, oshaIncidents: true, inventory: true,
    };
    const incoming = (data.visibleSections ?? {}) as Partial<VisibleSections>;
    const merged: VisibleSections = { ...defaults };
    for (const section of PORTFOLIO_SECTIONS) {
      if (incoming[section] !== undefined) merged[section] = incoming[section]!;
    }
    const row: PortfolioShareRow = {
      id: randomUUID(),
      organizationId: orgId,
      token: randomUUID().replace(/-/g, ""),
      expiresAt: data.expiresAt,
      revokedAt: null,
      visibleSections: JSON.stringify(merged),
      createdBy: data.createdBy ?? null,
      createdAt: new Date().toISOString(),
    };
    const rows = await db.insert(t.portfolioShares).values(row).returning();
    return mapPortfolioShare(rows[0]);
  }

  async revokePortfolioShare(orgId: string, id: string): Promise<PortfolioShare | undefined> {
    const existing = await db.select().from(t.portfolioShares)
      .where(and(eq(t.portfolioShares.id, id), eq(t.portfolioShares.organizationId, orgId)));
    if (!existing[0]) return undefined;
    const rows = await db.update(t.portfolioShares)
      .set({ revokedAt: new Date().toISOString() })
      .where(and(eq(t.portfolioShares.id, id), eq(t.portfolioShares.organizationId, orgId)))
      .returning();
    return rows[0] ? mapPortfolioShare(rows[0]) : undefined;
  }

  async getPortfolioSnapshot(orgId: string, visibleSections: VisibleSections): Promise<PortfolioSnapshot> {
    const org = await this.getOrganization(orgId);
    if (!org) throw new Error("Organization not found");

    const snapshot: PortfolioSnapshot = {
      org: { id: org.id, name: org.name, orgType: org.orgType ?? "ssm_firm", logoUrl: org.logoUrl },
      generatedAt: new Date().toISOString(),
      visibleSections,
    };

    if (visibleSections.trir) {
      snapshot.trir = await this.computeTrir(orgId);
    }

    if (visibleSections.workerCerts) {
      const certs = await this.getWorkerCertifications(orgId);
      const summary = { total: certs.length, valid: 0, expiringSoon: 0, expired: 0, noExpiry: 0 };
      for (const c of certs) {
        const s = c.status ?? "no_expiry";
        if (s === "valid") summary.valid++;
        else if (s === "expiring_soon") summary.expiringSoon++;
        else if (s === "expired") summary.expired++;
        else summary.noExpiry++;
      }
      snapshot.workerCerts = summary;
    }

    if (visibleSections.coi) {
      const cois = await this.getCertificatesOfInsurance(orgId);
      snapshot.coi = cois.map(c => ({
        id: c.id,
        companyName: c.companyName,
        coverageType: c.coverageType,
        insurer: c.insurer ?? undefined,
        expiryDate: c.expiryDate ?? undefined,
        status: c.status ?? "no_expiry",
      }));
    }

    if (visibleSections.jobsites) {
      const jobsites = await this.getJobsitesByOrg(orgId);
      snapshot.jobsites = jobsites.map(j => ({
        id: j.id,
        name: j.name,
        address: j.address ?? undefined,
        status: (j as any).status ?? "active",
      }));
    }

    if (visibleSections.oshaIncidents) {
      const incidents = await this.getOshaIncidents(orgId);
      snapshot.oshaIncidents = incidents.map(i => ({
        id: i.id,
        incidentDate: i.incidentDate,
        caseType: i.caseType,
        recordableCase: i.recordableCase,
      }));
    }

    if (visibleSections.inventory) {
      const items = await this.getInventoryItems(orgId);
      const checkedOut = await this.getInventoryCheckouts(orgId, { open: true });
      snapshot.inventory = {
        total: items.length,
        checkedOut: checkedOut.length,
        outOfService: items.filter(i => i.condition === "out_of_service").length,
      };
    }

    return snapshot;
  }

  // ─── Notifications (Phase 8) ──────────────────────────────────────────────

  async getNotifications(orgId: string, userId: string, filters?: { unreadOnly?: boolean }): Promise<Notification[]> {
    const conditions: SQL[] = [
      eq(t.notifications.organizationId, orgId),
      eq(t.notifications.userId, userId),
    ];
    if (filters?.unreadOnly) conditions.push(isNull(t.notifications.readAt));
    const rows = await db.select().from(t.notifications)
      .where(and(...conditions))
      .orderBy(desc(t.notifications.createdAt))
      .limit(50);
    return rows.map(mapNotification);
  }

  async getUnreadNotificationCount(orgId: string, userId: string): Promise<number> {
    const rows = await db.select().from(t.notifications)
      .where(and(
        eq(t.notifications.organizationId, orgId),
        eq(t.notifications.userId, userId),
        isNull(t.notifications.readAt),
      ));
    return rows.length;
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const row: NotificationRow = {
      id: randomUUID(),
      organizationId: data.organizationId,
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    const rows = await db.insert(t.notifications).values(row).returning();
    return mapNotification(rows[0]);
  }

  async markNotificationRead(orgId: string, userId: string, id: string): Promise<Notification | undefined> {
    const existing = await db.select().from(t.notifications).where(and(
      eq(t.notifications.id, id),
      eq(t.notifications.organizationId, orgId),
      eq(t.notifications.userId, userId),
    ));
    if (!existing[0]) return undefined;
    const rows = await db.update(t.notifications)
      .set({ readAt: new Date().toISOString() })
      .where(and(
        eq(t.notifications.id, id),
        eq(t.notifications.organizationId, orgId),
        eq(t.notifications.userId, userId),
      ))
      .returning();
    return rows[0] ? mapNotification(rows[0]) : undefined;
  }

  async markAllNotificationsRead(orgId: string, userId: string): Promise<void> {
    await db.update(t.notifications)
      .set({ readAt: new Date().toISOString() })
      .where(and(
        eq(t.notifications.organizationId, orgId),
        eq(t.notifications.userId, userId),
        isNull(t.notifications.readAt),
      ));
  }

  async deleteNotification(orgId: string, userId: string, id: string): Promise<boolean> {
    const result = await db.delete(t.notifications)
      .where(and(
        eq(t.notifications.id, id),
        eq(t.notifications.organizationId, orgId),
        eq(t.notifications.userId, userId),
      ))
      .returning();
    return result.length > 0;
  }

  async getNotificationByEntity(orgId: string, type: string, entityId: string): Promise<Notification | undefined> {
    const rows = await db.select().from(t.notifications)
      .where(and(
        eq(t.notifications.organizationId, orgId),
        eq(t.notifications.type, type),
        eq(t.notifications.entityId, entityId),
      ))
      .limit(1);
    return rows[0] ? mapNotification(rows[0]) : undefined;
  }
}

function mapNotification(row: typeof t.notifications.$inferSelect): Notification {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    type: row.type,
    title: row.title,
    message: row.message,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    readAt: row.readAt ?? null,
    createdAt: row.createdAt,
  };
}

export async function createNotificationForOrgAdmins(
  orgId: string,
  type: string,
  title: string,
  message: string,
  entityType?: string,
  entityId?: string,
): Promise<void> {
  try {
    const users = await db.select().from(t.users).where(
      and(
        eq(t.users.organizationId, orgId),
        inArray(t.users.role, ["Owner", "Admin"]),
      ),
    );
    for (const user of users) {
      await storage.createNotification({
        organizationId: orgId,
        userId: user.id,
        type: type as InsertNotification["type"],
        title,
        message,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
      });
    }
  } catch (e) {
    console.error("Failed to create notifications:", e);
  }
}

function mapPortfolioShare(row: typeof t.portfolioShares.$inferSelect): PortfolioShare {
  let parsed: VisibleSections;
  try {
    const obj = JSON.parse(row.visibleSections) as Partial<VisibleSections>;
    parsed = {
      trir: obj.trir ?? true,
      workerCerts: obj.workerCerts ?? true,
      coi: obj.coi ?? true,
      jobsites: obj.jobsites ?? true,
      oshaIncidents: obj.oshaIncidents ?? true,
      inventory: obj.inventory ?? true,
    };
  } catch {
    parsed = { trir: true, workerCerts: true, coi: true, jobsites: true, oshaIncidents: true, inventory: true };
  }
  return {
    id: row.id,
    organizationId: row.organizationId,
    token: row.token,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt ?? undefined,
    visibleSections: parsed,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt ?? "",
  };
}

export const storage = new DatabaseStorage();
