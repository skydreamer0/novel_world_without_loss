const fs = require('fs');
const path = require('path');
const {
  CharacterCatalog,
  CatalogValidationError,
} = require('../catalog/character_catalog');

class PromptBuilder {
  constructor(baseDir = path.join(__dirname, '..')) {
    this.baseDir = path.resolve(baseDir);
    this.stylePreset = JSON.parse(fs.readFileSync(path.join(this.baseDir, 'config', 'style_preset.json'), 'utf8'));
    this.generatorConfig = JSON.parse(fs.readFileSync(path.join(this.baseDir, 'config', 'generator_config.json'), 'utf8'));
    this.catalog = CharacterCatalog.load(this.baseDir, { validateAssets: true });
  }

  loadVisualBibleItem(category, id) {
    if (category === 'characters') return this.catalog.getCharacter(id);

    const filePath = path.join(this.baseDir, 'visual_bible', category, `${id}.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Visual Bible item not found: ${category}/${id}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  buildCharacterSheetPrompt(characterId, targetEngine = 'flux', options = {}) {
    const character = this.catalog.getCharacter(characterId);
    const referenceSet = this._selectReferenceSet(character, options.reference_set_id);
    const anchors = character.prompt_tokens.join(', ');
    const positivePrompt = `Production four-view full-body character turnaround sheet, ${anchors}, exactly the same identity and costume in direct front view, three-quarter view, exact side profile, and exact back view, identical scale and floor line, neutral expression, standing pose, clean neutral solid grey background, no text or scenery, character design reference sheet, ${this.stylePreset.base_style_prompt}`;
    const negativeTokens = [
      'cropped',
      'bad anatomy',
      'multiple different clothing',
      'busy background',
      ...character.forbidden_traits,
      this.stylePreset.default_negative_prompt,
    ];

    return {
      schema_version: 1,
      type: 'character_turnaround_prompt_package',
      engine: targetEngine,
      character_id: character.character_id,
      reference_set_id: referenceSet?.reference_set_id || null,
      reference_set_version: referenceSet?.version || null,
      references: referenceSet?.references || [],
      required_anchor_tokens: [...character.prompt_tokens],
      positive_prompt: positivePrompt,
      negative_prompt: [...new Set(negativeTokens.filter(Boolean))].join(', '),
      catalog_warnings: referenceSet ? [] : [`${character.character_id} has no approved Reference Set`],
    };
  }

  buildScenePrompt(shotSpec, targetEngine = 'flux') {
    if (!shotSpec || typeof shotSpec !== 'object' || Array.isArray(shotSpec)) {
      throw new TypeError('Scene Spec must be an object');
    }

    const {
      character_ids = [],
      character_refs = null,
      item_ids = [],
      location_id = null,
      camera = 'cinematic eye-level shot',
      action_description = '',
      mood = 'intense cold calculation',
    } = shotSpec;
    const requestedCharacters = character_refs === null
      ? character_ids.map((characterId) => ({ character_id: characterId }))
      : character_refs;

    if (!Array.isArray(requestedCharacters) || !Array.isArray(item_ids)) {
      throw new TypeError('character_refs/character_ids and item_ids must be arrays');
    }

    const characterTokens = [];
    const itemTokens = [];
    const locationTokens = [];
    const requiredAnchorTokens = [];
    const characterLineage = [];
    const catalogWarnings = [];
    const characterForbiddenTraits = [];

    requestedCharacters.forEach((requested, index) => {
      if (!requested || typeof requested.character_id !== 'string') {
        throw new CatalogValidationError(`Invalid character reference at index ${index}`, [{
          source: 'Scene Spec',
          field: `character_refs[${index}]`,
          code: 'invalid_character_reference',
          message: 'Each character reference requires character_id',
        }]);
      }
      const character = this.catalog.getCharacter(requested.character_id);
      const referenceSet = this._selectReferenceSet(character, requested.reference_set_id);
      characterTokens.push(...character.prompt_tokens);
      requiredAnchorTokens.push(...character.prompt_tokens);
      characterForbiddenTraits.push(...character.forbidden_traits);
      characterLineage.push({
        character_id: character.character_id,
        reference_set_id: referenceSet?.reference_set_id || null,
        reference_set_version: referenceSet?.version || null,
        reference_status: referenceSet?.status || null,
        references: referenceSet?.references || [],
      });
      if (!referenceSet) catalogWarnings.push(`${character.character_id} has no approved Reference Set`);
    });

    item_ids.forEach((itemId) => {
      const item = this.loadVisualBibleItem('items', itemId);
      itemTokens.push(...item.prompt_tokens);
      requiredAnchorTokens.push(...item.prompt_tokens);
    });

    if (location_id) {
      const location = this.loadVisualBibleItem('locations', location_id);
      locationTokens.push(...location.prompt_tokens);
      requiredAnchorTokens.push(...location.prompt_tokens);
    }

    const promptSegments = [
      camera,
      ...characterTokens,
      ...itemTokens,
      action_description,
      mood,
      ...locationTokens,
      this.stylePreset.base_style_prompt,
    ].filter(Boolean);
    const positivePrompt = promptSegments.join(', ');
    const lowerPrompt = positivePrompt.toLowerCase();
    const forbiddenMatches = this.stylePreset.forbidden_tokens.filter(
      (token) => lowerPrompt.includes(token.toLowerCase()),
    );
    const negativePrompt = [
      this.stylePreset.default_negative_prompt,
      ...characterForbiddenTraits,
    ].filter(Boolean).join(', ');

    const finalPayload = {
      schema_version: 1,
      type: 'scene_prompt_package',
      engine: targetEngine,
      character_lineage: characterLineage,
      item_ids: [...item_ids],
      location_id,
      required_anchor_tokens: [...new Set(requiredAnchorTokens)],
      positive_prompt: positivePrompt,
      negative_prompt: negativePrompt,
      forbidden_warnings: forbiddenMatches,
      catalog_warnings: catalogWarnings,
    };

    if (targetEngine === 'midjourney') {
      const options = this.generatorConfig.engine_settings.midjourney;
      finalPayload.mj_command = `/imagine prompt: ${positivePrompt} ${options.aspect_ratio} ${options.stylize} --v ${options.version}`;
    }

    return finalPayload;
  }

  _selectReferenceSet(character, requestedReferenceSetId) {
    if (requestedReferenceSetId) {
      const referenceSet = this.catalog.getReferenceSet(requestedReferenceSetId);
      if (referenceSet.character_id !== character.character_id) {
        throw new CatalogValidationError(
          `Reference Set ${requestedReferenceSetId} does not belong to ${character.character_id}`,
          [{
            source: 'PromptBuilder',
            field: 'reference_set_id',
            code: 'reference_set_owner_mismatch',
            message: `${requestedReferenceSetId} belongs to ${referenceSet.character_id}`,
          }],
        );
      }
      if (referenceSet.status !== 'approved') {
        throw new CatalogValidationError(
          `Reference Set ${requestedReferenceSetId} is not approved`,
          [{
            source: 'PromptBuilder',
            field: 'reference_set_id',
            code: 'reference_set_not_approved',
            message: `${requestedReferenceSetId} has status ${referenceSet.status}`,
          }],
        );
      }
      return referenceSet;
    }

    return character.reference_sets.find((set) => set.status === 'approved' && set.is_primary)
      || character.reference_sets.find((set) => set.status === 'approved')
      || null;
  }
}

module.exports = PromptBuilder;
