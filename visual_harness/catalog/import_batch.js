const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  CharacterCatalog,
  CatalogValidationError,
  validateCharacterRecord,
  validateReferenceSetRecord,
  canonicalAssetPath
} = require('./character_catalog');

const IMPORT_SCHEMA_VERSION = 1;
const COLLISION_POLICIES = new Set(['error', 'skip-identical']);
const BATCH_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

class ImportBatchError extends Error {
  constructor(message, report) {
    super(message);
    this.name = 'ImportBatchError';
    this.report = report;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isPlainObject(value)) return value;

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
}

function semanticallyEqual(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function normalizeIssue(issue) {
  if (typeof issue === 'string') return issue;
  if (issue instanceof Error) return issue.message;
  if (isPlainObject(issue)) {
    const location = issue.path || issue.instancePath || issue.field;
    const detail = issue.message || issue.code || JSON.stringify(issue);
    return location ? `${location}: ${detail}` : detail;
  }
  return String(issue);
}

function newReport(manifestPath, baseDir, commit, collisionPolicy) {
  return {
    schema_version: IMPORT_SCHEMA_VERSION,
    batch_id: null,
    manifest: path.resolve(manifestPath),
    base_dir: path.resolve(baseDir),
    mode: commit ? 'commit' : 'dry-run',
    collision_policy: collisionPolicy,
    success: false,
    committed: false,
    catalog_projection: null,
    summary: {
      requested: 0,
      planned: 0,
      created: 0,
      skipped_identical: 0,
      rolled_back: 0,
      errors: 0
    },
    entries: [],
    errors: []
  };
}

function addError(report, code, message, entry = null) {
  const error = { code, message };
  if (entry) {
    error.kind = entry.kind;
    error.index = entry.index;
    error.source = entry.source;
    if (entry.destination) error.destination = entry.destination;
    entry.status = 'error';
    entry.errors.push({ code, message });
  }
  report.errors.push(error);
}

function validateExactKeys(value, allowedKeys, label, report, entry = null) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      addError(report, 'UNKNOWN_PROPERTY', `${label} contains unknown property "${key}"`, entry);
    }
  }
}

function validateManifestStructure(manifest, report) {
  if (!isPlainObject(manifest)) {
    addError(report, 'INVALID_MANIFEST', 'Import batch manifest must be a JSON object');
    return false;
  }

  validateExactKeys(
    manifest,
    new Set(['schema_version', 'batch_id', 'collision_policy', 'characters', 'reference_sets', 'assets']),
    'manifest',
    report
  );

  if (manifest.schema_version !== IMPORT_SCHEMA_VERSION) {
    addError(
      report,
      'UNSUPPORTED_SCHEMA_VERSION',
      `schema_version must be ${IMPORT_SCHEMA_VERSION}`
    );
  }

  if (typeof manifest.batch_id !== 'string' || !BATCH_ID_PATTERN.test(manifest.batch_id)) {
    addError(
      report,
      'INVALID_BATCH_ID',
      'batch_id must start with a lowercase letter or digit and contain only lowercase letters, digits, dot, underscore, or hyphen'
    );
  } else {
    report.batch_id = manifest.batch_id;
  }

  if (
    manifest.collision_policy !== undefined
    && !COLLISION_POLICIES.has(manifest.collision_policy)
  ) {
    addError(
      report,
      'INVALID_COLLISION_POLICY',
      'manifest collision_policy must be error or skip-identical'
    );
  }

  for (const field of ['characters', 'reference_sets', 'assets']) {
    if (!Array.isArray(manifest[field])) {
      addError(report, 'INVALID_ENTRY_LIST', `${field} must be an array`);
    }
  }

  const entryCount = ['characters', 'reference_sets', 'assets']
    .filter(field => Array.isArray(manifest[field]))
    .reduce((count, field) => count + manifest[field].length, 0);

  if (entryCount === 0) {
    addError(report, 'EMPTY_BATCH', 'At least one character, reference set, or asset is required');
  }

  return report.errors.length === 0;
}

