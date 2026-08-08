const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const REFERENCE_SET_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*-[a-z0-9]+(?:_[a-z0-9]+)*-v[1-9][0-9]*$/;
const CHARACTER_KEYS = new Set([
  'schema_version',
  'character_id',
  'canonical_name',
  'aliases',
  'role',
  'visual_anchors',
  'forbidden_traits',
  'prompt_tokens',
  'display',
]);
const DISPLAY_KEYS = new Set(['role', 'visual_anchors', 'forbidden_traits']);
const VISUAL_ANCHOR_KEYS = new Set([
  'apparent_age',
  'face_structure',
  'eyes',
  'nose',
  'hair',
  'physique',
  'signature_clothing',
  'signature_item',
  'distinguishing_marks',
]);
const REFERENCE_SET_KEYS = new Set([
  'schema_version',
  'reference_set_id',
  'character_id',
  'version',
  'label',
  'status',
  'is_primary',
  'references',
  'engine_bindings',
]);
const REFERENCE_KEYS = new Set(['role', 'path', 'sha256', 'media_type', 'source']);
const REFERENCE_ROLES = new Set([
  'turnaround',
  'full_body_front',
  'full_body_three_quarter',
  'full_body_profile',
  'full_body_back',
  'face_front',
  'face_three_quarter',
  'profile',
  'full_body',
  'outfit',
  'pose',
  'other',
]);
const REFERENCE_STATUSES = new Set(['draft', 'approved', 'retired']);
const REQUIRED_PRIMARY_FOUR_VIEW_ROLES = [
  'turnaround',
  'full_body_front',
  'full_body_three_quarter',
  'full_body_profile',
  'full_body_back',
];
const DISPLAY_REFERENCE_ROLE_ORDER = [
  'full_body_three_quarter',
  'full_body_front',
  'face_three_quarter',
  'face_front',
  'full_body',
  'outfit',
  'pose',
  'full_body_profile',
  'profile',
  'full_body_back',
  'turnaround',
  'other',
];

class CatalogValidationError extends Error {
  constructor(message, issues) {
    super(message);
    this.name = 'CatalogValidationError';
    this.issues = issues;
  }
}

function issue(source, field, code, message) {
  return { source, field, code, message };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateUnknownKeys(record, allowed, source, field = '') {
  if (!isPlainObject(record)) return [];
  return Object.keys(record)
    .filter((key) => !allowed.has(key))
    .map((key) => issue(source, field ? `${field}.${key}` : key, 'unknown_field', `Unknown field: ${key}`));
}

function validateNonEmptyString(value, source, field, issues) {
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push(issue(source, field, 'invalid_string', `${field} must be a non-empty string`));
  }
}

function validateUniqueStrings(value, source, field, issues, { required = true } = {}) {
  if (!Array.isArray(value)) {
    if (required) issues.push(issue(source, field, 'invalid_array', `${field} must be an array`));
    return;
  }

  const seen = new Set();
  value.forEach((entry, index) => {
    if (typeof entry !== 'string' || entry.trim() === '') {
      issues.push(issue(source, `${field}[${index}]`, 'invalid_string', `${field} entries must be non-empty strings`));
      return;
    }
    if (seen.has(entry)) {
      issues.push(issue(source, `${field}[${index}]`, 'duplicate_value', `Duplicate value: ${entry}`));
    }
    seen.add(entry);
  });
}

function canonicalAssetPath(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Asset path must be a non-empty string');
  }

  const normalized = value.trim().replaceAll('\\', '/');
  if (path.posix.isAbsolute(normalized)) throw new Error('Asset path must be relative');

  const canonical = path.posix.normalize(normalized);
  if (canonical === '.' || canonical.startsWith('../') || canonical.includes('/../')) {
    throw new Error('Asset path cannot leave the visual_harness directory');
  }
  if (!canonical.startsWith('storage/')) {
    throw new Error('Asset path must live under storage/');
  }
  return canonical;
}

