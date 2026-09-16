export interface QuestionItem {
  id: string;
  title: string;
  question: string;
  industry: 'tech' | 'fintech' | 'healthcare' | 'design' | 'general';
  role: 'frontend' | 'backend' | 'fullstack' | 'data_science' | 'devops' | 'product_manager' | 'system_design' | 'general';
  difficulty: 'entry' | 'mid' | 'senior' | 'staff';
  category: 'behavioral' | 'technical_dsa' | 'system_design' | 'hr_culture' | 'situational';
  tags: string[];
  tip: string;
  idealAnswer: string;
  keyCriteria: string[];
  commonPitfalls: string[];
  followUps?: string[];
  starterCode?: string;
  testCases?: Array<{ input: string; expected: string; description: string }>;
}

export const QUESTION_LIBRARY: QuestionItem[] = [
  // --- TECH: FRONTEND ---
  {
    id: 'fe-1',
    title: 'React Rendering & Performance Optimization',
    question: 'How does the React Virtual DOM reconciliation algorithm work, and what specific techniques do you use to optimize rendering performance in large applications?',
    industry: 'tech',
    role: 'frontend',
    difficulty: 'senior',
    category: 'behavioral',
    tags: ['React', 'Performance', 'DOM', 'Profiling'],
    tip: 'Explain the fiber reconciliation architecture, keys in lists, useMemo/useCallback trade-offs, and browser profiling metrics (LCP, INP).',
    idealAnswer: 'React maintains a Virtual DOM tree of fiber nodes. During updates, React diffs the new element tree against the previous fiber tree using heuristic algorithms: comparing element types and unique keys. In large applications, unnecessary re-renders are mitigated by: 1) Structuring state close to where it is used, 2) Strategically applying React.memo and useMemo for computationally expensive derivations, 3) Code-splitting with React.lazy and dynamic imports, and 4) Measuring real user interactions with Chrome DevTools Performance Profiler and Web Vitals metrics.',
    keyCriteria: ['Explains fiber diffing and key props', 'Mentions state colocation over premature memoization', 'Reflects understanding of real browser performance tools'],
    commonPitfalls: ['Claiming React.memo should wrap every single component', 'Confusing mounting with re-rendering'],
    followUps: [
      'When would useCallback actually hurt performance instead of helping?',
      'How does React 18 concurrent rendering change reconciliation?'
    ]
  },
  {
    id: 'fe-2',
    title: 'Custom Debounce Function Implementation',
    question: 'Implement a debounce function in JavaScript that delays invoking a callback until after a given delay has elapsed since the last time it was called. Include immediate execution option.',
    industry: 'tech',
    role: 'frontend',
    difficulty: 'mid',
    category: 'technical_dsa',
    tags: ['JavaScript', 'Closures', 'Async', 'Event Handling'],
    tip: 'Utilize closures to store the timer ID and handle proper context (this) and arguments binding.',
    idealAnswer: 'A debounce function returns a higher-order function that captures a timer ID in its lexical environment. Whenever invoked, it clears any pending timer with clearTimeout and schedules a new execution using setTimeout. If immediate execution is enabled, it triggers on the leading edge.',
    keyCriteria: ['Preserves function context and arguments', 'Cleans up timers correctly', 'Handles edge cases cleanly'],
    commonPitfalls: ['Losing "this" binding with standard function declarations', 'Not clearing previous timer instances causing multiple fires'],
    starterCode: `function debounce(func, wait, immediate = false) {
  let timeout;
  return function(...args) {
    const context = this;
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    }, wait);
    if (callNow) func.apply(context, args);
  };
}`,
    testCases: [
      { input: 'Calls 5 times in 50ms with 100ms wait', expected: 'Executes exactly 1 time after 100ms', description: 'Trailing debounce' }
    ]
  },
  {
    id: 'fe-3',
    title: 'Core Web Vitals & Loading Architecture',
    question: 'Describe how you diagnose and fix poor Largest Contentful Paint (LCP) and Interaction to Next Paint (INP) scores on an e-commerce platform.',
    industry: 'tech',
    role: 'frontend',
    difficulty: 'senior',
    category: 'behavioral',
    tags: ['Performance', 'CWV', 'LCP', 'INP', 'Web Vitals'],
    tip: 'Break down LCP into time to first byte, resource load delay, resource load duration, and element render delay. For INP, discuss main-thread blocking tasks.',
    idealAnswer: 'For LCP: First analyze the 4 sub-parts (TTFB, Load Delay, Load Duration, Render Delay). Ensure the hero banner is server-rendered or preloaded with <link rel="preload" as="image" fetchpriority="high">, compress to modern AVIF/WebP formats, and avoid client-side redirect chains. For INP: Profile main-thread tasks longer than 50ms using Chrome DevTools. Break down long tasks using scheduler.yield() or requestIdleCallback, decouple non-critical tracking scripts, and optimize React state updates.',
    keyCriteria: ['Detailed grasp of LCP sub-parts', 'Understanding fetchpriority="high"', 'Concrete strategies to resolve main thread blocking for INP'],
    commonPitfalls: ['Generic answer like "just use lazy loading" (lazy loading the hero image actually ruins LCP!)']
  },

  // --- TECH: BACKEND & SYSTEM DESIGN ---
  {
    id: 'be-1',
    title: 'Design a Scalable Distributed Rate Limiter',
    question: 'How would you design a distributed rate limiter for a public API handling 50,000 requests per second across multiple data centers?',
    industry: 'tech',
    role: 'backend',
    difficulty: 'senior',
    category: 'system_design',
    tags: ['System Design', 'Redis', 'Concurrency', 'Microservices'],
    tip: 'Compare Token Bucket, Leaky Bucket, and Sliding Window Counter. Discuss Redis cluster, Lua scripts for atomic increments, and local memory caching.',
    idealAnswer: 'I would implement a Sliding Window Counter algorithm backed by a Redis Cluster. To prevent race conditions, operations are executed atomically using a Lua script with EVAL. Each incoming request checks the counter for key: (client_id:window_timestamp). If count exceeds quota, return HTTP 429 with Retry-After headers. For 50k QPS across multi-regions, to avoid cross-region network latency, we deploy local Redis clusters in each region with asynchronous synchronization or local token bucket counters that periodically sync token allocations.',
    keyCriteria: ['Compares rate limiting algorithms clearly', 'Considers concurrency and race conditions with Lua scripts', 'Addresses multi-region latency and failure modes'],
    commonPitfalls: ['Proposing centralized relational DB queries for rate checks', 'Ignoring network latency in distributed environments']
  },
  {
    id: 'be-2',
    title: 'Database Indexing & Query Optimization',
    question: 'A critical relational database query starts taking 8 seconds under production load. Walk through your step-by-step methodology to investigate, diagnose, and resolve it.',
    industry: 'tech',
    role: 'backend',
    difficulty: 'mid',
    category: 'behavioral',
    tags: ['PostgreSQL', 'SQL', 'Indexes', 'Performance'],
    tip: 'Start with EXPLAIN ANALYZE, inspect sequential scans vs index scans, table bloat, lock contention, and connection pool saturation.',
    idealAnswer: '1) Run EXPLAIN (ANALYZE, BUFFERS) on the query to inspect execution plan: identify whether it performs sequential scans, expensive joins, or file sorts. 2) Check if an appropriate composite B-tree index is missing or if existing indexes are bypassed due to functions on columns. 3) Inspect database lock contention (pg_locks) and active transactions. 4) Analyze table statistics with ANALYZE and check vacuum health. 5) Implement targeted indexing, query restructuring, or materialized caching as necessary.',
    keyCriteria: ['Systematic debugging pipeline', 'Familiarity with EXPLAIN ANALYZE', 'Understanding composite index column order'],
    commonPitfalls: ['Immediately recommending caching without investigating query execution plan first']
  },
  {
    id: 'be-3',
    title: 'Design a Resilient Job Queue & Notification Service',
    question: 'Design an asynchronous notification system (Email, SMS, Push) capable of sending millions of messages daily with guaranteed at-least-once delivery, deduplication, and retry mechanisms.',
    industry: 'tech',
    role: 'system_design',
    difficulty: 'senior',
    category: 'system_design',
    tags: ['Architecture', 'Kafka', 'RabbitMQ', 'Idempotency', 'Dead-Letter-Queue'],
    tip: 'Cover message brokers (Kafka/RabbitMQ/SQS), Idempotency keys, exponential backoff with jitter, Dead Letter Queues (DLQ), and rate limits imposed by third-party providers (SendGrid/Twilio).',
    idealAnswer: 'The architecture decouples publishers from consumers using an event streaming bus like Apache Kafka or AWS SQS. Publishers push events with a unique idempotency UUID. Workers pull messages and verify against a Redis cache / DB unique constraint to guarantee deduplication. If a third-party gateway fails, workers use exponential backoff with jitter up to N attempts before routing failed payloads to a Dead Letter Queue (DLQ) with alerting. Rate limiting buckets per provider prevent triggering vendor throttling.',
    keyCriteria: ['Addresses idempotency and deduplication', 'Includes exponential backoff and DLQ handling', 'Respects downstream vendor rate limits'],
    commonPitfalls: ['Assuming message queues guarantee exactly-once delivery without consumer idempotency']
  },

  // --- DSA / CODING SANDBOX PROBLEMS ---
  {
    id: 'dsa-1',
    title: 'Two Sum Problem',
    question: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume each input has exactly one solution and you may not use the same element twice.',
    industry: 'tech',
    role: 'fullstack',
    difficulty: 'entry',
    category: 'technical_dsa',
    tags: ['Arrays', 'Hash Map', 'Algorithms', 'LeetCode'],
    tip: 'A hash map allows checking complement values in O(1) time, reducing brute-force O(N^2) to O(N) time.',
    idealAnswer: 'Initialize an empty hash map. Iterate through the array once: for each number, calculate complement = target - num. If complement exists in the map, return [map[complement], currentIndex]. Otherwise, store num with its index in the map. Time complexity is O(N), space complexity is O(N).',
    keyCriteria: ['One-pass hash map approach', 'Optimal O(N) time complexity', 'Handles negative numbers and duplicates'],
    commonPitfalls: ['Using nested loops resulting in O(N^2) time'],
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
      { input: 'nums = [2, 7, 11, 15], target = 9', expected: '[0, 1]', description: 'Basic positive numbers' },
      { input: 'nums = [3, 2, 4], target = 6', expected: '[1, 2]', description: 'Non-sequential indices' },
      { input: 'nums = [3, 3], target = 6', expected: '[0, 1]', description: 'Identical values' }
    ]
  },
  {
    id: 'dsa-2',
    title: 'Valid Parentheses',
    question: 'Given a string s containing just the characters "(", ")", "{", "}", "[" and "]", determine if the input string is valid. Open brackets must be closed by the same type of brackets in the correct order.',
    industry: 'tech',
    role: 'fullstack',
    difficulty: 'entry',
    category: 'technical_dsa',
    tags: ['Stack', 'Strings', 'Algorithms'],
    tip: 'A Stack (LIFO) is the ideal data structure to match closing brackets with the most recently opened bracket.',
    idealAnswer: 'Use a stack to keep track of opening brackets. Iterate through each character in the string. If it is an opening bracket, push it onto the stack. If it is a closing bracket, pop from the stack and verify that the popped opening bracket corresponds to the current closing bracket. At the end, verify the stack is empty. Time O(N), Space O(N).',
    keyCriteria: ['Stack based approach', 'Handles odd length strings early', 'Checks empty stack on final return'],
    commonPitfalls: ['Assuming counting total opening and closing brackets is sufficient (ignores nesting order!)'],
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
      { input: 's = "()"', expected: 'true', description: 'Simple single pair' },
      { input: 's = "()[]{}"', expected: 'true', description: 'Multiple bracket types' },
      { input: 's = "(]"', expected: 'false', description: 'Mismatched brackets' }
    ]
  },
  {
    id: 'dsa-3',
    title: 'LRU Cache Design',
    question: 'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache with get(key) and put(key, value) in O(1) average time complexity.',
    industry: 'tech',
    role: 'backend',
    difficulty: 'senior',
    category: 'technical_dsa',
    tags: ['Hash Map', 'Doubly Linked List', 'Data Structures'],
    tip: 'A Hash Map provides O(1) key lookup, and a Doubly Linked List allows O(1) removal and insertion at head/tail.',
    idealAnswer: 'Combine a Hash Map with a Doubly Linked List. The Map stores key -> Node references. The Doubly Linked List maintains usage order with dummy Head and Tail nodes. On get(), find the node in the map and move it to the head (most recently used). On put(), if the key exists, update value and move to head. If new and over capacity, evict the node right before the tail and delete from map, then insert new node at head.',
    keyCriteria: ['Both get and put run in O(1)', 'Doubly linked list maintains node ordering', 'Proper dummy head and tail node boundaries'],
    commonPitfalls: ['Using an Array or Object.keys which causes O(N) re-indexing on eviction'],
    starterCode: `class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
  }
  get(key) {
    if (!this.map.has(key)) return -1;
    const val = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }
  put(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
    this.map.set(key, value);
  }
}`
  },

  // --- BEHAVIORAL & STAR COACHING ---
  {
    id: 'beh-1',
    title: 'Handling a High-Stakes Production Outage',
    question: 'Tell me about a time when a critical bug or outage occurred under your watch. How did you diagnose the problem, communicate with stakeholders, and prevent recurrence?',
    industry: 'tech',
    role: 'general',
    difficulty: 'mid',
    category: 'behavioral',
    tags: ['STAR', 'Leadership', 'Incident Management', 'Communication'],
    tip: 'Structure using STAR. Highlight fast triage, clear customer-facing status updates, and a blameless post-mortem with preventative automated checks.',
    idealAnswer: 'Situation: During a Black Friday flash sale, our primary checkout service threw 500 errors, blocking 30% of transactions. Task: As on-call lead, I had to stop financial hemorrhaging, isolate the root cause, and keep executive leadership informed. Action: 1) Immediately rolled back the latest deployment within 4 minutes while establishing a dedicated incident war-room. 2) Sent standardized 15-minute status updates to support and executives. 3) Discovered an unindexed query on a new promotional table causing connection pool starvation. Result: Restored 100% checkout operations in 12 minutes. Authored a blameless post-mortem that introduced automated query plan checks in CI/CD, resulting in zero outages for the next 4 quarters.',
    keyCriteria: ['Clear STAR breakdown', 'Highlights calm leadership and clear communication', 'Mentions quantifiable business impact and long-term fix'],
    commonPitfalls: ['Focusing on who caused the error instead of team remediation', 'Lacking concrete numbers/metrics in Result']
  },
  {
    id: 'beh-2',
    title: 'Navigating Cross-Functional Disagreements',
    question: 'Describe a situation where Product or Design pushed for a feature deadline that you believed compromised technical integrity or security. How did you resolve the conflict?',
    industry: 'general',
    role: 'general',
    difficulty: 'senior',
    category: 'behavioral',
    tags: ['STAR', 'Negotiation', 'Product Alignment', 'Trade-offs'],
    tip: 'Demonstrate collaborative problem-solving, presenting data-backed trade-offs (Phased Rollout / MVP) instead of an outright "no".',
    idealAnswer: 'Situation: Product wanted to ship a new payments integration in 2 weeks, skipping automated integration test suites and idempotency safety nets. Task: Protect system financial reliability without blocking the company revenue target. Action: Instead of refusing, I scheduled a 30-minute sync where I mapped out the risk curve: shipping without idempotency posed a 15% risk of double-charging users, which would swamp support. I proposed a phased compromise: ship an MVP on schedule restricted to a 5% beta cohort with manual reconciliation, while we finalized automated tests for the 100% rollout 10 days later. Result: The feature launched on time for early customers without double-billing incidents, and full rollout completed with zero critical bugs.',
    keyCriteria: ['Shows empathy for business goals', 'Uses data to articulate technical risk', 'Offers viable alternative solutions'],
    commonPitfalls: ['Portraying the other party as unreasonable', 'Agreeing to cut security corners without risk mitigation']
  },
  {
    id: 'beh-3',
    title: 'Leading Through Ambiguity and Shifting Requirements',
    question: 'Can you share an example of a project where the initial specifications were vague or constantly shifting? How did you bring clarity and drive the project to completion?',
    industry: 'general',
    role: 'product_manager',
    difficulty: 'senior',
    category: 'situational',
    tags: ['STAR', 'Ambiguity', 'Project Management', 'Agile'],
    tip: 'Emphasize creating fast prototypes, defining MVP acceptance criteria, and instituting feedback loops with end users.',
    idealAnswer: 'Situation: Our team was tasked with building an AI-powered search experience, but leadership had differing visions of whether it should be a conversational chat or an augmented search bar. Task: Define the product scope, align stakeholders, and deliver a testable prototype within 6 weeks. Action: I built a rapid interactive prototype in 5 days displaying both modalities. I coordinated user interviews with 15 target customers, gathering qualitative and speed metrics. Presenting this data to leadership proved users preferred augmented search for fast workflows. We codified this as our Phase 1 MVP with crisp milestones. Result: Delivered the project 1 week ahead of schedule, increasing search click-through rate by 38% and user satisfaction scores by 24 points.',
    keyCriteria: ['Proactive drive rather than waiting for instructions', 'Validates with actual user data', 'Establishes clear milestones from ambiguity'],
    commonPitfalls: ['Complaining about leadership indecision', 'Failing to mention concrete business results']
  },

  // --- HR & CULTURE FIT ---
  {
    id: 'hr-1',
    title: 'Why ResuV / Target Company?',
    question: 'Why are you specifically interested in joining our team and mission at this stage of your career?',
    industry: 'general',
    role: 'general',
    difficulty: 'entry',
    category: 'hr_culture',
    tags: ['Culture', 'Motivation', 'Research'],
    tip: 'Tie your personal career goals and passions directly to the company products, technical challenges, and recent milestones.',
    idealAnswer: 'I have been following your team’s transition toward real-time AI assistive tools and scalable infrastructure. In my previous role, I discovered that I do my best work at the intersection of high-fidelity user experiences and real-time performance. Your mission of democratizing career readiness resonates with me deeply, and looking at your recent growth, my background in building performant React workflows and distributed services matches the exact scaling challenges your engineering team is tackling right now.',
    keyCriteria: ['Demonstrates company research', 'Connects personal strengths to company challenges', 'Conveys authentic enthusiasm'],
    commonPitfalls: ['Giving a generic answer that could apply to any company', 'Talking only about compensation or perks']
  },
  {
    id: 'hr-2',
    title: 'What Are Your Greatest Weaknesses and How Do You Manage Them?',
    question: 'What is an area of development or constructive feedback you received recently, and what proactive steps have you taken to address it?',
    industry: 'general',
    role: 'general',
    difficulty: 'mid',
    category: 'hr_culture',
    tags: ['Self-Awareness', 'Growth Mindset', 'Humility'],
    tip: 'Choose a genuine professional skill (not a disguised humblebrag like "I work too hard") and show active systems/habits you built to improve.',
    idealAnswer: 'In the past, I had a tendency to take on too many exploratory technical tasks simultaneously rather than aggressively delegating or pushing back on non-critical asks, which occasionally led to context-switching fatigue. After discussing this in a quarterly review, I adopted a structured prioritization system: I now block the first 3 hours of every morning strictly for the top 2 high-leverage deliverables and practice transparent workload reviews with my team during Monday standups. Over the past 9 months, this improved my sprint completion rate by 22% and enabled me to mentor junior teammates more effectively.',
    keyCriteria: ['Genuine vulnerability without disqualifying oneself', 'Clear corrective action plan', 'Measurable improvement resulting from feedback'],
    commonPitfalls: ['Saying "I am a perfectionist"', 'Mentioning a fatal flaw relevant to core job duties without improvement steps']
  },

  // --- FINTECH & DATA SCIENCE ---
  {
    id: 'fin-1',
    title: 'ACID Transactions & Distributed Consensus',
    question: 'How do you ensure transaction integrity and prevent double-spending in a distributed payment ledger experiencing network partitions?',
    industry: 'fintech',
    role: 'backend',
    difficulty: 'staff',
    category: 'system_design',
    tags: ['Fintech', 'Distributed Systems', 'CAP Theorem', 'Two-Phase Commit', 'Saga'],
    tip: 'Discuss the CAP theorem (CP preference for financial systems), Saga pattern for microservices, and distributed locking with idempotency keys.',
    idealAnswer: 'In financial systems, consistency and partition tolerance (CP) take priority over raw availability. We prevent double-spending through: 1) Strong idempotency keys registered in an append-only distributed ledger, 2) The Saga orchestration pattern with compensating transactions for distributed operations rather than blocking 2-phase commits, 3) Optimistic concurrency control using database versioning tokens to abort stale writes, and 4) Reconciling end-of-day balances via asynchronous double-entry bookkeeping checks.',
    keyCriteria: ['Recognizes CP trade-off', 'Explains Saga pattern vs 2PC', 'Understands double-entry bookkeeping safeguards'],
    commonPitfalls: ['Relying solely on in-memory caches for financial state', 'Ignoring network partition scenarios']
  },
  {
    id: 'ds-1',
    title: 'Handling Class Imbalance in Fraud Detection Models',
    question: 'When training a machine learning model to detect fraudulent transactions where fraud constitutes only 0.1% of all cases, how do you handle data imbalance and evaluate model performance?',
    industry: 'fintech',
    role: 'data_science',
    difficulty: 'senior',
    category: 'behavioral',
    tags: ['Machine Learning', 'Fraud', 'Imbalanced Data', 'Metrics'],
    tip: 'Explain why raw accuracy is deceptive (a model predicting all normal achieves 99.9% accuracy!). Discuss SMOTE, Focal Loss, Precision-Recall AUC, and business cost matrices.',
    idealAnswer: 'First, never evaluate on accuracy. In a 0.1% fraud dataset, a dumb model predicting non-fraud gives 99.9% accuracy while failing 100% of fraud. We use Precision-Recall AUC (PR-AUC), F-beta score (weighting recall higher), and cost-weighted confusion matrices. For modeling: 1) Resampling techniques like SMOTE or intelligent undersampling, 2) Cost-sensitive loss functions such as Focal Loss or class-weighted XGBoost, and 3) Stratified k-fold cross-validation strictly segregated across time horizons to prevent data leakage.',
    keyCriteria: ['Immediately identifies accuracy fallacy', 'Suggests PR-AUC and cost matrix metrics', 'Describes SMOTE / Focal Loss mechanisms'],
    commonPitfalls: ['Recommending ROC-AUC without acknowledging PR-AUC superiority for extreme imbalance']
  }
];