function makeEntry(kind, index, raw) {
  return {
    kind,
    index,
    source: isPlainObject(raw) && typeof raw.source === 'string' ? raw.source : null,
    destination: null,
    id: null,
    sha256: null,
    status: 'pending',
    errors: []
  };
}

function resolveSource(manifestDir, source) {
  if (typeof source !== 'string' || source.length === 0) {
    throw new Error('source must be a non-empty relative path');
  }
  if (path.isAbsolute(source)) throw new Error('source must be relative to the manifest directory');

  const manifestRoot = fs.realpathSync(manifestDir);
  const logicalPath = path.resolve(manifestDir, source);
  if (!isPathInside(path.resolve(manifestDir), logicalPath)) {
    throw new Error('source escapes the manifest directory');
  }

  const stat = fs.lstatSync(logicalPath);
  if (stat.isSymbolicLink()) throw new Error('source may not be a symbolic link');
  if (!stat.isFile()) throw new Error('source must be a regular file');

  const realPath = fs.realpathSync(logicalPath);
  if (!isPathInside(manifestRoot, realPath)) {
    throw new Error('source resolves outside the manifest directory');
  }
  return realPath;
}

function assertSafeTarget(baseDir, destination) {
  const root = path.resolve(baseDir);
  const target = path.resolve(root, ...destination.split('/'));
  if (!isPathInside(root, target) || target === root) {
    throw new Error('destination escapes the Visual Harness directory');
  }

  const relativeParts = path.relative(root, target).split(path.sep);
  let cursor = root;
  for (const part of relativeParts.slice(0, -1)) {
    cursor = path.join(cursor, part);
    if (!fs.existsSync(cursor)) continue;
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink()) throw new Error(`destination traverses symbolic link: ${part}`);
    if (!stat.isDirectory()) throw new Error(`destination parent is not a directory: ${part}`);
  }
  return target;
}

function readJsonSource(manifestDir, source) {
  const sourcePath = resolveSource(manifestDir, source);
  const buffer = fs.readFileSync(sourcePath);
  let record;
  try {
    record = JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    throw new Error(`invalid JSON: ${error.message}`);
  }
  return { sourcePath, record, sourceHash: sha256(buffer) };
}

function normalizeValidatorIssues(validator, record, sourceLabel) {
  const issues = validator(record, sourceLabel);
  if (!Array.isArray(issues)) {
    throw new Error(`${sourceLabel} validator returned a non-array result`);
  }
  return issues.map(normalizeIssue);
}

function prepareRecordEntries(manifest, manifestDir, baseDir, report) {
  const plans = [];
  const definitions = [
    {
      field: 'characters',
      kind: 'character',
      idField: 'character_id',
      directory: 'visual_bible/characters',
      validator: validateCharacterRecord
    },
    {
      field: 'reference_sets',
      kind: 'reference_set',
      idField: 'reference_set_id',
      directory: 'visual_bible/reference_sets',
      validator: validateReferenceSetRecord
    }
  ];

  for (const definition of definitions) {
    if (!Array.isArray(manifest[definition.field])) continue;
    manifest[definition.field].forEach((raw, index) => {
      const entry = makeEntry(definition.kind, index, raw);
      report.entries.push(entry);

      if (!isPlainObject(raw)) {
        addError(report, 'INVALID_ENTRY', `${definition.field}[${index}] must be an object`, entry);
        return;
      }
      validateExactKeys(raw, new Set(['source']), `${definition.field}[${index}]`, report, entry);

      try {
        const { sourcePath, record, sourceHash } = readJsonSource(manifestDir, raw.source);
        const issues = normalizeValidatorIssues(definition.validator, record, sourcePath);
        if (issues.length > 0) {
          for (const issue of issues) addError(report, 'INVALID_RECORD', issue, entry);
          return;
        }

        const id = record[definition.idField];
        const destination = `${definition.directory}/${id}.json`;
        entry.id = id;
        entry.destination = destination;
        entry.sha256 = sourceHash;

        const targetPath = assertSafeTarget(baseDir, destination);
        const outputBuffer = Buffer.from(`${JSON.stringify(record, null, 2)}\n`, 'utf8');
        plans.push({
          entry,
          kind: definition.kind,
          destination,
          targetPath,
          outputBuffer,
          record,
          semantic: true
        });
      } catch (error) {
        addError(report, 'INVALID_SOURCE', error.message, entry);
      }
    });
  }

  return plans;
}

