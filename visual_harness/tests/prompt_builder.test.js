const assert = require('node:assert/strict');
const path = require('path');
const test = require('node:test');

const PromptBuilder = require('../prompt_engine/prompt_builder');
const { CatalogValidationError } = require('../catalog/character_catalog');

const VISUAL_HARNESS = path.join(__dirname, '..');

test('scene Prompt Package preserves Character and Reference Set lineage', () => {
  const builder = new PromptBuilder(VISUAL_HARNESS);
  const payload = builder.buildScenePrompt({
    character_refs: [{
      character_id: 'qin_woulou',
      reference_set_id: 'qin_woulou-core-v2',
    }],
    item_ids: ['empty_womb'],
    location_id: 'qingya_city',
    action_description: 'Qin Wulou guards the city wall',
  });

  assert.equal(payload.type, 'scene_prompt_package');
  assert.equal(payload.character_lineage[0].character_id, 'qin_woulou');
  assert.equal(payload.character_lineage[0].reference_set_id, 'qin_woulou-core-v2');
  assert.equal(payload.character_lineage[0].reference_set_version, 2);
  assert.ok(payload.required_anchor_tokens.includes('qin_woulou_char'));
  assert.ok(payload.required_anchor_tokens.includes('qingya_city_citadel'));
});

test('unknown characters fail instead of producing partial prompts', () => {
  const builder = new PromptBuilder(VISUAL_HARNESS);
  assert.throws(
    () => builder.buildScenePrompt({ character_ids: ['missing_person'] }),
    (error) => error instanceof CatalogValidationError
      && error.issues.some((entry) => entry.code === 'unknown_character'),
  );
});

test('a Reference Set cannot be used for a different character', () => {
  const builder = new PromptBuilder(VISUAL_HARNESS);
  assert.throws(
    () => builder.buildScenePrompt({
      character_refs: [{
        character_id: 'lu_qinghe',
        reference_set_id: 'qin_woulou-core-v2',
      }],
    }),
    (error) => error instanceof CatalogValidationError
      && error.issues.some((entry) => entry.code === 'reference_set_owner_mismatch'),
  );
});

test('characters default to their approved primary four-view Reference Set', () => {
  const builder = new PromptBuilder(VISUAL_HARNESS);
  const payload = builder.buildScenePrompt({ character_ids: ['su_wanzhao'] });

  assert.equal(payload.character_lineage[0].reference_set_id, 'su_wanzhao-core-v1');
  assert.equal(payload.character_lineage[0].references.length, 5);
  assert.deepEqual(payload.catalog_warnings, []);
});
