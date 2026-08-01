const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/ResumeAnalyzerPage.tsx');
let code = fs.readFileSync(filePath, 'utf-8');

// 1. Rewrite OverallAssessmentCard
const overallStart = code.indexOf('function OverallAssessmentCard(');
const overallEnd = code.indexOf('}', code.indexOf('</section>', overallStart)) + 1;
code = code.substring(0, overallStart) + `function OverallAssessmentCard({ results }: { results: PremiumResults }) {
  const match = results.matchScore;
  const classification = results.engine.hiringManagerAssessment.overallDecision;
  const atsScore = results.atsScore;

  return (
    <section className="w-full rounded-3xl border-2 border-[#3c4a59] bg-[#f4f7f9] p-7 shadow-md sm:p-10 mb-8">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#3c4a59]/20 bg-white px-4 py-2 text-sm font-bold text-[#3c4a59]">
          <Target className="h-4 w-4" />
          Overall Result
        </div>
        <div className="grid sm:grid-cols-3 gap-6 text-center mt-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Job Match</p>
            <p className="text-4xl font-extrabold text-emerald-700">{match}%</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Classification</p>
            <p className="text-xl font-extrabold text-[#3c4a59] mt-2">{classification}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">ATS Parseability</p>
            <p className="text-4xl font-extrabold text-[#3c4a59]">{atsScore}%</p>
          </div>
        </div>
      </div>
    </section>
  );
}` + code.substring(overallEnd);

// 2. Add TopStrengthsCard & BiggestOpportunitiesCard & RequirementBreakdownCard
const newCards = `
function TopStrengthsCard({ breakdown }: { breakdown: any[] }) {
  const strengths = breakdown?.filter(b => b.classification === 'EXACT_MATCH' || b.classification === 'STRONG_SEMANTIC_MATCH') || [];
  if (strengths.length === 0) return null;
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        <h3 className="font-bold text-gray-900">Top Strengths</h3>
      </div>
      <ul className="space-y-3">
        {strengths.slice(0, 10).map((strength: any, i: number) => (
          <li key={i} className="flex flex-col gap-1 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
              <p className="text-sm font-bold text-emerald-950">{strength.requirement?.normalized_name}</p>
            </div>
            {strength.evidence?.[0] && (
               <p className="text-xs text-emerald-800 ml-7">Evidence: "{strength.evidence[0].source_text}"</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BiggestOpportunitiesCard({ opportunities }: { opportunities: string[] }) {
  if (!opportunities || opportunities.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Lightbulb className="w-5 h-5 text-amber-500" />
        <h3 className="font-bold text-gray-900">Biggest Opportunities</h3>
      </div>
      <ul className="space-y-3">
        {opportunities.map((opp, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-950 whitespace-pre-line leading-relaxed">{opp}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RequirementBreakdownCard({ breakdown }: { breakdown: any[] }) {
  if (!breakdown || breakdown.length === 0) return null;
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Target className="w-5 h-5 text-[#3c4a59]" />
        <h3 className="font-bold text-gray-900">Requirement Breakdown</h3>
      </div>
      <div className="space-y-4">
        {breakdown.map((item, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
            <div className="flex justify-between items-start mb-2">
               <div>
                 <p className="font-bold text-gray-900">{item.requirement?.normalized_name}</p>
                 <p className="text-xs text-gray-500 uppercase tracking-wide">{item.requirement?.priority} • {item.requirement?.category}</p>
               </div>
               <span className="text-xs font-bold px-2 py-1 bg-white border border-gray-200 rounded text-gray-700">
                 {item.classification}
               </span>
            </div>
            {item.evidence && item.evidence.length > 0 ? (
               <div className="mt-2 text-sm text-gray-700">
                 <strong>Evidence ({item.evidence[0].source_section}):</strong> "{item.evidence[0].source_text}"
               </div>
            ) : (
               <div className="mt-2 text-sm text-red-600">No evidence found in resume.</div>
            )}
            {item.explanation && (
               <div className="mt-2 text-xs text-gray-600 italic">
                 {item.explanation}
               </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
`;

const strStart = code.indexOf('function StrengthsMatchingRoleCard(');
const strEnd = code.indexOf('}', code.indexOf('</div>', strStart)) + 1;
code = code.substring(0, strStart) + newCards + code.substring(strEnd);

// 3. Update KeywordCompatibilityCard
code = code.replace(/const groups = \[[\s\S]*?\];/, 
`const groups = [
    { title: 'Exact Match', icon: '✓', items: compatibility.exactMatches || [], className: 'border-emerald-100 bg-emerald-50 text-emerald-900', iconClassName: 'text-emerald-700' },
    { title: 'Semantic Match', icon: '~', items: compatibility.semanticMatches || [], className: 'border-blue-100 bg-blue-50 text-blue-900', iconClassName: 'text-blue-700' },
    { title: 'Under-Expressed', icon: '!', items: compatibility.underExpressed || [], className: 'border-amber-100 bg-amber-50 text-amber-900', iconClassName: 'text-amber-700' },
    { title: 'Missing', icon: '✗', items: compatibility.missing || [], className: 'border-red-100 bg-red-50 text-red-900', iconClassName: 'text-red-700' },
  ];`);
