import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createMemory } from "./memoryEngine.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Gemini setup ─────────────────────────────────────────────────────────────

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

let geminiModel = null;
if (process.env.GEMINI_API_KEY) {
  try {
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    geminiModel = ai.getGenerativeModel({ model: GEMINI_MODEL });
    console.log(`[SaveReason] Gemini ready — model: ${GEMINI_MODEL}`);
  } catch (err) {
    console.error("[SaveReason] Gemini init failed:", err.message);
  }
} else {
  console.warn("[SaveReason] GEMINI_API_KEY not set — using local memory engine.");
}

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ─── In-memory storage ────────────────────────────────────────────────────────

const memories = [];

// ─── Helper: call Gemini and return parsed AI fields ─────────────────────────

async function getAIFields({ title, url, reason, selectedText }) {
  if (!geminiModel) {
    return createMemory({ title, url, reason, selectedText });
  }

  const prompt = `You are a personal memory assistant. A user saved a webpage and you must create a structured memory entry.

Page title: ${title}
Page URL: ${url}
Why they saved it: ${reason}
${selectedText ? `Selected text: "${selectedText}"` : ""}

Respond ONLY with a valid JSON object — no markdown, no code fences, no explanation. Use exactly this structure:

{
  "summary": "One or two sentences summarising what this page is about.",
  "whyItMatters": "Why this is relevant to the user based on their reason.",
  "keyInsight": "The single most important thing to remember from this page.",
  "intendedUse": "How the user should use or revisit this.",
  "tags": ["tag1", "tag2", "tag3"]
}`;

  const result = await geminiModel.generateContent(prompt);
  const raw    = result.response.text();

  // Strip code fences if present
  let jsonText = raw.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1].trim();

  // Extract the first JSON object
  const objMatch = jsonText.match(/\{[\s\S]*\}/);
  if (objMatch) jsonText = objMatch[0];

  const parsed = JSON.parse(jsonText);

  // Ensure required fields exist
  return {
    summary:      String(parsed.summary      || "").trim(),
    whyItMatters: String(parsed.whyItMatters || "").trim(),
    keyInsight:   String(parsed.keyInsight   || "").trim(),
    intendedUse:  String(parsed.intendedUse  || "").trim(),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 10)
      : [],
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({ service: "SaveReason", status: "ok", model: GEMINI_MODEL });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "SaveReason", model: GEMINI_MODEL });
});

// POST /api/memories
app.post("/api/memories", async (req, res) => {
  try {
    const { title, url, reason, selectedText } = req.body;

    // ── Validation ──
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "title is required" });
    }
    if (!url || typeof url !== "string" || !url.trim()) {
      return res.status(400).json({ error: "url is required" });
    }
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ error: "reason is required" });
    }

    try {
      const parsed = new URL(url.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return res.status(400).json({ error: "url must use http or https" });
      }
    } catch {
      return res.status(400).json({ error: "url is not a valid URL" });
    }

    const cleanTitle    = title.trim();
    const cleanUrl      = url.trim();
    const cleanReason   = reason.trim();
    const cleanSelected = (selectedText || "").trim();

    // ── Generate AI fields (Gemini or local fallback) ──
    let aiFields;
    try {
      aiFields = await getAIFields({
        title:        cleanTitle,
        url:          cleanUrl,
        reason:       cleanReason,
        selectedText: cleanSelected,
      });
    } catch (aiErr) {
      console.error("[SaveReason] Gemini error — falling back to local engine:", aiErr.message);
      try {
        aiFields = createMemory({
          title:        cleanTitle,
          url:          cleanUrl,
          reason:       cleanReason,
          selectedText: cleanSelected,
        });
      } catch (localErr) {
        console.error("[SaveReason] Local engine also failed:", localErr.message);
        return res.status(500).json({
          error: "Memory generation failed",
          details: aiErr.message,
        });
      }
    }

    // ── Build and store memory ──
    const memory = {
      id:           Date.now().toString(),
      title:        cleanTitle,
      url:          cleanUrl,
      reason:       cleanReason,
      selectedText: cleanSelected,
      summary:      aiFields.summary,
      whyItMatters: aiFields.whyItMatters,
      keyInsight:   aiFields.keyInsight,
      intendedUse:  aiFields.intendedUse,
      tags:         aiFields.tags,
      createdAt:    new Date().toISOString(),
    };

    memories.push(memory);
    console.log(`[SaveReason] Memory created: "${memory.title}" (id: ${memory.id})`);

    return res.status(201).json({ success: true, memory });

  } catch (err) {
    console.error("[SaveReason] POST /api/memories unhandled error:", err.message);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// GET /api/memories
app.get("/api/memories", (_req, res) => {
  const sorted = [...memories].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json(sorted);
});

// GET /api/memories/:id
app.get("/api/memories/:id", (req, res) => {
  const memory = memories.find((m) => m.id === req.params.id);
  if (!memory) {
    return res.status(404).json({ error: "Memory not found" });
  }
  res.json(memory);
});

// DELETE /api/memories/:id
app.delete("/api/memories/:id", (req, res) => {
  const idx = memories.findIndex((m) => m.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: "Memory not found" });
  }
  memories.splice(idx, 1);
  console.log(`[SaveReason] Memory deleted: id=${req.params.id}`);
  return res.json({ success: true, message: "Memory deleted" });
});

// PATCH /api/memories/:id
app.patch("/api/memories/:id", (req, res) => {
  const memory = memories.find((m) => m.id === req.params.id);
  if (!memory) {
    return res.status(404).json({ error: "Memory not found" });
  }

  const { title, reason, selectedText, tags, intendedUse } = req.body;

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "title must be a non-empty string" });
    }
    memory.title = title.trim();
  }
  if (reason !== undefined) {
    if (typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ error: "reason must be a non-empty string" });
    }
    memory.reason = reason.trim();
  }
  if (selectedText !== undefined) {
    memory.selectedText = String(selectedText).trim();
  }
  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: "tags must be an array" });
    }
    memory.tags = tags
      .map((t) => String(t).trim())
      .filter((t) => t.length > 0)
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 20);
  }
  if (intendedUse !== undefined) {
    memory.intendedUse = String(intendedUse).trim();
  }

  memory.updatedAt = new Date().toISOString();
  console.log(`[SaveReason] Memory updated: "${memory.title}" (id: ${memory.id})`);
  return res.json({ success: true, memory });
});

// Serve frontend static files — placed AFTER all API routes
const frontendPath = join(__dirname, "..", "Frontend");
app.use(express.static(frontendPath));

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`SaveReason backend running at http://localhost:${PORT}`);
});
