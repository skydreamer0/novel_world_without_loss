const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { CharacterCatalog } = require('../catalog/character_catalog');
const { runImportBatch } = require('../catalog/import_batch');

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function characterRecord(characterId) {
  return {
    schema_version: 1,
    character_id: characterId,
    canonical_name: `${characterId} canonical name`,
    aliases: [],
    role: 'Import Batch test character',
    visual_anchors: {
      apparent_age: 'young adult',
      face_structure: 'defined oval face',
      eyes: 'dark focused eyes',
      hair: 'long black hair',
      physique: 'lean upright build',
      signature_clothing: 'plain dark cultivation robe',
      distinguishing_marks: []
    },
    forbidden_traits: ['modern clothing'],
    prompt_tokens: [`${characterId}_char`, 'plain dark cultivation robe']
  };
}

function referenceSetRecord(characterId, referenceSetId, assetPath, assetHash) {
  const views = [
    ['turnaround', 'turnaround'],
    ['full_body_front', 'front'],
    ['full_body_three_quarter', 'three-quarter'],
    ['full_body_profile', 'profile'],
    ['full_body_back', 'back']
  ];
  return {
    schema_version: 1,
    reference_set_id: referenceSetId,
    character_id: characterId,
    version: 1,
    label: 'Core appearance',
    status: 'approved',
    is_primary: true,
    references: views.map(([role, suffix]) => (
      {
        role,
        path: assetPath.replace(/\.png$/, `-${suffix}.png`),
        sha256: assetHash,
        media_type: 'image/png',
        source: 'import batch test fixture'
      }
    )),
    engine_bindings: {}
  };
}

function makeFixture(t, { withReferenceSet = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'woulou-import-batch-'));
  const baseDir = path.join(root, 'visual_harness');
  const batchDir = path.join(root, 'batch');
  fs.mkdirSync(baseDir, { recursive: true });
  fs.mkdirSync(batchDir, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const characterId = 'import_hero';
  const referenceSetId = 'import_hero-core-v1';
  const assetPath = 'storage/generated/import_hero.png';
  const assetBuffer = Buffer.from('not-a-real-png-but-stable-binary-content');
  const assetHash = hash(assetBuffer);
  const character = characterRecord(characterId);
  const referenceSet = referenceSetRecord(characterId, referenceSetId, assetPath, assetHash);

  fs.writeFileSync(path.join(batchDir, 'character.json'), `${JSON.stringify(character, null, 2)}\n`);
  fs.writeFileSync(path.join(batchDir, 'reference_set.json'), `${JSON.stringify(referenceSet, null, 2)}\n`);
  const assetFiles = ['turnaround', 'front', 'three-quarter', 'profile', 'back'];
  assetFiles.forEach((suffix) => {
    fs.writeFileSync(path.join(batchDir, `${suffix}.png`), assetBuffer);
  });

  const manifest = {
    schema_version: 1,
    batch_id: 'test-import-001',
    characters: [{ source: 'character.json' }],
    reference_sets: withReferenceSet ? [{ source: 'reference_set.json' }] : [],
    assets: withReferenceSet
      ? assetFiles.map((suffix) => ({
          source: `${suffix}.png`,
          destination: assetPath.replace(/\.png$/, `-${suffix}.png`),
          sha256: assetHash
        }))
      : []
  };
  const manifestPath = path.join(batchDir, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    root,
    baseDir,
    batchDir,
    manifest,
    manifestPath,
    characterId,
    referenceSetId,
    assetPath,
    assetBuffer,
    assetHash
  };
}

function destinationPaths(fixture) {
  return {
    character: path.join(fixture.baseDir, 'visual_bible', 'characters', `${fixture.characterId}.json`),
    referenceSet: path.join(
      fixture.baseDir,
      'visual_bible',
      'reference_sets',
      `${fixture.referenceSetId}.json`
    ),
    assets: ['turnaround', 'front', 'three-quarter', 'profile', 'back'].map((suffix) => (
      path.join(
        fixture.baseDir,
        ...fixture.assetPath.replace(/\.png$/, `-${suffix}.png`).split('/')
      )
    ))
  };
}

test('dry run validates every entry without publishing files', async t => {
  const fixture = makeFixture(t);
  const destinations = destinationPaths(fixture);

  const report = await runImportBatch(fixture.manifestPath, { baseDir: fixture.baseDir });

  assert.equal(report.success, true, JSON.stringify(report, null, 2));
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.committed, false);
  assert.equal(report.summary.planned, 7);
  assert.deepEqual(report.entries.map(entry => entry.status), Array(7).fill('planned'));
  assert.equal(fs.existsSync(destinations.character), false);
  assert.equal(fs.existsSync(destinations.referenceSet), false);
  assert.equal(destinations.assets.every((asset) => !fs.existsSync(asset)), true);
});

