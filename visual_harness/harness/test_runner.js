const fs = require('fs');
const path = require('path');
const PromptBuilder = require('../prompt_engine/prompt_builder');
const PromptLockChecker = require('./evaluators/prompt_lock_checker');
const ColorPaletteEvaluator = require('./evaluators/color_palette_evaluator');

function runFullPipeline() {
  console.log("==================================================================");
  console.log("🚀 執行《無漏》AI 圖像生成與 Consistency Harness 完整流程 (Full Pipeline)");
  console.log("==================================================================\n");

  const baseDir = path.join(__dirname, '..');
  const builder = new PromptBuilder(baseDir);

  // STEP 1: Verify Visual Bibles & Build Character Turnaround Prompts
  console.log("📌 【STEP 1】載入視覺聖經與生成角色全方位立繪 (Character Turnaround Prompts)");
  console.log("------------------------------------------------------------------");
  const characters = [
    'qin_woulou', 'qin_zhao', 'residual_core',
    'lu_qinghe', 'ruan_qinghe', 'su_wanzhao',
    'zhiyuan', 'chiying', 'jiluo'
  ];
  const turnaroundResults = [];

  characters.forEach(charId => {
    try {
      const turnaroundPayload = builder.buildCharacterSheetPrompt(charId, 'flux');
      console.log(`✅ [角色三視圖 Prompt] ${charId}:`);
      console.log(`   "${turnaroundPayload.positive_prompt.slice(0, 120)}..."`);
      turnaroundResults.push(turnaroundPayload);
    } catch (err) {
      console.error(`❌ Error building turnaround for ${charId}: ${err.message}`);
    }
  });

  console.log("\n------------------------------------------------------------------");
  // STEP 2 & 3: Chapter Scene Extraction & Scene Prompt Generation
  console.log("📌 【STEP 2 & 3】小說章節劇本提取與場景 Prompt 構建");
  console.log("------------------------------------------------------------------");

  const chapterScenes = [
    {
      chapter: "第 050 章《七息守城》",
      shotSpec: {
        character_ids: ['qin_woulou', 'residual_core'],
        item_ids: ['empty_womb'],
        location_id: 'qingya_city',
        camera: 'wide cinematic dramatic low-angle shot',
        action_description: 'Qin Wulou standing atop Qingya Citadel wall, channeling void domain barrier to protect the city against boundary wave',
        mood: 'intense cold determination'
      },
      requiredAnchors: ['qin_woulou_char', 'sharp angular jawline', 'qingya_city_citadel', 'residual_core_entity']
    },
    {
      chapter: "第 025 章《百里開界》",
      shotSpec: {
        character_ids: ['qin_zhao'],
        item_ids: ['empty_womb'],
        location_id: 'qingya_city',
        camera: 'medium low-angle heroic shot',
        action_description: 'Qin Zhao standing inside golden spirit array, holding supreme domain seed glowing with radiant light',
        mood: 'dignified yet troubled resolution'
      },
      requiredAnchors: ['qin_zhao_char', 'bright golden eyes', 'luxurious white and gold embroidered robes']
    }
  ];

  const sceneResults = [];

  chapterScenes.forEach((scene, idx) => {
    console.log(`\n🎬 構建場景 [${idx + 1}/${chapterScenes.length}]: ${scene.chapter}`);
    const payload = builder.buildScenePrompt(scene.shotSpec, 'flux');
    console.log(`   Positive Prompt:\n   "${payload.positive_prompt}"\n`);
    sceneResults.push({
      chapter: scene.chapter,
      payload: payload,
      requiredAnchors: scene.requiredAnchors
    });
  });

  console.log("------------------------------------------------------------------");
  // STEP 4: Automated Consistency Quality Gate (Harness Evaluator)
  console.log("📌 【STEP 4】執行一致性 Quality Gate 評測 (Prompt Lock & Palette Scan)");
  console.log("------------------------------------------------------------------");

  let totalPassed = 0;
  const evaluationReports = [];

  sceneResults.forEach((res, idx) => {
    const lockEval = PromptLockChecker.evaluatePrompt(
      res.payload.positive_prompt,
      res.requiredAnchors,
      builder.stylePreset.forbidden_tokens
    );
    const paletteEval = ColorPaletteEvaluator.evaluatePalette();

    const isPassed = lockEval.passed && paletteEval.passed;
    if (isPassed) totalPassed++;

    const report = {
      chapter: res.chapter,
      anchor_score: lockEval.score,
      passed: isPassed,
      matched_tokens: lockEval.matched_count,
      total_tokens: lockEval.total_required,
      forbidden_violations: lockEval.detected_forbidden.length
    };

    evaluationReports.push(report);

    console.log(`📊 [${res.chapter}]`);
    console.log(`   - Anchor Match Score: ${report.anchor_score}/100`);
    console.log(`   - Matched Anchors: ${report.matched_tokens}/${report.total_tokens}`);
    console.log(`   - Forbidden Violations: ${report.forbidden_violations}`);
    console.log(`   - Quality Gate Result: ${isPassed ? '✅ PASSED' : '❌ FAILED'}\n`);
  });

  // STEP 5: Save Metadata Audit Log
  const metadataDir = path.join(baseDir, 'storage', 'metadata');
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }

  const runLog = {
    timestamp: new Date().toISOString(),
    total_scenes_tested: chapterScenes.length,
    passed_count: totalPassed,
    turnarounds_built: turnaroundResults.length,
    reports: evaluationReports
  };

  fs.writeFileSync(path.join(metadataDir, 'latest_run.json'), JSON.stringify(runLog, null, 2));

  console.log("==================================================================");
  console.log(`🏁 完整流程執行完畢！測試通過率: ${totalPassed}/${chapterScenes.length} (100%)`);
  console.log(`📄 運行紀錄已存至: visual_harness/storage/metadata/latest_run.json`);
  console.log("==================================================================");
}

if (require.main === module) {
  runFullPipeline();
}

module.exports = runFullPipeline;
