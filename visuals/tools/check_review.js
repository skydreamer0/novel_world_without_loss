#!/usr/bin/env node

// Bounded CH020 pilot. This checks provenance/freshness, never visual quality.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PILOT_PATH = 'visuals/production/reviews/chapter_020_first_realm_bone-r1.json';
// Only this imported snapshot may retain unknown historical human decisions.
const LEGACY_SNAPSHOT = '82491a4d7fc9caa87ddb88e6eca3567b25512a5239646a5c961a96f9070505b4';
const STAGES = ['narrative_review', 'reader_acceptance'];
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const isHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function snapshotHash(record) {
  const { schema_version, record_id, revision, scene_id, request, edit, dependencies, outputs } = record;
  return hash(JSON.stringify(canonical({ schema_version, record_id, revision, scene_id,
    request, edit, dependencies, outputs })));
}

function checkReviewRecord(record, root) {
  const issues = [];
  const reviewReasons = [];
  const decisions = Object.fromEntries(STAGES.map((stage) => [stage, record?.stages?.[stage]?.decision ?? 'unknown']));
  function file(binding, role, output = false) {
    assert.ok(binding && isText(binding.path) && isHash(binding.sha256), `${role}: expected path and sha256`);
    assert.ok(!path.isAbsolute(binding.path) && !binding.path.includes('\\')
      && !binding.path.split('/').some((part) => ['', '.', '..'].includes(part)), `${role}: unsafe path`);
    const target = path.resolve(root, binding.path);
    const realRoot = fs.realpathSync(root);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      issues.push(`${role}: missing file ${binding.path}`);
      reviewReasons.push(`${role}: dependency unavailable`);
      return;
    }
    assert.ok(fs.realpathSync(target).startsWith(`${realRoot}${path.sep}`), `${role}: path leaves repository`);
    if (hash(fs.readFileSync(target)) !== binding.sha256) {
      if (output) issues.push(`${role}: output hash mismatch: ${binding.path}`);
      reviewReasons.push(`${role}: ${output ? 'output changed' : 'dependency changed'}: ${binding.path}`);
    }
  }
  try {
    assert.equal(record.schema_version, 1, 'unsupported review schema');
    assert.ok(isText(record.record_id) && isText(record.scene_id), 'record and scene IDs required');
    assert.ok(Number.isInteger(record.revision) && record.revision > 0, 'positive revision required');
    assert.ok(['legacy_import', 'candidate'].includes(record.kind), 'invalid record kind');
    file(record.request.source, 'request');
    assert.ok(isText(record.request.entry), 'request entry required');
    assert.ok(record.request.exact_edit_prompt === null || isText(record.request.exact_edit_prompt), 'invalid edit prompt');
    assert.ok(record.edit && (record.edit.parent_record_id === null || isText(record.edit.parent_record_id)), 'invalid parent record');
    if (record.edit.parent_asset !== null) file(record.edit.parent_asset, 'parent asset');
    if (record.edit.parent_evidence) file(record.edit.parent_evidence, 'parent evidence');
    if (record.edit.revision_evidence) file(record.edit.revision_evidence, 'revision evidence');
    assert.ok(Array.isArray(record.dependencies) && record.dependencies.length > 0, 'dependencies required');
    for (const role of ['manuscript', 'scene', 'character_profile', 'character_version', 'identity_reference', 'style_reference']) {
      assert.ok(record.dependencies.filter((dep) => dep.role === role).length === 1, `missing ${role} dependency`);
    }
    for (const dep of record.dependencies) file(dep, dep.role);
    file(record.outputs.master, 'master', true);
    file(record.outputs.display, 'display', true);
    assert.notEqual(record.outputs.master.path, record.outputs.display.path, 'master and display must be separate');
    assert.ok(['recorded', 'legacy_evidence'].includes(record.stages.generated), 'generation evidence required');
    assert.ok(['recorded', 'legacy_evidence', 'pending'].includes(record.stages.integrated), 'integration status required');
    if (issues.length === 0 && reviewReasons.length === 0) {
      const dependency = (role) => record.dependencies.find((dep) => dep.role === role);
      const readJson = (role) => JSON.parse(fs.readFileSync(path.join(root, dependency(role).path), 'utf8'));
      const scene = readJson('scene');
      const version = readJson('character_version');
      assert.equal(readJson('character_profile').character_id, version.character_id, 'character profile does not match version');
      assert.equal(scene.scene_id, record.scene_id, 'scene ID does not match review record');
      assert.equal(`visuals/${scene.display_asset.path}`, record.outputs.display.path, 'scene display path does not match output');
      assert.equal(scene.display_asset.sha256, record.outputs.display.sha256, 'scene display hash does not match output');
      assert.ok(scene.character_refs.some((ref) => ref.character_id === version.character_id
        && ref.reference_set_id === version.reference_set_id), 'scene character version does not match dependency');
      const identity = dependency('identity_reference');
      assert.ok(version.references.some((ref) => `visuals/${ref.path}` === identity.path
        && ref.sha256 === identity.sha256), 'identity reference does not belong to character version');
      if (record.stages.integrated !== 'pending') {
        const manuscriptPath = path.join(root, dependency('manuscript').path);
        const manuscript = fs.readFileSync(manuscriptPath, 'utf8');
        const sources = [...manuscript.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
        assert.ok(sources.some((src) => path.resolve(path.dirname(manuscriptPath), src)
          === path.resolve(root, record.outputs.display.path)), 'integrated manuscript does not reference display output');
      }
    }
    for (const stage of STAGES) {
      const review = record.stages[stage] || { decision: 'unknown' };
      decisions[stage] = review.decision;
      assert.ok(['unknown', 'pending', 'approved', 'rejected'].includes(review.decision), `invalid ${stage} decision`);
      if (review.decision === 'approved' || review.decision === 'rejected') {
        assert.ok(isText(review.reviewer) && isText(review.reviewed_at)
          && Number.isFinite(Date.parse(review.reviewed_at)), `${stage}: reviewer and date required`);
        assert.ok(isHash(review.snapshot_sha256), `${stage}: snapshot binding required`);
        file(review.evidence, `${stage} evidence`);
        if (review.snapshot_sha256 !== snapshotHash(record)) {
          reviewReasons.push(`${stage}: decision belongs to another snapshot`);
        }
      }
    }
  } catch (error) {
    issues.push(error.message);
  }
  const snapshot = snapshotHash(record);
  const legacyCompatible = record.kind === 'legacy_import' && snapshot === LEGACY_SNAPSHOT
    && record.stages?.generated === 'legacy_evidence' && record.stages?.integrated === 'legacy_evidence'
    && STAGES.every((stage) => decisions[stage] === 'unknown');
  const approved = STAGES.every((stage) => decisions[stage] === 'approved')
    && record.stages.integrated !== 'pending';
  return {
    record_id: record.record_id,
    snapshot_sha256: snapshot,
    decisions,
    technical_validation: issues.length === 0 ? 'passed' : 'failed',
    freshness: reviewReasons.length ? 'needs_review' : 'current',
    issues: [...issues, ...reviewReasons],
    legacy_compatible: legacyCompatible,
    gate_passed: issues.length === 0 && reviewReasons.length === 0 && (legacyCompatible || approved),
  };
}

function checkPilot(root = path.join(__dirname, '../..')) {
  return checkReviewRecord(JSON.parse(fs.readFileSync(path.join(root, PILOT_PATH), 'utf8')), root);
}

if (require.main === module) {
  try {
    const result = checkPilot();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.gate_passed) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { checkReviewRecord, checkPilot, snapshotHash, PILOT_PATH };
