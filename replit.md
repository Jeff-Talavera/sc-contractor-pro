# SafeSite - Construction Safety Management

## Overview
Multi-firm construction safety application for safety consulting firms (2-10 inspectors). Usable anywhere — designed for NYC and non-NYC users alike. Provides client/jobsite management, inspection workflows, observation tracking, code reference guidance (NYC Building Code, OSHA CFR 1926), public records monitoring (permits/complaints/violations), and AI-assisted photo analysis for safety observations.

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
- `client/src/pages/` - All page components (dashboard, clients, jobsites, inspections, code-library, workforce)

## Data Models
- **Organization** + **User** (multi-org, role-based: Owner/Admin/Inspector)
- **Client** + **Jobsite** (with fields: address, city, state, optional BIN/job number for NYC DOB, project type, site flags, monitorPublicRecords toggle, `parentClientId` for subcontractor hierarchy)
- **CodeReference** (Building Code Chapter 33 + Administrative Code sections with tags and plain-English summaries)
- **InspectionTemplate** + **Inspection** + **Observation** (full inspection workflow with code reference linking)
- **JobsitePermit** (DOB NOW/BIS/NYC Open Data permit records per jobsite)
- **JobsiteExternalEvent** (DOB complaints and ECB violations per jobsite, with isNew flag)
- **AiFinding** (AI-detected hazard with label, confidence score, and suggested code references)
- **Observation** extended with `source: "manual"|"ai"` and optional `aiFindings[]` for traceability
- **EmployeeProfile** (linked to User, with title, phone, certifications, licenseNumbers, hireDate, status, hourlyRate, emergency contact)
- **ScheduleEntry** (employee-to-jobsite assignment on a date with shift times and status: Scheduled/Confirmed/Completed/Cancelled)
- **Timesheet** (weekly timesheet per employee with status: Draft/Submitted/Approved/Rejected, totalHours, approval tracking)
- **TimesheetEntry** (daily line item on a timesheet: date, jobsite, hours, description)
- **SafetyReport** (contractor safety data entry per period: lagging + leading indicators, auto-computed scores 0-100 and letter grade A-D, `photos: string[]` base64 attachments up to 10)
- **SafetyReportSettings** (org-level scoring weight configuration, defaults: incident 35%, training 20%, hazard 20%, permit 15%, culture 10%)
- **Organization** extended with `logoUrl?: string` (stored as base64 data URI)

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

### Photo Annotation
- `client/src/components/photo-annotator.tsx` — Fabric.js canvas annotator
- Drawing tools: Arrow, Line, Rectangle, Circle, Freehand draw
- Color picker: Red (default), Yellow, Blue, White, Black
- Undo/Redo/Clear and Save functionality
- Integrated in both Photo AI dialog (annotate before AI analysis) and manual Add Observation form
- Annotated photos saved as data URLs to `observation.photoUrls`

### Code Reference Keyword Chips
- Clickable keyword chips above the code reference search input
- Keywords: fall protection, scaffolds, cranes, excavations, housekeeping, public protection, permits, demolition, hoists, rigging
- Clicking a chip fills the search box and filters results; clicking again clears

### Observation Export (PDF)
- `client/src/lib/export-observation.ts` — PDF generator using jsPDF
- "Export PDF" button on each observation card
- PDF includes: SafeSite header, observation details, description, recommended actions, linked code references (ID + title), annotated photos, AI confidence (if applicable)

### Workforce Module
- **Directory tab**: Searchable employee list with status filter, click-through to employee detail view
  - Employee detail: contact info, certifications & license numbers, emergency contact, upcoming schedule
  - Add Employee dialog with user selection, title, phone, certifications (tag input), emergency contact
- **Schedule tab**: Week-view grid (employees as rows, days as columns) with prev/next week navigation
  - Colored assignment chips showing jobsite name and shift times
  - Click chip to advance status (Scheduled → Confirmed → Completed)
  - Assign dialog: select employee + jobsite + date + shift times + notes
