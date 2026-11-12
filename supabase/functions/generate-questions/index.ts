import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
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

  if(request.method !== 'POST')return new Response('Method not allowed',{status:405,headers:corsHeaders});
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing bearer token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:user,error:authError}=await authClient.auth.getUser(auth.slice(7));
  if(authError || !user.user)return new Response(JSON.stringify({error:'Sign in required'}),{status:401,headers:{...corsHeaders,'Content-Type':'application/json'}});
  let body: RequestBody;
  try {
    const text=await request.text();
    if(text.length > 200000)throw new Error();
    body=JSON.parse(text);
    if(!body || typeof body.source_text !== 'string' || !Number.isInteger(body.question_count) || body.question_count < 1 || body.question_count > 30 || !['vi','en'].includes(body.language))throw new Error();
  } catch {
    return new Response(JSON.stringify({error:'Invalid JSON or generation settings'}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
  }
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
  } catch {
    console.error("generate-questions: validation or provider failure");
    return new Response(JSON.stringify({ error: "AI generation failed validation or timed out" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

