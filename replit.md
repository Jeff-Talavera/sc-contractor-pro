# SafeSite - NYC Construction Safety Management

## Overview
Multi-firm construction safety application for NYC-based safety firms (2-10 inspectors). Provides client/jobsite management, inspection workflows, observation tracking, and NYC code reference guidance.

## Architecture
- **Frontend**: React + TypeScript with Vite, TanStack Query, wouter routing, shadcn/ui components
- **Backend**: Express.js with in-memory storage (prepared for future database integration)
- **Data**: In-memory storage with mock/seed data - structured for easy swap to Supabase or PostgreSQL

## Key Files
- `shared/schema.ts` - All TypeScript interfaces and Zod validation schemas
- `server/mockData.ts` - All seed/mock data (organizations, users, clients, jobsites, code references, templates, inspections, observations)
- `server/storage.ts` - Storage interface (IStorage) and in-memory implementation
- `server/routes.ts` - All API routes prefixed with /api
- `client/src/components/disclaimer.tsx` - Shared disclaimer text component
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `client/src/pages/` - All page components (dashboard, clients, jobsites, inspections, code-library)

## Data Models
- **Organization** + **User** (multi-org, role-based: Owner/Admin/Inspector)
- **Client** + **Jobsite** (with NYC-specific fields: BIN, DOB job number, borough, project type, site flags)
- **CodeReference** (Building Code Chapter 33 + Administrative Code sections with tags and plain-English summaries)
- **InspectionTemplate** + **Inspection** + **Observation** (full inspection workflow with code reference linking)

## Important Locations
- Code References: Edit/add entries in `server/mockData.ts` → `mockCodeReferences`
- Inspection Templates: Edit/add in `server/mockData.ts` → `mockInspectionTemplates`
- Disclaimer Text: Edit in `client/src/components/disclaimer.tsx` → `DISCLAIMER_TEXT`
- Current User (mock auth): Edit in `server/mockData.ts` → `currentUser`

## Running
- `npm run dev` starts Express backend + Vite frontend on port 5000
