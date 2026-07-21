export const fixtures = {
  linkedInAnnotation: `Amina Khan
amina.khan@example.com | +1 415 555 0133

Experience
Built reporting dashboards with Python.

Projects
Created a resume parser with TypeScript.

Extracted Links:
LinkedIn Profile
→ https://www.linkedin.com/in/amina-khan`,

  directLinkedIn: `Jordan Lee
linkedin.com/in/jordan-lee

Skills
React
TypeScript`,

  piiInProject: `Sam Rivera
sam.rivera@example.com | +44 20 7946 0958

Experience
Built internal analytics dashboards. https://example.dev

Projects
Portfolio project: https://portfolio.example.dev
Contact: sam.rivera@example.com
Led migration work with +44 20 7946 0958`,

  structuredSections: `Taylor Morgan

Professional Summary
Backend engineer focused on reliable APIs.

Experience
Developed REST services using Python.

Projects
Built a job matching tool with FastAPI.

Skills
Python
FastAPI
PostgreSQL

Education
BSc Computer Science

Certifications
AWS Certified Cloud Practitioner

Awards
Engineering Excellence Award

Languages
English
Urdu`,

  keywordGapResume: `Nora Patel

Experience
Developed Python reporting tools.

Skills
Python`,

  emailLeakResume: `Priya Shah

Experience
Developed Python data pipelines for sales reports.
Improved report delivery time by 20%.`,

  inventedTechnologyResume: `Omar Aziz

Projects
Built a React analytics dashboard.`,

  inventedMetricResume: `Mei Chen

Projects
Built a React analytics dashboard.`,

  duplicateAdviceResume: `Priya Shah

Experience
Developed Python data pipelines for sales reports.
Improved report delivery time by 20%.

Projects
Built a React analytics dashboard.`,

  photoResume: `Robin Clark
[Profile photo embedded in original PDF]

Experience
Developed Java services.`,

  certificationArtifactPdf: `Noor Ahmed
noor.ahmed@example.com | linkedin.com/in/noor-ahmed

Experience
Developed embedded control software for test rigs.

Certifications
P@SHA ICT Awards 2025.

Thank You!

Extracted Links:
LinkedIn →
mailto:noor.ahmed@example.com
→ https://www.linkedin.com/in/noor-ahmed
→ https://portfolio.example.test`,

  recommendationCoverageResume: `Morgan Lee

Summary
Engineer with Python, React, and TypeScript experience.

Experience
Built Docker workflows and deployed services to AWS.
Maintained PostgreSQL data stores and Jest test suites.

Projects
Created REST APIs with GraphQL integration.
Automated CI pipelines using Git and Kubernetes.`,

  embeddedGapResume: `Avery Khan

Summary
Mechatronics student with embedded systems project experience.

Skills
C++
Arduino
Proteus
Circuit Design

Projects
Built an Arduino line follower using sensors and BLDC motors.`,
};

/** Hand-labelled matching ground truth; protects exact, related, and credential cases. */
export const requirementMatchingFixtures = [
  {
    name: 'verbatim technical skill',
    resume: 'Skills\nArduino\n\nProjects\nBuilt an Arduino sensor controller.',
    requirement: 'Arduino',
    tier: 'Strong',
    section: 'Skills',
  },
  {
    name: 'normalized credential abbreviation',
    resume: 'Certifications\nPADI AOW Diver',
    requirement: 'PADI Advanced Open Water',
    tier: 'Strong',
    section: 'Certifications',
  },
  {
    name: 'higher education degree subsumes bachelor requirement',
    resume: 'Education\nM.S. in Marine Biology',
    requirement: "Bachelor's in Marine Biology or related field",
    tier: 'Strong',
    section: 'Education',
  },
  {
    name: 'related hardware tool stays partial',
    resume: 'Skills\nArduino\n\nProjects\nBuilt a microcontroller-based navigation prototype.',
    requirement: 'ESP32',
    tier: 'Partial',
    section: 'Skills',
  },
  {
    name: 'unrelated requirement is missing',
    resume: 'Experience\nProvided Mathematics tutoring.\n\nSkills\nPython',
    requirement: 'CAD',
    tier: 'Missing',
    section: null,
  },
  {
    name: 'project technology direct evidence',
    resume: 'Projects\nMechanical Workbench\n- Designed components using SolidWorks.',
    requirement: 'SolidWorks',
    tier: 'Strong',
    section: 'Projects',
  },
] as const;

/** Photo extraction is intentionally an expected unsupported capability today. */
export const capabilityExpectations = {
  photoDetection: false,
};