function validateCharacterRecord(record, source = 'character') {
  const issues = [];
  if (!isPlainObject(record)) {
    return [issue(source, '', 'invalid_record', 'Character record must be an object')];
  }

  issues.push(...validateUnknownKeys(record, CHARACTER_KEYS, source));
  if (record.schema_version !== 1) {
    issues.push(issue(source, 'schema_version', 'unsupported_schema', 'schema_version must be 1'));
  }
  validateNonEmptyString(record.character_id, source, 'character_id', issues);
  if (typeof record.character_id === 'string' && !ID_PATTERN.test(record.character_id)) {
    issues.push(issue(source, 'character_id', 'invalid_id', 'character_id must use lowercase snake_case'));
  }
  validateNonEmptyString(record.canonical_name, source, 'canonical_name', issues);
  validateNonEmptyString(record.role, source, 'role', issues);
  validateUniqueStrings(record.aliases, source, 'aliases', issues);
  validateUniqueStrings(record.forbidden_traits, source, 'forbidden_traits', issues);
  validateUniqueStrings(record.prompt_tokens, source, 'prompt_tokens', issues);

  if (!isPlainObject(record.visual_anchors)) {
    issues.push(issue(source, 'visual_anchors', 'invalid_object', 'visual_anchors must be an object'));
  } else {
    issues.push(...validateUnknownKeys(record.visual_anchors, VISUAL_ANCHOR_KEYS, source, 'visual_anchors'));
    for (const key of ['face_structure', 'eyes', 'hair', 'signature_clothing']) {
      validateNonEmptyString(record.visual_anchors[key], source, `visual_anchors.${key}`, issues);
    }
    for (const [key, value] of Object.entries(record.visual_anchors)) {
      if (key === 'distinguishing_marks') {
        validateUniqueStrings(value, source, 'visual_anchors.distinguishing_marks', issues);
      } else if (typeof value !== 'string' || value.trim() === '') {
        issues.push(issue(source, `visual_anchors.${key}`, 'invalid_string', `${key} must be a non-empty string`));
      }
    }
  }

  if (record.display !== undefined) {
    if (!isPlainObject(record.display)) {
      issues.push(issue(source, 'display', 'invalid_object', 'display must be an object'));
    } else {
      issues.push(...validateUnknownKeys(record.display, DISPLAY_KEYS, source, 'display'));
      if (record.display.role !== undefined) {
        validateNonEmptyString(record.display.role, source, 'display.role', issues);
      }
      if (record.display.forbidden_traits !== undefined) {
        validateUniqueStrings(record.display.forbidden_traits, source, 'display.forbidden_traits', issues);
      }
      if (record.display.visual_anchors !== undefined) {
        if (!isPlainObject(record.display.visual_anchors)) {
          issues.push(issue(source, 'display.visual_anchors', 'invalid_object', 'display.visual_anchors must be an object'));
        } else {
          issues.push(...validateUnknownKeys(record.display.visual_anchors, VISUAL_ANCHOR_KEYS, source, 'display.visual_anchors'));
          for (const [key, value] of Object.entries(record.display.visual_anchors)) {
            // display translations must not invent anchors the Visual Bible does not define
            if (!isPlainObject(record.visual_anchors) || record.visual_anchors[key] === undefined) {
              issues.push(issue(source, `display.visual_anchors.${key}`, 'unknown_field', `display.visual_anchors.${key} has no matching visual_anchors entry`));
            }
            if (key === 'distinguishing_marks') {
              validateUniqueStrings(value, source, 'display.visual_anchors.distinguishing_marks', issues);
            } else if (typeof value !== 'string' || value.trim() === '') {
              issues.push(issue(source, `display.visual_anchors.${key}`, 'invalid_string', `${key} must be a non-empty string`));
            }
          }
        }
      }
    }
  }

  return issues;
}

