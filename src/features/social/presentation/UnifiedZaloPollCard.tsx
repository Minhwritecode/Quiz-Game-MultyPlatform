import { memo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import type { SocialUserProfile, UnifiedPoll } from '../domain/models';

/**
 * Unified Zalo-Style Poll Component (Section 9.4)
 * Reused identically across Posts, Communities, Group Chats, and Live Discussions!
 */
export const UnifiedZaloPollCard = memo(function UnifiedZaloPollCard({
  poll,
  viewerId,
  viewerName,
  profilesById,
  onVote,
  onAddOption,
  onToggleClose,
}: {
  poll: UnifiedPoll;
  viewerId: string;
  viewerName: string;
  profilesById?: Record<string, SocialUserProfile>;
  onVote: (optionId: string) => void;
  onAddOption?: (optionText: string) => void;
  onToggleClose?: () => void;
}) {
  const palette = usePalette();
  const router = useRouter();
  const [newOptionText, setNewOptionText] = useState('');
  const [addingOpen, setAddingOpen] = useState(false);
  const [votersModalOpen, setVotersModalOpen] = useState(false);

  const isExpired = Boolean(poll.expiresAt && Date.parse(poll.expiresAt) <= Date.now());
  const locked = poll.isClosed || isExpired;

  const uniqueVoterSet = new Set<string>();
  poll.options.forEach((o) => o.voterIds.forEach((id) => uniqueVoterSet.add(id)));
  const totalVoters = uniqueVoterSet.size;
  const totalVotesCast = poll.options.reduce((sum, o) => sum + o.voterIds.length, 0);

  return (
    <View style={[styles.container, { backgroundColor: palette.paper, borderColor: palette.indigoBorder }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Badge tone="primary">Khảo sát</Badge>
            {poll.allowMultiple && <Badge tone="neutral">Chọn nhiều</Badge>}
            {poll.isAnonymous && <Badge tone="neutral">Ẩn danh</Badge>}
            {locked && <Badge tone="danger">Đã khóa</Badge>}
          </View>
          <Text style={[typography.body, { color: palette.ink, fontWeight: '800', marginTop: 6 }]}>
            {poll.question}
          </Text>
        </View>
      </View>

      <View style={{ gap: 7, marginTop: 8 }}>
        {poll.options.map((opt) => {
          const count = opt.voterIds.length;
          const pct = totalVotesCast > 0 ? Math.round((count / totalVotesCast) * 100) : 0;
          const voted = opt.voterIds.includes(viewerId);

          return (
            <Pressable
              key={opt.id}
              accessibilityRole="button"
              disabled={locked}
              onPress={() => onVote(opt.id)}
              style={[
                styles.optionBox,
                {
                  borderColor: voted ? palette.indigo : palette.paperMuted,
                  backgroundColor: palette.paperRaised,
                  opacity: locked ? 0.82 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${pct}%`,
                    backgroundColor: voted ? palette.indigoTint : palette.paperMuted,
                  },
                ]}
              />
              <View style={styles.optionRow}>
                <Ionicons
                  name={
                    poll.allowMultiple
                      ? voted
                        ? 'checkbox'
                        : 'square-outline'
                      : voted
                      ? 'radio-button-on'
                      : 'radio-button-off'
                  }
                  size={17}
                  color={voted ? palette.indigo : palette.inkMuted}
                />
                <Text
                  style={[
                    typography.caption,
                    { color: palette.ink, fontWeight: voted ? '800' : '600', flex: 1, flexShrink: 1 },
                  ]}
                >
                  {opt.text}
                </Text>
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>
                  {count} ({pct}%)
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Zalo-style Member Add Option */}
      {!locked && poll.allowAddOptions && onAddOption && (
        <View style={{ marginTop: 8 }}>
          {!addingOpen ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setAddingOpen(true)}
              style={styles.addOptTrigger}
            >
              <Ionicons name="add-circle-outline" size={16} color={palette.indigo} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>
                + Thêm phương án bình chọn
              </Text>
            </Pressable>
          ) : (
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <TextInput
                value={newOptionText}
                onChangeText={setNewOptionText}
                placeholder={`Phương án mới bởi ${viewerName}...`}
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.addInput,
                  { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
                ]}
              />
              <Pressable
                onPress={() => {
                  if (newOptionText.trim()) {
                    onAddOption(newOptionText.trim());
                    setNewOptionText('');
                    setAddingOpen(false);
                  }
                }}
                style={[styles.smallBtn, { backgroundColor: palette.indigo }]}
              >
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>Thêm</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Footer Metadata: Total Voters, Deadline, Voter List & Creator Close */}
      <View style={[styles.footerRow, { borderTopColor: palette.paperMuted }]}>
        <Pressable
          disabled={poll.isAnonymous || totalVoters === 0}
          onPress={() => setVotersModalOpen(true)}
        >
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.inkMuted }}>
            👥 {totalVoters} người tham gia
            {!poll.isAnonymous && totalVoters > 0 ? ' · Xem danh sách' : ''}
            {poll.expiresAt
              ? ` · Hạn ${new Date(poll.expiresAt).toLocaleDateString('vi-VN')}`
              : ''}
          </Text>
        </Pressable>

        {onToggleClose && poll.createdBy === viewerId && (
          <Pressable onPress={onToggleClose}>
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: locked ? palette.mint : palette.danger }}>
              {locked ? 'Mở lại bình chọn' : 'Đóng bình chọn'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Non-Anonymous Voter Breakdown Sheet */}
      {votersModalOpen && !poll.isAnonymous && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setVotersModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <Card style={[styles.modalCard, { backgroundColor: palette.paper }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.title, { color: palette.ink }]}>📊 Chi tiết người bình chọn</Text>
                <Pressable onPress={() => setVotersModalOpen(false)}>
                  <Ionicons name="close" size={22} color={palette.inkMuted} />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 320, marginTop: 10 }}>
                {poll.options.map((o) => (
                  <View key={o.id} style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: palette.indigo }}>
                      {o.text} ({o.voterIds.length})
                    </Text>
                    {o.voterIds.map((uid) => {
                      const prof = profilesById?.[uid];
                      const display = prof?.displayName || (uid === viewerId ? viewerName : 'Thành viên Papyrus');
                      return (
                        <Pressable
                          key={uid}
                          onPress={() => {
                            setVotersModalOpen(false);
                            router.push({ pathname: '/user/[userId]', params: { userId: uid } });
                          }}
                          style={styles.voterRow}
                        >
                          <Ionicons name="person-circle-outline" size={18} color={palette.indigo} />
                          <Text style={{ fontSize: 12.5, fontWeight: '700', color: palette.ink }}>{display}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
              <Button variant="secondary" onPress={() => setVotersModalOpen(false)}>
                Đóng
              </Button>
            </Card>
          </View>
        </Modal>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  optionBox: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: radii.sm,
    overflow: 'hidden',
    minHeight: 40,
    justifyContent: 'center',
  },
  progressBar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addOptTrigger: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  addInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    fontSize: 12.5,
  },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: radii.sm },
  footerRow: {
    marginTop: 8,
    paddingTop: 7,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalCard: { width: '100%', maxWidth: 420, gap: 8 },
  voterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 },
});
