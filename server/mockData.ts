import type {
  Organization, User, Client, Jobsite, CodeReference,
  InspectionTemplate, Inspection, Observation,
  JobsitePermit, JobsiteExternalEvent,
  EmployeeProfile, ScheduleEntry, Timesheet, TimesheetEntry
} from "@shared/schema";

export const mockOrganizations: Organization[] = [
  { id: "org-1", name: "SafeGuard NYC Consulting", logoUrl: undefined },
  { id: "org-2", name: "Metro Safety Partners", logoUrl: undefined },
];

export const mockUsers: User[] = [
  { id: "user-1", organizationId: "org-1", name: "Maria Santos", email: "maria@safeguardnyc.com", role: "Owner" },
  { id: "user-2", organizationId: "org-1", name: "James Chen", email: "james@safeguardnyc.com", role: "Admin" },
  { id: "user-3", organizationId: "org-1", name: "Aisha Johnson", email: "aisha@safeguardnyc.com", role: "Inspector" },
  { id: "user-4", organizationId: "org-1", name: "Robert Kowalski", email: "robert@safeguardnyc.com", role: "Inspector" },
  { id: "user-5", organizationId: "org-2", name: "David Park", email: "david@metrosafetypartners.com", role: "Owner" },
  { id: "user-6", organizationId: "org-1", name: "Tony Ramirez", email: "tony@safeguardnyc.com", role: "Inspector" },
];

export const currentUser: User = mockUsers[0];

export const mockClients: Client[] = [
  {
    id: "client-1", organizationId: "org-1",
    name: "Turner Construction Company",
    contactName: "Michael Rodriguez",
    contactEmail: "mrodriguez@turnerconstruction.com",
    contactPhone: "(212) 555-0142",
    notes: "Preferred client. Multiple active projects in Manhattan."
  },
  {
    id: "client-2", organizationId: "org-1",
    name: "Lendlease US Construction",
    contactName: "Sarah Kim",
    contactEmail: "skim@lendlease.com",
    contactPhone: "(212) 555-0198",
    notes: "New high-rise project starting Q2."
  },
  {
    id: "client-3", organizationId: "org-1",
    name: "Tishman Speyer Properties",
    contactName: "Anthony Morales",
    contactEmail: "amorales@tishmanspeyer.com",
    contactPhone: "(212) 555-0217",
  },
  {
    id: "client-4", organizationId: "org-1",
    name: "Silverstein Properties",
    contactName: "Jessica Liu",
    contactEmail: "jliu@silversteinproperties.com",
    contactPhone: "(212) 555-0263",
    notes: "WTC campus projects."
  },
];

export const mockJobsites: Jobsite[] = [
  {
    id: "job-1", organizationId: "org-1", clientId: "client-1",
    name: "One Vanderbilt Phase 2",
    address: "1 Vanderbilt Ave", city: "Manhattan", state: "NY", bin: "1015862", dobJobNumber: "121587643",
    projectType: "NB", buildingType: "Commercial", stories: 67,
    hasScaffold: true, hasHoist: true, hasCrane: true, hasExcavation: false,
    monitorPublicRecords: true,
  },
  {
    id: "job-2", organizationId: "org-1", clientId: "client-1",
    name: "Hudson Yards Tower C",
    address: "500 W 33rd St", city: "Manhattan", state: "NY", bin: "1012456", dobJobNumber: "121598712",
    projectType: "NB", buildingType: "Mixed-Use", stories: 52,
    hasScaffold: true, hasHoist: true, hasCrane: true, hasExcavation: true,
    monitorPublicRecords: true,
  },
  {
    id: "job-3", organizationId: "org-1", clientId: "client-2",
    name: "Brooklyn Heights Residential",
    address: "250 Cadman Plaza W", city: "Brooklyn", state: "NY", bin: "3002451", dobJobNumber: "321456789",
    projectType: "ALT", buildingType: "Residential", stories: 18,
    hasScaffold: true, hasHoist: false, hasCrane: false, hasExcavation: false,
    monitorPublicRecords: false,
  },
  {
    id: "job-4", organizationId: "org-1", clientId: "client-3",
    name: "Queens Plaza Office Tower",
    address: "29-11 Queens Plaza N", city: "Queens", state: "NY", bin: "4004523", dobJobNumber: "421789012",
    projectType: "NB", buildingType: "Commercial", stories: 35,
    hasScaffold: true, hasHoist: true, hasCrane: true, hasExcavation: true,
    monitorPublicRecords: true,
  },
  {
    id: "job-5", organizationId: "org-1", clientId: "client-4",
    name: "WTC Campus Renovation",
    address: "200 Greenwich St", city: "Manhattan", state: "NY", bin: "1001234", dobJobNumber: "121345678",
    projectType: "ALT", buildingType: "Commercial", stories: 44,
    hasScaffold: true, hasHoist: false, hasCrane: false, hasExcavation: false,
    monitorPublicRecords: false,
  },
  {
    id: "job-6", organizationId: "org-1", clientId: "client-2",
    name: "Bronx Medical Center Demolition",
    address: "1400 Pelham Pkwy S", city: "Bronx", state: "NY", bin: "2045678", dobJobNumber: "221567890",
    projectType: "DEM", buildingType: "Institutional", stories: 6,
    hasScaffold: false, hasHoist: false, hasCrane: true, hasExcavation: true,
    monitorPublicRecords: true,
  },
];

