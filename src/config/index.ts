import 'dotenv/config';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key} — check your .env file`);
  return val;
}

export const config = {
  geminiApiKey: requireEnv('GEMINI_API_KEY'),
  asanaAccessToken: requireEnv('ASANA_ACCESS_TOKEN'),
  asanaProjectId: requireEnv('ASANA_PROJECT_ID'),
  gmailUser: requireEnv('GMAIL_USER'),
  gmailAppPassword: requireEnv('GMAIL_APP_PASSWORD'),
  gmailPollIntervalMs: parseInt(process.env.GMAIL_POLL_INTERVAL_MS ?? '30000', 10),
  redisUrl: requireEnv('REDIS_URL'),
  port: parseInt(process.env.PORT ?? '3000', 10),
  bullBoardUser: process.env.BULL_BOARD_USER ?? 'admin',
  bullBoardPass: requireEnv('BULL_BOARD_PASS'),
  asanaPromptVersionFieldGid: process.env.ASANA_PROMPT_VERSION_FIELD_GID ?? '',
} as const;
