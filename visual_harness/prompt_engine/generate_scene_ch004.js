const path = require('path');
const PromptBuilder = require('./prompt_builder');
const PromptLockChecker = require('../harness/evaluators/prompt_lock_checker');

const baseDir = path.join(__dirname, '..');
const builder = new PromptBuilder(baseDir);

const shotSpec = {
  character_ids: ['qin_woulou', 'residual_core'],
  item_ids: ['empty_womb'],
  location_id: null,
  camera: 'cinematic macro medium shot, atmospheric lighting',
  action_description: 'Qin Wulou reaching his hand towards the floating unfolded bronze core expanding into ancient golden geometric plates with a glowing cyan octahedron crystal center in dark void space',
  mood: 'mysterious ancient revelation'
};

const payload = builder.buildScenePrompt(shotSpec, 'flux');

const requiredAnchors = ['qin_woulou_char', 'sharp angular jawline', 'residual_core_entity', 'empty_womb_domain_seed'];
const evalResult = PromptLockChecker.evaluatePrompt(payload.positive_prompt, requiredAnchors, builder.stylePreset.forbidden_tokens);

console.log("=== Chapter 004 Scene Prompt Compiled ===");
console.log(`Positive Prompt:\n"${payload.positive_prompt}"\n`);
console.log(`Anchor Coverage Score: ${evalResult.score}/100 | Passed: ${evalResult.passed ? '✅ YES' : '❌ FAILED'}`);