export const mockCodeReferences: CodeReference[] = [
  {
    id: "BC-3301.2", codeType: "BC", chapter: 33, sectionNumber: "3301.2",
    title: "General Safety Requirements for Construction Sites",
    plainSummary: "All construction and demolition operations must be conducted in a manner that protects workers and the general public. Responsible parties must implement and maintain safety programs appropriate to the scope and nature of the work.",
    tags: ["general", "safety program", "public protection"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3301.9", codeType: "BC", chapter: 33, sectionNumber: "3301.9",
    title: "Protection of the Public",
    plainSummary: "Measures must be taken to protect pedestrians and adjacent properties during construction. This includes sidewalk sheds, fences, and covered walkways where falling debris poses a risk to the public.",
    tags: ["public protection", "sidewalk shed", "pedestrian safety"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3302.1", codeType: "BC", chapter: 33, sectionNumber: "3302.1",
    title: "Construction Fences",
    plainSummary: "Construction fences at least 8 feet high are required around construction sites. Fences must be maintained in good condition, properly secured, and must not encroach beyond permitted limits.",
    tags: ["fencing", "public protection", "site perimeter"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3303.1", codeType: "BC", chapter: 33, sectionNumber: "3303.1",
    title: "Sidewalk Sheds",
    plainSummary: "Sidewalk sheds are required when construction exceeds a certain height above the sidewalk or when there is a risk of falling materials. Sheds must be structurally sound, properly lit, and maintained in safe condition.",
    tags: ["sidewalk shed", "public protection", "overhead protection"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3306.1", codeType: "BC", chapter: 33, sectionNumber: "3306.1",
    title: "Scaffolds - General Requirements",
    plainSummary: "All scaffolds must be designed, erected, and maintained to safely support their intended loads. Scaffolds must comply with applicable standards and be inspected by a competent person before use.",
    tags: ["scaffolds", "fall protection", "structural"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3306.5", codeType: "BC", chapter: 33, sectionNumber: "3306.5",
    title: "Supported Scaffold Requirements",
    plainSummary: "Supported scaffolds must have adequate foundations, base plates, and bracing. Guardrails and toeboards are required at all open sides and ends of scaffold platforms above specified heights.",
    tags: ["scaffolds", "guardrails", "fall protection"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3306.9", codeType: "BC", chapter: 33, sectionNumber: "3306.9",
    title: "Suspended Scaffold Requirements",
    plainSummary: "Suspended scaffolds must be properly anchored, counterweighted, and equipped with safety devices including secondary wire ropes. Operators must be trained and certified.",
    tags: ["scaffolds", "suspended scaffold", "fall protection", "rigging"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3307.1", codeType: "BC", chapter: 33, sectionNumber: "3307.1",
    title: "Hoisting Equipment - General",
    plainSummary: "All hoisting equipment including cranes, derricks, and hoists must be installed, maintained, and operated according to manufacturer specifications and applicable code requirements.",
    tags: ["hoists", "cranes", "rigging", "material handling"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3307.6", codeType: "BC", chapter: 33, sectionNumber: "3307.6",
    title: "Personnel Hoists",
    plainSummary: "Personnel hoists used to transport workers must meet specific design and operational standards including speed governors, interlocks, and regular inspections by licensed operators.",
    tags: ["hoists", "personnel hoist", "vertical transport"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3308.1", codeType: "BC", chapter: 33, sectionNumber: "3308.1",
    title: "Cranes and Derricks - General",
    plainSummary: "Tower cranes and mobile cranes must be erected, operated, and dismantled under the supervision of licensed crane operators. Daily logs and pre-operation inspections are required.",
    tags: ["cranes", "tower crane", "mobile crane", "logs"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3309.1", codeType: "BC", chapter: 33, sectionNumber: "3309.1",
    title: "Excavation - General Requirements",
    plainSummary: "Excavation work must be planned and executed with proper shoring, sloping, or shielding to prevent cave-ins. Adjacent structures must be protected from undermining.",
    tags: ["excavations", "shoring", "underpinning", "structural"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3309.4", codeType: "BC", chapter: 33, sectionNumber: "3309.4",
    title: "Support of Adjacent Structures During Excavation",
    plainSummary: "When excavation extends below the foundation of adjacent buildings, the person causing the excavation must ensure those structures are properly supported and protected from damage.",
    tags: ["excavations", "underpinning", "adjacent structures"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3310.1", codeType: "BC", chapter: 33, sectionNumber: "3310.1",
    title: "Demolition - General Requirements",
    plainSummary: "Demolition operations must follow an approved plan that addresses structural stability during progressive removal, dust control, debris management, and protection of adjacent properties.",
    tags: ["demolition", "dust control", "debris", "structural"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3311.1", codeType: "BC", chapter: 33, sectionNumber: "3311.1",
    title: "Site Safety Manager Requirements",
    plainSummary: "Certain construction and demolition projects require a designated Site Safety Manager who must be present on site during all work hours and maintain a daily log of safety activities.",
    tags: ["site safety manager", "SSM", "logs", "administrative"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3311.3", codeType: "BC", chapter: 33, sectionNumber: "3311.3",
    title: "Site Safety Plan",
    plainSummary: "A site safety plan must be prepared and kept on site for projects meeting specified thresholds. The plan must address fall protection, material handling, emergency procedures, and fire safety.",
    tags: ["site safety plan", "fall protection", "fire safety", "administrative"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3314.1", codeType: "BC", chapter: 33, sectionNumber: "3314.1",
    title: "Fall Protection in Construction",
    plainSummary: "Workers at heights of six feet or more above a lower level must be protected by guardrails, safety nets, or personal fall arrest systems. All fall protection must be inspected regularly.",
    tags: ["fall protection", "guardrails", "safety nets", "harness"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "BC-3316.1", codeType: "BC", chapter: 33, sectionNumber: "3316.1",
    title: "Material Storage and Housekeeping",
    plainSummary: "Construction materials must be stored safely and not create hazards. Work areas must be kept orderly, and debris must be removed regularly to prevent slips, trips, and fire hazards.",
    tags: ["housekeeping", "material storage", "fire safety", "debris"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "AC-28-105.1", codeType: "AC", sectionNumber: "28-105.1",
    title: "Work Permits Required",
    plainSummary: "No person shall perform construction or demolition work without first obtaining a work permit from the Department of Buildings, except for emergency work or minor alterations as defined.",
    tags: ["permits", "administrative", "DOB"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "AC-28-301.1", codeType: "AC", sectionNumber: "28-301.1",
    title: "Owner Responsibility for Maintenance",
    plainSummary: "Building owners are responsible for maintaining their properties in a safe condition. This includes structural elements, fire protection systems, and means of egress.",
    tags: ["maintenance", "owner responsibility", "structural"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "AC-28-401.3", codeType: "AC", sectionNumber: "28-401.3",
    title: "Licensed Rigger Requirements",
    plainSummary: "Rigging work involving hoisting or lowering of materials on the outside of buildings must be performed under the direct supervision of a licensed rigger. Licenses must be current and valid.",
    tags: ["rigging", "licensing", "hoists", "material handling"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "AC-28-204.1", codeType: "AC", sectionNumber: "28-204.1",
    title: "Violations and Penalties",
    plainSummary: "The commissioner may issue violations for failure to comply with building codes. Penalties vary by violation class and may include fines, stop work orders, and criminal prosecution.",
    tags: ["violations", "penalties", "enforcement", "administrative"],
    officialUrl: "https://www.nyc.gov/buildings/code"
  },
  {
    id: "OSHA-1926.20", codeType: "OSHA", sectionNumber: "1926.20",
    title: "General Safety and Health Provisions",
    plainSummary: "Employers must initiate and maintain programs to comply with safety regulations. Frequent and regular inspections must be made by competent persons. Employees must not be assigned tasks they are not qualified to perform safely.",
    tags: ["general safety", "competent person", "safety program"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.20"
  },
  {
    id: "OSHA-1926.21", codeType: "OSHA", sectionNumber: "1926.21",
    title: "Safety Training and Education",
    plainSummary: "Employers must instruct each employee in the recognition and avoidance of unsafe conditions and the regulations applicable to the work environment. Training must cover all safety hazards present on the job.",
    tags: ["training", "education", "safety program"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.21"
  },
  {
    id: "OSHA-1926.25", codeType: "OSHA", sectionNumber: "1926.25",
    title: "Housekeeping",
    plainSummary: "During construction, form and scrap lumber with protruding nails and all other debris shall be kept cleared from work areas, passageways, and stairs in and around buildings or other structures. Combustible scrap and debris shall be removed at regular intervals.",
    tags: ["housekeeping", "debris", "walkways", "fire safety"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.25"
  },
  {
    id: "OSHA-1926.95", codeType: "OSHA", sectionNumber: "1926.95",
    title: "PPE - Criteria for Personal Protective Equipment",
    plainSummary: "Personal protective equipment for eyes, face, head, and extremities; protective clothing; respiratory devices; and protective shields and barriers shall be provided and used when required. PPE must be of safe design and construction for the work to be performed.",
    tags: ["PPE", "personal protective equipment", "safety equipment"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.95"
  },
  {
    id: "OSHA-1926.100", codeType: "OSHA", sectionNumber: "1926.100",
    title: "Head Protection",
    plainSummary: "Employees working in areas where there is a possible danger of head injury from impact, falling or flying objects, or electrical shock shall be protected by protective helmets. Helmets must meet ANSI Z89 standards.",
    tags: ["PPE", "hard hat", "head protection", "ANSI"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.100"
  },
  {
    id: "OSHA-1926.102", codeType: "OSHA", sectionNumber: "1926.102",
    title: "Eye and Face Protection",
    plainSummary: "Eye and face protection shall be provided when machines or operations present potential eye or face injury from physical, chemical, or radiation agents. Equipment must meet ANSI Z87.1 standards.",
    tags: ["PPE", "eye protection", "face shield", "ANSI"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.102"
  },
  {
    id: "OSHA-1926.150", codeType: "OSHA", sectionNumber: "1926.150",
    title: "Fire Protection",
    plainSummary: "A fire prevention program must be established before any construction operation. Firefighting equipment must be accessible and in operative condition. Workers must be familiar with alarm systems and evacuation procedures.",
    tags: ["fire protection", "fire prevention", "fire extinguisher", "emergency"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.150"
  },
  {
    id: "OSHA-1926.151", codeType: "OSHA", sectionNumber: "1926.151",
    title: "Fire Prevention",
    plainSummary: "Ignition hazards including welding, cutting, and grinding must be controlled. Flammable and combustible materials must be stored away from ignition sources. Fire lanes must be maintained for emergency vehicle access.",
    tags: ["fire prevention", "flammable materials", "combustible", "hot work"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.151"
  },
  {
    id: "OSHA-1926.200", codeType: "OSHA", sectionNumber: "1926.200",
    title: "Accident Prevention Signs and Tags",
    plainSummary: "Danger signs, caution signs, and exit signs must be used where required. Safety instruction signs shall be used where needed to warn against potential hazards or to instruct employees. Signs must conform to ANSI standards.",
    tags: ["signs", "barricades", "safety signage", "warnings"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.200"
  },
  {
    id: "OSHA-1926.400", codeType: "OSHA", sectionNumber: "1926.400",
    title: "Electrical - General Requirements",
    plainSummary: "Electrical equipment and installations must comply with applicable NFPA and NEC standards. All electrical work must be performed or supervised by qualified persons. Electrical hazards must be guarded to protect employees.",
    tags: ["electrical", "NFPA", "NEC", "wiring"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.400"
  },
  {
    id: "OSHA-1926.416", codeType: "OSHA", sectionNumber: "1926.416",
    title: "General Electrical Safety - Working on or Near Energized Parts",
    plainSummary: "Employees working near energized parts must be protected by insulation, barriers, or guarding. LOTO (lockout/tagout) procedures must be followed when de-energizing equipment. GFCIs or assured equipment grounding programs are required for outdoor and wet work.",
    tags: ["electrical", "lockout/tagout", "GFCI", "energized"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.416"
  },
  {
    id: "OSHA-1926.451", codeType: "OSHA", sectionNumber: "1926.451",
    title: "Scaffolding - General Requirements",
    plainSummary: "Scaffolds must support four times the intended maximum load. Guardrail systems and toeboards are required on all open sides and ends above 10 feet. A competent person must inspect scaffolds before each work shift and after any event that could affect scaffold integrity.",
    tags: ["scaffolds", "fall protection", "competent person", "guardrails"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.451"
  },
  {
    id: "OSHA-1926.452", codeType: "OSHA", sectionNumber: "1926.452",
    title: "Scaffolding - Additional Requirements",
    plainSummary: "Additional requirements apply to specific scaffold types including tube and coupler, fabricated frame, pump jack, ladder jack, and suspended scaffolds. Each type has specific erection, use, and dismantling requirements.",
    tags: ["scaffolds", "tube and coupler", "suspended scaffold", "pump jack"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.452"
  },
  {
    id: "OSHA-1926.500", codeType: "OSHA", sectionNumber: "1926.500",
    title: "Fall Protection - Scope and Application",
    plainSummary: "Fall protection provisions apply to all construction activities where workers are exposed to fall hazards. Employers must provide fall protection when workers are at heights of 6 feet or more above a lower level.",
    tags: ["fall protection", "scope", "general"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.500"
  },
  {
    id: "OSHA-1926.502", codeType: "OSHA", sectionNumber: "1926.502",
    title: "Fall Protection Systems - Criteria and Practices",
    plainSummary: "Guardrail systems must be capable of withstanding 200 lbs force. Safety net systems must be installed as close as practicable below working surfaces. Personal fall arrest systems must limit force on employees to 1,800 lbs and prevent free fall of more than 6 feet.",
    tags: ["fall protection", "guardrails", "safety nets", "personal fall arrest", "PFAS"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.502"
  },
  {
    id: "OSHA-1926.503", codeType: "OSHA", sectionNumber: "1926.503",
    title: "Fall Protection Training Requirements",
    plainSummary: "Employers must provide fall protection training to each employee who might be exposed to fall hazards. Training must include recognition of fall hazards and use of fall protection systems. Retraining is required when the employer believes the employee lacks the understanding or skill required.",
    tags: ["fall protection", "training", "education"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.503"
  },
  {
    id: "OSHA-1926.550", codeType: "OSHA", sectionNumber: "1926.550",
    title: "Cranes and Derricks",
    plainSummary: "Cranes must be inspected before use and documented daily. Rated load capacities must be visible from the operator's station. Employees must not be lifted by crane in equipment not designed for personnel. Outriggers must be fully deployed on proper pads.",
    tags: ["cranes", "derricks", "hoisting", "operator"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.550"
  },
  {
    id: "OSHA-1926.600", codeType: "OSHA", sectionNumber: "1926.600",
    title: "Motor Vehicles and Mechanized Equipment",
    plainSummary: "All vehicles in use shall be checked at the beginning of each shift for brakes, lights, horns, steering, and safety devices. Vehicles must not be operated with faulty equipment. Seat belts are required where rollover protection is provided.",
    tags: ["vehicles", "forklifts", "equipment", "safety checks"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.600"
  },
  {
    id: "OSHA-1926.650", codeType: "OSHA", sectionNumber: "1926.650",
    title: "Excavations - Scope and Definitions",
    plainSummary: "Excavation provisions apply to all open excavations made in the earth's surface, including trenches. A competent person must classify soil conditions before work begins and must inspect trenches daily and after rain events.",
    tags: ["excavations", "trenches", "soil classification", "competent person"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.650"
  },
  {
    id: "OSHA-1926.651", codeType: "OSHA", sectionNumber: "1926.651",
    title: "Excavations - Specific Excavation Requirements",
    plainSummary: "Surface encumbrances must be removed or supported before excavation. Employees must be protected from underground utilities. Means of egress must be provided at 25-foot intervals in trenches exceeding 4 feet in depth.",
    tags: ["excavations", "utilities", "egress", "trenches"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.651"
  },
  {
    id: "OSHA-1926.652", codeType: "OSHA", sectionNumber: "1926.652",
    title: "Excavations - Requirements for Protective Systems",
    plainSummary: "Employees in excavations deeper than 5 feet must be protected against cave-ins by sloping, shoring, or shielding systems. Systems must be designed by a registered professional engineer or conform to OSHA Appendix tables.",
    tags: ["excavations", "shoring", "sloping", "shielding", "cave-in"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.652"
  },
  {
    id: "OSHA-1926.1050", codeType: "OSHA", sectionNumber: "1926.1050",
    title: "Stairways and Ladders - Scope",
    plainSummary: "Stairways and ladders must be provided wherever there is a change in elevation of 19 inches or more and no ramp, runway, or embankment. All stairways and ladders used during construction must meet the requirements of this subpart.",
    tags: ["ladders", "stairways", "access", "egress"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1050"
  },
  {
    id: "OSHA-1926.1053", codeType: "OSHA", sectionNumber: "1926.1053",
    title: "Ladders - Requirements",
    plainSummary: "Ladders must be capable of supporting the intended load. Extension ladders must extend at least 3 feet above the upper landing. Ladders must be positioned at a 4:1 angle. Metal ladders must not be used near electrical hazards.",
    tags: ["ladders", "extension ladder", "angle", "electrical"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1053"
  },
  {
    id: "OSHA-1926.1400", codeType: "OSHA", sectionNumber: "1926.1400",
    title: "Cranes and Derricks in Construction - Scope",
    plainSummary: "This subpart applies to power-operated equipment used to hoist materials. Covers tower cranes, mobile cranes, derricks, and overhead hoists. Equipment operators must be certified and qualified for the specific equipment type.",
    tags: ["cranes", "tower crane", "mobile crane", "operator certification"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1400"
  },
  {
    id: "OSHA-1926.1412", codeType: "OSHA", sectionNumber: "1926.1412",
    title: "Cranes and Derricks - Inspections",
    plainSummary: "Equipment must be inspected prior to each shift, monthly, and annually. The operator must visually inspect equipment for defects. Annual inspections must be performed by a qualified person and documented. Any defects affecting safe operation must be corrected before use.",
    tags: ["cranes", "inspections", "pre-shift inspection", "documentation"],
    officialUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1412"
  },
];

export const mockInspectionTemplates: InspectionTemplate[] = [
  { id: "tpl-1", organizationId: "org-1", name: "Daily SSM Walk", description: "Daily site safety manager walkthrough covering all active work areas.", category: "General" },
  { id: "tpl-2", organizationId: "org-1", name: "Weekly Safety Audit", description: "Comprehensive weekly safety audit covering all trades and work activities.", category: "General" },
  { id: "tpl-3", organizationId: "org-1", name: "Scaffold Inspection", description: "Supported and suspended scaffold inspection per BC 3306.", category: "Scaffold" },
  { id: "tpl-4", organizationId: "org-1", name: "Hoist Inspection", description: "Personnel and material hoist inspection per BC 3307.", category: "Hoist" },
  { id: "tpl-5", organizationId: "org-1", name: "Crane Daily Log", description: "Daily crane operation log and pre-shift inspection.", category: "Crane" },
  { id: "tpl-6", organizationId: "org-1", name: "Excavation Safety Check", description: "Excavation and shoring inspection per BC 3309.", category: "Excavation" },
];

export const mockInspections: Inspection[] = [
  {
    id: "insp-1", organizationId: "org-1", jobsiteId: "job-1", templateId: "tpl-1", date: "2026-02-26", inspectorUserId: "user-1", status: "Submitted",
    recipientName: "Michael Rodriguez", recipientTitle: "Project Manager", recipientCompany: "Turner Construction Company", recipientAddress: "375 Hudson St, New York, NY 10014",
    scopeOfWork: "Structural steel and concrete work ongoing on floors 42–48. Tower crane operations active on south face. Sidewalk shed maintained along Vanderbilt Ave frontage. Active workforce approximately 180 workers across all trades.",
    ccList: ["James Chen, SafeGuard NYC Consulting", "Anthony Ferraro, Turner Construction – Safety Director"],
  },
  { id: "insp-2", organizationId: "org-1", jobsiteId: "job-1", templateId: "tpl-3", date: "2026-02-25", inspectorUserId: "user-3", status: "Submitted" },
  { id: "insp-3", organizationId: "org-1", jobsiteId: "job-2", templateId: "tpl-2", date: "2026-02-24", inspectorUserId: "user-4", status: "Draft" },
  { id: "insp-4", organizationId: "org-1", jobsiteId: "job-3", templateId: "tpl-1", date: "2026-02-26", inspectorUserId: "user-3", status: "Submitted" },
  { id: "insp-5", organizationId: "org-1", jobsiteId: "job-4", templateId: "tpl-5", date: "2026-02-25", inspectorUserId: "user-1", status: "Draft" },
];

export const mockObservations: Observation[] = [
  {
    id: "obs-1", organizationId: "org-1", inspectionId: "insp-1", jobsiteId: "job-1",
    createdAt: "2026-02-26T09:30:00Z", createdByUserId: "user-1",
    location: "Level 42, South elevation",
    description: "Missing guardrail on leading edge near column line D. Workers observed without tie-off at elevation.",
    category: "Fall Protection", type: "issue", severity: "High", status: "Open",
    correctedOnSite: false,
    assignedTo: "Robert Kowalski", dueDate: "2026-02-27",
    photoUrls: [],
    linkedCodeReferenceIds: ["BC-3314.1", "OSHA-1926.502"],
    recommendedActions: ["Install temporary guardrail system immediately.", "Ensure all workers at elevation have personal fall arrest systems."],
    source: "manual",
  },
  {
    id: "obs-2", organizationId: "org-1", inspectionId: "insp-1", jobsiteId: "job-1",
    createdAt: "2026-02-26T10:15:00Z", createdByUserId: "user-1",
    location: "Ground floor, material staging area",
    description: "Debris accumulation blocking emergency egress path near stairwell B. Combustible materials improperly stored.",
    category: "Housekeeping", type: "issue", severity: "Medium", status: "Corrected",
    correctedOnSite: true,
    assignedTo: "James Chen",
    photoUrls: [],
    linkedCodeReferenceIds: ["BC-3316.1", "OSHA-1926.25"],
    recommendedActions: ["Clear debris from egress path.", "Relocate combustible materials to designated storage area."],
    source: "manual",
  },
  {
    id: "obs-p1", organizationId: "org-1", inspectionId: "insp-1", jobsiteId: "job-1",
    createdAt: "2026-02-26T09:00:00Z", createdByUserId: "user-1",
    location: "All active floors",
    description: "All workers observed wearing hard hats and high-visibility vests in required areas.",
    category: "PPE", type: "positive", severity: "Low", status: "Verified",
    correctedOnSite: false,
    photoUrls: [],
    linkedCodeReferenceIds: ["OSHA-1926.100"],
    recommendedActions: [],
    source: "manual",
  },
  {
    id: "obs-p2", organizationId: "org-1", inspectionId: "insp-1", jobsiteId: "job-1",
    createdAt: "2026-02-26T09:10:00Z", createdByUserId: "user-1",
    location: "Scaffold bay 1–11, West elevation",
    description: "Scaffold guardrails and toeboards properly installed and in good condition at all inspected bays.",
    category: "Scaffolds", type: "positive", severity: "Low", status: "Verified",
    correctedOnSite: false,
    photoUrls: [],
    linkedCodeReferenceIds: ["BC-3306.5", "OSHA-1926.451"],
    recommendedActions: [],
    source: "manual",
  },
  {
    id: "obs-p3", organizationId: "org-1", inspectionId: "insp-1", jobsiteId: "job-1",
    createdAt: "2026-02-26T09:15:00Z", createdByUserId: "user-1",
    location: "Site perimeter, Vanderbilt Ave frontage",
    description: "Sidewalk shed maintained in good condition with all lighting functional. No gaps or structural deficiencies observed.",
    category: "Public Protection", type: "positive", severity: "Low", status: "Verified",
    correctedOnSite: false,
    photoUrls: [],
    linkedCodeReferenceIds: ["BC-3303.1"],
    recommendedActions: [],
    source: "manual",
  },
  {
    id: "obs-3", organizationId: "org-1", inspectionId: "insp-2", jobsiteId: "job-1",
    createdAt: "2026-02-25T14:00:00Z", createdByUserId: "user-3",
    location: "West elevation, scaffold bay 12-16",
    description: "Scaffold planking not fully decked. Gaps exceeding 1 inch between planks at multiple locations.",
    category: "Scaffolds", type: "issue", severity: "High", status: "Corrected",
    correctedOnSite: false,
    assignedTo: "Robert Kowalski",
    photoUrls: [],
    linkedCodeReferenceIds: ["BC-3306.1", "BC-3306.5"],
    recommendedActions: ["Re-deck scaffold planking to eliminate gaps.", "Inspect all scaffold bays for similar conditions."],
    source: "manual",
  },
  {
    id: "obs-4", organizationId: "org-1", inspectionId: "insp-3", jobsiteId: "job-2",
    createdAt: "2026-02-24T08:45:00Z", createdByUserId: "user-4",
    location: "Perimeter, West 33rd Street side",
    description: "Sidewalk shed lighting non-functional in two sections. Pedestrian visibility compromised during evening hours.",
    category: "Public Protection", type: "issue", severity: "Medium", status: "Open",
    correctedOnSite: false,
    photoUrls: [],
    linkedCodeReferenceIds: ["BC-3303.1", "BC-3301.9"],
    recommendedActions: ["Replace non-functional lighting fixtures.", "Verify all sidewalk shed lighting is operational before end of shift."],
    source: "manual",
  },
  {
    id: "obs-5", organizationId: "org-1", inspectionId: "insp-4", jobsiteId: "job-3",
    createdAt: "2026-02-26T11:00:00Z", createdByUserId: "user-3",
    location: "Lobby area, floor 1",
    description: "Fire extinguisher past inspection date. Safety data sheets not posted at chemical storage location.",
    category: "Administrative", type: "issue", severity: "Low", status: "Open",
    correctedOnSite: false,
    photoUrls: [],
    linkedCodeReferenceIds: ["BC-3311.3"],
    recommendedActions: ["Replace or re-certify expired fire extinguishers.", "Post current SDS at all chemical storage locations."],
    source: "manual",
  },
];

export const mockPermits: JobsitePermit[] = [
  {
    id: "pmt-1", jobsiteId: "job-1", source: "DOB_NOW", permitNumber: "PW1-121587643-01",
    jobFilingNumber: "B00987654", workType: "NB", permitType: "BUILDING",
    status: "ISSUED", issueDate: "2025-06-15", expirationDate: "2027-06-15",
    description: "New building construction - 67-story commercial tower",
    rawLocation: "1 Vanderbilt Ave, Manhattan",
    externalUrl: "https://a810-dobnow.nyc.gov/publish/#!/jobs?bin=1015862",
    createdAt: "2025-06-15T00:00:00Z", updatedAt: "2025-06-15T00:00:00Z",
  },
  {
    id: "pmt-2", jobsiteId: "job-1", source: "DOB_NOW", permitNumber: "PW1-121587643-02",
    workType: "NB", permitType: "ELECTRICAL",
    status: "ISSUED", issueDate: "2025-08-01", expirationDate: "2027-08-01",
    description: "Electrical work - full building electrical installation",
    rawLocation: "1 Vanderbilt Ave, Manhattan",
    externalUrl: "https://a810-dobnow.nyc.gov/publish/#!/jobs?bin=1015862",
    createdAt: "2025-08-01T00:00:00Z", updatedAt: "2025-08-01T00:00:00Z",
  },
  {
    id: "pmt-3", jobsiteId: "job-1", source: "BIS", permitNumber: "PW1-121587643-03",
    workType: "NB", permitType: "PLUMBING",
    status: "EXPIRED", issueDate: "2024-11-10", expirationDate: "2025-11-10",
    description: "Plumbing rough-in - floors 1 through 30",
    rawLocation: "1 Vanderbilt Ave, Manhattan",
    externalUrl: "https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?bin=1015862",
    createdAt: "2024-11-10T00:00:00Z", updatedAt: "2025-11-11T00:00:00Z",
  },
  {
    id: "pmt-4", jobsiteId: "job-2", source: "DOB_NOW", permitNumber: "PW1-121598712-01",
    jobFilingNumber: "B00876543", workType: "NB", permitType: "BUILDING",
    status: "ISSUED", issueDate: "2025-03-20", expirationDate: "2027-03-20",
    description: "New building construction - 52-story mixed-use tower",
    rawLocation: "500 W 33rd St, Manhattan",
    externalUrl: "https://a810-dobnow.nyc.gov/publish/#!/jobs?bin=1012456",
    createdAt: "2025-03-20T00:00:00Z", updatedAt: "2025-03-20T00:00:00Z",
  },
  {
    id: "pmt-5", jobsiteId: "job-2", source: "DOB_NOW", permitNumber: "PW1-121598712-02",
    workType: "NB", permitType: "CRANE/DERRICK",
    status: "ISSUED", issueDate: "2025-09-15", expirationDate: "2026-09-15",
    description: "Tower crane installation and operation permit",
    rawLocation: "500 W 33rd St, Manhattan",
    externalUrl: "https://a810-dobnow.nyc.gov/publish/#!/jobs?bin=1012456",
    createdAt: "2025-09-15T00:00:00Z", updatedAt: "2025-09-15T00:00:00Z",
  },
  {
    id: "pmt-6", jobsiteId: "job-2", source: "NYC_OPEN_DATA", permitNumber: "PW1-121598712-03",
    workType: "NB", permitType: "ELEVATOR",
    status: "IN_PROGRESS", issueDate: undefined, expirationDate: undefined,
    description: "Elevator installation - 3 passenger elevators",
    rawLocation: "500 W 33rd St, Manhattan",
    createdAt: "2026-01-10T00:00:00Z", updatedAt: "2026-01-10T00:00:00Z",
  },
  {
    id: "pmt-7", jobsiteId: "job-4", source: "DOB_NOW", permitNumber: "PW1-421789012-01",
    jobFilingNumber: "B00765432", workType: "NB", permitType: "BUILDING",
    status: "ISSUED", issueDate: "2025-01-12", expirationDate: "2027-01-12",
    description: "New building construction - 35-story commercial office tower",
    rawLocation: "29-11 Queens Plaza N, Queens",
    externalUrl: "https://a810-dobnow.nyc.gov/publish/#!/jobs?bin=4004523",
    createdAt: "2025-01-12T00:00:00Z", updatedAt: "2025-01-12T00:00:00Z",
  },
  {
    id: "pmt-8", jobsiteId: "job-4", source: "DOB_NOW", permitNumber: "PW1-421789012-02",
    workType: "NB", permitType: "FOUNDATION",
    status: "EXPIRED", issueDate: "2024-06-01", expirationDate: "2025-06-01",
    description: "Foundation and excavation work",
    rawLocation: "29-11 Queens Plaza N, Queens",
    createdAt: "2024-06-01T00:00:00Z", updatedAt: "2025-06-02T00:00:00Z",
  },
  {
    id: "pmt-9", jobsiteId: "job-6", source: "DOB_NOW", permitNumber: "PW1-221567890-01",
    workType: "DEM", permitType: "DEMOLITION",
    status: "ISSUED", issueDate: "2025-10-01", expirationDate: "2026-10-01",
    description: "Full demolition of existing 6-story medical center building",
    rawLocation: "1400 Pelham Pkwy S, Bronx",
    externalUrl: "https://a810-dobnow.nyc.gov/publish/#!/jobs?bin=2045678",
    createdAt: "2025-10-01T00:00:00Z", updatedAt: "2025-10-01T00:00:00Z",
  },
];

export const mockExternalEvents: JobsiteExternalEvent[] = [
  {
    id: "evt-1", jobsiteId: "job-1", source: "DOB_COMPLAINT",
    eventType: "Complaint", externalId: "CMP-8876543",
    status: "OPEN", category: "NOISE - CONSTRUCTION BEFORE/AFTER HOURS",
    description: "Complaint received regarding construction noise before 7:00 AM on weekdays.",
    issuedDate: "2026-02-20", lastUpdatedDate: "2026-02-20",
    rawLocation: "1 Vanderbilt Ave, Manhattan",
    externalUrl: "https://a810-bisweb.nyc.gov/bisweb/ComplaintsByAddressServlet?bin=1015862",
    isNew: true,
    createdAt: "2026-02-20T00:00:00Z",
  },
  {
    id: "evt-2", jobsiteId: "job-1", source: "DOB_ECB_VIOLATION",
    eventType: "Violation", externalId: "ECB-34567890",
    status: "OPEN", category: "FAILURE TO SAFEGUARD PERSONS/PROPERTY",
    description: "Violation issued for inadequate sidewalk shed maintenance. Missing lighting in sections near main entrance.",
    issuedDate: "2026-02-18", lastUpdatedDate: "2026-02-22",
    rawLocation: "1 Vanderbilt Ave, Manhattan",
    externalUrl: "https://a810-bisweb.nyc.gov/bisweb/ECBQueryByLocationServlet?bin=1015862",
    isNew: true,
    createdAt: "2026-02-18T00:00:00Z",
  },
  {
    id: "evt-3", jobsiteId: "job-1", source: "DOB_COMPLAINT",
    eventType: "Complaint", externalId: "CMP-8876201",
    status: "RESOLVED", category: "ILLEGAL WORK - NO PERMIT",
    description: "Investigation completed - all permits verified on file. No violation issued.",
    issuedDate: "2025-12-05", lastUpdatedDate: "2026-01-15",
    rawLocation: "1 Vanderbilt Ave, Manhattan",
    isNew: false,
    createdAt: "2025-12-05T00:00:00Z",
  },
  {
    id: "evt-4", jobsiteId: "job-2", source: "DOB_ECB_VIOLATION",
    eventType: "Violation", externalId: "ECB-34567234",
    status: "OPEN", category: "WORK WITHOUT PERMIT",
    description: "Violation for performing electrical work beyond scope of current permit.",
    issuedDate: "2026-02-10", lastUpdatedDate: "2026-02-10",
    rawLocation: "500 W 33rd St, Manhattan",
    externalUrl: "https://a810-bisweb.nyc.gov/bisweb/ECBQueryByLocationServlet?bin=1012456",
    isNew: true,
    createdAt: "2026-02-10T00:00:00Z",
  },
  {
    id: "evt-5", jobsiteId: "job-2", source: "DOB_COMPLAINT",
    eventType: "Complaint", externalId: "CMP-8875980",
    status: "OPEN", category: "UNSAFE CONDITIONS",
    description: "Complaint about debris falling from upper floors near pedestrian walkway.",
    issuedDate: "2026-02-15", lastUpdatedDate: "2026-02-16",
    rawLocation: "500 W 33rd St, Manhattan",
    isNew: false,
    createdAt: "2026-02-15T00:00:00Z",
  },
  {
    id: "evt-6", jobsiteId: "job-4", source: "DOB_ECB_VIOLATION",
    eventType: "Violation", externalId: "ECB-34566789",
    status: "RESOLVED", category: "FAILURE TO MAINTAIN",
    description: "Construction fence not maintained. Resolved after repair.",
    issuedDate: "2025-11-20", lastUpdatedDate: "2025-12-10",
    rawLocation: "29-11 Queens Plaza N, Queens",
    isNew: false,
    createdAt: "2025-11-20T00:00:00Z",
  },
  {
    id: "evt-7", jobsiteId: "job-6", source: "DOB_COMPLAINT",
    eventType: "Complaint", externalId: "CMP-8876100",
    status: "OPEN", category: "DUST/DEBRIS - DEMOLITION",
    description: "Excessive dust from demolition operations affecting neighboring residential buildings.",
    issuedDate: "2026-02-22", lastUpdatedDate: "2026-02-23",
    rawLocation: "1400 Pelham Pkwy S, Bronx",
    isNew: true,
    createdAt: "2026-02-22T00:00:00Z",
  },
];

export const mockEmployeeProfiles: EmployeeProfile[] = [
  {
    id: "emp-1", organizationId: "org-1", userId: "user-1",
    title: "Site Safety Manager / Owner",
    phone: "(917) 555-0101", hireDate: "2020-03-15", status: "Active",
    certifications: ["SST-40", "OSHA-30", "First Aid/CPR", "NYC SSM License"],
    licenseNumbers: { "SSM": "SSM-2020-4521", "OSHA-30": "OSHA30-NY-11234" },
    emergencyContact: "Carlos Santos", emergencyPhone: "(917) 555-0199",
    hourlyRate: 95,
    notes: "Company owner. Handles key accounts directly.",
  },
  {
    id: "emp-2", organizationId: "org-1", userId: "user-2",
    title: "Senior Safety Coordinator",
    phone: "(646) 555-0202", hireDate: "2021-07-01", status: "Active",
    certifications: ["SST-40", "OSHA-30", "Scaffold Competent Person", "Confined Space"],
    licenseNumbers: { "SSM": "SSM-2021-7892", "OSHA-30": "OSHA30-NY-22456" },
    emergencyContact: "Linda Chen", emergencyPhone: "(646) 555-0299",
    hourlyRate: 75,
  },
  {
    id: "emp-3", organizationId: "org-1", userId: "user-3",
    title: "Safety Inspector",
    phone: "(718) 555-0303", hireDate: "2022-01-10", status: "Active",
    certifications: ["SST-40", "OSHA-10", "First Aid/CPR"],
    licenseNumbers: { "OSHA-10": "OSHA10-NY-33789" },
    emergencyContact: "David Johnson", emergencyPhone: "(718) 555-0399",
    hourlyRate: 55,
  },
  {
    id: "emp-4", organizationId: "org-1", userId: "user-4",
    title: "Safety Inspector",
    phone: "(347) 555-0404", hireDate: "2023-04-20", status: "Active",
    certifications: ["SST-40", "OSHA-10", "Fire Guard"],
    licenseNumbers: { "OSHA-10": "OSHA10-NY-44123", "Fire Guard": "FG-2023-8901" },
    emergencyContact: "Anna Kowalski", emergencyPhone: "(347) 555-0499",
    hourlyRate: 55,
    notes: "Specializes in demolition and excavation sites.",
  },
];

export const mockScheduleEntries: ScheduleEntry[] = [
  { id: "sched-1", organizationId: "org-1", employeeId: "emp-1", jobsiteId: "job-1", date: "2026-03-09", shiftStart: "07:00", shiftEnd: "15:00", status: "Completed" },
  { id: "sched-2", organizationId: "org-1", employeeId: "emp-2", jobsiteId: "job-2", date: "2026-03-09", shiftStart: "07:00", shiftEnd: "15:30", status: "Completed" },
  { id: "sched-3", organizationId: "org-1", employeeId: "emp-3", jobsiteId: "job-3", date: "2026-03-09", shiftStart: "08:00", shiftEnd: "16:00", status: "Completed" },
  { id: "sched-4", organizationId: "org-1", employeeId: "emp-4", jobsiteId: "job-6", date: "2026-03-09", shiftStart: "07:00", shiftEnd: "15:00", status: "Completed" },
  { id: "sched-5", organizationId: "org-1", employeeId: "emp-1", jobsiteId: "job-1", date: "2026-03-10", shiftStart: "07:00", shiftEnd: "15:00", status: "Completed" },
  { id: "sched-6", organizationId: "org-1", employeeId: "emp-2", jobsiteId: "job-4", date: "2026-03-10", shiftStart: "07:00", shiftEnd: "15:30", status: "Completed" },
  { id: "sched-7", organizationId: "org-1", employeeId: "emp-3", jobsiteId: "job-1", date: "2026-03-10", shiftStart: "08:00", shiftEnd: "16:00", status: "Completed" },
  { id: "sched-8", organizationId: "org-1", employeeId: "emp-4", jobsiteId: "job-6", date: "2026-03-10", shiftStart: "07:00", shiftEnd: "15:00", status: "Completed" },
  { id: "sched-9", organizationId: "org-1", employeeId: "emp-1", jobsiteId: "job-5", date: "2026-03-11", shiftStart: "07:00", shiftEnd: "15:00", status: "Confirmed" },
  { id: "sched-10", organizationId: "org-1", employeeId: "emp-2", jobsiteId: "job-2", date: "2026-03-11", shiftStart: "07:00", shiftEnd: "15:30", status: "Confirmed" },
  { id: "sched-11", organizationId: "org-1", employeeId: "emp-3", jobsiteId: "job-3", date: "2026-03-11", shiftStart: "08:00", shiftEnd: "16:00", status: "Scheduled" },
  { id: "sched-12", organizationId: "org-1", employeeId: "emp-4", jobsiteId: "job-4", date: "2026-03-11", shiftStart: "07:00", shiftEnd: "15:00", status: "Scheduled" },
  { id: "sched-13", organizationId: "org-1", employeeId: "emp-1", jobsiteId: "job-1", date: "2026-03-12", shiftStart: "07:00", shiftEnd: "15:00", status: "Scheduled" },
  { id: "sched-14", organizationId: "org-1", employeeId: "emp-2", jobsiteId: "job-2", date: "2026-03-12", shiftStart: "07:00", shiftEnd: "15:30", status: "Scheduled" },
  { id: "sched-15", organizationId: "org-1", employeeId: "emp-3", jobsiteId: "job-1", date: "2026-03-12", shiftStart: "08:00", shiftEnd: "16:00", status: "Scheduled" },
  { id: "sched-16", organizationId: "org-1", employeeId: "emp-1", jobsiteId: "job-4", date: "2026-03-13", shiftStart: "07:00", shiftEnd: "15:00", status: "Scheduled" },
  { id: "sched-17", organizationId: "org-1", employeeId: "emp-3", jobsiteId: "job-5", date: "2026-03-13", shiftStart: "08:00", shiftEnd: "16:00", status: "Scheduled" },
  { id: "sched-18", organizationId: "org-1", employeeId: "emp-4", jobsiteId: "job-6", date: "2026-03-13", shiftStart: "07:00", shiftEnd: "15:00", status: "Scheduled" },
];

export const mockTimesheets: Timesheet[] = [
  {
    id: "ts-1", organizationId: "org-1", employeeId: "emp-1",
    weekStartDate: "2026-03-02", status: "Approved",
    submittedAt: "2026-03-06T17:00:00Z", approvedBy: "user-1", approvedAt: "2026-03-07T09:00:00Z",
    totalHours: 40, notes: "Standard work week",
  },
  {
    id: "ts-2", organizationId: "org-1", employeeId: "emp-2",
    weekStartDate: "2026-03-02", status: "Approved",
    submittedAt: "2026-03-06T17:30:00Z", approvedBy: "user-1", approvedAt: "2026-03-07T09:15:00Z",
    totalHours: 42.5,
  },
  {
    id: "ts-3", organizationId: "org-1", employeeId: "emp-3",
    weekStartDate: "2026-03-02", status: "Submitted",
    submittedAt: "2026-03-06T16:45:00Z",
    totalHours: 38,
  },
  {
    id: "ts-4", organizationId: "org-1", employeeId: "emp-4",
    weekStartDate: "2026-03-02", status: "Submitted",
    submittedAt: "2026-03-06T17:15:00Z",
    totalHours: 40,
  },
  {
    id: "ts-5", organizationId: "org-1", employeeId: "emp-1",
    weekStartDate: "2026-03-09", status: "Draft",
    totalHours: 16,
  },
  {
    id: "ts-6", organizationId: "org-1", employeeId: "emp-2",
    weekStartDate: "2026-03-09", status: "Draft",
    totalHours: 17,
  },
];

export const mockTimesheetEntries: TimesheetEntry[] = [
  { id: "tse-1", timesheetId: "ts-1", date: "2026-03-02", jobsiteId: "job-1", hours: 8, description: "Daily SSM walk - One Vanderbilt" },
  { id: "tse-2", timesheetId: "ts-1", date: "2026-03-03", jobsiteId: "job-1", hours: 8, description: "Daily SSM walk - One Vanderbilt" },
  { id: "tse-3", timesheetId: "ts-1", date: "2026-03-04", jobsiteId: "job-5", hours: 8, description: "Safety audit - WTC Campus" },
  { id: "tse-4", timesheetId: "ts-1", date: "2026-03-05", jobsiteId: "job-1", hours: 8, description: "Daily SSM walk - One Vanderbilt" },
  { id: "tse-5", timesheetId: "ts-1", date: "2026-03-06", jobsiteId: "job-4", hours: 8, description: "Crane inspection - Queens Plaza" },
  { id: "tse-6", timesheetId: "ts-2", date: "2026-03-02", jobsiteId: "job-2", hours: 8.5, description: "Weekly audit - Hudson Yards" },
  { id: "tse-7", timesheetId: "ts-2", date: "2026-03-03", jobsiteId: "job-2", hours: 8.5, description: "Scaffold inspection - Hudson Yards" },
  { id: "tse-8", timesheetId: "ts-2", date: "2026-03-04", jobsiteId: "job-4", hours: 8.5, description: "Safety coordination - Queens Plaza" },
  { id: "tse-9", timesheetId: "ts-2", date: "2026-03-05", jobsiteId: "job-2", hours: 8.5, description: "Daily walk - Hudson Yards" },
  { id: "tse-10", timesheetId: "ts-2", date: "2026-03-06", jobsiteId: "job-2", hours: 8.5, description: "Daily walk - Hudson Yards" },
  { id: "tse-11", timesheetId: "ts-5", date: "2026-03-09", jobsiteId: "job-1", hours: 8, description: "Daily SSM walk - One Vanderbilt" },
  { id: "tse-12", timesheetId: "ts-5", date: "2026-03-10", jobsiteId: "job-1", hours: 8, description: "Daily SSM walk - One Vanderbilt" },
  { id: "tse-13", timesheetId: "ts-6", date: "2026-03-09", jobsiteId: "job-2", hours: 8.5, description: "Daily walk - Hudson Yards" },
  { id: "tse-14", timesheetId: "ts-6", date: "2026-03-10", jobsiteId: "job-4", hours: 8.5, description: "Safety coordination - Queens Plaza" },
];
