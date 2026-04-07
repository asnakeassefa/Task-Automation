import fs from 'node:fs';
import path from 'node:path';
import { parseEmail } from './parser/emailParser.js';
import { buildExtractionPrompt, PROMPT_VERSION } from './ai/prompts.js';
import { extractTaskFromEmail } from './ai/geminiClient.js';
import { validateExtractedTask, type ExtractedTask } from './validator/taskSchema.js';

interface Fixture {
  label: string;
  expected: {
    is_actionable: boolean;
    priority: 'low' | 'medium' | 'high';
    has_due_date: boolean;
  };
  data: Record<string, string>;
}

interface TestResult {
  file: string;
  label: string;
  passed: boolean;
  failures: string[];
  extracted?: ExtractedTask;
  error?: string;
}

function checkExpectations(
  extracted: ExtractedTask,
  expected: Fixture['expected'],
): string[] {
  const failures: string[] = [];

  if (extracted.is_actionable !== expected.is_actionable) {
    failures.push(
      `is_actionable: expected ${expected.is_actionable}, got ${extracted.is_actionable}`,
    );
  }

  if (extracted.priority !== expected.priority) {
    failures.push(
      `priority: expected ${expected.priority}, got ${extracted.priority}`,
    );
  }

  const hasDueDate = extracted.due_date !== null;
  if (hasDueDate !== expected.has_due_date) {
    failures.push(
      `has_due_date: expected ${expected.has_due_date}, got ${hasDueDate} (due_date=${extracted.due_date})`,
    );
  }

  return failures;
}

const DELAY_MS = 4500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const fixturesDir = path.resolve('test/emails');
  const files = fs
    .readdirSync(fixturesDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  console.log(
    `\n=== Prompt Test Suite (${PROMPT_VERSION}) — ${files.length} fixtures ===\n`,
  );

  const results: TestResult[] = [];

  for (const file of files) {
    const fixture: Fixture = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, file), 'utf-8'),
    );

    process.stdout.write(`  ${file} — ${fixture.label} ... `);

    try {
      const email = parseEmail(fixture.data);
      const prompt = buildExtractionPrompt(email);
      const rawOutput = await extractTaskFromEmail(prompt);
      const extracted = validateExtractedTask(rawOutput);
      const failures = checkExpectations(extracted, fixture.expected);

      if (failures.length === 0) {
        console.log('PASS');
        results.push({ file, label: fixture.label, passed: true, failures: [], extracted });
      } else {
        console.log('FAIL');
        for (const f of failures) {
          console.log(`    ✗ ${f}`);
        }
        results.push({ file, label: fixture.label, passed: false, failures, extracted });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log('ERROR');
      console.log(`    ${msg.split('\n')[0]}`);
      results.push({ file, label: fixture.label, passed: false, failures: [], error: msg });
    }

    if (file !== files[files.length - 1]) {
      await sleep(DELAY_MS);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${passed}/${results.length} passed`);

  if (failed.length > 0) {
    console.log('\nFAILED:');
    for (const r of failed) {
      if (r.error) {
        console.log(`  ${r.file}: ERROR — ${r.error.split('\n')[0]}`);
      } else {
        for (const f of r.failures) {
          console.log(`  ${r.file}: ${f}`);
        }
      }
    }
  }

  console.log();
}

main();
