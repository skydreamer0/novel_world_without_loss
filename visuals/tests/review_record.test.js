const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { checkReviewRecord, checkPilot, snapshotHash, PILOT_PATH } = require('../tools/check_review');

const ROOT = path.join(__dirname, '../..');
const readPilot = () => JSON.parse(fs.readFileSync(path.join(ROOT, PILOT_PATH), 'utf8'));
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wwl-review-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const record = readPilot();
  const bindings = [record.request.source, record.edit.parent_evidence, record.edit.revision_evidence,
    ...record.dependencies, ...Object.values(record.outputs)];
  for (const binding of bindings) {
    const target = path.join(root, binding.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(ROOT, binding.path), target);
  }
  return { root, record };
}
function approveFixture(root, record) {
  // Synthetic fixture only, never a historical or real human approval.
  const evidence = 'Synthetic approval evidence for automated tests only.\n';
  fs.writeFileSync(path.join(root, 'test-review.txt'), evidence);
  for (const stage of ['narrative_review', 'reader_acceptance']) {
    record.stages[stage] = { decision: 'approved', reviewer: 'test fixture',
      reviewed_at: '2026-10-01T00:00:00Z', snapshot_sha256: snapshotHash(record),
      evidence: { path: 'test-review.txt', sha256: hash(evidence) } };
  }
}

test('existing CH020 bytes pass only the explicit legacy compatibility case', () => {
  const result = checkPilot(ROOT);
  assert.equal(result.gate_passed, true);
  assert.equal(result.technical_validation, 'passed');
  assert.equal(result.freshness, 'current');
  assert.equal(result.legacy_compatible, true);
  assert.deepEqual(result.decisions, { narrative_review: 'unknown', reader_acceptance: 'unknown' });
  assert.equal(readPilot().request.exact_edit_prompt, null);
  assert.equal(readPilot().edit.parent_asset, null);
});

test('missing historical decisions do not become human approvals', () => {
  const record = readPilot();
  delete record.stages.narrative_review;
  delete record.stages.reader_acceptance;
  assert.equal(checkReviewRecord(record, ROOT).decisions.narrative_review, 'unknown');
  record.kind = 'candidate';
  const result = checkReviewRecord(record, ROOT);
  assert.equal(result.legacy_compatible, false);
  assert.equal(result.gate_passed, false);
});

for (const output of ['master', 'display']) {
  test(`changed ${output} fails even for the allowlisted legacy snapshot`, (t) => {
    const { root, record } = fixture(t);
    fs.appendFileSync(path.join(root, record.outputs[output].path), 'changed');
    const result = checkReviewRecord(record, root);
    assert.equal(result.technical_validation, 'failed');
    assert.equal(result.freshness, 'needs_review');
    assert.equal(result.gate_passed, false);
    assert.match(result.issues.join('\n'), /output hash mismatch/);
  });
}

test('missing output fails closed without changing the record', (t) => {
  const { root, record } = fixture(t);
  fs.unlinkSync(path.join(root, record.outputs.master.path));
  const result = checkReviewRecord(record, root);
  assert.equal(result.technical_validation, 'failed');
  assert.equal(result.gate_passed, false);
});

for (const role of ['manuscript', 'identity_reference', 'style_reference', 'character_version', 'character_profile']) {
  test(`changed ${role} requires review without erasing the earlier decision`, (t) => {
    const { root, record } = fixture(t);
    record.kind = 'candidate';
    approveFixture(root, record);
    fs.appendFileSync(path.join(root, record.dependencies.find((dep) => dep.role === role).path), 'changed');
    const result = checkReviewRecord(record, root);
    assert.equal(result.technical_validation, 'passed');
    assert.equal(result.freshness, 'needs_review');
    assert.equal(result.decisions.narrative_review, 'approved');
    assert.equal(result.gate_passed, false);
  });
}

test('a changed request requires review', (t) => {
  const { root, record } = fixture(t);
  fs.appendFileSync(path.join(root, record.request.source.path), 'changed');
  assert.equal(checkReviewRecord(record, root).freshness, 'needs_review');
  assert.equal(checkReviewRecord(record, root).gate_passed, false);
});

