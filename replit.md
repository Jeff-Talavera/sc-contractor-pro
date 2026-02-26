# SafeSite - NYC Construction Safety Management

## Overview
Multi-firm construction safety application for NYC-based safety firms (2-10 inspectors). Provides client/jobsite management, inspection workflows, observation tracking, NYC code reference guidance, public records monitoring (permits/complaints/violations), and AI-assisted photo analysis for safety observations.

## Architecture
- **Frontend**: React + TypeScript with Vite, TanStack Query, wouter routing, shadcn/ui components
- **Backend**: Express.js with in-memory storage (prepared for future database integration)
- **Data**: In-memory storage with mock/seed data - structured for easy swap to Supabase or PostgreSQL

## Key Files
- `shared/schema.ts` - All TypeScript interfaces and Zod validation schemas
- `server/mockData.ts` - All seed/mock data (organizations, users, clients, jobsites, code references, templates, inspections, observations, permits, external events)
- `server/storage.ts` - Storage interface (IStorage) and in-memory implementation
- `server/routes.ts` - All API routes prefixed with /api, including mock AI analysis endpoint
- `client/src/components/disclaimer.tsx` - Shared disclaimer text component
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `client/src/pages/` - All page components (dashboard, clients, jobsites, inspections, code-library)

## Data Models
- **Organization** + **User** (multi-org, role-based: Owner/Admin/Inspector)
- **Client** + **Jobsite** (with NYC-specific fields: BIN, DOB job number, borough, project type, site flags, monitorPublicRecords toggle)
- **CodeReference** (Building Code Chapter 33 + Administrative Code sections with tags and plain-English summaries)
- **InspectionTemplate** + **Inspection** + **Observation** (full inspection workflow with code reference linking)
- **JobsitePermit** (DOB NOW/BIS/NYC Open Data permit records per jobsite)
- **JobsiteExternalEvent** (DOB complaints and ECB violations per jobsite, with isNew flag)
- **AiFinding** (AI-detected hazard with label, confidence score, and suggested code references)
- **Observation** extended with `source: "manual"|"ai"` and optional `aiFindings[]` for traceability

## Features

### Public Records (Jobsite Detail)
- Permits tab: table of DOB permits with status filter, external links to DOB NOW/BIS
- Complaints & Violations tab: table with type/status filters, summary counts, NEW badges
- Monitor toggle: switch to enable/disable public records monitoring per jobsite
- Mock data in `server/mockData.ts` → `mockPermits` and `mockExternalEvents`
- API routes: `GET /api/jobsites/:id/permits`, `GET /api/jobsites/:id/external-events`

### Photo AI Flow (Inspection Detail)
- "Photo Check (AI)" button opens dialog with upload → review → create workflow
- Upload 1-3 photos, mock AI analysis returns 2-4 findings per image
- Review findings with checkboxes, confidence scores, code reference chips, editable descriptions
- Creates observations with `source: "ai"`, purple AI badge shown in observation list
- Mock analyzer: `POST /api/ai/analyze-photo` in `server/routes.ts` (replace with real AI API later)
- AI disclaimer shown in dialog: "AI suggestions are for guidance only..."

### Where to Extend
- Replace mock AI analyzer: `server/routes.ts` → `/api/ai/analyze-photo` route
- Replace mock permits/events: `server/mockData.ts` → `mockPermits`, `mockExternalEvents` (or add real API calls to NYC Open Data)
- Add real database: Swap `MemStorage` in `server/storage.ts` with Drizzle ORM or Supabase client

## Important Locations
- Code References: Edit/add entries in `server/mockData.ts` → `mockCodeReferences`
- Inspection Templates: Edit/add in `server/mockData.ts` → `mockInspectionTemplates`
- Disclaimer Text: Edit in `client/src/components/disclaimer.tsx` → `DISCLAIMER_TEXT`
- Current User (mock auth): Edit in `server/mockData.ts` → `currentUser`
- Permits Mock Data: `server/mockData.ts` → `mockPermits`
- Events Mock Data: `server/mockData.ts` → `mockExternalEvents`

## Running
- `npm run dev` starts Express backend + Vite frontend on port 5000
