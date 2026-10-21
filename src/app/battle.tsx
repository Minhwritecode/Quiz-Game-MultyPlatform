import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Badge, BottomNav, Button, Card, PageHeader, Screen, usePalette } from '@/shared/ui';
import { colors, radii, spacing, typography } from '@/core/theme/tokens';

export default function BattleScreen() {
  const palette = usePalette();
  const [code, setCode] = useState('');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const createRoom = () => setRoomCode(Math.random().toString(36).slice(2, 8).toUpperCase());
  const joinRoom = () => code.trim().length === 6 ? setRoomCode(code.trim().toUpperCase()) : Alert.alert('Enter a room code', 'Room codes contain six characters.');
  return <Screen bottomNav><PageHeader eyebrow="STUDY CIRCLE" title="A little friendly pressure" subtitle="Battle fairly with server time, duplicate-answer protection and reconnect support." />{roomCode ? <Card color={palette.indigoTint} style={styles.room}><Badge tone="primary">WAITING ROOM</Badge><Text style={[typography.heading, { color: palette.indigo, marginTop: spacing.lg, letterSpacing: 5 }]}>{roomCode}</Text><Text style={[typography.body, { color: palette.indigoDeep, marginTop: spacing.sm }]}>Share this code with 1–3 classmates.</Text><View style={styles.players}><Ionicons name="people" size={20} color={palette.mint} /><Text style={[typography.body, { color: palette.mint, fontWeight: '800' }]}>You · waiting for players</Text></View><Button variant="secondary" onPress={() => setRoomCode(null)}>Leave room</Button></Card> : <View style={styles.columns}><Card style={styles.battleCard}><Ionicons name="add-circle" size={30} color={palette.indigo} /><Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>Create a room</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>Choose a set and invite your study circle.</Text><Button icon="add" onPress={createRoom}>Create room</Button></Card><Card style={styles.battleCard}><Ionicons name="keypad" size={30} color={palette.gold} /><Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>Join a room</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>Enter the six-character code from your host.</Text><TextInput autoCapitalize="characters" value={code} onChangeText={setCode} maxLength={6} placeholder="ABC123" placeholderTextColor={palette.inkMuted} style={[styles.codeInput, { color: palette.ink, borderColor: palette.paperMuted }]} /><Button variant="secondary" icon="arrow-forward" onPress={joinRoom}>Join battle</Button></Card></View>}<Card style={styles.contract}><Text style={[typography.title, { color: palette.ink }]}>Battle contract</Text>{[['people-outline', '2–4 players per room'], ['timer-outline', 'Server time controls the window'], ['shield-checkmark-outline', 'RPC owns scoring and duplicates'], ['wifi-outline', 'Reconnect hold keeps the room fair']].map(([icon, label]) => <View key={label} style={styles.contractRow}><Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={palette.indigo} /><Text style={[typography.body, { color: palette.ink }]}>{label}</Text></View>)}</Card></Screen>;
}

const styles = StyleSheet.create({
  columns: { gap: spacing.md },
  battleCard: { gap: spacing.sm },
  codeInput: { minHeight: 54, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.md, fontSize: 22, fontWeight: '800', letterSpacing: 4, marginVertical: spacing.md },
  room: { alignItems: 'center', paddingVertical: spacing.xxxl, marginBottom: spacing.xl },
  players: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginVertical: spacing.xl },
  contract: { marginTop: spacing.xl },
  contractRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
});
