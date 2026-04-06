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
} as const;
