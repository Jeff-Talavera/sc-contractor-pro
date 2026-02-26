import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClientSchema, insertJobsiteSchema, insertInspectionSchema, insertObservationSchema } from "@shared/schema";
import type { AiFinding } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/me", (_req, res) => {
    const user = storage.getCurrentUser();
    const org = storage.getOrganization(user.organizationId);
    res.json({ user, organization: org });
  });

  app.get("/api/users", (_req, res) => {
    const user = storage.getCurrentUser();
    res.json(storage.getUsersByOrg(user.organizationId));
  });

  app.get("/api/clients", (_req, res) => {
    const user = storage.getCurrentUser();
    res.json(storage.getClientsByOrg(user.organizationId));
  });

  app.get("/api/clients/:id", (req, res) => {
    const client = storage.getClient(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  });

  app.post("/api/clients", (req, res) => {
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const user = storage.getCurrentUser();
    const client = storage.createClient(user.organizationId, parsed.data);
    res.status(201).json(client);
  });

  app.get("/api/jobsites", (_req, res) => {
    const user = storage.getCurrentUser();
    res.json(storage.getJobsitesByOrg(user.organizationId));
  });

  app.get("/api/jobsites/:id", (req, res) => {
    const jobsite = storage.getJobsite(req.params.id);
    if (!jobsite) return res.status(404).json({ message: "Jobsite not found" });
    res.json(jobsite);
  });

  app.post("/api/jobsites", (req, res) => {
    const parsed = insertJobsiteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const user = storage.getCurrentUser();
    const jobsite = storage.createJobsite(user.organizationId, parsed.data);
    res.status(201).json(jobsite);
  });

  app.patch("/api/jobsites/:id", (req, res) => {
    const updated = storage.updateJobsite(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Jobsite not found" });
    res.json(updated);
  });

  app.get("/api/clients/:id/jobsites", (req, res) => {
    res.json(storage.getJobsitesByClient(req.params.id));
  });

  app.get("/api/code-references", (_req, res) => {
    res.json(storage.getCodeReferences());
  });

  app.get("/api/code-references/:id", (req, res) => {
    const ref = storage.getCodeReference(req.params.id);
    if (!ref) return res.status(404).json({ message: "Code reference not found" });
    res.json(ref);
  });

  app.get("/api/templates", (_req, res) => {
    const user = storage.getCurrentUser();
    res.json(storage.getTemplatesByOrg(user.organizationId));
  });

  app.get("/api/inspections", (_req, res) => {
    const user = storage.getCurrentUser();
    res.json(storage.getInspectionsByOrg(user.organizationId));
  });

  app.get("/api/inspections/:id", (req, res) => {
    const insp = storage.getInspection(req.params.id);
    if (!insp) return res.status(404).json({ message: "Inspection not found" });
    res.json(insp);
  });

  app.post("/api/inspections", (req, res) => {
    const parsed = insertInspectionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const user = storage.getCurrentUser();
    const inspection = storage.createInspection(user.organizationId, user.id, parsed.data);
    res.status(201).json(inspection);
  });

  app.patch("/api/inspections/:id/status", (req, res) => {
    const { status } = req.body;
    if (!["Draft", "Submitted"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const updated = storage.updateInspectionStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ message: "Inspection not found" });
    res.json(updated);
  });

  app.get("/api/jobsites/:id/inspections", (req, res) => {
    res.json(storage.getInspectionsByJobsite(req.params.id));
  });

  app.get("/api/inspections/:id/observations", (req, res) => {
    res.json(storage.getObservationsByInspection(req.params.id));
  });

  app.get("/api/observations/:id", (req, res) => {
    const obs = storage.getObservation(req.params.id);
    if (!obs) return res.status(404).json({ message: "Observation not found" });
    res.json(obs);
  });

  app.post("/api/observations", (req, res) => {
    const parsed = insertObservationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const user = storage.getCurrentUser();
    const observation = storage.createObservation(user.organizationId, user.id, parsed.data);
    res.status(201).json(observation);
  });

  app.patch("/api/observations/:id", (req, res) => {
    const updated = storage.updateObservation(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Observation not found" });
    res.json(updated);
  });

  app.get("/api/jobsites/:id/permits", (req, res) => {
    res.json(storage.getPermitsByJobsite(req.params.id));
  });

  app.get("/api/jobsites/:id/external-events", (req, res) => {
    res.json(storage.getExternalEventsByJobsite(req.params.id));
  });

  app.post("/api/ai/analyze-photo", (_req, res) => {
    const codeRefs = storage.getCodeReferences();
    const findingPool: AiFinding[] = [
      {
        id: `ai-${Date.now()}-1`,
        label: "No guardrails at open edge",
        confidence: 0.92,
        suggestedCodeReferenceIds: ["BC-3314.1", "BC-3306.5"],
      },
      {
        id: `ai-${Date.now()}-2`,
        label: "Debris accumulation in walkway",
        confidence: 0.87,
        suggestedCodeReferenceIds: ["BC-3316.1"],
      },
      {
        id: `ai-${Date.now()}-3`,
        label: "Missing toe board on scaffold platform",
        confidence: 0.79,
        suggestedCodeReferenceIds: ["BC-3306.1", "BC-3306.5"],
      },
      {
        id: `ai-${Date.now()}-4`,
        label: "Unsecured construction fence section",
        confidence: 0.84,
        suggestedCodeReferenceIds: ["BC-3302.1", "BC-3301.9"],
      },
      {
        id: `ai-${Date.now()}-5`,
        label: "Workers at height without fall arrest system",
        confidence: 0.95,
        suggestedCodeReferenceIds: ["BC-3314.1"],
      },
      {
        id: `ai-${Date.now()}-6`,
        label: "Sidewalk shed lighting deficiency",
        confidence: 0.73,
        suggestedCodeReferenceIds: ["BC-3303.1"],
      },
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
