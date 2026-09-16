// ============================================================
// EMBEDDING SERVICE
// ============================================================
//
// Responsible ONLY for turning text into a vector via OpenRouter.
//
// It does NOT:
// - save embeddings to PostgreSQL
// - search embeddings
// - know anything about tasks/projects/organizations
//
// See knowledgeBaseService.js for indexing and
// vectorSearchService.js / retrievalService.js for retrieval.
// ============================================================

const crypto = require("crypto");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/embeddings";

const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small";

// ============================================================
// CREATE EMBEDDING
// ============================================================

async function createEmbedding(text) {
  if (!text || !String(text).trim()) {
    throw new Error("Text is required for embedding.");
  }

  if (!process.env.OPENROUTER_API_KEY || !process.env.OPENROUTER_API_KEY.trim()) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }

  const cleanText = String(text).trim();

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
      "X-Title": "DevFlow Knowledge Base",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: cleanText,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Embedding API error:", data);
    throw new Error(data?.error?.message || "Unable to create embedding.");
  }

  const embedding = data?.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Embedding was not returned.");
  }

  return embedding;
}

// ============================================================
// CONTENT HASH
// ============================================================
//
// Used by knowledgeBaseService to skip re-embedding content
// that hasn't actually changed (idempotent indexing).

function hashContent(text) {
  return crypto
    .createHash("sha256")
    .update(String(text || ""))
    .digest("hex");
}

// ============================================================
// PGVECTOR LITERAL
// ============================================================
//
// Converts a JS number array into the text format pgvector
// expects inside a parameterized query: '[0.1,0.2,...]'

function toVectorLiteral(embedding) {
  return `[${embedding.join(",")}]`;
}

module.exports = {
  createEmbedding,
  hashContent,
  toVectorLiteral,
};
