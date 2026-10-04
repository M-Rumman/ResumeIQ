import {
  runLocalStrategicOptimization,
  runAlgorithmicAtsOptimization,
  formatStrategicPrompt,
  formatAtsMaxScorePrompt
} from '../src/utils/strategicResumeOptimizer.js';
import { calculateRealtimeScore } from '../src/utils/realtimeScorer.js';

const sampleResume = `# ALEX RIVERA
Autonomous Systems Engineer | alex.rivera@example.com | (555) 123-4567 | San Francisco, CA

## PROFESSIONAL SUMMARY
Robotics Engineer with 4+ years of experience designing autonomous mobile robots, perception pipelines, and navigation stacks. Proven track record in C++ and Python development for real-time robotic systems.

## TECHNICAL SKILLS
- Languages & Frameworks: C++, Python, ROS, Linux, OpenCV
- Hardware & Sensors: LiDAR, IMU, Depth Cameras, STM32 Microcontrollers
- Tools: Git, CMake, Docker

## WORK EXPERIENCE
### Autonomous Robotics Lab - Robotics Engineer (2022 - Present)
- Integrated IMU and LiDAR perception pipelines for mobile robot localization.
- Implemented motor controller feedback loops, achieving 99.2% trajectory tracking accuracy.
- Evaluated system performance across 500+ simulation trials, reducing execution time by 35%.

### Robotech Solutions - Junior Embedded Engineer (2020 - 2022)
- Developed firmware on STM32 microcontrollers for real-time motor control tasks.
- Tested embedded communication protocols between onboard sensors and main computer.
- Collaborated with mechanical and electrical engineering squads during hardware integration.

## EDUCATION
B.S. in Mechanical Engineering, Robotics Minor - University of California, Berkeley (2020)
`;

const sampleJd = `We are seeking a Senior Robotics & Software Engineer to join our Autonomous Mobility team.
Requirements:
- Deep expertise in sensor integration, sensor fusion, and state estimation.
- Hands-on experience with ROS/ROS2 and SLAM algorithms for autonomous navigation.
- Strong C++ and Python proficiency with embedded systems and RTOS.
- Experience with benchmarking, latency optimization, and automated CI/CD pipelines.
- Familiarity with CAN bus protocols and PID control.
- Passion for cross-functional collaboration in fast-paced engineering environments.`;

console.log('--- 1. Testing formatStrategicPrompt & formatAtsMaxScorePrompt ---');
const prompt1 = formatStrategicPrompt(sampleJd, sampleResume);
const prompt2 = formatAtsMaxScorePrompt(sampleJd, sampleResume);
if (!prompt1.includes('ZERO FABRICATION') || !prompt2.includes('IMPACT (Target: 22+/25)')) {
  throw new Error('Prompt formats failed!');
}
console.log('Prompts passed!');

console.log('--- 2. Testing runLocalStrategicOptimization (Domain Keyword Weaver) ---');
const result1 = runLocalStrategicOptimization(sampleResume, sampleJd);
console.log(`Keywords added: ${result1.addedKeywordsSummary.length}`);
if (!result1.guardrailsAudit.zeroFabricationVerified) throw new Error('Guardrails failed');

console.log('--- 3. Testing runAlgorithmicAtsOptimization (ATS Algorithmic Max Score) ---');
const result2 = runAlgorithmicAtsOptimization(sampleResume, sampleJd);
console.log(`Rewritten bullets: ${result2.addedKeywordsSummary.length}`);
console.log('Optimized Resume Snippet:\n', result2.finalizedResumeText);

const score = calculateRealtimeScore(result2.finalizedResumeText);
console.log('--- Real-time Score Results ---');
console.log(`Overall Score: ${score.overallScore}/100 (Grade ${score.grade})`);
console.log(`Impact Score: ${score.pillars.impact.score}/25 (Target: 22+) -> ${score.pillars.impact.score >= 22 ? 'PASSED ✅' : 'FAILED ❌'}`);
console.log(`Style Score: ${score.pillars.style.score}/25 (Target: 22+) -> ${score.pillars.style.score >= 22 ? 'PASSED ✅' : 'FAILED ❌'}`);
console.log('Style feedback:', score.pillars.style.feedback);
console.log('Style tip:', score.pillars.style.actionableTip);
console.log('Active voice %:', score.activeVoicePercentage);
console.log(`Brevity Score: ${score.pillars.brevity.score}/25 (Target: 23+) -> ${score.pillars.brevity.score >= 23 ? 'PASSED ✅' : 'FAILED ❌'}`);

if (score.pillars.impact.score < 22) {
  throw new Error(`Impact score ${score.pillars.impact.score} below target 22!`);
}
if (score.pillars.style.score < 22) {
  throw new Error(`Style score ${score.pillars.style.score} below target 22!`);
}
if (score.pillars.brevity.score < 23) {
  throw new Error(`Brevity score ${score.pillars.brevity.score} below target 23!`);
}

console.log('All tests passed with flying colors! Both modes verified!');
