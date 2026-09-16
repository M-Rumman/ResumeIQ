import { useState, useMemo } from 'react';
import {
  Search,
  Code2,
  Layers,
  Compass,
  Sparkles,
  Play,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { QUESTION_LIBRARY, type QuestionItem } from '../../utils/interviewQuestionsData';

interface QuestionLibraryViewProps {
  onPracticeQuestion?: (question: QuestionItem) => void;
  onOpenCodeSandbox?: (question: QuestionItem) => void;
}

export default function QuestionLibraryView({
  onPracticeQuestion,
  onOpenCodeSandbox,
}: QuestionLibraryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredQuestions = useMemo(() => {
    return QUESTION_LIBRARY.filter((item) => {
      if (selectedIndustry !== 'all' && item.industry !== selectedIndustry) return false;
      if (selectedRole !== 'all' && item.role !== selectedRole) return false;
      if (selectedDifficulty !== 'all' && item.difficulty !== selectedDifficulty) return false;
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesQuestion = item.question.toLowerCase().includes(query);
        const matchesTags = item.tags.some((t) => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesQuestion && !matchesTags) return false;
      }

      return true;
    });
  }, [searchQuery, selectedIndustry, selectedRole, selectedDifficulty, selectedCategory]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCategoryBadge = (cat: QuestionItem['category']) => {
    switch (cat) {
      case 'technical_dsa':
        return { label: 'DSA / Algorithm', color: 'bg-emerald-100 text-emerald-800' };
      case 'system_design':
        return { label: 'System Design', color: 'bg-blue-100 text-blue-800' };
      case 'behavioral':
        return { label: 'Behavioral / STAR', color: 'bg-amber-100 text-amber-800' };
      case 'hr_culture':
        return { label: 'HR & Culture', color: 'bg-purple-100 text-purple-800' };
      case 'situational':
        return { label: 'Situational Leadership', color: 'bg-indigo-100 text-indigo-800' };
      default:
        return { label: 'General', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const getDifficultyBadge = (diff: QuestionItem['difficulty']) => {
    switch (diff) {
      case 'entry':
        return { label: 'Entry / Junior', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      case 'mid':
        return { label: 'Mid-Level', color: 'text-blue-700 bg-blue-50 border-blue-200' };
      case 'senior':
        return { label: 'Senior / Lead', color: 'text-amber-700 bg-amber-50 border-amber-200' };
      case 'staff':
        return { label: 'Staff / Principal', color: 'text-red-700 bg-red-50 border-red-200' };
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="glass-card p-6 sm:p-8 space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#3c4a59]" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Curated Question Database
          </span>
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900">
          Comprehensive Question Library
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
          Browse categorized interview questions verified by tech leads and recruiters across industries. Each question includes model answers, key evaluation rubrics, common pitfalls, and instant practice triggers.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-5 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by keywords, concepts (e.g. React, Kafka, Redis, Two Sum, Outage)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3c4a59] bg-white font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Industry */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Industry
            </label>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#3c4a59]"
            >
              <option value="all">All Industries</option>
              <option value="tech">Tech & Software</option>
              <option value="fintech">Fintech & Finance</option>
              <option value="healthcare">Healthcare & Biotech</option>
              <option value="general">General Cross-Industry</option>
            </select>
          </div>

          {/* Role */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#3c4a59]"
            >
              <option value="all">All Roles</option>
              <option value="frontend">Frontend Engineer</option>
              <option value="backend">Backend Engineer</option>
              <option value="fullstack">Full Stack Engineer</option>
              <option value="system_design">System Architect</option>
              <option value="data_science">Data Scientist / AI</option>
              <option value="product_manager">Product Manager</option>
              <option value="general">General Roles</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Question Type
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#3c4a59]"
            >
              <option value="all">All Types</option>
              <option value="behavioral">Behavioral (STAR)</option>
              <option value="technical_dsa">DSA & Coding</option>
              <option value="system_design">System Design</option>
              <option value="hr_culture">HR & Culture Fit</option>
              <option value="situational">Situational Leadership</option>
            </select>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Difficulty
            </label>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#3c4a59]"
            >
              <option value="all">All Levels</option>
              <option value="entry">Entry / Junior</option>
              <option value="mid">Mid-Level</option>
              <option value="senior">Senior / Lead</option>
              <option value="staff">Staff / Principal</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
          <span>
            Showing <strong>{filteredQuestions.length}</strong> questions
          </span>
          {(selectedIndustry !== 'all' || selectedRole !== 'all' || selectedDifficulty !== 'all' || selectedCategory !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedIndustry('all');
                setSelectedRole('all');
                setSelectedDifficulty('all');
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              Reset All Filters
            </button>
          )}
        </div>
      </div>

      {/* Question List */}
      <div className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <div className="glass-card p-12 text-center space-y-3">
            <Compass className="w-8 h-8 text-gray-400 mx-auto" />
            <h4 className="text-base font-bold text-gray-900">No questions matched your criteria</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Try relaxing your filters or searching for more general keywords.
            </p>
          </div>
        ) : (
          filteredQuestions.map((q) => {
            const isExpanded = expandedQuestionId === q.id;
            const categoryMeta = getCategoryBadge(q.category);
            const difficultyMeta = getDifficultyBadge(q.difficulty);

            return (
              <div
                key={q.id}
                className="border border-gray-200 rounded-2xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-all"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                  className="cursor-pointer p-5 flex items-start justify-between gap-4 hover:bg-gray-50/70 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${categoryMeta.color}`}>
                        {categoryMeta.label}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${difficultyMeta.color}`}>
                        {difficultyMeta.label}
                      </span>
                      {q.tags.map((tag) => (
                        <span key={tag} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <h3 className="font-extrabold text-gray-900 text-sm sm:text-base leading-snug">
                      {q.title}
                    </h3>

                    <p className="text-xs text-gray-700 font-serif leading-relaxed line-clamp-2">
                      "{q.question}"
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(q.id, q.question);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      title="Copy question"
                    >
                      {copiedId === q.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-6 bg-slate-50/70 border-t border-gray-100 space-y-4 text-xs">
                    {/* Full Question Prompt */}
                    <div className="pt-4 bg-white p-4 rounded-xl border border-gray-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                        Full Interview Prompt
                      </span>
                      <p className="text-sm font-semibold text-gray-900 leading-relaxed font-serif">
                        "{q.question}"
                      </p>
                    </div>

                    {/* Model Ideal Answer */}
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Model Benchmark Answer
                      </span>
                      <p className="text-xs text-emerald-950 leading-relaxed font-sans">
                        {q.idealAnswer}
                      </p>
                    </div>

                    {/* Starter Code (if coding problem) */}
                    {q.starterCode && (
                      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 text-white font-mono text-[11px] overflow-x-auto">
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">
                          Starter Algorithm Template
                        </div>
                        <pre>{q.starterCode}</pre>
                      </div>
                    )}

                    {/* Criteria & Pitfalls Grid */}
                    <div className="grid sm:grid-cols-2 gap-3 pt-1">
                      {/* Key Criteria */}
                      <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-1.5">
                        <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> What Interviewers Look For
                        </span>
                        <ul className="space-y-1 text-gray-600 text-[11px]">
                          {q.keyCriteria.map((crit, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                              <span>{crit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Pitfalls */}
                      <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-1.5">
                        <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Common Candidate Pitfalls
                        </span>
                        <ul className="space-y-1 text-gray-600 text-[11px]">
                          {q.commonPitfalls.map((pit, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                              <span>{pit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="text-[11px] text-gray-500 italic">
                        Tip: {q.tip}
                      </div>

                      <div className="flex items-center gap-2">
                        {q.category === 'technical_dsa' && onOpenCodeSandbox && (
                          <button
                            onClick={() => onOpenCodeSandbox(q)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-700 text-xs font-bold transition-all"
                          >
                            <Code2 className="w-3.5 h-3.5" />
                            Open in Coding Sandbox
                          </button>
                        )}

                        {onPracticeQuestion && (
                          <button
                            onClick={() => onPracticeQuestion(q)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3c4a59] text-white hover:bg-[#2e3a47] text-xs font-bold transition-all shadow-sm active:scale-95"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Practice in Mock Simulator
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
