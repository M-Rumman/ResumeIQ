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
  content?: Array<{ heading?: string; paragraphs?: string[]; bullets?: string[]; numbered?: string[] }>;
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
    slug: 'best-resume-format-2026', title: 'Best Resume Format in 2026: The Ultimate Guide to Landing More Interviews',
    excerpt: 'Choose an ATS-friendly format that gives your experience, projects, and skills room to be understood by both software and recruiters.',
    category: 'Templates', author: { name: 'Maya Ahmed', role: 'Career Strategy Editor', initials: 'MA' }, readingTime: '12 min read', publishDate: 'July 2026',
    coverImage: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=1000&q=85',
    metaTitle: 'Best Resume Format in 2026: The Ultimate Guide | ResuV', metaDescription: 'Learn the best ATS-friendly resume format in 2026 and how to make it easier for recruiters to evaluate.', tags: ['Resume Format', 'Templates', 'ATS'],
    content: [
      { paragraphs: [
        'The job market in 2026 is more competitive than ever. Recruiters spend only 6–8 seconds scanning a resume before deciding whether to continue reading. On top of that, most companies now use Applicant Tracking Systems (ATS) to filter resumes before a human ever sees them.',
        'This means that having the right experience is no longer enough—you also need the right resume format.',
        'In this guide, you will learn the best resume format in 2026, what ATS systems actually look for, mistakes that instantly lower your chances, a modern resume structure recruiters love, and how AI can help optimize your resume.',
      ] },
      { heading: 'Why Resume Format Matters More Than Ever', paragraphs: ['A resume serves two audiences: ATS software and human recruiters. Your resume must satisfy both. If it looks beautiful but ATS cannot read it, you may be rejected automatically. If ATS accepts it but recruiters struggle to understand it, you can still lose interviews.', 'The ideal resume is easy for ATS to parse, easy for recruiters to skim, and optimized for the specific job you are applying for.'] },
      { heading: 'The Best Resume Format in 2026', paragraphs: ['The reverse chronological resume remains the gold standard. Recruiters prefer it because it clearly shows career progression, and ATS systems can easily understand its structure.'], numbered: ['Contact Information', 'Professional Summary', 'Skills', 'Work Experience', 'Projects (if applicable)', 'Education', 'Certifications', 'Awards or Leadership (optional)'] },
      { paragraphs: ['Avoid creative formats that prioritize design over readability.'] },
      { heading: 'What Recruiters Look For', numbered: ['Are you qualified? Your experience should immediately show that you meet the job requirements.', 'Do you have the required skills? Your technical and soft skills should closely match the job description.', 'Have you achieved results? Instead of listing responsibilities, demonstrate measurable accomplishments.', 'Is your resume easy to read? Long paragraphs discourage recruiters, so use concise bullet points and plenty of white space.'], paragraphs: ['Instead of writing “Managed inventory,” write “Reduced inventory errors by 28% through an automated tracking system.” Numbers build credibility.'] },
      { heading: 'ATS-Friendly Resume Tips', paragraphs: ['Many applicants unknowingly fail ATS screening because of formatting mistakes.'], bullets: ['Use standard section headings: Experience, Education, Skills, and Projects.', 'Use common fonts such as Calibri, Arial, or Helvetica.', 'Save as PDF unless instructed otherwise.', 'Include keywords from the job description naturally.'], },
      { paragraphs: ['Avoid text boxes, tables, graphics, icons, multiple columns, and headers containing important information.'] },
      { heading: 'The Resume Structure That Gets Interviews', paragraphs: ['Professional Summary: keep it between 3–5 lines. Mention your experience, core skills, career focus, and biggest strength.', 'Example: “Mechatronics Engineering undergraduate with experience in robotics, embedded systems, and automation projects. Skilled in C++, Python, SolidWorks, and PCB design. Passionate about building intelligent systems and solving real-world engineering problems.”'] },
      { heading: 'Skills', paragraphs: ['Separate technical and soft skills. Technical skills can include Python, C++, PCB Design, SolidWorks, Proteus, and Embedded Systems. Soft skills can include Communication, Problem Solving, Teamwork, and Leadership.'] },
      { heading: 'Experience', paragraphs: ['Every bullet should answer one question: what impact did you create? Strong bullets begin with action verbs such as Developed, Designed, Implemented, Optimized, Automated, Improved, Reduced, and Increased.'] },
      { heading: 'Projects', paragraphs: ['Students often underestimate projects. Projects can compensate for limited professional experience. Include the objective, technologies used, your contribution, and results.', 'Instead of “Built a line-following robot,” write “Designed and implemented a PID-controlled autonomous line-following robot using Arduino, achieving stable navigation across complex track layouts.”'] },
      { heading: 'Education', bullets: ['Degree', 'University', 'Graduation year', 'GPA, if strong'] },
      { heading: 'Resume Mistakes That Hurt Your Chances', paragraphs: ['Many resumes get rejected for simple reasons. Avoid these common mistakes:'], bullets: ['Generic professional summaries', 'Weak bullet points', 'Missing measurable achievements', 'Applying with the same resume everywhere', 'Keyword stuffing', 'Including irrelevant experience', 'Spelling mistakes', 'Overdesigned templates'] },
      { heading: 'Tailor Every Resume', paragraphs: ['One of the biggest mistakes job seekers make is sending the same resume to every company. Every job description contains unique keywords and requirements.', 'Your resume should be customized to reflect requested skills, technologies mentioned, responsibilities, and industry terminology. Even small adjustments can significantly improve your chances of passing ATS screening.'] },
      { heading: 'How AI Is Changing Resume Writing', bullets: ['Analyze ATS compatibility', 'Compare your resume against a job description', 'Identify missing keywords', 'Rewrite weak bullet points', 'Explain why your resume scored the way it did', 'Suggest role-specific improvements'], paragraphs: ['Instead of guessing what recruiters want, you can receive data-driven recommendations tailored to each application.'] },
      { heading: 'Final Resume Checklist', bullets: ['Is my resume tailored to this specific job?', 'Does my summary match the role?', 'Are my strongest skills near the top?', 'Do my bullet points show measurable impact?', 'Have I included relevant keywords naturally?', 'Is the formatting ATS-friendly?', 'Is everything free of grammar and spelling errors?'], paragraphs: ['If you answered yes to all of these, your resume is in a strong position.'] },
      { heading: 'Final Thoughts', paragraphs: ['A great resume does not guarantee a job—but a poor one can prevent you from getting an interview.', 'The best resume format in 2026 focuses on clarity, relevance, measurable impact, and ATS compatibility. Instead of trying to impress with flashy designs, concentrate on presenting your experience in a way that both software and recruiters can quickly understand.', 'Remember, every application is an opportunity to improve. Tailor your resume, quantify your achievements, and let your strongest work speak for itself.'] },
      { heading: 'Ready to Optimize Your Resume?', paragraphs: ['If you would like instant feedback on your resume, compare it against a job description, and receive AI-powered improvement suggestions, try ResuV. Analyze your resume, identify missing keywords, strengthen weak bullet points, and increase your chances of landing interviews—all in just a few minutes.'] },
    ],
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
