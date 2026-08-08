const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  CharacterCatalog,
  CatalogValidationError,
  canonicalAssetPath,
  validateCharacterRecord,
  validateReferenceSetRecord,
} = require('../catalog/character_catalog');
const { buildCharacterCatalog } = require('../scripts/build_character_catalog');

const VISUAL_HARNESS = path.join(__dirname, '..');

test('loads every Character Identity in stable order', () => {
  const catalog = CharacterCatalog.load(VISUAL_HARNESS);
  const characters = catalog.listCharacters();
  const ids = characters.map((character) => character.character_id);

  assert.equal(characters.length, 9);
  assert.deepEqual(ids, [...ids].sort());
  assert.equal(catalog.resolveCharacterId('秦無漏'), 'qin_woulou');
  assert.equal(catalog.resolveCharacterId('Lu Qinghe'), 'lu_qinghe');
});

test('exposes approved Reference Set lineage and preferred assets', () => {
  const catalog = CharacterCatalog.load(VISUAL_HARNESS);
  const qinWulou = catalog.getCharacter('qin_woulou');
  const luQinghe = catalog.getCharacter('lu_qinghe');

  assert.equal(qinWulou.preferred_reference.reference_set_id, 'qin_woulou-core-v2');
  assert.equal(qinWulou.preferred_reference.role, 'turnaround');
  assert.equal(qinWulou.display_reference.role, 'full_body_three_quarter');
  assert.equal(luQinghe.preferred_reference.reference_set_id, 'lu_qinghe-core-v2');
  assert.equal(luQinghe.preferred_reference.role, 'turnaround');
  assert.equal(luQinghe.display_reference.role, 'full_body_three_quarter');
});

test('every current character has one approved primary four-view Reference Set', () => {
  const catalog = CharacterCatalog.load(VISUAL_HARNESS);

  catalog.listCharacters().forEach((character) => {
    const primary = character.reference_sets.find((set) => set.status === 'approved' && set.is_primary);
    assert.ok(primary, `${character.character_id} has no approved primary Reference Set`);
    assert.deepEqual(
      new Set(primary.references.map((reference) => reference.role)),
      new Set([
        'turnaround',
        'full_body_front',
        'full_body_three_quarter',
        'full_body_profile',
        'full_body_back',
      ]),
    );
  });
});

test('strict Character Identity validation rejects unknown fields', () => {
  const issues = validateCharacterRecord({
    schema_version: 1,
    character_id: 'test_person',
    canonical_name: '測試人物',
    aliases: [],
    role: 'test',
    visual_anchors: {
      face_structure: 'oval',
      eyes: 'dark',
      hair: 'black',
      signature_clothing: 'plain robe',
      distinguishing_marks: [],
    },
    forbidden_traits: [],
    prompt_tokens: ['test_person_char'],
    unexpected: true,
  });

  assert.ok(issues.some((entry) => entry.code === 'unknown_field'));
});

test('canonical asset paths cannot escape storage', () => {
  assert.equal(canonicalAssetPath('storage/generated/a.png'), 'storage/generated/a.png');
  assert.throws(() => canonicalAssetPath('../outside.png'));
  assert.throws(() => canonicalAssetPath('/absolute.png'));
  assert.throws(() => canonicalAssetPath('visual_bible/a.png'));
});

test('approved primary Reference Sets reject incomplete or shared four-view assets', () => {
  const base = {
    schema_version: 1,
    reference_set_id: 'test_person-core-v1',
    character_id: 'test_person',
    version: 1,
    label: 'Core',
    status: 'approved',
    is_primary: true,
    references: [{
      role: 'turnaround',
      path: 'storage/generated/test.png',
      sha256: 'a'.repeat(64),
      media_type: 'image/png',
    }],
    engine_bindings: {},
  };
  const incomplete = validateReferenceSetRecord(base);
  assert.ok(incomplete.some((entry) => entry.code === 'incomplete_primary_turnaround'));

  const roles = [
    'turnaround',
    'full_body_front',
    'full_body_three_quarter',
    'full_body_profile',
    'full_body_back',
  ];
  const shared = validateReferenceSetRecord({
    ...base,
    references: roles.map((role) => ({
      role,
      path: 'storage/generated/test.png',
      sha256: 'a'.repeat(64),
      media_type: 'image/png',
    })),
  });
  assert.ok(shared.some((entry) => entry.code === 'shared_primary_view_asset'));
});

test('missing assets fail the Catalog interface', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wwl-catalog-'));
  fs.mkdirSync(path.join(tempRoot, 'visual_bible', 'characters'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'visual_bible', 'reference_sets'), { recursive: true });
  const character = {
    schema_version: 1,
    character_id: 'test_person',
    canonical_name: '測試人物',
    aliases: [],
    role: 'test',
    visual_anchors: {
      face_structure: 'oval',
      eyes: 'dark',
      hair: 'black',
      signature_clothing: 'plain robe',
      distinguishing_marks: [],
    },
    forbidden_traits: [],
    prompt_tokens: ['test_person_char'],
  };
  const referenceSet = {
    schema_version: 1,
    reference_set_id: 'test_person-core-v1',
    character_id: 'test_person',
    version: 1,
    label: 'Core',
    status: 'approved',
    is_primary: true,
    references: [{
      role: 'full_body',
      path: 'storage/generated/missing.png',
      sha256: 'a'.repeat(64),
      media_type: 'image/png',
    }],
    engine_bindings: {},
  };
  fs.writeFileSync(
    path.join(tempRoot, 'visual_bible', 'characters', 'test_person.json'),
    JSON.stringify(character),
  );
  fs.writeFileSync(
    path.join(tempRoot, 'visual_bible', 'reference_sets', 'test_person-core-v1.json'),
    JSON.stringify(referenceSet),
  );

  assert.throws(
    () => CharacterCatalog.load(tempRoot),
    (error) => error instanceof CatalogValidationError
      && error.issues.some((entry) => entry.code === 'missing_asset'),
  );
});

test('browser projection is generated from the same snapshot', () => {
  const result = buildCharacterCatalog(VISUAL_HARNESS);
  const json = JSON.parse(fs.readFileSync(result.json_path, 'utf8'));
  const browser = fs.readFileSync(result.browser_path, 'utf8');

  assert.equal(json.characters.length, 9);
  assert.match(browser, /^\/\* Generated/);
  assert.match(browser, /window\.WWL_CHARACTER_CATALOG/);
});
