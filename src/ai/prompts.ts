import type { RawEmailPayload } from '../parser/emailParser.js';

export const PROMPT_VERSION = 'v1';

export function buildExtractionPrompt(email: RawEmailPayload): string {
  return `
You are a task extraction assistant integrated into a project management system.
Given an email, extract task information and return ONLY valid JSON — no explanation, no markdown, no code fences.

Email:
Subject: ${email.subject}
From: ${email.from}
Date: ${email.date}
Body:
${email.textBody}

Return this exact JSON structure:
{
  "task_name": "short, clear, action-oriented title starting with a verb",
  "notes": "full relevant context from the email body",
  "due_date": "YYYY-MM-DD if a deadline is mentioned, otherwise null",
  "priority": "low | medium | high based on urgency in the email",
  "is_actionable": true if this email requires a clear action, false if it is a newsletter/notification/receipt/spam,
  "suggested_tags": ["relevant", "tags"]
}

Rules:
- task_name must start with an action verb (Review, Send, Fix, Schedule, Follow up, etc.)
- Extract explicit or implied deadlines for due_date
- Set priority to "high" if words like urgent, ASAP, critical, or immediate appear
- Set is_actionable to false for newsletters, receipts, automated notifications, and marketing emails
- Keep notes concise but complete — include names, links, and key details from the body
- Always return a single JSON object, never an array. If multiple actions exist, combine them into one task.
`.trim();
}