function prepareAssetEntries(manifest, manifestDir, baseDir, report) {
  const plans = [];
  if (!Array.isArray(manifest.assets)) return plans;

  manifest.assets.forEach((raw, index) => {
    const entry = makeEntry('asset', index, raw);
    report.entries.push(entry);

    if (!isPlainObject(raw)) {
      addError(report, 'INVALID_ENTRY', `assets[${index}] must be an object`, entry);
      return;
    }
    validateExactKeys(raw, new Set(['source', 'destination', 'sha256']), `assets[${index}]`, report, entry);

    try {
      if (typeof raw.destination !== 'string' || raw.destination.length === 0) {
        throw new Error('destination must be a non-empty string');
      }
      if (raw.sha256 !== undefined && (typeof raw.sha256 !== 'string' || !SHA256_PATTERN.test(raw.sha256))) {
        throw new Error('sha256 must be 64 lowercase hexadecimal characters');
      }

      const sourcePath = resolveSource(manifestDir, raw.source);
      const outputBuffer = fs.readFileSync(sourcePath);
      const actualHash = sha256(outputBuffer);
      if (raw.sha256 !== undefined && actualHash !== raw.sha256) {
        throw new Error(`sha256 mismatch: expected ${raw.sha256}, got ${actualHash}`);
      }

      const destination = canonicalAssetPath(raw.destination);
      const targetPath = assertSafeTarget(baseDir, destination);
      entry.destination = destination;
      entry.sha256 = actualHash;
      plans.push({
        entry,
        kind: 'asset',
        destination,
        targetPath,
        outputBuffer,
        record: null,
        semantic: false
      });
    } catch (error) {
      addError(report, 'INVALID_ASSET', error.message, entry);
    }
  });

  return plans;
}

function markDuplicateDestinations(plans, report) {
  const byDestination = new Map();
  for (const plan of plans) {
    if (plan.entry.status === 'error') continue;
    const earlier = byDestination.get(plan.destination);
    if (!earlier) {
      byDestination.set(plan.destination, plan);
      continue;
    }
    addError(report, 'DUPLICATE_DESTINATION', `destination is also used by ${earlier.entry.kind}[${earlier.entry.index}]`, plan.entry);
    addError(report, 'DUPLICATE_DESTINATION', `destination is also used by ${plan.entry.kind}[${plan.entry.index}]`, earlier.entry);
  }
}

function existingContentIsIdentical(plan) {
  const stat = fs.lstatSync(plan.targetPath);
  if (stat.isSymbolicLink() || !stat.isFile()) return false;
  const existing = fs.readFileSync(plan.targetPath);
  if (!plan.semantic) return existing.equals(plan.outputBuffer);

  try {
    return semanticallyEqual(JSON.parse(existing.toString('utf8')), plan.record);
  } catch (_error) {
    return false;
  }
}

function applyCollisionPolicy(plans, collisionPolicy, report) {
  for (const plan of plans) {
    if (plan.entry.status === 'error') continue;
    if (!fs.existsSync(plan.targetPath)) {
      plan.entry.status = 'planned';
      continue;
    }

    let identical = false;
    try {
      identical = existingContentIsIdentical(plan);
    } catch (error) {
      addError(report, 'DESTINATION_CHECK_FAILED', error.message, plan.entry);
      continue;
    }

    if (collisionPolicy === 'skip-identical' && identical) {
      plan.entry.status = 'skipped_identical';
      continue;
    }

    addError(
      report,
      'DESTINATION_COLLISION',
      identical
        ? 'destination already contains identical content and collision policy is error'
        : 'destination already exists with different content',
      plan.entry
    );
  }
}

