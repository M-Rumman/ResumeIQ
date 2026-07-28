import type { ResumeIntelligenceProfile } from './resumeIntelligence.js';

export type JobSearchIntent = {
  job_titles: string[];
  keywords: string[];
};

type DomainQueryDefinition = {
  titles: string[];
  keywords: string[];
};

// Titles are curated role-family expansions. The generator only selects a
// family already evidenced by the structured resume profile.
const DOMAIN_QUERIES: Record<string, DomainQueryDefinition> = {
  'Mechatronics Engineering': { titles: ['Robotics Engineer', 'Automation Engineer', 'Embedded Engineer', 'Mechatronics Engineer', 'Control Engineer', 'PLC Engineer', 'Control Systems Engineer', 'Hardware Engineer', 'Electronics Engineer'], keywords: ['Mechatronics Engineering', 'Robotics', 'Automation', 'Embedded Systems', 'Control Systems', 'PLC Programming', 'Sensor Integration', 'Microcontrollers'] },
  'Embedded Systems': { titles: ['Embedded Systems Engineer', 'Firmware Engineer', 'Embedded Software Engineer', 'IoT Engineer', 'Hardware Engineer', 'Electronics Engineer'], keywords: ['Embedded Systems', 'Firmware Development', 'Microcontrollers', 'Embedded Programming', 'Sensor Integration', 'IoT'] },
  'Mechanical Engineering': { titles: ['Mechanical Engineer', 'Mechanical Design Engineer', 'Product Design Engineer', 'Manufacturing Engineer', 'CAD Engineer', 'Design Engineer'], keywords: ['Mechanical Engineering', 'Mechanical Design', 'CAD Design', 'Product Design', 'Manufacturing', 'Engineering Analysis'] },
  'Electrical Engineering': { titles: ['Electrical Engineer', 'Electronics Engineer', 'Hardware Engineer', 'Power Systems Engineer', 'PCB Design Engineer', 'Control Systems Engineer'], keywords: ['Electrical Engineering', 'Electronics', 'Circuit Design', 'PCB Design', 'Power Systems', 'Hardware Design'] },
  'Computer Science': { titles: ['Software Engineer', 'Backend Engineer', 'Full Stack Developer', 'Application Developer', 'Junior Software Developer', 'Systems Engineer'], keywords: ['Computer Science', 'Software Development', 'Algorithms', 'Data Structures', 'Application Development', 'Programming'] },
  Cybersecurity: { titles: ['Cybersecurity Analyst', 'SOC Analyst', 'Information Security Analyst', 'Security Engineer', 'Incident Response Analyst', 'GRC Analyst'], keywords: ['Cybersecurity', 'Information Security', 'Security Operations', 'Incident Response', 'Risk Management', 'Threat Detection'] },
  Finance: { titles: ['Financial Analyst', 'Risk Analyst', 'Investment Analyst', 'Corporate Finance Analyst', 'Credit Analyst', 'Financial Planning Analyst'], keywords: ['Finance', 'Financial Analysis', 'Financial Modeling', 'Valuation', 'Risk Analysis', 'Investment Analysis'] },
  Accounting: { titles: ['Accountant', 'Audit Associate', 'Financial Accountant', 'Tax Associate', 'Accounts Analyst', 'Junior Auditor'], keywords: ['Accounting', 'Auditing', 'Financial Reporting', 'Taxation', 'Bookkeeping', 'IFRS'] },
  Marketing: { titles: ['Marketing Specialist', 'Digital Marketing Specialist', 'SEO Specialist', 'Content Marketing Specialist', 'Growth Marketing Associate', 'Marketing Analyst'], keywords: ['Marketing', 'Digital Marketing', 'SEO', 'Content Strategy', 'Campaign Management', 'Brand Management'] },
  'Human Resources': { titles: ['HR Coordinator', 'Talent Acquisition Specialist', 'HR Generalist', 'People Operations Associate', 'Recruitment Coordinator', 'HR Analyst'], keywords: ['Human Resources', 'Talent Acquisition', 'Recruitment', 'Employee Relations', 'People Operations', 'HRIS'] },
  Law: { titles: ['Legal Associate', 'Paralegal', 'Compliance Analyst', 'Contract Specialist', 'Legal Researcher', 'Junior Legal Counsel'], keywords: ['Legal Research', 'Contract Drafting', 'Compliance', 'Corporate Law', 'Litigation', 'Legal Documentation'] },
  Healthcare: { titles: ['Healthcare Assistant', 'Clinical Research Coordinator', 'Medical Assistant', 'Public Health Analyst', 'Clinical Data Coordinator', 'Healthcare Administrator'], keywords: ['Healthcare', 'Clinical Research', 'Patient Care', 'Medical Records', 'Public Health', 'Clinical Operations'] },
  'Marine Biology': { titles: ['Marine Biologist', 'Marine Research Assistant', 'Field Research Technician', 'Conservation Scientist', 'Aquatic Ecologist', 'Marine Science Technician'], keywords: ['Marine Biology', 'Marine Science', 'Aquatic Ecology', 'Field Research', 'Conservation', 'Oceanography'] },
  'Construction Management': { titles: ['Construction Project Coordinator', 'Site Engineer', 'Quantity Surveyor', 'Project Controls Engineer', 'Construction Estimator', 'Construction Planner'], keywords: ['Construction Management', 'Site Engineering', 'Project Controls', 'Quantity Surveying', 'Construction Safety', 'Cost Estimation'] },
  Education: { titles: ['Teacher', 'Education Coordinator', 'Curriculum Specialist', 'Academic Tutor', 'Instructional Designer', 'Learning Support Specialist'], keywords: ['Education', 'Teaching', 'Curriculum Development', 'Student Assessment', 'Lesson Planning', 'Learning Management Systems'] },
  Sales: { titles: ['Sales Representative', 'Business Development Associate', 'Account Executive', 'Account Manager', 'Sales Operations Analyst', 'Client Success Associate'], keywords: ['Sales', 'Business Development', 'Account Management', 'CRM', 'Lead Generation', 'Pipeline Management'] },
};

const unique = (values: string[]) => [...new Map(values.filter(Boolean).map((value) => [value.trim().toLowerCase(), value.trim()] as const)).values()];
const softSkill = /^(?:communication|teamwork|leadership|problem solving|time management|adaptability|critical thinking|collaboration|work ethic)$/i;

export function generateJobSearchIntent(profile: ResumeIntelligenceProfile): JobSearchIntent {
  const domains = [profile.primary_domain, ...profile.secondary_domains, ...profile.career_taxonomy.related_domains];
  const definitions = domains.map((domain) => DOMAIN_QUERIES[domain]).filter(Boolean);
  const job_titles = unique([
    ...profile.job_titles,
    ...definitions.flatMap((definition) => definition.titles),
  ]).slice(0, 10);
  const keywords = unique([
    ...profile.technical_skills.filter((skill) => !softSkill.test(skill)),
    ...profile.software_tools,
    ...profile.keywords.filter((keyword) => !softSkill.test(keyword)),
    ...definitions.flatMap((definition) => definition.keywords),
    ...job_titles,
    profile.primary_domain,
    ...profile.secondary_domains,
    ...profile.industries,
  ]).slice(0, 30);
  return { job_titles, keywords };
}
