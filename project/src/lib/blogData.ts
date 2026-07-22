export type BlogCategory =
  | 'Resume Writing'
  | 'ATS Optimization'
  | 'Interview Preparation'
  | 'Resume Examples'
  | 'Career Advice'
  | 'Engineering Careers'
  | 'Software Careers'
  | 'AI Careers'
  | 'Job Search'
  | 'Fresh Graduates'
  | 'Cover Letters'
  | 'LinkedIn'
  | 'Career Growth'
  | 'Salary Guides'
  | 'Templates';

export type BlogArticle = {
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  author: { name: string; role: string; initials: string };
  readingTime: string;
  publishDate: string;
  coverImage: string;
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  featured?: boolean;
};

export const BLOG_CATEGORIES: Array<'All Articles' | BlogCategory> = [
  'All Articles', 'Resume Writing', 'ATS Optimization', 'Interview Preparation',
  'Resume Examples', 'Career Advice', 'Engineering Careers', 'Software Careers',
  'AI Careers', 'Job Search', 'Fresh Graduates', 'Cover Letters', 'LinkedIn',
  'Career Growth', 'Salary Guides', 'Templates',
];

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: 'how-ats-resume-scanners-actually-work',
    title: 'How ATS Resume Scanners Actually Work',
    excerpt: 'A practical look at how applicant tracking systems read structure, keywords, and evidence before a recruiter opens your resume.',
    category: 'ATS Optimization', author: { name: 'Maya Ahmed', role: 'Career Strategy Editor', initials: 'MA' }, readingTime: '12 min read', publishDate: 'July 2026',
    coverImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=85',
    metaTitle: 'How ATS Resume Scanners Work | ResuV', metaDescription: 'Learn how ATS systems read resumes and how to make your application easier to evaluate.', tags: ['ATS', 'Resume Keywords', 'Job Search'], featured: true,
  },
  {
    slug: 'resume-mistakes-that-cost-interviews', title: '20 Resume Mistakes That Cost Interviews',
    excerpt: 'The avoidable details that make a strong candidate harder for both ATS systems and recruiters to understand.',
    category: 'Resume Writing', author: { name: 'Daniel Kim', role: 'Resume Coach', initials: 'DK' }, readingTime: '9 min read', publishDate: 'July 2026',
    coverImage: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1000&q=85',
    metaTitle: '20 Resume Mistakes That Cost Interviews | ResuV', metaDescription: 'Avoid common resume mistakes that reduce clarity and interview chances.', tags: ['Resume Writing', 'Recruiters', 'Career Advice'],
  },
  {
    slug: 'engineering-resume-guide', title: 'The Engineering Resume Guide: Projects That Prove Your Skills',
    excerpt: 'Turn technical coursework, prototypes, and internships into evidence a hiring manager can quickly assess.',
    category: 'Engineering Careers', author: { name: 'Aisha Rahman', role: 'Engineering Career Coach', initials: 'AR' }, readingTime: '10 min read', publishDate: 'June 2026',
    coverImage: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1000&q=85',
    metaTitle: 'Engineering Resume Guide | ResuV', metaDescription: 'Build an engineering resume that clearly demonstrates practical technical experience.', tags: ['Engineering', 'Projects', 'Students'],
  },
  {
    slug: 'best-resume-format-2026', title: 'Best Resume Format in 2026',
    excerpt: 'Choose an ATS-friendly format that gives your experience, projects, and skills room to be understood.',
    category: 'Templates', author: { name: 'Maya Ahmed', role: 'Career Strategy Editor', initials: 'MA' }, readingTime: '7 min read', publishDate: 'June 2026',
    coverImage: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=1000&q=85',
    metaTitle: 'Best Resume Format in 2026 | ResuV', metaDescription: 'Choose a clean, recruiter-friendly and ATS-compatible resume format.', tags: ['Resume Format', 'Templates', 'ATS'],
  },
  {
    slug: 'how-recruiters-read-resumes', title: 'How Recruiters Read Resumes in the First 10 Seconds',
    excerpt: 'The visual and evidence signals that help a recruiter identify role fit at a glance.',
    category: 'Career Advice', author: { name: 'Daniel Kim', role: 'Resume Coach', initials: 'DK' }, readingTime: '6 min read', publishDate: 'June 2026',
    coverImage: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1000&q=85',
    metaTitle: 'How Recruiters Read Resumes | ResuV', metaDescription: 'Understand the first signals recruiters use when reviewing a resume.', tags: ['Recruiters', 'Resume Review', 'Career Advice'],
  },
  {
    slug: 'tailor-your-resume-for-every-job', title: 'How to Tailor Your Resume for Every Job',
    excerpt: 'A repeatable process for aligning your evidence with one job description without overstating experience.',
    category: 'Job Search', author: { name: 'Aisha Rahman', role: 'Engineering Career Coach', initials: 'AR' }, readingTime: '8 min read', publishDate: 'May 2026',
    coverImage: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1000&q=85',
    metaTitle: 'Tailor Your Resume for Every Job | ResuV', metaDescription: 'Use job descriptions to tailor your resume truthfully and strategically.', tags: ['Job Search', 'Keywords', 'Resume Tailoring'],
  },
  {
    slug: 'resume-keywords-explained', title: 'Resume Keywords Explained: What to Add and Where',
    excerpt: 'Learn the difference between a keyword you can prove and a phrase you should not add without evidence.',
    category: 'ATS Optimization', author: { name: 'Maya Ahmed', role: 'Career Strategy Editor', initials: 'MA' }, readingTime: '8 min read', publishDate: 'May 2026',
    coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=85',
    metaTitle: 'Resume Keywords Explained | ResuV', metaDescription: 'Use relevant resume keywords while keeping every claim truthful.', tags: ['Keywords', 'ATS', 'Resume Writing'],
  },
  {
    slug: 'software-engineer-interview-questions', title: 'Top Interview Questions for Software Engineers',
    excerpt: 'Prepare for technical and behavioral questions by connecting your answers to real project evidence.',
    category: 'Software Careers', author: { name: 'Daniel Kim', role: 'Resume Coach', initials: 'DK' }, readingTime: '11 min read', publishDate: 'May 2026',
    coverImage: 'https://images.unsplash.com/photo-1516321165247-4aa89a48be28?auto=format&fit=crop&w=1000&q=85',
    metaTitle: 'Software Engineer Interview Questions | ResuV', metaDescription: 'Prepare practical answers to common software engineering interview questions.', tags: ['Software Engineering', 'Interviews', 'Career Growth'],
  },
  {
    slug: 'mechanical-engineer-resume-example', title: 'Mechanical Engineer Resume Example: Stronger Project Evidence',
    excerpt: 'See how CAD, simulation, testing, and design decisions can be organized into a credible early-career resume.',
    category: 'Resume Examples', author: { name: 'Aisha Rahman', role: 'Engineering Career Coach', initials: 'AR' }, readingTime: '9 min read', publishDate: 'April 2026',
    coverImage: 'https://images.unsplash.com/photo-1537462715879-360eeb61a0ad?auto=format&fit=crop&w=1000&q=85',
    metaTitle: 'Mechanical Engineer Resume Example | ResuV', metaDescription: 'A practical guide to presenting mechanical engineering projects and tools.', tags: ['Mechanical Engineering', 'Resume Examples', 'CAD'],
  },
  {
    slug: 'mechatronics-resume-guide', title: 'Mechatronics Resume Guide for Students and Graduates',
    excerpt: 'Present Arduino, controls, sensors, robotics, and prototyping work in a way employers can verify.',
    category: 'Fresh Graduates', author: { name: 'Aisha Rahman', role: 'Engineering Career Coach', initials: 'AR' }, readingTime: '10 min read', publishDate: 'April 2026',
    coverImage: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1000&q=85',
    metaTitle: 'Mechatronics Resume Guide | ResuV', metaDescription: 'Create a credible mechatronics resume for internships and graduate roles.', tags: ['Mechatronics', 'Fresh Graduates', 'Robotics'],
  },
  {
    slug: 'write-better-resume-bullet-points', title: 'How to Write Better Resume Bullet Points',
    excerpt: 'Use clear action, technical context, and truthful outcomes to make each bullet easier to evaluate.',
    category: 'Resume Writing', author: { name: 'Maya Ahmed', role: 'Career Strategy Editor', initials: 'MA' }, readingTime: '7 min read', publishDate: 'March 2026',
    coverImage: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1000&q=85',
    metaTitle: 'How to Write Better Resume Bullet Points | ResuV', metaDescription: 'Strengthen resume bullet points with clarity, context, and credible impact.', tags: ['Bullet Points', 'Resume Writing', 'ATS'],
  },
  {
    slug: 'linkedin-optimization-guide', title: 'LinkedIn Optimization Guide for Job Seekers',
    excerpt: 'Bring your LinkedIn profile and resume into alignment without creating inconsistent claims.',
    category: 'LinkedIn', author: { name: 'Daniel Kim', role: 'Resume Coach', initials: 'DK' }, readingTime: '8 min read', publishDate: 'March 2026',
    coverImage: 'https://images.unsplash.com/photo-1611944212129-29977ae1398c?auto=format&fit=crop&w=1000&q=85',
    metaTitle: 'LinkedIn Optimization Guide | ResuV', metaDescription: 'Improve your LinkedIn profile for a clearer and more consistent job search presence.', tags: ['LinkedIn', 'Job Search', 'Career Growth'],
  },
];

export function getBlogArticle(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((article) => article.slug === slug);
}