function validateReferenceSetRecord(record, source = 'reference_set') {
  const issues = [];
  if (!isPlainObject(record)) {
    return [issue(source, '', 'invalid_record', 'Reference Set record must be an object')];
  }

  issues.push(...validateUnknownKeys(record, REFERENCE_SET_KEYS, source));
  if (record.schema_version !== 1) {
    issues.push(issue(source, 'schema_version', 'unsupported_schema', 'schema_version must be 1'));
  }
  validateNonEmptyString(record.reference_set_id, source, 'reference_set_id', issues);
  if (typeof record.reference_set_id === 'string' && !REFERENCE_SET_ID_PATTERN.test(record.reference_set_id)) {
    issues.push(issue(source, 'reference_set_id', 'invalid_id', 'reference_set_id must end with a positive vN version'));
  }
  validateNonEmptyString(record.character_id, source, 'character_id', issues);
  if (typeof record.character_id === 'string' && !ID_PATTERN.test(record.character_id)) {
    issues.push(issue(source, 'character_id', 'invalid_id', 'character_id must use lowercase snake_case'));
  }
  if (!Number.isInteger(record.version) || record.version < 1) {
    issues.push(issue(source, 'version', 'invalid_version', 'version must be a positive integer'));
  }
  validateNonEmptyString(record.label, source, 'label', issues);
  if (!REFERENCE_STATUSES.has(record.status)) {
    issues.push(issue(source, 'status', 'invalid_status', `status must be one of: ${[...REFERENCE_STATUSES].join(', ')}`));
  }
  if (typeof record.is_primary !== 'boolean') {
    issues.push(issue(source, 'is_primary', 'invalid_boolean', 'is_primary must be a boolean'));
  }
  if (!isPlainObject(record.engine_bindings)) {
    issues.push(issue(source, 'engine_bindings', 'invalid_object', 'engine_bindings must be an object'));
  }

  if (!Array.isArray(record.references) || record.references.length === 0) {
    issues.push(issue(source, 'references', 'invalid_array', 'references must contain at least one asset'));
  } else {
    const rolePaths = new Set();
    record.references.forEach((reference, index) => {
      const prefix = `references[${index}]`;
      if (!isPlainObject(reference)) {
        issues.push(issue(source, prefix, 'invalid_record', 'reference must be an object'));
        return;
      }
      issues.push(...validateUnknownKeys(reference, REFERENCE_KEYS, source, prefix));
      if (!REFERENCE_ROLES.has(reference.role)) {
        issues.push(issue(source, `${prefix}.role`, 'invalid_role', `Unknown reference role: ${reference.role}`));
      }
      try {
        canonicalAssetPath(reference.path);
      } catch (error) {
        issues.push(issue(source, `${prefix}.path`, 'invalid_asset_path', error.message));
      }
      if (typeof reference.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(reference.sha256)) {
        issues.push(issue(source, `${prefix}.sha256`, 'invalid_sha256', 'sha256 must be 64 lowercase hex characters'));
      }
      if (typeof reference.media_type !== 'string' || !/^image\/(png|jpeg|webp)$/.test(reference.media_type)) {
        issues.push(issue(source, `${prefix}.media_type`, 'invalid_media_type', 'media_type must be image/png, image/jpeg, or image/webp'));
      }
      if (reference.source !== undefined && (typeof reference.source !== 'string' || reference.source.trim() === '')) {
        issues.push(issue(source, `${prefix}.source`, 'invalid_string', 'source must be a non-empty string when present'));
      }
      const rolePath = `${reference.role}:${reference.path}`;
      if (rolePaths.has(rolePath)) {
        issues.push(issue(source, prefix, 'duplicate_reference', `Duplicate reference: ${rolePath}`));
      }
      rolePaths.add(rolePath);
    });
  }

  if (
    typeof record.reference_set_id === 'string'
    && Number.isInteger(record.version)
    && !record.reference_set_id.endsWith(`-v${record.version}`)
  ) {
    issues.push(issue(source, 'version', 'version_mismatch', 'version must match the reference_set_id suffix'));
  }

  if (record.status === 'approved' && record.is_primary === true && Array.isArray(record.references)) {
    const roleCounts = new Map();
    record.references.forEach((reference) => {
      if (!isPlainObject(reference) || typeof reference.role !== 'string') return;
      roleCounts.set(reference.role, (roleCounts.get(reference.role) || 0) + 1);
    });

    REQUIRED_PRIMARY_FOUR_VIEW_ROLES.forEach((role) => {
      const count = roleCounts.get(role) || 0;
      if (count !== 1) {
        issues.push(issue(
          source,
          'references',
          'incomplete_primary_turnaround',
          `Approved primary Reference Set requires exactly one ${role} reference`,
        ));
      }
    });

    const requiredReferences = record.references.filter(
      (reference) => isPlainObject(reference) && REQUIRED_PRIMARY_FOUR_VIEW_ROLES.includes(reference.role),
    );
    const requiredPaths = requiredReferences
      .map((reference) => reference.path)
      .filter((assetPath) => typeof assetPath === 'string');
    if (new Set(requiredPaths).size !== requiredPaths.length) {
      issues.push(issue(
        source,
        'references',
        'shared_primary_view_asset',
        'Approved primary four-view roles must point to distinct image assets',
      ));
    }
  }

  return issues;
}

