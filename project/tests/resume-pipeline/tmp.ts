import { callOpenRouter } from '../../api/_lib/openrouter.js';

async function testPrompt() {
  process.env.OPENROUTER_API_KEY = 'YOUR_KEY'; // Need a real key to test or use node to make a fetch directly? No wait, I don't have the API key. 
}
testPrompt();
