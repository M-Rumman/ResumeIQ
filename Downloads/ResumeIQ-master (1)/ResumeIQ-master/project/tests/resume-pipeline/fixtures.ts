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
};

/** Photo extraction is intentionally an expected unsupported capability today. */
export const capabilityExpectations = {
  photoDetection: false,
};
