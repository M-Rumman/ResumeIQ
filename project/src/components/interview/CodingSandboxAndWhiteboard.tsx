import { useState, useRef, useEffect } from 'react';
import {
  Code2,
  PenTool,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Download,
  Trash2,
  Square,
  ArrowRight,
  Type,
  Sparkles,
  Circle,
} from 'lucide-react';

interface Problem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  starterCode: string;
  testCases: Array<{
    name: string;
    inputDesc: string;
    expected: unknown;
    testFn: (fn: any) => { passed: boolean; actual: unknown };
  }>;
}

const PROBLEMS: Problem[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    description:
      'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. Each input has exactly one solution, and you may not use the same element twice.\n\nExample:\nInput: nums = [2, 7, 11, 15], target = 9\nOutput: [0, 1] because nums[0] + nums[1] == 9.',
    starterCode: `function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}`,
    testCases: [
      {
        name: 'Basic Case',
        inputDesc: 'nums = [2, 7, 11, 15], target = 9',
        expected: '[0, 1]',
        testFn: (fn) => {
          const res = fn([2, 7, 11, 15], 9);
          const passed = Array.isArray(res) && res[0] === 0 && res[1] === 1;
          return { passed, actual: JSON.stringify(res) };
        },
      },
      {
        name: 'Non-sequential Indices',
        inputDesc: 'nums = [3, 2, 4], target = 6',
        expected: '[1, 2]',
        testFn: (fn) => {
          const res = fn([3, 2, 4], 6);
          const passed = Array.isArray(res) && res[0] === 1 && res[1] === 2;
          return { passed, actual: JSON.stringify(res) };
        },
      },
      {
        name: 'Duplicate Values',
        inputDesc: 'nums = [3, 3], target = 6',
        expected: '[0, 1]',
        testFn: (fn) => {
          const res = fn([3, 3], 6);
          const passed = Array.isArray(res) && res[0] === 0 && res[1] === 1;
          return { passed, actual: JSON.stringify(res) };
        },
      },
    ],
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    description:
      'Given a string s containing just the characters "(", ")", "{", "}", "[" and "]", determine if the input string is valid.\n\nOpen brackets must be closed by the same type of brackets in the correct order.',
    starterCode: `function isValid(s) {
  if (s.length % 2 !== 0) return false;
  const stack = [];
  const map = { ')': '(', '}': '{', ']': '[' };
  for (const char of s) {
    if (char === '(' || char === '{' || char === '[') {
      stack.push(char);
    } else {
      if (stack.pop() !== map[char]) return false;
    }
  }
  return stack.length === 0;
}`,
    testCases: [
      {
        name: 'Single Pair',
        inputDesc: 's = "()"',
        expected: 'true',
        testFn: (fn) => {
          const res = fn('()');
          return { passed: res === true, actual: String(res) };
        },
      },
      {
        name: 'Multiple Balanced Types',
        inputDesc: 's = "()[]{}"',
        expected: 'true',
        testFn: (fn) => {
          const res = fn('()[]{}');
          return { passed: res === true, actual: String(res) };
        },
      },
      {
        name: 'Mismatched Closing',
        inputDesc: 's = "(]"',
        expected: 'false',
        testFn: (fn) => {
          const res = fn('(]');
          return { passed: res === false, actual: String(res) };
        },
      },
    ],
  },
  {
    id: 'debounce',
    title: 'Custom Debounce Function',
    difficulty: 'Medium',
    description:
      'Implement a debounce function that delays invoking a callback until after wait milliseconds have elapsed since the last time the debounced function was invoked.',
    starterCode: `function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}`,
    testCases: [
      {
        name: 'Returns a Function',
        inputDesc: 'typeof debounce(() => {}, 100)',
        expected: '"function"',
        testFn: (fn) => {
          const debounced = fn(() => {}, 100);
          return { passed: typeof debounced === 'function', actual: typeof debounced };
        },
      },
      {
        name: 'Preserves Arguments',
        inputDesc: 'debounced("hello", 42)',
        expected: 'Executes with valid arguments',
        testFn: (fn) => {
          let received = '';
          const debounced = fn((msg: string) => {
            received = msg;
          }, 0);
          debounced('tested');
          return { passed: received === 'tested', actual: received };
        },
      },
    ],
  },
];

