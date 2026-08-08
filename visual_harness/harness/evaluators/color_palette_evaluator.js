/**
 * Evaluates whether prompt or metadata color palette aligns with
 * the novel's Xianxia Dark Shadow tone settings.
 */
class ColorPaletteEvaluator {
  static evaluatePalette(colorsHex = [], targetPaletteHex = ["#0d1117", "#161b22", "#00f2fe", "#4facfe"]) {
    if (!Array.isArray(colorsHex) || colorsHex.length === 0) {
      return {
        score: null,
        passed: null,
        assessable: false,
        target_palette: targetPaletteHex,
        notes: "No image palette supplied; image-level assessment was not run."
      };
    }

    const normalizedTarget = new Set(targetPaletteHex.map(color => color.toLowerCase()));
    const normalizedInput = colorsHex.map(color => String(color).toLowerCase());
    const matched = normalizedInput.filter(color => normalizedTarget.has(color)).length;
    const score = Math.round((matched / normalizedInput.length) * 100);
    return {
      score,
      passed: score >= 50,
      assessable: true,
      target_palette: targetPaletteHex,
      notes: `${matched}/${normalizedInput.length} sampled colors match the target palette.`
    };
  }
}

module.exports = ColorPaletteEvaluator;
