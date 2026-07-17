import { Info } from 'lucide-react';
import StaticPageLayout from '../components/StaticPageLayout';

export default function AboutPage() {
  return (
    <StaticPageLayout
      title="About ResuV"
      subtitle="Helping job seekers stand out with AI-powered career tools."
      icon={Info}
    >
      <div className="space-y-6 text-primary leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-2">What we do</h2>
          <p className="text-sm sm:text-base">
            ResuV is an AI-powered platform for resume optimization and interview preparation. We help
            you improve ATS compatibility, strengthen your resume content, and practice role-specific
            interview questions so you can apply with confidence.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Our mission</h2>
          <p className="text-sm sm:text-base">
            Our mission is to make professional career guidance accessible to everyone. Whether you are
            entering the job market or advancing your career, ResuV gives you clear, actionable feedback
            without the complexity of traditional career coaching.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-2">AI-powered resume optimization</h2>
          <p className="text-sm sm:text-base">
            Upload your resume, compare it against job descriptions, and receive ATS scores, keyword
            insights, and improvement suggestions. Pair that with tailored interview prep to present your
            best self at every stage of the hiring process.
          </p>
        </section>
      </div>
    </StaticPageLayout>
  );
}