function collectRecordAssetReferences(plan, report) {
  const references = [];
  const record = plan.record;

  if (typeof record.anchor_image === 'string' && record.anchor_image.length > 0) {
    references.push({ path: record.anchor_image, sha256: null, field: 'anchor_image' });
  }
  if (Array.isArray(record.references)) {
    record.references.forEach((reference, index) => {
      if (!isPlainObject(reference) || typeof reference.path !== 'string' || reference.path.length === 0) return;
      references.push({
        path: reference.path,
        sha256: typeof reference.sha256 === 'string' ? reference.sha256 : null,
        field: `references[${index}].path`
      });
    });
  }

  return references.map(reference => {
    try {
      return { ...reference, path: canonicalAssetPath(reference.path) };
    } catch (error) {
      addError(report, 'INVALID_ASSET_REFERENCE', `${reference.field}: ${error.message}`, plan.entry);
      return null;
    }
  }).filter(Boolean);
}

function verifySemanticLinks(plans, baseDir, report) {
  const usablePlans = plans.filter(plan => plan.entry.status !== 'error');
  const assetPlans = new Map(
    usablePlans.filter(plan => plan.kind === 'asset').map(plan => [plan.destination, plan])
  );
  const incomingCharacters = new Map(
    usablePlans
      .filter(plan => plan.kind === 'character')
      .map(plan => [plan.record.character_id, plan])
  );
  function readExistingRecord(destination) {
    const targetPath = assertSafeTarget(baseDir, destination);
    if (!fs.existsSync(targetPath) || !fs.lstatSync(targetPath).isFile()) return null;
    return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  }

  function resolveCharacter(characterId) {
    const incoming = incomingCharacters.get(characterId);
    if (incoming) return incoming.record;
    return readExistingRecord(`visual_bible/characters/${characterId}.json`);
  }

  for (const plan of usablePlans) {
    if (plan.kind === 'reference_set' && typeof plan.record.character_id === 'string') {
      let character = null;
      try {
        character = resolveCharacter(plan.record.character_id);
      } catch (error) {
        addError(report, 'INVALID_LINKED_CHARACTER', error.message, plan.entry);
      }
      if (!character) {
        addError(
          report,
          'UNKNOWN_CHARACTER',
          `reference set refers to unknown character_id "${plan.record.character_id}"`,
          plan.entry
        );
      }
    }

    if (plan.kind !== 'character' && plan.kind !== 'reference_set') continue;
    for (const reference of collectRecordAssetReferences(plan, report)) {
      const assetPlan = assetPlans.get(reference.path);
      let actualHash = null;
      if (assetPlan && assetPlan.entry.status !== 'error') {
        actualHash = assetPlan.entry.sha256;
      } else {
        let targetPath;
        try {
          targetPath = assertSafeTarget(baseDir, reference.path);
        } catch (error) {
          addError(report, 'INVALID_ASSET_REFERENCE', `${reference.field}: ${error.message}`, plan.entry);
          continue;
        }
        if (!fs.existsSync(targetPath) || !fs.lstatSync(targetPath).isFile()) {
          addError(report, 'MISSING_ASSET', `${reference.field} does not resolve to an imported or existing file`, plan.entry);
          continue;
        }
        actualHash = sha256(fs.readFileSync(targetPath));
      }

      if (reference.sha256 && reference.sha256 !== actualHash) {
        addError(
          report,
          'ASSET_REFERENCE_HASH_MISMATCH',
          `${reference.field} expects ${reference.sha256}, got ${actualHash}`,
          plan.entry
        );
      }
    }
  }
}

