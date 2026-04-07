import { parseEmail, type RawEmailPayload } from './parser/emailParser.js';
import { buildExtractionPrompt, PROMPT_VERSION } from './ai/prompts.js';
import { extractTaskFromEmail } from './ai/geminiClient.js';
import { validateExtractedTask } from './validator/taskSchema.js';
import { createAsanaTask, type AsanaTaskResult } from './asana/client.js';

const testEmails = [
  {
    label: 'Urgent request',
    data: {
      messageId: 'test-001@example.com',
      subject: 'URGENT: Server migration needs approval by Friday',
      from: 'Alice Chen <alice@company.com>',
      fromEmail: 'alice@company.com',
      to: 'team@company.com',
      date: '2026-04-06T10:30:00Z',
      textBody: `Hi team,

We need to finalize the server migration plan ASAP. The cloud provider
has given us a deadline of April 11th to confirm our instance types
or we lose the reserved pricing.

Please review the attached migration doc and approve by end of day Friday.
The estimated cost saving is $2,400/month if we lock in now.

Key decisions needed:
1. Instance type (r6g.xlarge vs r6g.2xlarge)
2. Region (us-east-1 vs eu-west-1)
3. Backup retention policy (7 vs 30 days)

Let me know if you have questions.

Thanks,
Alice`,
    },
  },
  {
    label: 'Newsletter (should be skipped)',
    data: {
      messageId: 'test-002@example.com',
      subject: 'Weekly Tech Digest — Top Stories This Week',
      from: 'TechNews <noreply@technews.io>',
      fromEmail: 'noreply@technews.io',
      to: 'subscriber@company.com',
      date: '2026-04-05T08:00:00Z',
      textBody: `Hello subscriber,

Here's your weekly roundup of the top tech stories:

1. AI models are getting smaller and faster
2. New JavaScript runtime benchmarks released
3. Open source funding models in 2026
4. Docker announces new enterprise features

Read more at technews.io

You received this because you subscribed to Weekly Tech Digest.
Unsubscribe: https://technews.io/unsubscribe`,
    },
  },
  {
    label: 'Vague follow-up',
    data: {
      messageId: 'test-003@example.com',
      subject: 'Re: Onboarding process',
      from: 'Bob Martinez <bob@company.com>',
      fromEmail: 'bob@company.com',
      to: 'hr@company.com',
      date: '2026-04-04T14:15:00Z',
      textBody: `Hey,

Following up on our conversation last week. Can you send me the updated
onboarding checklist? I want to make sure we have everything ready
before the new hires start on April 14th.

Also, do we have a buddy system set up for them?

Thanks,
Bob`,
    },
  },
];

async function processEmail(email: RawEmailPayload): Promise<{
  skipped: boolean;
  task?: AsanaTaskResult;
}> {
  const prompt = buildExtractionPrompt(email);
  const rawOutput = await extractTaskFromEmail(prompt);
  const extracted = validateExtractedTask(rawOutput);

  console.log('  Gemini output:', JSON.stringify(extracted, null, 2));

  if (!extracted.is_actionable) {
    return { skipped: true };
  }

  const asanaTask = await createAsanaTask(extracted);
  return { skipped: false, task: asanaTask };
}

async function main() {
  console.log(`\n=== Email → Gemini → Asana Pipeline Test (prompt ${PROMPT_VERSION}) ===\n`);

  for (const testCase of testEmails) {
    console.log(`--- ${testCase.label} ---`);
    console.log(`  Subject: ${testCase.data.subject}`);

    try {
      const email = parseEmail(testCase.data);
      const result = await processEmail(email);

      if (result.skipped) {
        console.log('  Result: SKIPPED (not actionable)\n');
      } else {
        const assignee = result.task!.assignee;
        console.log(`  Result: TASK CREATED`);
        console.log(`  Asana GID: ${result.task!.gid}`);
        console.log(`  URL: ${result.task!.permalink_url}`);
        console.log(`  Assigned to: ${assignee ? `${assignee.name} (${assignee.email})` : '(unassigned)'}\n`);
      }
    } catch (error: any) {
      console.error(`  ERROR: ${error instanceof Error ? error.message : error}`);
      if (error?.response?.body) {
        console.error('  Asana details:', JSON.stringify(error.response.body, null, 2));
      }
      console.error();
    }
  }

  console.log('=== Done ===\n');
}

main();
