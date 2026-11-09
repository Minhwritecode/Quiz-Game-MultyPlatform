import { corsHeaders } from "../_shared/cors.ts";
import { generateWithGemini } from "../_shared/gemini.ts";
import { normaliseQuestions, parseModelJson } from "../_shared/question-schema.ts";

type RequestBody = {
  source_text: string;
  question_count: number;
  difficulty: "easy" | "medium" | "hard";
  language: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing bearer token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = (await request.json()) as RequestBody;
  if (!body.source_text?.trim() || body.source_text.length > 30_000) {
    return new Response(JSON.stringify({ error: "source_text must be 1–30000 characters" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const questionCount = Math.max(1, Math.min(30, Math.floor(body.question_count)));
  if (!Number.isFinite(questionCount) || !["easy", "medium", "hard"].includes(body.difficulty)) {
    return new Response(JSON.stringify({ error: "Invalid generation settings" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL");
  if (!apiKey || !model) {
    return new Response(JSON.stringify({ error: "AI provider is not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const raw = await generateWithGemini({
      sourceText: body.source_text.trim(),
      questionCount,
      difficulty: body.difficulty,
      language: body.language || "en",
      apiKey,
      model,
    });
    const questions = normaliseQuestions(parseModelJson(raw), questionCount).map((question, position) => ({
      id: crypto.randomUUID(),
      ...question,
      position,
    }));
    return new Response(JSON.stringify({ questions }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-questions failed", error instanceof Error ? error.message : "unknown error");
    return new Response(JSON.stringify({ error: "AI generation failed validation or timed out" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

