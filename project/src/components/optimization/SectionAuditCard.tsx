import { useState } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, User, FileText, Briefcase, GraduationCap, Wrench } from 'lucide-react';
import { performSectionAudits, type SectionAuditItem } from '../../utils/sectionAuditor';

interface SectionAuditCardProps {
  resumeText: string;
}

export default function SectionAuditCard({ resumeText }: SectionAuditCardProps) {
  const audit = performSectionAudits(resumeText);
  const [selectedTab, setSelectedTab] = useState<'contact' | 'summary' | 'experience' | 'education' | 'skills'>('contact');

  const tabs: Array<{
    key: typeof selectedTab;
    label: string;
    icon: any;
    data: SectionAuditItem;
  }> = [
    { key: 'contact', label: 'Contact Info', icon: User, data: audit.contactAudit },
    { key: 'summary', label: 'Summary', icon: FileText, data: audit.summaryAudit },
    { key: 'experience', label: 'Experience', icon: Briefcase, data: audit.experienceAudit },
    { key: 'education', label: 'Education', icon: GraduationCap, data: audit.educationAudit },
    { key: 'skills', label: 'Skills', icon: Wrench, data: audit.skillsAudit },
  ];

  const currentAudit = tabs.find(t => t.key === selectedTab)!.data;

  const getStatusBadge = (status: SectionAuditItem['status']) => {
    switch (status) {
      case 'passed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">PASSED</span>;
      case 'warning':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800">NEEDS WORK</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800">CRITICAL</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#3c4a59] to-[#252f38] text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900">Section-by-Section Deep Audit</h3>
            <p className="text-xs text-gray-500">Granular critiques on contact information, summary statements, experience flow, and education layout</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = selectedTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isSelected
                  ? 'bg-[#3c4a59] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-800'
              }`}>
                {tab.data.score}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Section Detail Card */}
      <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-200/60">
          <div>
            <h4 className="text-base font-black text-gray-900">{currentAudit.sectionName}</h4>
            <p className="text-xs text-gray-600 mt-0.5">{currentAudit.headline}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-gray-900">{currentAudit.score}%</span>
            {getStatusBadge(currentAudit.status)}
          </div>
        </div>

        {/* Critiques */}
        <div>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
            Section Critiques
          </span>
          <div className="space-y-2">
            {currentAudit.critiques.map((critique, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-gray-800 bg-white p-3 rounded-xl border border-gray-200/70">
                {currentAudit.status === 'passed' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <span>{critique}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="pt-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
            Recruiter & ATS Best Practice Recommendations
          </span>
          <div className="space-y-2">
            {currentAudit.recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-emerald-950 bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
