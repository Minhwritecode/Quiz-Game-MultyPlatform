import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { dependencies } from '@/app/composition/dependencies';
import { useAuthStore } from '@/core/state/useAuthStore';
import type { QuestionSet } from '@/core/domain/models';
import { emptyCloudState, type CloudState } from '@/features/sync/domain/cloudSets';
import { Badge, Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { spacing, typography } from '@/core/theme/tokens';

export default function SyncScreen() {
  const user = useAuthStore(state => state.user);
  const router = useRouter();
  return user ? <AccountLibrary key={user.id} owner={user.id} /> : (
    <Screen><TopBar title="Account library" onBack={() => router.back()} />
      <Card><Text>Sign in to sync your question sets across devices.</Text>
        <Button onPress={() => router.push('/auth')}>Sign in</Button>
      </Card>
    </Screen>
  );
}

function AccountLibrary({ owner }: { owner: string }) {
  const router = useRouter();
  const palette = usePalette();
  const [state, setState] = useState<CloudState>(emptyCloudState);
  const [local, setLocal] = useState<QuestionSet[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const [next, sets] = await Promise.all([
      dependencies.cloudSets.list(owner), dependencies.questionSets.list(),
    ]);
    setState(next); setLocal(sets);
  }, [owner]);
  useEffect(() => { void refresh().catch(error => setMessage(String(error))); }, [refresh]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await action(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to sync.'); }
    finally {
      try { await refresh(); } catch (error) { setMessage(String(error)); }
      setBusy(false);
    }
  };
  const label = { ...typography.body, color: palette.ink };
  return <Screen>
    <TopBar title="Account library" onBack={() => router.back()} />
    <View style={{ gap: spacing.lg }}>
      <Card>
        <Text style={label}>Choose device sets to copy into this account. Copies stay available offline on this device. Sync sends pending changes and downloads account changes.</Text>
        <Text style={label}>{state.pending.length} pending · {state.pending.filter(item => item.conflict).length} conflicts</Text>
        <Button disabled={busy} onPress={() => void run(() => dependencies.cloudSets.sync(owner), 'Sync request completed. Check pending items below.')}>{busy ? 'Working…' : 'Sync now'}</Button>
        <Text style={{ ...typography.caption, color: palette.inkMuted }}>Failed requests keep their queue and retry after a short backoff when you sync again. Study history is still device-only.</Text>
      </Card>
      {message ? <Text accessibilityLiveRegion="polite" style={label}>{message}</Text> : null}
      <Text style={{ ...typography.title, color: palette.ink }}>In this account</Text>
      {state.documents.length === 0 ? <Text style={label}>No account sets yet. Import a device set below or sync to download existing sets.</Text> : null}
      {state.documents.filter(document => !document.deleted || state.pending.some(item => item.document.id === document.id)).map(document => {
        const pending = state.pending.find(item => item.document.id === document.id);
        return <Card key={document.id}>
          <Text style={{ ...typography.title, color: palette.ink }}>{document.title}</Text>
          <Text style={label}>{document.questions.length} questions · {document.subject}</Text>
          <Badge tone={pending?.conflict ? 'danger' : pending ? 'neutral' : 'success'}>{pending?.conflict ? 'Conflict' : pending ? document.deleted ? 'Deletion pending' : 'Pending upload' : 'Synced'}</Badge>
          {pending?.failures ? <Text style={label}>Upload failed. Your changes are saved here; retry with Sync now.</Text> : null}
          {pending?.conflict ? <View style={{ gap: spacing.sm }}>
            <Text style={label}>Another device changed this set: “{pending.conflict.title}”{pending.conflict.deleted ? ' (deleted)' : ''}. Keep the server copy or queue this device’s copy against the new revision.</Text>
            <Button disabled={busy} variant="secondary" onPress={() => void run(() => dependencies.cloudSets.resolve(owner, document.id, 'server'), 'Server copy kept.')}>Keep server copy</Button>
            <Button disabled={busy} onPress={() => void run(() => dependencies.cloudSets.resolve(owner, document.id, 'local'), 'Device copy queued. Sync to upload.')}>Keep device copy</Button>
          </View> : null}
          {!pending && !document.deleted ? <>
            <Button disabled={busy} variant="secondary" onPress={() => router.push('/battle')}>Use in battle</Button>
            {deleting === document.id ? <View>
              <Text style={label}>Delete this account copy on all synced devices? The original device set stays in your local library.</Text>
              <Button disabled={busy} variant="danger" onPress={() => void run(async () => { await dependencies.cloudSets.remove(owner, document.id); setDeleting(null); }, 'Deletion queued. Sync to apply.')}>Confirm deletion</Button>
              <Button variant="ghost" onPress={() => setDeleting(null)}>Cancel</Button>
            </View> : <Button disabled={busy} variant="ghost" onPress={() => setDeleting(document.id)}>Delete account copy</Button>}
          </> : null}
        </Card>;
      })}
      <Text style={{ ...typography.title, color: palette.ink }}>On this device</Text>
      <Text style={label}>Only import material you want to associate with this signed-in account.</Text>
      {local.map(set => <Card key={set.id}>
        <Text style={label}>{set.title} · {set.questions.length} questions</Text>
        <Button disabled={busy || state.pending.some(item => item.document.id === state.imports[set.id])} variant="secondary" onPress={() => void run(() => dependencies.cloudSets.import(owner, set), 'Account copy queued. Sync to upload.')}>{state.imports[set.id] ? 'Update account copy' : 'Copy to this account'}</Button>
      </Card>)}
    </View>
  </Screen>;
}