function readJsonDirectory(directory, validateRecord) {
  if (!fs.existsSync(directory)) return { records: [], issues: [] };
  const records = [];
  const issues = [];

  for (const filename of fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort()) {
    const filePath = path.join(directory, filename);
    let record;
    try {
      record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      issues.push(issue(filePath, '', 'invalid_json', error.message));
      continue;
    }
    const recordIssues = validateRecord(record, filePath);
    issues.push(...recordIssues);
    records.push({ record, filePath, filename });
  }
  return { records, issues };
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

class CharacterCatalog {
  constructor(baseDir, characters, referenceSets) {
    this.baseDir = baseDir;
    this._characters = characters;
    this._referenceSets = referenceSets;
    this._characterById = new Map(characters.map((character) => [character.character_id, character]));
    this._referenceSetById = new Map(referenceSets.map((set) => [set.reference_set_id, set]));
    this._nameToId = new Map();

    characters.forEach((character) => {
      [character.canonical_name, ...character.aliases].forEach((name) => {
        this._nameToId.set(name.toLocaleLowerCase('zh-Hant'), character.character_id);
      });
    });
  }

  static load(baseDir = path.join(__dirname, '..'), { validateAssets = true } = {}) {
    const root = path.resolve(baseDir);
    const characterResult = readJsonDirectory(
      path.join(root, 'visual_bible', 'characters'),
      validateCharacterRecord,
    );
    const referenceSetResult = readJsonDirectory(
      path.join(root, 'visual_bible', 'reference_sets'),
      validateReferenceSetRecord,
    );
    const issues = [...characterResult.issues, ...referenceSetResult.issues];
    const characters = characterResult.records.map(({ record }) => record);
    const referenceSets = referenceSetResult.records.map(({ record }) => record);
    const characterById = new Map();
    const referenceSetById = new Map();
    const nameToId = new Map();

    for (const { record, filePath, filename } of characterResult.records) {
      if (filename !== `${record.character_id}.json`) {
        issues.push(issue(filePath, 'character_id', 'filename_mismatch', 'Character filename must match character_id'));
      }
      if (characterById.has(record.character_id)) {
        issues.push(issue(filePath, 'character_id', 'duplicate_id', `Duplicate character_id: ${record.character_id}`));
      }
      characterById.set(record.character_id, record);

      for (const name of [record.canonical_name, ...(record.aliases || [])]) {
        if (typeof name !== 'string') continue;
        const key = name.toLocaleLowerCase('zh-Hant');
        const existing = nameToId.get(key);
        if (existing && existing !== record.character_id) {
          issues.push(issue(filePath, 'aliases', 'duplicate_name', `Name ${name} is already assigned to ${existing}`));
        }
        nameToId.set(key, record.character_id);
      }
    }

    for (const { record, filePath, filename } of referenceSetResult.records) {
      if (filename !== `${record.reference_set_id}.json`) {
        issues.push(issue(filePath, 'reference_set_id', 'filename_mismatch', 'Reference Set filename must match reference_set_id'));
      }
      if (referenceSetById.has(record.reference_set_id)) {
        issues.push(issue(filePath, 'reference_set_id', 'duplicate_id', `Duplicate reference_set_id: ${record.reference_set_id}`));
      }
      referenceSetById.set(record.reference_set_id, record);

      const character = characterById.get(record.character_id);
      if (!character) {
        issues.push(issue(filePath, 'character_id', 'missing_character', `Unknown character_id: ${record.character_id}`));
      }

      if (validateAssets && Array.isArray(record.references)) {
        record.references.forEach((reference, index) => {
          let assetPath;
          try {
            assetPath = path.join(root, canonicalAssetPath(reference.path));
          } catch {
            return;
          }
          if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
            issues.push(issue(filePath, `references[${index}].path`, 'missing_asset', `Asset does not exist: ${reference.path}`));
            return;
          }
          if (typeof reference.sha256 === 'string' && /^[a-f0-9]{64}$/.test(reference.sha256)) {
            const actualHash = sha256File(assetPath);
            if (actualHash !== reference.sha256) {
              issues.push(issue(filePath, `references[${index}].sha256`, 'hash_mismatch', `Expected ${reference.sha256}, received ${actualHash}`));
            }
          }
        });
      }
    }

    for (const { record, filePath } of characterResult.records) {
      const primaryApproved = referenceSets.filter(
        (set) => set.character_id === record.character_id && set.status === 'approved' && set.is_primary,
      );
      if (primaryApproved.length > 1) {
        issues.push(issue(filePath, 'reference_set_ids', 'multiple_primary_sets', 'A character can have only one approved primary Reference Set'));
      }
    }

    if (issues.length > 0) {
      throw new CatalogValidationError(`Character Catalog contains ${issues.length} validation issue(s)`, issues);
    }

    characters.sort((a, b) => a.character_id.localeCompare(b.character_id));
    referenceSets.sort((a, b) => a.reference_set_id.localeCompare(b.reference_set_id));
    return new CharacterCatalog(root, characters, referenceSets);
  }

  listCharacters() {
    return this._characters.map((character) => this._enrichCharacter(character));
  }

  getCharacter(characterId, { required = true } = {}) {
    const character = this._characterById.get(characterId);
    if (!character) {
      if (!required) return null;
      throw new CatalogValidationError(`Unknown character: ${characterId}`, [
        issue('CharacterCatalog', 'character_id', 'unknown_character', `Unknown character: ${characterId}`),
      ]);
    }
    return this._enrichCharacter(character);
  }

  getReferenceSet(referenceSetId, { required = true } = {}) {
    const referenceSet = this._referenceSetById.get(referenceSetId);
    if (!referenceSet) {
      if (!required) return null;
      throw new CatalogValidationError(`Unknown Reference Set: ${referenceSetId}`, [
        issue('CharacterCatalog', 'reference_set_id', 'unknown_reference_set', `Unknown Reference Set: ${referenceSetId}`),
      ]);
    }
    return deepClone(referenceSet);
  }

  resolveCharacterId(nameOrId, { required = true } = {}) {
    if (this._characterById.has(nameOrId)) return nameOrId;
    const key = typeof nameOrId === 'string' ? nameOrId.toLocaleLowerCase('zh-Hant') : '';
    const characterId = this._nameToId.get(key) || null;
    if (!characterId && required) {
      throw new CatalogValidationError(`Unknown character name: ${nameOrId}`, [
        issue('CharacterCatalog', 'name', 'unknown_character_name', `Unknown character name: ${nameOrId}`),
      ]);
    }
    return characterId;
  }

  toSnapshot() {
    return {
      schema_version: 1,
      characters: this.listCharacters(),
    };
  }

  _enrichCharacter(character) {
    const referenceSets = this._referenceSets
      .filter((referenceSet) => referenceSet.character_id === character.character_id)
      .sort((a, b) => b.version - a.version || a.reference_set_id.localeCompare(b.reference_set_id));
    const preferredSet = referenceSets.find((set) => set.status === 'approved' && set.is_primary)
      || referenceSets.find((set) => set.status === 'approved')
      || null;
    const preferredReference = preferredSet
      ? preferredSet.references.find((reference) => reference.role === 'turnaround')
        || preferredSet.references.find((reference) => reference.role === 'full_body')
        || preferredSet.references[0]
      : null;
    // Turnaround sheets are production references (white plate, printed view labels); portraits read
    // far better in the Reader and Dashboard, so surface a separate display-first pick.
    const displayReference = preferredSet
      ? DISPLAY_REFERENCE_ROLE_ORDER.reduce(
        (found, role) => found || preferredSet.references.find((reference) => reference.role === role),
        null,
      ) || preferredSet.references[0]
      : null;

    return deepClone({
      ...character,
      reference_set_ids: referenceSets.map((referenceSet) => referenceSet.reference_set_id),
      reference_sets: referenceSets,
      preferred_reference: preferredReference
        ? { ...preferredReference, reference_set_id: preferredSet.reference_set_id }
        : null,
      display_reference: displayReference
        ? { ...displayReference, reference_set_id: preferredSet.reference_set_id }
        : null,
    });
  }
}

module.exports = {
  CharacterCatalog,
  CatalogValidationError,
  canonicalAssetPath,
  validateCharacterRecord,
  validateReferenceSetRecord,
};
