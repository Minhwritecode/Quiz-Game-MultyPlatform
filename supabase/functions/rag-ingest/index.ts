import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { corsHeaders } from "../_shared/cors.ts";
import { chunkDocument, cleanDocumentText, sha256Hex } from "../_shared/rag.ts";
import { generateEmbedding768, resolveProviderConfig } from "../_shared/llm-provider.ts";

type IngestRequest = {
  space_id?: string;
  space_name?: string;
  space_subject?: string;
  name: string;
  kind?: "pdf" | "docx" | "md" | "txt" | "note";
  raw_text: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing bearer token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = auth.slice(7);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData.user) {
    return new Response(JSON.stringify({ error: "Sign in required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  let body: IngestRequest;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 500_000) throw new Error("Payload too large");
    body = JSON.parse(rawBody);
    if (!body || typeof body.name !== "string" || typeof body.raw_text !== "string") {
      throw new Error("Invalid payload");
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON or document payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cleaned = cleanDocumentText(body.raw_text);
  if (!cleaned || cleaned.length > 250_000) {
    return new Response(JSON.stringify({ error: "Document text must be 1-250000 characters" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Ensure target knowledge space exists for this user
  let spaceId = body.space_id;
  if (!spaceId) {
    const { data: createdSpace, error: spaceErr } = await supabase
      .from("knowledge_spaces")
      .insert({
        owner_id: userId,
        name: (body.space_name || "Kho tri thức").trim().slice(0, 160),
        subject: (body.space_subject || "Tổng hợp").trim().slice(0, 80),
      })
      .select("id")
      .single();
    if (spaceErr || !createdSpace) {
      return new Response(JSON.stringify({ error: "Failed to create knowledge space" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    spaceId = createdSpace.id;
  }

  const sha = await sha256Hex(cleaned);
  const { data: existingDoc } = await supabase
    .from("knowledge_documents")
    .select("id, name, kind, excerpt, chunk_count, status")
    .eq("space_id", spaceId)
    .eq("content_sha256", sha)
    .maybeSingle();

  if (existingDoc) {
    return new Response(
      JSON.stringify({ document: existingDoc, deduplicated: true, space_id: spaceId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const chunks = chunkDocument(cleaned);
  const excerpt = cleaned.slice(0, 260);
  const kind = ["pdf", "docx", "md", "txt", "note"].includes(body.kind ?? "")
    ? body.kind!
    : "note";

  const { data: docRow, error: docErr } = await supabase
    .from("knowledge_documents")
    .insert({
      space_id: spaceId,
      owner_id: userId,
      name: body.name.trim().slice(0, 240),
      kind,
      content_sha256: sha,
      raw_text: cleaned.slice(0, 120_000),
      excerpt,
      chunk_count: chunks.length,
      status: "indexing",
    })
    .select("id, name, kind, excerpt, chunk_count, status")
    .single();

  if (docErr || !docRow) {
    return new Response(JSON.stringify({ error: "Failed to save knowledge document" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const providerConfig = resolveProviderConfig();
  let embeddedCount = 0;
  const rowsToInsert = [];

  for (const chunk of chunks.slice(0, 40)) {
    const vector = await generateEmbedding768(chunk.content, providerConfig);
    if (vector) embeddedCount++;
    rowsToInsert.push({
      document_id: docRow.id,
      space_id: spaceId,
      owner_id: userId,
      chunk_index: chunk.chunkIndex,
      heading_path: chunk.headingPath,
      page_number: chunk.pageNumber,
      content: chunk.content,
      embedding: vector ? `[${vector.join(",")}]` : null,
    });
  }

  if (rowsToInsert.length > 0) {
    const { error: chunkErr } = await supabase.from("knowledge_chunks").insert(rowsToInsert);
    if (chunkErr) {
      await supabase
        .from("knowledge_documents")
        .update({ status: "failed" })
        .eq("id", docRow.id);
      return new Response(JSON.stringify({ error: "Failed to index document chunks" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  await supabase
    .from("knowledge_documents")
    .update({ status: "ready", chunk_count: rowsToInsert.length })
    .eq("id", docRow.id);

  return new Response(
    JSON.stringify({
      space_id: spaceId,
      document: { ...docRow, status: "ready", chunk_count: rowsToInsert.length },
      chunk_count: rowsToInsert.length,
      embedded_chunks: embeddedCount,
      deduplicated: false,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
