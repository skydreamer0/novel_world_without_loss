const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  VisualCatalog,
  CatalogValidationError,
  canonicalAssetPath,
  validateCharacterRecord,
} = require('../tools/visual_catalog');
const { buildVisualCatalog } = require('../tools/build');

const VISUALS_ROOT = path.join(__dirname, '..');

function testCharacter(characterId) {
  return {
    schema_version: 1,
    character_id: characterId,
    canonical_name: characterId,
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
    prompt_tokens: [`${characterId}_char`],
  };
}

function writeCharacter(root, characterId, referenceSet) {
  const characterDir = path.join(root, 'characters', characterId);
  fs.mkdirSync(path.join(characterDir, 'versions'), { recursive: true });
  fs.writeFileSync(path.join(characterDir, 'profile.json'), JSON.stringify(testCharacter(characterId)));
  fs.writeFileSync(
    path.join(characterDir, 'versions', `${referenceSet.reference_set_id}.json`),
    JSON.stringify(referenceSet),
  );
}

test('loads the complete named-character visual library', () => {
  const catalog = VisualCatalog.load(VISUALS_ROOT);
  const characters = catalog.listCharacters();
  const ids = characters.map((character) => character.character_id);

  assert.equal(characters.length, 35);
  assert.deepEqual(ids, [...ids].sort());
  assert.equal(catalog.resolveCharacterId('秦無漏'), 'qin_woulou');
  assert.equal(catalog.resolveCharacterId('秦罡'), 'qin_gang');
});

test('each character keeps one approved current four-view set', () => {
  const catalog = VisualCatalog.load(VISUALS_ROOT);
  const requiredRoles = new Set([
    'turnaround',
    'full_body_front',
    'full_body_three_quarter',
    'full_body_profile',
    'full_body_back',
  ]);

  catalog.listCharacters().forEach((character) => {
    const current = character.reference_sets.find((set) => set.status === 'approved' && set.is_primary);
    assert.ok(current, `${character.character_id} has no approved current version`);
    const roles = new Set(current.references.map((reference) => reference.role));
    requiredRoles.forEach((role) => assert.ok(roles.has(role), `${character.character_id} is missing ${role}`));
  });
});

test('Chiying keeps the approved v3 face anchor and display image', () => {
  const chiying = VisualCatalog.load(VISUALS_ROOT).getCharacter('chiying');
  assert.equal(chiying.preferred_reference.reference_set_id, 'chiying-core-v3');
  assert.equal(chiying.display_reference.role, 'full_body_three_quarter');
  assert.ok(chiying.reference_sets[0].references.some((reference) => reference.role === 'face_front'));
});

test('strict character validation rejects unknown fields', () => {
  const record = { ...testCharacter('test_person'), unexpected: true };
  assert.ok(validateCharacterRecord(record).some((entry) => entry.code === 'unknown_field'));
});

test('reference images stay inside their character folder', () => {
  assert.equal(
    canonicalAssetPath('characters/test_person/images/front.png'),
    'characters/test_person/images/front.png',
  );
  assert.throws(() => canonicalAssetPath('../outside.png'));
  assert.throws(() => canonicalAssetPath('/absolute.png'));
  assert.throws(() => canonicalAssetPath('scenes/test.png'));
});

test('missing image files fail validation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wwl-visuals-missing-'));
  writeCharacter(root, 'test_person', {
    schema_version: 1,
    reference_set_id: 'test_person-core-v1',
    character_id: 'test_person',
    version: 1,
    label: 'Draft',
    status: 'draft',
    is_primary: false,
    references: [{
      role: 'other',
      path: 'characters/test_person/images/missing.png',
      sha256: 'a'.repeat(64),
      media_type: 'image/png',
    }],
    engine_bindings: {},
  });

  assert.throws(
    () => VisualCatalog.load(root),
    (error) => error instanceof CatalogValidationError
      && error.issues.some((entry) => entry.code === 'missing_asset'),
  );
});

test('the Reader projection is generated from the validated catalog', () => {
  const result = buildVisualCatalog(VISUALS_ROOT, { write: false });
  assert.equal(result.snapshot.characters.length, 35);
  assert.match(result.browser_code, /^\/\* Generated/);
  assert.match(result.browser_code, /window\.WWL_VISUAL_CATALOG/);
});

test('scene and world files remain valid after simplification', () => {
  const catalog = VisualCatalog.load(VISUALS_ROOT);
  const sceneDirs = fs.readdirSync(path.join(VISUALS_ROOT, 'scenes'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.equal(sceneDirs.length, 16);

  sceneDirs.forEach((directoryName) => {
    const sceneDir = path.join(VISUALS_ROOT, 'scenes', directoryName);
    const scene = JSON.parse(fs.readFileSync(path.join(sceneDir, 'scene.json'), 'utf8'));
    assert.equal(scene.scene_id, directoryName);
    scene.character_refs.forEach(({ character_id: characterId, reference_set_id: versionId }) => {
      catalog.getCharacter(characterId);
      assert.equal(catalog.getReferenceSet(versionId).character_id, characterId);
    });
    if (scene.display_asset) {
      const imagePath = path.join(VISUALS_ROOT, scene.display_asset.path);
      assert.ok(fs.existsSync(imagePath), `Missing scene image: ${scene.display_asset.path}`);
      const actualHash = crypto.createHash('sha256').update(fs.readFileSync(imagePath)).digest('hex');
      assert.equal(actualHash, scene.display_asset.sha256);
    }
  });

  for (const filename of ['style.json', 'empty_womb.json', 'qingya_city.json', 'wanjie_city.json']) {
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(VISUALS_ROOT, 'world', filename), 'utf8')));
  }
});
