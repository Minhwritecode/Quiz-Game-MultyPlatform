import { corsHeaders } from "../_shared/cors.ts";

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

  // Keep provider keys server-side. Replace this scaffold with the selected
  // Gemini streaming client and emit one JSON object per SSE data event.
  const payload = {
    message: "LLM provider adapter pending",
    requested: {
      question_count: body.question_count,
      difficulty: body.difficulty,
      language: body.language,
    },
  };
  return new Response(JSON.stringify(payload), {
    status: 501,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

