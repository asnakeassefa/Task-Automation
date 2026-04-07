import type { RawEmailPayload } from '../parser/emailParser.js';

export const PROMPT_VERSION = 'v2';

const MAX_BODY_LENGTH = 3000;

function truncateBody(body: string): string {
  if (body.length <= MAX_BODY_LENGTH) return body;
  return body.slice(0, MAX_BODY_LENGTH) + '\n\n(body truncated)';
}

export function buildExtractionPrompt(email: RawEmailPayload): string {
  const body = truncateBody(email.textBody);

  return `
You are a task extraction assistant integrated into a project management system.
Given an email, extract task information and return ONLY valid JSON — no explanation, no markdown, no code fences.

Email:
Subject: ${email.subject || '(no subject)'}
From: ${email.from}
Date: ${email.date}
Body:
${body}

Return this exact JSON structure:
{
  "task_name": "short, clear, action-oriented title starting with a verb",
  "notes": "full relevant context from the email body",
  "due_date": "YYYY-MM-DD if a deadline is mentioned, otherwise null",
  "priority": "low | medium | high based on urgency in the email",
  "is_actionable": true if this email requires a clear action, false if it is a newsletter/notification/receipt/spam,
  "suggested_tags": ["relevant", "tags"],
  "suggested_role": "backend | frontend | devops | design | general | null if unclear",
  "suggested_level": "senior | junior | any"
}

Rules:
- task_name must start with an action verb (Review, Send, Fix, Schedule, Follow up, etc.)
- If the subject is empty or missing, infer the task name from the email body content
- Extract explicit or implied deadlines for due_date
- For relative deadlines like "tomorrow", "end of week", or "next Monday", resolve them to absolute YYYY-MM-DD dates using the email's Date header as the reference point
- Set priority to "high" if words like urgent, ASAP, critical, or immediate appear
- Set is_actionable to false for newsletters, receipts, automated notifications, and marketing emails
- If the email references attachments but has minimal body text, it is still actionable — infer the action from the subject line
- For reply chains with quoted text (lines starting with >), focus only on the most recent message at the top when determining the task
- Keep notes concise but complete — include names, links, and key details from the body
- Always return a single JSON object, never an array. If multiple actions exist, combine them into one task
- Based on the email content, suggest which role (backend, frontend, devops, design, general) and expertise level (senior, junior, any) is best suited to handle this task. Use "general" and "any" if unclear
`.trim();
}
