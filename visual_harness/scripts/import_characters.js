#!/usr/bin/env node

const path = require('path');
const { runImportBatch } = require('../catalog/import_batch');

function usage() {
  return [
    'Usage: node scripts/import_characters.js <batch.json> [options]',
    '',
    'Options:',
    '  --commit                       Publish the validated batch (default is dry-run)',
    '  --dry-run                      Validate and report without writing files',
    '  --collision <policy>            error | skip-identical (default: manifest or skip-identical)',
    '  --base-dir <visual-harness-dir> Override the Visual Harness directory',
    '  -h, --help                     Show this help'
  ].join('\n');
}

function takeOptionValue(args, index, name) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function parseArgs(argv) {
  const options = {
    commit: false,
    baseDir: path.resolve(__dirname, '..'),
    collisionPolicy: undefined,
    manifestPath: null,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '-h' || argument === '--help') {
      options.help = true;
    } else if (argument === '--commit') {
      options.commit = true;
    } else if (argument === '--dry-run') {
      options.commit = false;
    } else if (argument === '--collision') {
      options.collisionPolicy = takeOptionValue(argv, index, '--collision');
      index += 1;
    } else if (argument.startsWith('--collision=')) {
      options.collisionPolicy = argument.slice('--collision='.length);
    } else if (argument === '--base-dir') {
      options.baseDir = path.resolve(takeOptionValue(argv, index, '--base-dir'));
      index += 1;
    } else if (argument.startsWith('--base-dir=')) {
      options.baseDir = path.resolve(argument.slice('--base-dir='.length));
    } else if (argument.startsWith('-')) {
      throw new Error(`unknown option: ${argument}`);
    } else if (options.manifestPath) {
      throw new Error('only one batch manifest may be supplied');
    } else {
      options.manifestPath = path.resolve(argument);
    }
  }

  return options;
}

async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ success: false, error: error.message }, null, 2)}\n`);
    process.stderr.write(`${usage()}\n`);
    return 2;
  }

  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (!options.manifestPath) {
    process.stderr.write(`${JSON.stringify({ success: false, error: 'batch manifest is required' }, null, 2)}\n`);
    process.stderr.write(`${usage()}\n`);
    return 2;
  }

  try {
    const report = await runImportBatch(options.manifestPath, {
      baseDir: options.baseDir,
      commit: options.commit,
      collisionPolicy: options.collisionPolicy
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.success ? 0 : 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      success: false,
      committed: false,
      mode: options.commit ? 'commit' : 'dry-run',
      error: error.message
    }, null, 2)}\n`);
    return 1;
  }
}

if (require.main === module) {
  main().then(code => {
    process.exitCode = code;
  });
}

module.exports = { main, parseArgs, usage };
