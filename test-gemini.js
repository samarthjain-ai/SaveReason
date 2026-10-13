/**
 * test-gemini.js — smoke-test the Gemini API connection
 *
 * Usage:  node test-gemini.js
 *
 * If this passes, the backend POST /api/memories Gemini flow will work.
 * If you see a 401, your GEMINI_API_KEY in .env is invalid.
 *   → Get a new key at https://aistudio.google.com/apikey
 */

import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const key   = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

if (!key) {
  console.error("ERROR: GEMINI_API_KEY is not set in .env");
  process.exit(1);
}

if (!key.startsWith("AIza")) {
  console.warn("WARNING: GEMINI_API_KEY does not look like an AI Studio key.");
  console.warn("  Valid keys start with AIza (length ~39).");
  console.warn("  Your key starts with:", key.substring(0, 8));
  console.warn("  Get a new key at: https://aistudio.google.com/apikey");
}

const ai    = new GoogleGenerativeAI(key);
const model = ai.getGenerativeModel({ model: MODEL });

console.log("Testing Gemini API...");
console.log("Model:", MODEL);

try {
  const result = await model.generateContent(
    `You are a personal memory assistant. A user saved a webpage and you must create a structured memory entry.

Page title: React Hooks Deep Dive
Page URL: https://react.dev/reference/react
Why they saved it: For my college project

Respond ONLY with a valid JSON object — no markdown, no code fences, no explanation. Use exactly this structure:

{
  "summary": "...",
  "whyItMatters": "...",
  "keyInsight": "...",
  "intendedUse": "...",
  "tags": ["..."]
}`
  );

  const text = result.response.text();
  console.log("\nGemini raw response:");
  console.log(text);

  // Parse safely — handles code fences
  let jsonText = text.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1].trim();
  const objMatch = jsonText.match(/\{[\s\S]*\}/);
  if (objMatch) jsonText = objMatch[0];

  const parsed = JSON.parse(jsonText);
  console.log("\nParsed memory:");
  console.log(JSON.stringify(parsed, null, 2));
  console.log("\n✓ Gemini API is working correctly.");
} catch (err) {
  console.error("\nERROR:", err.message);
  if (err.message.includes("401") || err.message.includes("API_KEY_INVALID")) {
    console.error("\nYour GEMINI_API_KEY is invalid or expired.");
    console.error("Get a new key at: https://aistudio.google.com/apikey");
    console.error("Then update GEMINI_API_KEY= in Backend/.env");
  } else if (err.message.includes("404") || err.message.includes("not found")) {
    console.error(`\nModel "${MODEL}" not found. Try setting GEMINI_MODEL=gemini-2.0-flash in .env`);
  }
  process.exit(1);
}