test('a CH020 candidate needs two attributed, exact-snapshot human decisions', (t) => {
  const { root, record } = fixture(t);
  record.kind = 'candidate';
  record.record_id = 'chapter_020_first_realm_bone-r2';
  record.revision = 2;
  record.edit.parent_record_id = readPilot().record_id;
  record.edit.parent_asset = { ...record.outputs.master };
  assert.equal(checkReviewRecord(record, root).gate_passed, false);
  approveFixture(root, record);
  assert.equal(checkReviewRecord(record, root).gate_passed, true);
  delete record.stages.narrative_review.reviewer;
  assert.equal(checkReviewRecord(record, root).gate_passed, false);
});

test('updating output hashes cannot reuse an approval for the old output', (t) => {
  const { root, record } = fixture(t);
  record.kind = 'candidate';
  approveFixture(root, record);
  fs.appendFileSync(path.join(root, record.outputs.display.path), 'changed');
  record.outputs.display.sha256 = hash(fs.readFileSync(path.join(root, record.outputs.display.path)));
  const sceneDependency = record.dependencies.find((dep) => dep.role === 'scene');
  const scenePath = path.join(root, sceneDependency.path);
  const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
  scene.display_asset.sha256 = record.outputs.display.sha256;
  fs.writeFileSync(scenePath, JSON.stringify(scene));
  sceneDependency.sha256 = hash(fs.readFileSync(scenePath));
  const result = checkReviewRecord(record, root);
  assert.equal(result.technical_validation, 'passed');
  assert.equal(result.freshness, 'needs_review');
  assert.equal(result.gate_passed, false);
});

test('changing a legacy binding cannot expand the compatibility exception', () => {
  const record = readPilot();
  record.request.exact_edit_prompt = 'new request';
  assert.equal(checkReviewRecord(record, ROOT).legacy_compatible, false);
  assert.equal(checkReviewRecord(record, ROOT).gate_passed, false);
});

test('unsafe dependencies fail closed', () => {
  const record = readPilot();
  record.dependencies[0].path = '../outside.md';
  assert.equal(checkReviewRecord(record, ROOT).technical_validation, 'failed');
  assert.equal(checkReviewRecord(record, ROOT).gate_passed, false);
});


test('approved output must be the exact display selected by the scene', (t) => {
  const { root, record } = fixture(t);
  record.kind = 'candidate';
  record.outputs.display = { ...record.dependencies.find((dep) => dep.role === 'style_reference') };
  approveFixture(root, record);
  const result = checkReviewRecord(record, root);
  assert.equal(result.gate_passed, false);
  assert.match(result.issues.join('\n'), /scene display path/);
});

test('newer records cannot claim integration before the manuscript uses the output', (t) => {
  const { root, record } = fixture(t);
  record.kind = 'candidate';
  const manuscript = record.dependencies.find((dep) => dep.role === 'manuscript');
  fs.writeFileSync(path.join(root, manuscript.path), 'No integrated illustration.');
  manuscript.sha256 = hash('No integrated illustration.');
  approveFixture(root, record);
  const result = checkReviewRecord(record, root);
  assert.equal(result.gate_passed, false);
  assert.match(result.issues.join('\n'), /manuscript does not reference/);
});

for (const decision of ['pending', 'rejected']) {
  test(`${decision} decision prevents approval even with current valid files`, (t) => {
    const { root, record } = fixture(t);
    record.kind = 'candidate';
    approveFixture(root, record);
    record.stages.narrative_review.decision = decision;
    const result = checkReviewRecord(record, root);
    assert.equal(result.technical_validation, 'passed');
    assert.equal(result.decisions.narrative_review, decision);
    assert.equal(result.gate_passed, false);
  });
}

for (const kind of ['legacy_import', 'candidate']) {
  test(`${kind} with pending integration cannot pass the gate`, (t) => {
    const { root, record } = fixture(t);
    record.kind = kind;
    if (kind === 'candidate') approveFixture(root, record);
    record.stages.integrated = 'pending';
    const result = checkReviewRecord(record, root);
    assert.equal(result.gate_passed, false);
    assert.equal(result.legacy_compatible, false);
  });
}