function validateCombinedCatalogSemantics(plans, baselineSnapshot, report) {
  const incomingCharacters = plans.filter(
    plan => plan.kind === 'character' && plan.entry.status !== 'error'
  );
  const incomingReferenceSets = plans.filter(
    plan => plan.kind === 'reference_set' && plan.entry.status !== 'error'
  );
  const names = new Map();

  for (const character of baselineSnapshot.characters || []) {
    for (const name of [character.canonical_name, ...(character.aliases || [])]) {
      if (typeof name === 'string') names.set(name.toLocaleLowerCase('zh-Hant'), character.character_id);
    }
  }

  for (const plan of incomingCharacters) {
    for (const name of [plan.record.canonical_name, ...(plan.record.aliases || [])]) {
      if (typeof name !== 'string') continue;
      const key = name.toLocaleLowerCase('zh-Hant');
      const owner = names.get(key);
      if (owner && owner !== plan.record.character_id) {
        addError(
          report,
          'DUPLICATE_CHARACTER_NAME',
          `name "${name}" is already assigned to character "${owner}"`,
          plan.entry
        );
      } else {
        names.set(key, plan.record.character_id);
      }
    }
  }

  const setsByCharacter = new Map();
  for (const character of baselineSnapshot.characters || []) {
    const setMap = new Map();
    for (const referenceSet of character.reference_sets || []) {
      setMap.set(referenceSet.reference_set_id, referenceSet);
    }
    setsByCharacter.set(character.character_id, setMap);
  }
  for (const plan of incomingReferenceSets) {
    const setMap = setsByCharacter.get(plan.record.character_id) || new Map();
    setMap.set(plan.record.reference_set_id, plan.record);
    setsByCharacter.set(plan.record.character_id, setMap);
  }

  for (const [characterId, setMap] of setsByCharacter) {
    const primaryApproved = [...setMap.values()].filter(
      referenceSet => referenceSet.status === 'approved' && referenceSet.is_primary
    );
    if (primaryApproved.length <= 1) continue;
    for (const plan of incomingReferenceSets) {
      if (
        plan.record.character_id === characterId
        && primaryApproved.some(set => set.reference_set_id === plan.record.reference_set_id)
      ) {
        addError(
          report,
          'MULTIPLE_PRIMARY_REFERENCE_SETS',
          `character "${characterId}" would have multiple approved primary reference sets`,
          plan.entry
        );
      }
    }
  }
}

function updateSummary(report) {
  report.summary.requested = report.entries.length;
  report.summary.planned = report.entries.filter(entry => entry.status === 'planned').length;
  report.summary.created = report.entries.filter(entry => entry.status === 'created').length;
  report.summary.skipped_identical = report.entries.filter(entry => entry.status === 'skipped_identical').length;
  report.summary.rolled_back = report.entries.filter(entry => entry.status === 'rolled_back').length;
  report.summary.errors = report.errors.length;
}

function ensureParentDirectories(targetPath, baseDir, createdDirectories) {
  const root = path.resolve(baseDir);
  const parent = path.dirname(targetPath);
  const relative = path.relative(root, parent);
  if (!relative) return;

  let cursor = root;
  for (const part of relative.split(path.sep)) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor)) {
      const stat = fs.lstatSync(cursor);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new Error(`cannot create destination through non-directory ${cursor}`);
      }
      continue;
    }
    fs.mkdirSync(cursor);
    createdDirectories.push(cursor);
  }
}