export default function CodingSandboxAndWhiteboard() {
  const [activeTab, setActiveTab] = useState<'coding' | 'whiteboard'>('coding');

  // --- Coding Sandbox State ---
  const [selectedProblem, setSelectedProblem] = useState<Problem>(PROBLEMS[0]);
  const [code, setCode] = useState(selectedProblem.starterCode);
  const [executionOutput, setExecutionOutput] = useState<{
    success: boolean;
    results: Array<{ name: string; passed: boolean; actual: unknown; expected: unknown }>;
    executionTimeMs: number;
    logs: string[];
    error?: string;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Update starter code when problem changes
  useEffect(() => {
    setCode(selectedProblem.starterCode);
    setExecutionOutput(null);
  }, [selectedProblem]);

  // Safe client-side code runner
  const handleRunCode = () => {
    setIsRunning(true);
    setExecutionOutput(null);

    setTimeout(() => {
      const logs: string[] = [];
      const startTime = performance.now();

      try {
        // Safe evaluation wrapper
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const userFunction = new Function(
          'console',
          `${code};
           if (typeof twoSum !== 'undefined') return twoSum;
           if (typeof isValid !== 'undefined') return isValid;
           if (typeof debounce !== 'undefined') return debounce;
           throw new Error("Target function not found. Please ensure function name matches the prompt.");`
        );

        const customConsole = {
          log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
          warn: (...args: unknown[]) => logs.push('[warn] ' + args.map(String).join(' ')),
          error: (...args: unknown[]) => logs.push('[error] ' + args.map(String).join(' ')),
        };

        const compiledFn = userFunction(customConsole);

        const testResults = selectedProblem.testCases.map((tc) => {
          try {
            const { passed, actual } = tc.testFn(compiledFn);
            return {
              name: tc.name,
              passed,
              actual,
              expected: tc.expected,
            };
          } catch (testErr) {
            return {
              name: tc.name,
              passed: false,
              actual: testErr instanceof Error ? testErr.message : 'Execution error',
              expected: tc.expected,
            };
          }
        });

        const allPassed = testResults.every((r) => r.passed);
        const duration = Math.round((performance.now() - startTime) * 100) / 100;

        setExecutionOutput({
          success: allPassed,
          results: testResults,
          executionTimeMs: duration,
          logs,
        });
      } catch (err) {
        setExecutionOutput({
          success: false,
          results: [],
          executionTimeMs: 0,
          logs,
          error: err instanceof Error ? err.message : 'Syntax or Runtime Error in code',
        });
      } finally {
        setIsRunning(false);
      }
    }, 200);
  };

  // --- System Design Whiteboard State ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<'pen' | 'arrow' | 'rect' | 'text' | 'eraser'>('pen');
  const [color, setColor] = useState('#1e293b');
  const lineWidth = 3;
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [snapshot, setSnapshot] = useState<ImageData | null>(null);

  // Initialize Canvas
  useEffect(() => {
    if (activeTab === 'whiteboard' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // Fill white background initially if empty
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [activeTab]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setStartPos({ x, y });
    setSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));

    if (tool === 'pen' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      ctx.lineWidth = tool === 'eraser' ? lineWidth * 4 : lineWidth;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'pen' || tool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (snapshot) {
      // Restore previous snapshot for shape dragging preview
      ctx.putImageData(snapshot, 0, 0);

      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;

      if (tool === 'rect') {
        ctx.strokeRect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
      } else if (tool === 'arrow') {
        // Draw line with arrowhead
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Arrow head
        const angle = Math.atan2(y - startPos.y, x - startPos.x);
        const headLen = 12;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - headLen * Math.cos(angle - Math.PI / 6), y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x, y);
        ctx.lineTo(x - headLen * Math.cos(angle + Math.PI / 6), y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas && tool === 'text' && startPos) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const text = prompt('Enter text note for architecture diagram:');
        if (text) {
          ctx.fillStyle = color;
          ctx.font = 'bold 14px sans-serif';
          ctx.fillText(text, startPos.x, startPos.y);
        }
      }
    }
    setIsDrawing(false);
    setStartPos(null);
    setSnapshot(null);
  };

  const handleClearWhiteboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleStampComponent = (name: string, subtext: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const x = Math.floor(Math.random() * (canvas.width - 160)) + 30;
    const y = Math.floor(Math.random() * (canvas.height - 80)) + 30;

    // Draw box
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, 140, 56, 8);
    ctx.fill();
    ctx.stroke();

    // Draw text inside
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, x + 70, y + 26);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText(subtext, x + 70, y + 42);
    ctx.textAlign = 'start';
  };

  const handleExportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'system-design-architecture.png';
    a.click();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header with Dual-Mode Tabs */}
      <div className="glass-card p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-[#3c4a59]" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Technical Interview Execution Suite
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900">
              Coding Sandbox & System Design Whiteboard
            </h2>
            <p className="text-xs text-gray-600">
              Practice real-time DSA code execution with automated test assertions, or sketch distributed system architectures on the collaborative whiteboard.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setActiveTab('coding')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'coding'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Code2 className="w-4 h-4 text-emerald-600" />
              Coding Sandbox
            </button>
            <button
              onClick={() => setActiveTab('whiteboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'whiteboard'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <PenTool className="w-4 h-4 text-indigo-600" />
              System Design Whiteboard
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'coding' ? (
        /* --- CODING SANDBOX TAB --- */
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Problem Selector & Prompt (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="glass-card p-5 space-y-3">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Select Technical Challenge
              </label>
              <select
                value={selectedProblem.id}
                onChange={(e) => {
                  const p = PROBLEMS.find((item) => item.id === e.target.value);
                  if (p) setSelectedProblem(p);
                }}
                className="w-full text-xs font-bold p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#3c4a59]"
              >
                {PROBLEMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.difficulty})
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  {selectedProblem.difficulty}
                </span>
                <span className="text-[10px] text-gray-400">
                  {selectedProblem.testCases.length} Test Cases
                </span>
              </div>
            </div>

            <div className="glass-card p-5 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Problem Statement
              </span>
              <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-line font-sans">
                {selectedProblem.description}
              </p>
            </div>

            <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Big-O Interview Tip
              </div>
              <p className="text-[11px] text-indigo-800 leading-relaxed">
                Aim for linear O(N) time using Hash Maps or Two Pointers rather than brute-force O(N²). Be ready to explain your space complexity trade-off.
              </p>
            </div>
          </div>

          {/* Editor & Execution Panel (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="glass-card overflow-hidden border border-gray-300 shadow-md">
              {/* Editor Header */}
              <div className="px-5 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <span className="text-xs font-mono text-slate-300 ml-2">solution.js</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCode(selectedProblem.starterCode)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 text-xs flex items-center gap-1"
                    title="Reset to starter code"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </button>
                  <button
                    onClick={handleRunCode}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md active:scale-95 transition-all"
                  >
                    {isRunning ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    Run Code & Tests
                  </button>
                </div>
              </div>

              {/* Code Area */}
              <textarea
                rows={12}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="w-full p-4 bg-slate-950 text-emerald-400 font-mono text-xs leading-relaxed focus:outline-none resize-none selection:bg-indigo-700 selection:text-white"
              />
            </div>

            {/* Test Execution Output */}
            {executionOutput && (
              <div className="glass-card p-5 space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {executionOutput.success ? (
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4" /> All Tests Passed
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-red-700 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                        <XCircle className="w-4 h-4" /> Tests Failed
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 font-mono">
                    Runtime: {executionOutput.executionTimeMs}ms
                  </span>
                </div>

                {executionOutput.error && (
                  <div className="p-3 bg-red-50 text-red-800 rounded-xl border border-red-200 text-xs font-mono">
                    {executionOutput.error}
                  </div>
                )}

                {/* Individual Test Cases */}
                <div className="space-y-2">
                  {executionOutput.results.map((res, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                        res.passed
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : 'bg-red-50/60 border-red-200 text-red-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {res.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        )}
                        <span className="font-bold">{res.name}</span>
                      </div>
                      <div className="text-[11px] font-mono">
                        Expected: {String(res.expected)} | Got: {String(res.actual)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* --- SYSTEM DESIGN WHITEBOARD TAB --- */
        <div className="space-y-4">
          {/* Whiteboard Controls & Architecture Stamps */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Drawing Tools */}
              <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200">
                <button
                  onClick={() => setTool('pen')}
                  className={`p-2 rounded-lg text-xs font-bold transition-all ${
                    tool === 'pen' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Freehand Pen"
                >
                  <PenTool className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTool('arrow')}
                  className={`p-2 rounded-lg text-xs font-bold transition-all ${
                    tool === 'arrow' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Connection Arrow"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTool('rect')}
                  className={`p-2 rounded-lg text-xs font-bold transition-all ${
                    tool === 'rect' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Rectangle Box"
                >
                  <Square className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTool('text')}
                  className={`p-2 rounded-lg text-xs font-bold transition-all ${
                    tool === 'text' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Text Note"
                >
                  <Type className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTool('eraser')}
                  className={`p-2 rounded-lg text-xs font-bold transition-all ${
                    tool === 'eraser' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Eraser"
                >
                  <Circle className="w-4 h-4" />
                </button>
              </div>

              {/* Color Palette */}
              <div className="flex items-center gap-1.5">
                {['#0f172a', '#2563eb', '#16a34a', '#dc2626', '#9333ea'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full border transition-all ${
                      color === c ? 'ring-2 ring-offset-2 ring-gray-600 scale-110' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              {/* Actions: Clear & Export */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearWhiteboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-red-50 text-gray-600 hover:text-red-600 text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </button>
                <button
                  onClick={handleExportImage}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#3c4a59] text-white hover:bg-[#2e3a47] text-xs font-bold shadow-sm transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Export PNG
                </button>
              </div>
            </div>

            {/* Quick Component Stamp Badges */}
            <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mr-1">
                Stamp Component:
              </span>
              <button
                onClick={() => handleStampComponent('Client / SPA', 'React Web / Mobile')}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1 rounded-lg font-medium border border-gray-200 transition-colors"
              >
                + Client App
              </button>
              <button
                onClick={() => handleStampComponent('Load Balancer', 'NGINX / ALB')}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1 rounded-lg font-medium border border-gray-200 transition-colors"
              >
                + Load Balancer
              </button>
              <button
                onClick={() => handleStampComponent('API Gateway', 'Auth & Rate Limiting')}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1 rounded-lg font-medium border border-gray-200 transition-colors"
              >
                + API Gateway
              </button>
              <button
                onClick={() => handleStampComponent('PostgreSQL DB', 'Primary / Replica')}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1 rounded-lg font-medium border border-gray-200 transition-colors"
              >
                + Relational DB
              </button>
              <button
                onClick={() => handleStampComponent('Redis Cache', 'In-Memory / TTL')}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1 rounded-lg font-medium border border-gray-200 transition-colors"
              >
                + Redis Cache
              </button>
              <button
                onClick={() => handleStampComponent('Kafka Broker', 'Event Streaming')}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1 rounded-lg font-medium border border-gray-200 transition-colors"
              >
                + Kafka Queue
              </button>
            </div>
          </div>

          {/* Canvas Board */}
          <div className="glass-card overflow-hidden border border-gray-300 shadow-md bg-white">
            <canvas
              ref={canvasRef}
              width={960}
              height={560}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="w-full h-[520px] cursor-crosshair bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
