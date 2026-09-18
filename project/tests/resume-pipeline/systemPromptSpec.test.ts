import assert from 'node:assert/strict';
import { parseResumeText } from '../../api/_lib/resumeParser.js';
import { calculateRealtimeScore } from '../../src/utils/realtimeScorer.js';
import { scanResumeFormatting } from '../../src/utils/atsFormatScanner.js';

console.log('--- RUNNING SYSTEM PROMPT SPEC TESTS ---');

// Test 1: Fuzzy Heading Detection & Zero-Drop Policy
const sampleRoboticsResume = `
Alex Mercer
alex.mercer@example.com | (555) 123-4567 | San Francisco, CA

Professional Summary
Robotics engineer specializing in autonomous mobile robots and control systems.

Education
Bachelor of Science in Mechatronics Engineering
XYZ University | 2018 - 2022

Technical Skills
Python and C++, ROS2, Nav2, SLAM, AMCL, Gazebo and RViz, SolidWorks or equivalent, Lidar, BLDC motor control validation

Professional Experience and Projects
Industrial AI and IoT Lab | June 2023 - Present
Robotics Research Intern
Developed autonomous navigation pipelines using ROS2, Nav2, SLAM, and AMCL algorithms for warehouse mobile robots. Achieved 7cm positioning accuracy.

Research and Development Center | Jan 2022 - May 2023
Hardware & Systems Engineering Intern
Designed mechanical chassis in SolidWorks. Integrated 2D Lidar sensors and executed BLDC motor control validation across 15 prototype iterations.

Autonomous Rover Project
Built a 4-wheel differential drive rover prototype using Arduino and ESP32 with obstacle avoidance.
`;

const parsed = parseResumeText(sampleRoboticsResume);

// Assert Task 1: Semantic Section Parsing
assert.ok(parsed.experience.length >= 2, `Expected at least 2 formal experience roles, got ${parsed.experience.length}`);

// Assert Task 2: Atomic Skill Extraction
assert.ok(parsed.skills.includes('Python'), 'Should extract Python');
assert.ok(parsed.skills.includes('C++'), 'Should extract C++');
assert.ok(!parsed.skills.some(s => s.toLowerCase().includes('python and c++')), 'Should split conjunction "Python and C++"');
assert.ok(parsed.skills.includes('Gazebo'), 'Should extract Gazebo');
assert.ok(parsed.skills.includes('RViz'), 'Should extract RViz');
assert.ok(!parsed.skills.some(s => s.toLowerCase().includes('gazebo and rviz')), 'Should split conjunction "Gazebo and RViz"');
assert.ok(parsed.skills.includes('SolidWorks'), 'Should extract SolidWorks');
assert.ok(!parsed.skills.some(s => s.toLowerCase().includes('or equivalent')), 'Should remove "or equivalent"');
assert.ok(!parsed.skills.some(s => s.toLowerCase().includes("bachelor's degree")), 'Should exclude credentials from skills');

// Check robotics keywords in understanding/entities
const normalizedEntityNames = parsed.understanding.entities.map(e => e.normalizedName);

assert.ok(normalizedEntityNames.includes('ROS2'), 'Entities should include ROS2');
assert.ok(normalizedEntityNames.includes('Nav2'), 'Entities should include Nav2');
assert.ok(normalizedEntityNames.includes('SLAM'), 'Entities should include SLAM');
assert.ok(normalizedEntityNames.includes('AMCL'), 'Entities should include AMCL');
assert.ok(normalizedEntityNames.includes('SolidWorks'), 'Entities should include SolidWorks');
assert.ok(normalizedEntityNames.includes('Lidar'), 'Entities should include Lidar');

// Assert Task 3: Realistic Scoring Framework (Max 24/25 per category)
const scoreReport = calculateRealtimeScore(sampleRoboticsResume);

assert.ok(scoreReport.pillars.impact.score <= 24, 'Impact score must not exceed 24');
assert.ok(scoreReport.pillars.brevity.score <= 24, 'Brevity score must not exceed 24');
assert.ok(scoreReport.pillars.style.score <= 24, 'Style score must not exceed 24');
assert.ok(scoreReport.pillars.structure.score <= 24, 'Structure score must not exceed 24');
assert.ok(scoreReport.overallScore <= 96, 'Overall score must not exceed 96 (sum of 4x24)');

// Assert Task 4: Strict Formatting & Diagnostic Feedback
const atsReport = scanResumeFormatting(sampleRoboticsResume);

const tableIssue = atsReport.issues.find(i => i.id === 'table_detected');
assert.equal(tableIssue, undefined, 'Plain text resume must not trigger table hallucinations');

const encodingIssue = atsReport.issues.find(i => i.id === 'unusual_fonts_encoding');
assert.equal(encodingIssue, undefined, 'Readable resume text must not trigger font encoding hallucinations');

const renameIssue = atsReport.issues.find(i => i.id === 'compound_heading_rename');
assert.ok(renameIssue, 'Should detect compound heading and suggest exact rename');
assert.ok(renameIssue?.remediation.includes("Change 'Professional Experience and Projects' to 'Experience'"), 'Should provide exact ATS rename suggestion');

console.log('✔ All system prompt spec assertions passed');
