import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.2,
  },
});

export async function extractTaskFromEmail(prompt: string): Promise<unknown> {
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text);
}
