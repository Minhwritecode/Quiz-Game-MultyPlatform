// Dual-provider LLM & Embedding adapter for Papyrus Edge Functions:
// 1) Google Gemini (GEMINI_API_KEY + GEMINI_MODEL)
// 2) Any OpenAI-compatible server: OpenAI, Ollama, vLLM, LM Studio
//    (OPENAI_COMPAT_BASE_URL + OPENAI_COMPAT_MODEL + optional OPENAI_COMPAT_API_KEY)

export interface ProviderConfig {
  provider: "gemini" | "openai-compatible";
  model: string;
  apiKey: string;
  baseUrl?: string;
  embedModel?: string;
}

export interface RagQueryPlan {
  searchQuery: string;
  sectionFilter: string | null;
}

export function resolveProviderConfig(): ProviderConfig | null {
  const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  const geminiModel = Deno.env.get("GEMINI_MODEL")?.trim();
  const compatBaseUrl = Deno.env.get("OPENAI_COMPAT_BASE_URL")?.trim();
  const compatModel = Deno.env.get("OPENAI_COMPAT_MODEL")?.trim();
  const compatKey = Deno.env.get("OPENAI_COMPAT_API_KEY")?.trim() ?? "";
  const preferred = Deno.env.get("AI_PROVIDER")?.trim()?.toLowerCase();

  if (preferred === "openai" || preferred === "openai-compatible" || preferred === "ollama") {
    if (compatBaseUrl && compatModel) {
      return {
        provider: "openai-compatible",
        baseUrl: compatBaseUrl.replace(/\/+$/, ""),
        model: compatModel,
        apiKey: compatKey,
        embedModel: Deno.env.get("OPENAI_COMPAT_EMBED_MODEL")?.trim() || undefined,
      };
    }
  }

  if (geminiKey && geminiModel) {
    return {
      provider: "gemini",
      apiKey: geminiKey,
      model: geminiModel,
      embedModel: Deno.env.get("GEMINI_EMBED_MODEL")?.trim() || "gemini-embedding-001",
    };
  }

  if (compatBaseUrl && compatModel) {
    return {
      provider: "openai-compatible",
      baseUrl: compatBaseUrl.replace(/\/+$/, ""),
      model: compatModel,
      apiKey: compatKey,
      embedModel: Deno.env.get("OPENAI_COMPAT_EMBED_MODEL")?.trim() || undefined,
    };
  }

  return null;
}

function l2Normalize(vec: number[]): number[] {
  let sumSq = 0;
  for (const v of vec) sumSq += v * v;
  const norm = Math.sqrt(sumSq);
  return norm > 0 ? vec.map((v) => v / norm) : vec;
}

/**
 * Generate a 768-dim normalized embedding vector for pgvector HNSW storage/search.
 * Returns null gracefully if embedding API is unavailable so FTS fallback continues seamlessly.
 */
export async function generateEmbedding768(
  text: string,
  config: ProviderConfig | null,
): Promise<number[] | null> {
  if (!config || !text.trim()) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    if (config.provider === "gemini") {
      const embedModel = config.embedModel || "gemini-embedding-001";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(embedModel)}:embedContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": config.apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            content: { parts: [{ text: text.slice(0, 6000) }] },
            outputDimensionality: 768,
          }),
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { embedding?: { values?: number[] } };
      const values = data.embedding?.values;
      if (!Array.isArray(values) || values.length !== 768) return null;
      return l2Normalize(values);
    }

    if (config.provider === "openai-compatible" && config.baseUrl && config.embedModel) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;
      const res = await fetch(`${config.baseUrl}/embeddings`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: config.embedModel,
          input: text.slice(0, 6000),
          dimensions: 768,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
      const values = data.data?.[0]?.embedding;
      if (!Array.isArray(values) || values.length !== 768) return null;
      return l2Normalize(values);
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Lightweight Query Planner (heuristic + optional temp-0 LLM extraction) to parse locator
 * cues like "Chương 4", "Unit 2", "Section 3" into section_filter + clean searchQuery.
 */
export function planRagQueryHeuristic(prompt: string): RagQueryPlan {
  const clean = prompt.trim();
  if (!clean) return { searchQuery: "", sectionFilter: null };

  const sectionMatch = clean.match(
    /(?:chương|phần|mục|bài|unit|chapter|section|lesson|module)\s*[0-9a-zA-Z.-]+/i,
  );
  return {
    searchQuery: clean,
    sectionFilter: sectionMatch ? sectionMatch[0].trim() : null,
  };
}

const geminiQuestionSchema = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      minItems: 1,
      items: {
        type: "OBJECT",
        properties: {
          content: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" }, minItems: 4, maxItems: 4 },
          correct_index: { type: "INTEGER", minimum: 0, maximum: 3 },
          explanation: { type: "STRING" },
          code_snippet: { type: "STRING" },
          source_labels: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["content", "options", "correct_index", "explanation"],
      },
    },
  },
  required: ["questions"],
};

export async function generateQuestionsWithProvider(input: {
  config: ProviderConfig;
  promptText: string;
}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  try {
    if (input.config.provider === "gemini") {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.config.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": input.config.apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: input.promptText }] }],
            generationConfig: {
              temperature: 0.3,
              response_mime_type: "application/json",
              response_schema: geminiQuestionSchema,
            },
          }),
        },
      );
      if (!response.ok) throw new Error(`Gemini provider returned HTTP ${response.status}.`);
      const payload = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();
      if (!text) throw new Error("Gemini provider returned an empty response.");
      return text;
    }

    // OpenAI-compatible / Ollama / vLLM chat completions
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (input.config.apiKey) headers["Authorization"] = `Bearer ${input.config.apiKey}`;
    const response = await fetch(`${input.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: input.config.model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Return valid JSON matching {"questions":[{"content":string,"options":[string,string,string,string],"correct_index":0|1|2|3,"explanation":string,"code_snippet"?:string,"source_labels"?:string[]}]}',
          },
          { role: "user", content: input.promptText },
        ],
      }),
    });
    if (!response.ok) throw new Error(`OpenAI-compatible provider returned HTTP ${response.status}.`);
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("OpenAI-compatible provider returned an empty response.");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
