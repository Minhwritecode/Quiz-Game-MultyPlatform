import { supabase } from '@/core/network/supabase';
import type { KnowledgeDoc, KnowledgeSpace } from '../domain/models';

async function ensureCloudSpace(space: { cloudId?: string; name: string; subject: string }): Promise<string | null> {
  if (!supabase) return null;
  if (space.cloudId) return space.cloudId;
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data: created } = await supabase
      .from('knowledge_spaces')
      .insert({
        owner_id: userData.user.id,
        name: space.name,
        subject: space.subject,
      })
      .select('id')
      .single();
    return created?.id ? String(created.id) : null;
  } catch {
    return null;
  }
}

export const knowledgeSpacesRepository = {
  ensureCloudSpace,

  async deleteCloudSpace(cloudId: string): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.from('knowledge_spaces').delete().eq('id', cloudId);
    } catch {
      // Ignore offline delete errors
    }
  },

  async deleteCloudDocument(docId: string): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.from('knowledge_documents').delete().eq('id', docId);
    } catch {
      // Ignore offline delete errors
    }
  },

  async ingestDocument(
    targetSpace: { cloudId?: string; name: string; subject: string },
    doc: { name: string; kind: KnowledgeDoc['kind']; excerpt: string; fileBase64?: string }
  ): Promise<{ cloudSpaceId: string; documentId: string; chunkCount: number } | null> {
    if (!supabase) return null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return null;
      const cloudSpaceId = await ensureCloudSpace(targetSpace);
      if (!cloudSpaceId) return null;

      const { data: ingested, error } = await supabase.functions.invoke('rag-ingest', {
        body: {
          space_id: cloudSpaceId,
          space_name: targetSpace.name,
          space_subject: targetSpace.subject,
          name: doc.name,
          kind: doc.kind,
          raw_text: doc.excerpt,
          file_base64: doc.fileBase64 || undefined,
        },
      });
      if (error || !ingested?.document?.id) return null;
      return {
        cloudSpaceId,
        documentId: String(ingested.document.id),
        chunkCount: Number(ingested.chunk_count ?? ingested.document.chunk_count ?? 1),
      };
    } catch {
      return null;
    }
  },

  async listCloudSpaces(): Promise<KnowledgeSpace[] | null> {
    if (!supabase) return null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      const [{ data: spaceRows }, { data: docRows }] = await Promise.all([
        supabase
          .from('knowledge_spaces')
          .select('id, name, subject, created_at')
          .order('updated_at', { ascending: false })
          .limit(30),
        supabase
          .from('knowledge_documents')
          .select('id, space_id, name, kind, excerpt, chunk_count, created_at')
          .order('created_at', { ascending: false })
          .limit(120),
      ]);

      if (!Array.isArray(spaceRows) || spaceRows.length === 0) return null;

      const docsBySpace = new Map<string, KnowledgeDoc[]>();
      for (const row of Array.isArray(docRows) ? docRows : []) {
        const sid = String(row.space_id ?? '');
        const list = docsBySpace.get(sid) ?? [];
        list.push({
          id: String(row.id),
          name: String(row.name ?? 'Document'),
          kind: (row.kind as KnowledgeDoc['kind']) ?? 'note',
          excerpt: String(row.excerpt ?? ''),
          chunkCount: Number(row.chunk_count ?? 0),
          synced: true,
          addedAt: String(row.created_at ?? new Date().toISOString()),
        });
        docsBySpace.set(sid, list);
      }

      return spaceRows.map((row) => {
        const cid = String(row.id);
        return {
          id: cid,
          cloudId: cid,
          name: String(row.name ?? 'Kho tri thức'),
          subject: String(row.subject ?? 'Tổng hợp'),
          documents: docsBySpace.get(cid) ?? [],
          createdAt: String(row.created_at ?? new Date().toISOString()),
        };
      });
    } catch {
      return null;
    }
  },
};
