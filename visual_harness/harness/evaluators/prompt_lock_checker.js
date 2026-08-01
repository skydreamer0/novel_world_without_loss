/**
 * Evaluates whether a prompt retains mandatory visual anchor tokens
 * defined in character/item/location Visual Bibles.
 */
class PromptLockChecker {
  static evaluatePrompt(promptText, requiredTokens = [], forbiddenTokens = []) {
    const lowerPrompt = promptText.toLowerCase();
    let matchedCount = 0;
    let missingTokens = [];

    requiredTokens.forEach(token => {
      if (lowerPrompt.includes(token.toLowerCase())) {
        matchedCount++;
      } else {
        missingTokens.push(token);
      }
    });

    let detectedForbidden = [];
    forbiddenTokens.forEach(token => {
      if (lowerPrompt.includes(token.toLowerCase())) {
        detectedForbidden.push(token);
      }
    });

    const totalRequired = requiredTokens.length;
    const anchorScore = totalRequired > 0 ? Math.round((matchedCount / totalRequired) * 100) : 100;
    const isPassed = anchorScore >= 80 && detectedForbidden.length === 0;

    return {
      score: anchorScore,
      passed: isPassed,
      matched_count: matchedCount,
      total_required: totalRequired,
      missing_tokens: missingTokens,
      detected_forbidden: detectedForbidden
    };
  }
}

module.exports = PromptLockChecker;