function writeExclusive(plan, baseDir, createdFiles, createdDirectories) {
  ensureParentDirectories(plan.targetPath, baseDir, createdDirectories);
  const descriptor = fs.openSync(plan.targetPath, 'wx');
  createdFiles.push(plan.targetPath);
  try {
    fs.writeFileSync(descriptor, plan.outputBuffer);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function rollback(createdFiles, createdDirectories) {
  const rollbackErrors = [];
  for (const filePath of [...createdFiles].reverse()) {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
      rollbackErrors.push(`failed to remove ${filePath}: ${error.message}`);
    }
  }
  for (const directory of [...createdDirectories].reverse()) {
    try {
      if (fs.existsSync(directory)) fs.rmdirSync(directory);
    } catch (error) {
      if (error.code !== 'ENOTEMPTY') rollbackErrors.push(`failed to remove ${directory}: ${error.message}`);
    }
  }
  return rollbackErrors;
}

function parseManifest(manifestPath) {
  const resolved = path.resolve(manifestPath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error('manifest must be a regular file and may not be a symbolic link');
  }
  try {
    return { resolved, manifest: JSON.parse(fs.readFileSync(resolved, 'utf8')) };
  } catch (error) {
    throw new Error(`unable to parse manifest JSON: ${error.message}`);
  }
}

async function runImportBatch(manifestPath, options = {}) {
  const baseDir = path.resolve(options.baseDir || path.join(__dirname, '..'));
  const commit = options.commit === true;
  let collisionPolicy = options.collisionPolicy || 'skip-identical';
  let parsed;

  const initialReport = newReport(manifestPath, baseDir, commit, collisionPolicy);
  try {
    parsed = parseManifest(manifestPath);
  } catch (error) {
    addError(initialReport, 'INVALID_MANIFEST', error.message);
    updateSummary(initialReport);
    return initialReport;
  }

  const { resolved, manifest } = parsed;
  if (!options.collisionPolicy && isPlainObject(manifest) && manifest.collision_policy) {
    collisionPolicy = manifest.collision_policy;
  }
  const report = newReport(resolved, baseDir, commit, collisionPolicy);

  if (options.collisionPolicy && !COLLISION_POLICIES.has(options.collisionPolicy)) {
    addError(report, 'INVALID_COLLISION_POLICY', 'option collisionPolicy must be error or skip-identical');
  }
  validateManifestStructure(manifest, report);
  if (!isPlainObject(manifest)) {
    updateSummary(report);
    return report;
  }

  const manifestDir = path.dirname(resolved);
  const plans = [
    ...prepareRecordEntries(manifest, manifestDir, baseDir, report),
    ...prepareAssetEntries(manifest, manifestDir, baseDir, report)
  ];
  markDuplicateDestinations(plans, report);
  if (COLLISION_POLICIES.has(collisionPolicy)) applyCollisionPolicy(plans, collisionPolicy, report);

  let baselineSnapshot = { schema_version: 1, characters: [] };
  try {
    baselineSnapshot = CharacterCatalog.load(baseDir, { validateAssets: true }).toSnapshot();
  } catch (error) {
    if (error instanceof CatalogValidationError && Array.isArray(error.issues)) {
      for (const issue of error.issues) {
        addError(report, 'BASE_CATALOG_INVALID', normalizeIssue(issue));
      }
    } else {
      addError(report, 'BASE_CATALOG_INVALID', error.message);
    }
  }

  verifySemanticLinks(plans, baseDir, report);
  validateCombinedCatalogSemantics(plans, baselineSnapshot, report);

  if (report.errors.length > 0) {
    for (const entry of report.entries) {
      if (entry.status === 'pending' || entry.status === 'planned') entry.status = 'blocked_by_batch_error';
    }
    updateSummary(report);
    return report;
  }

  if (!commit) {
    report.success = true;
    updateSummary(report);
    return report;
  }

  const createdFiles = [];
  const createdDirectories = [];
  const createdPlans = [];
  try {
    for (const plan of plans) {
      if (plan.entry.status !== 'planned') continue;
      writeExclusive(plan, baseDir, createdFiles, createdDirectories);
      createdPlans.push(plan);
      plan.entry.status = 'created';
    }

    const catalog = await CharacterCatalog.load(baseDir, { validateAssets: true });
    await catalog.toSnapshot();
    const { buildCharacterCatalog } = require('../scripts/build_character_catalog');
    const projection = buildCharacterCatalog(baseDir);
    report.catalog_projection = {
      character_count: projection.character_count,
      json_path: projection.json_path,
      browser_path: projection.browser_path
    };

    report.success = true;
    report.committed = true;
  } catch (error) {
    const rollbackErrors = rollback(createdFiles, createdDirectories);
    for (const plan of createdPlans) plan.entry.status = 'rolled_back';
    for (const entry of report.entries) {
      if (entry.status === 'planned') entry.status = 'blocked_by_commit_error';
    }

    const details = error instanceof CatalogValidationError && Array.isArray(error.issues)
      ? error.issues.map(normalizeIssue).join('; ')
      : error.message;
    addError(report, 'COMMIT_FAILED', details || 'commit failed');
    try {
      const { buildCharacterCatalog } = require('../scripts/build_character_catalog');
      buildCharacterCatalog(baseDir);
    } catch (projectionError) {
      addError(report, 'PROJECTION_RESTORE_FAILED', projectionError.message);
    }
    for (const rollbackError of rollbackErrors) addError(report, 'ROLLBACK_FAILED', rollbackError);
  }

  updateSummary(report);
  return report;
}

module.exports = {
  IMPORT_SCHEMA_VERSION,
  COLLISION_POLICIES,
  ImportBatchError,
  runImportBatch,
  semanticallyEqual,
  sha256
};