- **Timesheets tab**: Filterable list by employee and status
  - Timesheet detail: daily breakdown with add/delete entries, submit/approve/reject actions
  - New Timesheet dialog: select employee + week start date
- API routes: `/api/employees`, `/api/schedule`, `/api/timesheets`, `/api/timesheet-entries`
- Page: `client/src/pages/workforce.tsx`
- Mock data: `mockEmployeeProfiles`, `mockScheduleEntries`, `mockTimesheets`, `mockTimesheetEntries`

### Where to Extend
- Replace mock AI analyzer: `server/routes.ts` → `/api/ai/analyze-photo` route
- Replace mock permits/events: `server/mockData.ts` → `mockPermits`, `mockExternalEvents` (or add real API calls to NYC Open Data)
- Add real database: Swap `MemStorage` in `server/storage.ts` with Drizzle ORM or Supabase client

### Safety Ratings (Contractor Safety Rating Report)
- `/safety-ratings` — ranked dashboard showing all contractors by overall safety score with 5-category breakdown
- `/safety-ratings/:clientId` — contractor detail page with 4-period trend line chart, category bars, risk summary, report history
- **Scoring** (auto-calculated on submit): 5 weighted categories — Incident History (35% lagging), Training Compliance (20%), Hazard Management (20%), Permit & Pre-Task (15%), Reporting Culture (10%)
- **Scoring engine** in `server/storage.ts` → `calculateSafetyScores()`: TRIR, DART, LTIR, EMR, OSHA citations, WC claims for lagging; inspection ratio, CA closure, toolbox talks, certifications, JHA%, permit%, near-miss rate for leading
- **Letter grades**: A≥90, B≥75, C≥60, D<60
- **4-step new report wizard**: contractor & period → lagging indicators → leading indicators → risk summary
- **PDF export**: `client/src/lib/export-safety-report.ts` using jsPDF, dark header, scoring bars, breakdown tables, risk summary
- **Weight editor** (Weights button): org-level slider panel with must-sum-to-100 validation
- **Subcontractor support**: Client detail page shows subcontractor section with safety grade badges + Rating shortcut button; `parentClientId` on Client model
- API routes: `GET/POST /api/safety-reports`, `GET /api/safety-reports/:id`, `GET /api/safety-reports/client/:clientId`, `GET/PUT /api/safety-settings`, `GET /api/clients/:id/subcontractors`, `PUT /api/organization`
- New Report wizard: 5-step flow (Contractor & Period → Lagging Indicators → Leading Indicators → Risk Summary → Photos)
- Photo attachments: up to 10 base64 images per report, displayed as thumbnails with lightbox on detail page
- Photo documentation section added to PDF export
- Subcontractors section on parent contractor detail page: latest report grade + PDF download button per sub
- Organization Settings page (`/settings`): logo upload (FileReader → base64), stored via `PUT /api/organization`, displayed on Settings page; logo embedded in PDF report header and cover
- PDF performance banner: full-width colored banner showing grade, score, descriptor (Excellent / Good / Needs Improvement / Critical)
- Mock data: 9 safety reports across 5 clients (4-period history for Turner Construction), 1 subcontractor (Apex Steel & Frame LLC under Turner)

## Important Locations
- Code References: Edit/add entries in `server/mockData.ts` → `mockCodeReferences`
- Inspection Templates: Edit/add in `server/mockData.ts` → `mockInspectionTemplates`
- Disclaimer Text: Edit in `client/src/components/disclaimer.tsx` → `DISCLAIMER_TEXT`
- Current User (mock auth): Edit in `server/mockData.ts` → `currentUser`
- Permits Mock Data: `server/mockData.ts` → `mockPermits`
- Events Mock Data: `server/mockData.ts` → `mockExternalEvents`
- Safety Reports Mock Data: `server/mockData.ts` → `mockSafetyReports`, `mockSafetyReportSettings`
- Safety Scoring Logic: `server/storage.ts` → `calculateSafetyScores()`

## Running
- `npm run dev` starts Express backend + Vite frontend on port 5000