code = code.replace(/<span><strong>Matched:<\/strong> \{compatibility\.strongMatches\.length\}<\/span>/, 
`<span><strong>Exact:</strong> {compatibility.exactMatches?.length || 0}</span>
        <span><strong>Semantic:</strong> {compatibility.semanticMatches?.length || 0}</span>`);
code = code.replace(/<span><strong>Partial:<\/strong> \{compatibility\.partialMatches\.length\}<\/span>/, 
`<span><strong>Under-Expressed:</strong> {compatibility.underExpressed?.length || 0}</span>`);

// 4. Update ResumeResultsBody rendering
code = code.replace(/<StrengthsMatchingRoleCard strengths=\{results\.engine\.roleStrengths\} \/>/g, 
`<TopStrengthsCard breakdown={results.requirementBreakdown} />
            <BiggestOpportunitiesCard opportunities={results.engine.optimizationRecommendations || []} />
            <RequirementBreakdownCard breakdown={results.requirementBreakdown} />`);

// 5. Update KeywordRecommendations
const kwStart = code.indexOf('function KeywordRecommendations(');
const kwEnd = code.indexOf('}', code.indexOf('</div>', kwStart)) + 1;

const newKw = `function KeywordRecommendations({ priorities }: { priorities: PremiumResults['engine']['recommendationPriorities'] }) {
  if (!priorities) return null;
  const levels = [
    { label: 'Critical', items: priorities.critical, color: 'text-red-700 border-red-100 bg-red-50' },
    { label: 'Important', items: priorities.important, color: 'text-amber-700 border-amber-100 bg-amber-50' },
    { label: 'Optional', items: priorities.optional, color: 'text-[#3c4a59] border-gray-200 bg-gray-50' }
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <AlertCircle className="w-5 h-5 text-amber-600" />
        <h3 className="font-bold text-gray-900">Recommended Changes</h3>
      </div>
      <div className="space-y-5">
        {levels.map((level) => {
          if (!level.items || level.items.length === 0) return null;
          return (
            <div key={level.label}>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">{level.label}</p>
              <div className="space-y-2">
                {level.items.map((item, i) => (
                  <div key={i} className={\`rounded-xl border px-4 py-3 \${level.color}\`}>
                    <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}`;

code = code.substring(0, kwStart) + newKw + code.substring(kwEnd);

code = code.replace(/<KeywordRecommendations recommendations=\{results\.keywordRecommendations\} \/>/g, `<KeywordRecommendations priorities={results.engine.recommendationPriorities} />`);

// 6. Split AtsBreakdown into ResumeQuality and AtsHealth
const atsStart = code.indexOf('function AtsBreakdown(');
const atsEnd = code.indexOf('}', code.indexOf('</section>', atsStart)) + 1;

const splitAts = `
function ResumeQualityCard({ breakdown }: { breakdown: PremiumResults['engine']['atsBreakdown'] }) {
  const qualityItems = breakdown.filter(i => i.label !== 'Section Recognition' && i.label !== 'Readability & Formatting');
  if (qualityItems.length === 0) return null;
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <FileText className="w-5 h-5 text-[#3c4a59]" />
        <h3 className="font-bold text-gray-900">Resume Quality</h3>
      </div>
      <div className="space-y-3">
        {qualityItems.map((item) => (
          <div key={item.label} className="rounded-lg bg-gray-50 px-4 py-3 border border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-gray-900">{item.label}</p>
              <span className="text-xs font-extrabold text-[#3c4a59]">{item.score} / {item.maximum}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-700 whitespace-pre-line">{item.explanation}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AtsHealthCard({ breakdown }: { breakdown: PremiumResults['engine']['atsBreakdown'] }) {
  const healthItems = breakdown.filter(i => i.label === 'Section Recognition' || i.label === 'Readability & Formatting');
  if (healthItems.length === 0) return null;
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Target className="w-5 h-5 text-emerald-600" />
        <h3 className="font-bold text-gray-900">ATS Health</h3>
      </div>
      <div className="space-y-3">
        {healthItems.map((item) => (
          <div key={item.label} className="rounded-lg bg-emerald-50 px-4 py-3 border border-emerald-100">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-emerald-900">{item.label}</p>
              <span className="text-xs font-extrabold text-emerald-800">{item.score} / {item.maximum}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-emerald-800 whitespace-pre-line">{item.explanation}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
`;

code = code.substring(0, atsStart) + splitAts + code.substring(atsEnd);

code = code.replace(/<AtsBreakdown breakdown=\{results\.engine\.atsBreakdown\} overallScore=\{results\.atsScore\} \/>/g, 
`<AtsHealthCard breakdown={results.engine.atsBreakdown} />
                <ResumeQualityCard breakdown={results.engine.atsBreakdown} />`);


fs.writeFileSync(filePath, code);
console.log('UI Rewrite Complete');