test('commit publishes a valid batch and skip-identical makes reruns idempotent', async t => {
  const fixture = makeFixture(t);
  const destinations = destinationPaths(fixture);

  const first = await runImportBatch(fixture.manifestPath, {
    baseDir: fixture.baseDir,
    commit: true
  });

  assert.equal(first.success, true);
  assert.equal(first.committed, true);
  assert.equal(first.summary.created, 7);
  assert.equal(fs.existsSync(destinations.character), true);
  assert.equal(fs.existsSync(destinations.referenceSet), true);
  destinations.assets.forEach((asset) => {
    assert.deepEqual(fs.readFileSync(asset), fixture.assetBuffer);
  });
  assert.equal(CharacterCatalog.load(fixture.baseDir, { validateAssets: true }).listCharacters().length, 1);

  const second = await runImportBatch(fixture.manifestPath, {
    baseDir: fixture.baseDir,
    commit: true
  });

  assert.equal(second.success, true);
  assert.equal(second.committed, true);
  assert.equal(second.summary.created, 0);
  assert.equal(second.summary.skipped_identical, 7);
  assert.deepEqual(second.entries.map(entry => entry.status), Array(7).fill('skipped_identical'));

  const strictCollision = await runImportBatch(fixture.manifestPath, {
    baseDir: fixture.baseDir,
    commit: true,
    collisionPolicy: 'error'
  });
  assert.equal(strictCollision.success, false);
  assert.equal(strictCollision.errors.every(error => error.code === 'DESTINATION_COLLISION'), true);
});

test('a validation failure blocks the entire batch before any official file changes', async t => {
  const fixture = makeFixture(t);
  const destinations = destinationPaths(fixture);
  fixture.manifest.assets[0].sha256 = '0'.repeat(64);
  fs.writeFileSync(fixture.manifestPath, `${JSON.stringify(fixture.manifest, null, 2)}\n`);

  const report = await runImportBatch(fixture.manifestPath, {
    baseDir: fixture.baseDir,
    commit: true
  });

  assert.equal(report.success, false);
  assert.equal(report.committed, false);
  assert.equal(report.errors.some(error => error.code === 'INVALID_ASSET'), true);
  assert.equal(fs.existsSync(destinations.character), false);
  assert.equal(fs.existsSync(destinations.referenceSet), false);
  assert.equal(destinations.assets.every((asset) => !fs.existsSync(asset)), true);
});

test('an I/O failure during commit rolls back files created earlier in that commit', async t => {
  const fixture = makeFixture(t, { withReferenceSet: false });
  const secondCharacter = characterRecord('import_ally');
  fs.writeFileSync(
    path.join(fixture.batchDir, 'second_character.json'),
    `${JSON.stringify(secondCharacter, null, 2)}\n`
  );
  fixture.manifest.characters.push({ source: 'second_character.json' });
  fs.writeFileSync(fixture.manifestPath, `${JSON.stringify(fixture.manifest, null, 2)}\n`);

  const firstDestination = path.join(
    fixture.baseDir,
    'visual_bible',
    'characters',
    `${fixture.characterId}.json`
  );
  const secondDestination = path.join(
    fixture.baseDir,
    'visual_bible',
    'characters',
    'import_ally.json'
  );

  const originalOpenSync = fs.openSync;
  let exclusiveOpenCount = 0;
  fs.openSync = function injectedOpenFailure(filePath, flags, ...rest) {
    if (flags === 'wx') {
      exclusiveOpenCount += 1;
      if (exclusiveOpenCount === 2) {
        const error = new Error('injected write failure');
        error.code = 'EIO';
        throw error;
      }
    }
    return originalOpenSync.call(fs, filePath, flags, ...rest);
  };

  let report;
  try {
    report = await runImportBatch(fixture.manifestPath, {
      baseDir: fixture.baseDir,
      commit: true
    });
  } finally {
    fs.openSync = originalOpenSync;
  }

  assert.equal(report.success, false);
  assert.equal(report.committed, false);
  assert.equal(report.errors.some(error => error.code === 'COMMIT_FAILED'), true);
  assert.equal(report.summary.rolled_back, 1);
  assert.equal(fs.existsSync(firstDestination), false);
  assert.equal(fs.existsSync(secondDestination), false);
});
