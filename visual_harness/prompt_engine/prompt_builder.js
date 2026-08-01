const fs = require('fs');
const path = require('path');

class PromptBuilder {
  constructor(baseDir = path.join(__dirname, '..')) {
    this.baseDir = baseDir;
    this.stylePreset = JSON.parse(fs.readFileSync(path.join(baseDir, 'config', 'style_preset.json'), 'utf8'));
    this.generatorConfig = JSON.parse(fs.readFileSync(path.join(baseDir, 'config', 'generator_config.json'), 'utf8'));
  }

  loadVisualBibleItem(category, id) {
    const filePath = path.join(this.baseDir, 'visual_bible', category, `${id}.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Visual Bible item not found: ${category}/${id}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  /**
   * Generates a 3-View Character Turnaround Sheet Prompt (角色全方位立繪 / 三視圖 Prompt)
   */
  buildCharacterSheetPrompt(characterId, targetEngine = 'flux') {
    const charData = this.loadVisualBibleItem('characters', characterId);
    const anchors = charData.prompt_tokens.join(', ');

    const positivePrompt = `Full body character turnaround sheet, ${anchors}, multiple angles, front view, side view, back view, neutral expression, standing pose, clean neutral solid grey background, character design sheet, concept art reference sheet, ${this.stylePreset.base_style_prompt}`;

    return {
      character_id: characterId,
      type: "character_turnaround_sheet",
      engine: targetEngine,
      positive_prompt: positivePrompt,
      negative_prompt: "cropped, bad anatomy, multiple different clothing, busy background, " + this.stylePreset.default_negative_prompt
    };
  }

  /**
   * Generates a Scene Shot Prompt
   */
  buildScenePrompt(shotSpec, targetEngine = 'flux') {
    const {
      character_ids = [],
      item_ids = [],
      location_id = null,
      camera = "cinematic eye-level shot",
      action_description = "",
      mood = "intense cold calculation"
    } = shotSpec;

    let characterTokens = [];
    let itemTokens = [];
    let locationTokens = [];

    character_ids.forEach(charId => {
      try {
        const charData = this.loadVisualBibleItem('characters', charId);
        characterTokens = characterTokens.concat(charData.prompt_tokens);
      } catch (err) {
        console.warn(`[PromptBuilder] Warning: ${err.message}`);
      }
    });

    item_ids.forEach(itemId => {
      try {
        const itemData = this.loadVisualBibleItem('items', itemId);
        itemTokens = itemTokens.concat(itemData.prompt_tokens);
      } catch (err) {
        console.warn(`[PromptBuilder] Warning: ${err.message}`);
      }
    });

    if (location_id) {
      try {
        const locData = this.loadVisualBibleItem('locations', location_id);
        locationTokens = locationTokens.concat(locData.prompt_tokens);
      } catch (err) {
        console.warn(`[PromptBuilder] Warning: ${err.message}`);
      }
    }

    const promptSegments = [
      camera,
      ...characterTokens,
      ...itemTokens,
      action_description,
      mood,
      ...locationTokens,
      this.stylePreset.base_style_prompt
    ].filter(Boolean);

    let positivePrompt = promptSegments.join(', ');

    const lowerPrompt = positivePrompt.toLowerCase();
    const forbiddenMatches = this.stylePreset.forbidden_tokens.filter(token => lowerPrompt.includes(token.toLowerCase()));

    let finalPayload = {
      engine: targetEngine,
      positive_prompt: positivePrompt,
      negative_prompt: this.stylePreset.default_negative_prompt,
      forbidden_warnings: forbiddenMatches
    };

    if (targetEngine === 'midjourney') {
      const mjOpts = this.generatorConfig.engine_settings.midjourney;
      finalPayload.mj_command = `/imagine prompt: ${positivePrompt} ${mjOpts.aspect_ratio} ${mjOpts.stylize} --v ${mjOpts.version}`;
    }

    return finalPayload;
  }
}

module.exports = PromptBuilder;
