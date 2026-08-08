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
  action_description: 'Qin Wulou reaching toward the Residual Core: a luminous cyan faceted octahedral crystal held inside intersecting aged-gold astrolabe frames and a cyan ring of non-readable ancient glyphs',
  mood: 'mysterious ancient revelation'
};

const payload = builder.buildScenePrompt(shotSpec, 'flux');

const evalResult = PromptLockChecker.evaluatePrompt(
  payload.positive_prompt,
  payload.required_anchor_tokens,
  builder.stylePreset.forbidden_tokens
);

console.log("=== Chapter 004 Scene Prompt Compiled ===");
console.log(`Positive Prompt:\n"${payload.positive_prompt}"\n`);
console.log(`Character Lineage:\n${JSON.stringify(payload.character_lineage, null, 2)}\n`);
console.log(`Anchor Coverage Score: ${evalResult.score}/100 | Passed: ${evalResult.passed ? '✅ YES' : '❌ FAILED'}`);
