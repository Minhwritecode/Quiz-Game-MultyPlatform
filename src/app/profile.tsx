import { errorMessage } from '@/core/domain/failure';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, ProgressBar, Screen, SmoothReveal, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import { useMembershipStore } from '@/features/membership/state/useMembershipStore';
import { useNotificationStore, type AdminGiftItem } from '@/features/notifications/state/useNotificationStore';
import { useCommunityStore } from '@/features/community/state/useCommunityStore';
import { CreateStoryCard916, StoryCard916 } from '@/features/community/presentation/StoryCard916';
import { StoryComposerModal, StoryViewerModal } from '@/features/community/presentation/StoryModalViewer';
import { FriendsDiscoveryHub } from '@/features/community/presentation/FriendsDiscoveryHub';
import type { ScholarStory } from '@/features/community/domain/models';
import { useSocialStore } from '@/features/social/state/useSocialStore';
import type { AdminManagedDocument, SocialPostItem } from '@/features/social/domain/models';
import { isFollowingAccepted, projectSafePostForViewer } from '@/features/social/domain/rankingAndPermissions';
import { MetaThreadsPostCard } from '@/features/social/presentation/MetaThreadsPostCard';
import { AdvancedThreadComposerModal } from '@/features/social/presentation/AdvancedThreadComposerModal';
import { getScholarRankInfo, XP_PER_SCHOLAR_LEVEL } from '@/core/domain/scholarRank';
import { getLocalDateString } from '@/features/streak/domain/models';
import { dependencies } from '@/composition/dependencies';
import {
  fetchCloudProfileSnapshot,
  preferenceStorage,
  seedQuestionSets,
  syncUserProgressToCloud,
} from '@/composition/preferences';
import {
  pickAvatarImageDataUrl,
  pickCoverImageDataUrl,
} from '@/composition/platform';
import { saveQuestionSet } from '@/features/question-sets/domain/saveQuestionSet';
import { DUEL_CATEGORIES, getEloTier } from '@/features/room-battle/domain/elo';
import { sfx } from '@/core/audio/sfx';

type ProfileTab = 'timeline' | 'saved' | 'vault' | 'insights' | 'friends' | 'about';

const PROFILE_META_KEY = 'papyrus.profile.meta.v2';
const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const COVER_PRESETS = [
  { id: 'royal', label: 'Hoàng Gia', c1: '#1E1B4B', c2: '#6D28D9' },
  { id: 'aurora', label: 'Cực Quang', c1: '#064E3B', c2: '#0284C7' },
  { id: 'sunset', label: 'Phượng Hoàng', c1: '#7C2D12', c2: '#DB2777' },
  { id: 'cosmos', label: 'Tinh Vân', c1: '#0F172A', c2: '#4F46E5' },
];

const AVATAR_PRESETS = [
  { id: 'indigo', label: 'Học giả Indigo', bg: '#4F46E5', fg: '#FFFFFF', icon: 'school' as const },
  { id: 'violet', label: 'Pháp sư Tím', bg: '#7C3AED', fg: '#FFFFFF', icon: 'sparkles' as const },
  { id: 'gold', label: 'Quán quân Vàng', bg: '#D97706', fg: '#FFFFFF', icon: 'trophy' as const },
  { id: 'emerald', label: 'Thảo nguyên Xanh', bg: '#059669', fg: '#FFFFFF', icon: 'leaf' as const },
  { id: 'crimson', label: 'Chiến binh Lửa', bg: '#DC2626', fg: '#FFFFFF', icon: 'flame' as const },
  { id: 'cyan', label: 'Thiên văn Lam', bg: '#0284C7', fg: '#FFFFFF', icon: 'planet' as const },
];

function createPresetAvatarDataUri(bg: string, letter: string): string {
  const safeLetter = (letter || 'P').slice(0, 2).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'P';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="#060A24"/></linearGradient></defs><rect width="240" height="240" rx="120" fill="url(#g)"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#FFFFFF" font-family="system-ui,sans-serif" font-size="96" font-weight="800">${safeLetter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id ?? 'guest';
  const viewerName = user?.displayName?.trim() || 'Thành viên Papyrus';
  const viewerAvatar = user?.avatarUrl ?? null;
  const palette = usePalette();
  const router = useRouter();
  const params = useLocalSearchParams<{ composeStory?: string; tab?: string }>();
  const { width } = useWindowDimensions();
  const maxW = Math.min(width - spacing.lg * 2, 760);

  const gamesPlayed = usePapyrusStore((s) => s.gamesPlayed);
  const totalScore = usePapyrusStore((s) => s.totalScore);
  const bestScore = usePapyrusStore((s) => s.bestScore);
  const wins = usePapyrusStore((s) => s.wins);
  const eloRating = usePapyrusStore((s) => s.eloRating);
  const eloPeak = usePapyrusStore((s) => s.eloPeak);
  const categoryElos = usePapyrusStore((s) => s.categoryElos);
  const questionSets = usePapyrusStore((s) => s.questionSets);
  const addBonusXp = usePapyrusStore((s) => s.addBonusXp);
  const hydrateCloudProfile = usePapyrusStore((s) => s.hydrateCloudProfile);
  const eloTier = getEloTier(eloRating);
  const rankInfo = useMemo(() => getScholarRankInfo(totalScore), [totalScore]);

  const currentStreak = useStreakStore((s) => s.currentStreak);
  const longestStreak = useStreakStore((s) => s.longestStreak);
  const todayCompleted = useStreakStore((s) => s.todayCompleted);
  const historyDates = useStreakStore((s) => s.historyDates);
  const checkInToday = useStreakStore((s) => s.checkInToday);
  const membershipTier = useMembershipStore((s) => s.tier);

  const gifts = useNotificationStore((s) => s.gifts);
  const claimGift = useNotificationStore((s) => s.claimGift);
  const syncCloudGifts = useNotificationStore((s) => s.syncCloudGifts);

  const stories = useCommunityStore((s) => s.stories);
  const addStory = useCommunityStore((s) => s.addStory);
  const markStoryViewed = useCommunityStore((s) => s.markStoryViewed);
  const reactToStory = useCommunityStore((s) => s.reactToStory);

  // Unified Social Media & Threads State
  const profilesById = useSocialStore((s) => s.profilesById);
  const follows = useSocialStore((s) => s.follows);
  const friendRequests = useSocialStore((s) => s.friendRequests);
  const relations = useSocialStore((s) => s.relations);
  const socialPosts = useSocialStore((s) => s.posts);
  const communities = useSocialStore((s) => s.communities);
  const conversations = useSocialStore((s) => s.conversations);
  const moderationCases = useSocialStore((s) => s.moderationCases);
  const adminDocuments = useSocialStore((s) => s.adminDocuments);
  const userSlices = useSocialStore((s) => s.userSlices);

  const ensureUserProfile = useSocialStore((s) => s.ensureUserProfile);
  const propagateIdentityUpdate = useSocialStore((s) => s.propagateIdentityUpdate);
  const respondFollowRequest = useSocialStore((s) => s.respondFollowRequest);
  const saveComposerDraft = useSocialStore((s) => s.saveComposerDraft);
  const createSocialPost = useSocialStore((s) => s.createSocialPost);
  const editSocialPost = useSocialStore((s) => s.editSocialPost);
  const deleteOrArchivePost = useSocialStore((s) => s.deleteOrArchivePost);
  const togglePinPost = useSocialStore((s) => s.togglePinPost);
  const summarizePostWithAi = useSocialStore((s) => s.summarizePostWithAi);
  const voteDebateSide = useSocialStore((s) => s.voteDebateSide);
  const addDebateArgument = useSocialStore((s) => s.addDebateArgument);
  const togglePostEmojiReaction = useSocialStore((s) => s.togglePostEmojiReaction);
  const addThreadedReply = useSocialStore((s) => s.addThreadedReply);
  const editOrDeleteComment = useSocialStore((s) => s.editOrDeleteComment);
  const toggleCommentReaction = useSocialStore((s) => s.toggleCommentReaction);
  const togglePinComment = useSocialStore((s) => s.togglePinComment);
  const togglePureRepost = useSocialStore((s) => s.togglePureRepost);
  const toggleSaveBookmark = useSocialStore((s) => s.toggleSaveBookmark);
  const toggleFavouritePost = useSocialStore((s) => s.toggleFavouritePost);
  const voteUnifiedPoll = useSocialStore((s) => s.voteUnifiedPoll);
  const addUnifiedPollOption = useSocialStore((s) => s.addUnifiedPollOption);
  const toggleCloseUnifiedPoll = useSocialStore((s) => s.toggleCloseUnifiedPoll);
  const toggleFollowUser = useSocialStore((s) => s.toggleFollowUser);
  const toggleUserRelation = useSocialStore((s) => s.toggleUserRelation);
  const sharePostToDestination = useSocialStore((s) => s.sharePostToDestination);
  const submitModerationReport = useSocialStore((s) => s.submitModerationReport);
  const submitUserAppeal = useSocialStore((s) => s.submitUserAppeal);
  const recordDocumentDownload = useSocialStore((s) => s.recordDocumentDownload);

  const mySocialProfile = profilesById[viewerId];
  const mySlice = userSlices[viewerId] ?? userSlices.guest;
  const graph = useMemo(
    () => ({ follows, friendRequests, relations, communities }),
    [communities, follows, friendRequests, relations]
  );

  const [activeTab, setActiveTab] = useState<ProfileTab>(() =>
    params.tab === 'friends'
      ? 'friends'
      : params.tab === 'vault'
      ? 'vault'
      : params.tab === 'insights'
      ? 'insights'
      : params.tab === 'saved'
      ? 'saved'
      : params.tab === 'about'
      ? 'about'
      : 'timeline'
  );
  const [name, setName] = useState(user?.displayName ?? '');
  const [university, setUniversity] = useState('');
  const [major, setMajor] = useState('');
  const [locationArea, setLocationArea] = useState('');
  const [interestsText, setInterestsText] = useState('CNTT, AI, ÔnThi');
  const [bio, setBio] = useState('');
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);

  const [coverPresetId, setCoverPresetId] = useState('royal');
  const [customCoverUrl, setCustomCoverUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [storyComposerOpen, setStoryComposerOpen] = useState(() => params.composeStory === '1');
  const [viewingStory, setViewingStory] = useState<ScholarStory | null>(null);
  const [threadComposerOpen, setThreadComposerOpen] = useState(false);
  const [quotedPost, setQuotedPost] = useState<SocialPostItem | null>(null);
  const [readingAdminDoc, setReadingAdminDoc] = useState<AdminManagedDocument | null>(null);
  const [appealDrafts, setAppealDrafts] = useState<Record<string, string>>({});
  const [insightsPeriod, setInsightsPeriod] = useState<'7d' | '30d'>('7d');
  const [message, setMessage] = useState('');

  const userEditedCoverRef = useRef(false);
  const currentUserId = user?.id ?? null;

  useEffect(() => {
    userEditedCoverRef.current = false;
    let active = true;

    if (user?.id) {
      ensureUserProfile({
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
        role: user.role === 'admin' ? 'admin' : 'user',
      });
    }

    void preferenceStorage.getItem(`${PROFILE_META_KEY}.${viewerId}`).then((raw) => {
      if (!active) return;
      setName(user?.displayName ?? '');
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            university?: string;
            major?: string;
            locationArea?: string;
            interestsText?: string;
            bio?: string;
            isPrivateAccount?: boolean;
            showOnlineStatus?: boolean;
            coverPresetId?: string;
            customCoverUrl?: string | null;
          };
          setUniversity(parsed.university ?? '');
          setMajor(parsed.major ?? '');
          setLocationArea(parsed.locationArea ?? '');
          if (parsed.interestsText) setInterestsText(parsed.interestsText);
          setBio(parsed.bio ?? '');
          setIsPrivateAccount(Boolean(parsed.isPrivateAccount));
          setShowOnlineStatus(parsed.showOnlineStatus !== false);
          if (parsed.coverPresetId) setCoverPresetId(parsed.coverPresetId);
          if (!userEditedCoverRef.current && parsed.customCoverUrl !== undefined) {
            setCustomCoverUrl(parsed.customCoverUrl ?? null);
          }
        } catch {
          // Ignore malformed JSON
        }
      }
    });

    if (currentUserId) {
      void hydrateCloudProfile();
      void syncCloudGifts(currentUserId);
      void fetchCloudProfileSnapshot().then((snap) => {
        if (!active || !snap) return;
        if (snap.coverUrl && !userEditedCoverRef.current) {
          setCustomCoverUrl(snap.coverUrl);
        }
        if (snap.bio) setBio((prev) => prev || snap.bio || '');
        if (snap.university) setUniversity((prev) => prev || snap.university || '');
        if (snap.major) setMajor((prev) => prev || snap.major || '');
      });
    }

    return () => {
      active = false;
    };
  }, [currentUserId, viewerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const myStories = useMemo(
    () => stories.filter((s) => s.authorId === viewerId || s.isHighlight),
    [stories, viewerId]
  );

  const myAuthoredPosts = useMemo(
    () =>
      socialPosts
        .filter(
          (p) =>
            (p.internalAuthorId || p.authorId) === viewerId &&
            p.lifecycleStatus !== 'removed'
        )
        .sort((a, b) =>
          a.isPinnedProfile !== b.isPinnedProfile
            ? a.isPinnedProfile
              ? -1
              : 1
            : Date.parse(b.createdAt) - Date.parse(a.createdAt)
        ),
    [socialPosts, viewerId]
  );

  const myBookmarkedPosts = useMemo(
    () => socialPosts.filter((p) => mySlice?.bookmarkedPostIds.includes(p.id)),
    [mySlice?.bookmarkedPostIds, socialPosts]
  );

  const myFollowersCount = useMemo(
    () => follows.filter((f) => f.followingId === viewerId && f.status === 'accepted').length,
    [follows, viewerId]
  );
  const myFollowingCount = useMemo(
    () => follows.filter((f) => f.followerId === viewerId && f.status === 'accepted').length,
    [follows, viewerId]
  );
  const myFriendsCount = useMemo(
    () =>
      friendRequests.filter(
        (r) => r.status === 'accepted' && (r.senderId === viewerId || r.receiverId === viewerId)
      ).length,
    [friendRequests, viewerId]
  );
  const pendingFollowRequestsToMe = useMemo(
    () => follows.filter((f) => f.followingId === viewerId && f.status === 'pending'),
    [follows, viewerId]
  );

  const myGifts = useMemo(
    () =>
      currentUserId
        ? gifts.filter((g) => g.recipientId === 'all' || g.recipientId === currentUserId)
        : [],
    [gifts, currentUserId]
  );

  const [mountNowMs] = useState(() => Date.now());

  // Gifted Admin Documents accessible to this user (Section 14.8!)
  const myAccessibleAdminDocs = useMemo(() => {
    const myCommIds = communities
      .filter((c) => c.members.some((m) => m.userId === viewerId && m.role !== 'pending' && m.role !== 'banned'))
      .map((c) => c.id);

    return adminDocuments.filter((doc) => {
      if (doc.status !== 'published') return false;
      if (doc.expiresAt && Date.parse(doc.expiresAt) <= mountNowMs) return false;
      return (
        doc.recipientUserIds.includes('all') ||
        doc.recipientUserIds.includes(viewerId) ||
        doc.recipientCommunityIds.some((cid) => myCommIds.includes(cid))
      );
    });
  }, [adminDocuments, communities, mountNowMs, viewerId]);

  const myModerationCases = useMemo(
    () => moderationCases.filter((c) => c.targetOwnerId === viewerId),
    [moderationCases, viewerId]
  );

  // Creator Insights Computations (Section 12)
  const creatorStats = useMemo(() => {
    const totalImpressions = myAuthoredPosts.reduce((s, p) => s + p.impressionsCount, 0);
    const totalViews = myAuthoredPosts.reduce((s, p) => s + p.viewsCount, 0);
    const totalReactions = myAuthoredPosts.reduce(
      (s, p) =>
        s +
        Object.values(p.reactions).reduce((acc, arr) => acc + (arr?.length ?? 0), 0),
      0
    );
    const totalComments = myAuthoredPosts.reduce((s, p) => s + p.comments.length, 0);
    const totalReposts = myAuthoredPosts.reduce(
      (s, p) => s + p.repostedByIds.length + p.quoteCount,
      0
    );
    const engagementRate =
      totalImpressions > 0
        ? (((totalReactions + totalComments + totalReposts) / totalImpressions) * 100).toFixed(1)
        : '0.0';
    return {
      totalImpressions,
      totalViews,
      totalReactions,
      totalComments,
      totalReposts,
      engagementRate,
      profileViews: mySocialProfile?.profileViewsCount ?? 0,
    };
  }, [myAuthoredPosts, mySocialProfile?.profileViewsCount]);

  const last7Days = useMemo(() => {
    const activeSet = new Set(historyDates ?? []);
    const out: Array<{ key: string; label: string; done: boolean; isToday: boolean }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = getLocalDateString(d);
      out.push({
        key,
        label: DAY_LABELS[d.getDay()] ?? 'T',
        done: activeSet.has(key),
        isToday: i === 0,
      });
    }
    return out;
  }, [historyDates]);

  const persistCoverSelection = async (nextCoverUrl: string | null, nextPresetId = coverPresetId) => {
    userEditedCoverRef.current = true;
    setCustomCoverUrl(nextCoverUrl);
    setCoverPresetId(nextPresetId);
    await preferenceStorage.setItem(
      `${PROFILE_META_KEY}.${viewerId}`,
      JSON.stringify({
        university: university.trim(),
        major: major.trim(),
        locationArea: locationArea.trim(),
        interestsText,
        bio: bio.trim(),
        isPrivateAccount,
        showOnlineStatus,
        coverPresetId: nextPresetId,
        customCoverUrl: nextCoverUrl,
      })
    );
    propagateIdentityUpdate(viewerId, { coverUrl: nextCoverUrl });
    if (user) {
      void syncUserProgressToCloud({ coverUrl: nextCoverUrl });
    }
  };

  async function handlePickCoverPhoto() {
    if (coverBusy) return;
    setCoverBusy(true);
    try {
      const dataUrl = await pickCoverImageDataUrl();
      if (!dataUrl) return;
      await persistCoverSelection(dataUrl);
      setMessage('✅ Đã cập nhật ảnh bìa trang cá nhân thành công!');
    } catch (error) {
      setMessage(errorMessage(error, 'Không thể đổi ảnh bìa lúc này.'));
    } finally {
      setCoverBusy(false);
    }
  }

  async function handlePickPhotoAvatar() {
    if (!user || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const dataUrl = await pickAvatarImageDataUrl();
      if (!dataUrl) return;
      const updated = await dependencies.updateUserAvatar(dataUrl);
      useAuthStore.getState().setUser(updated);
      propagateIdentityUpdate(user.id, {
        displayName: updated.displayName,
        avatarUrl: updated.avatarUrl ?? dataUrl,
      });
      setAvatarModalOpen(false);
      setMessage('✅ Đã cập nhật ảnh đại diện và đồng bộ trên toàn bộ bài viết & tin nhắn!');
    } catch (error) {
      setMessage(errorMessage(error, 'Không thể tải ảnh đại diện.'));
    } finally {
      setAvatarBusy(false);
    }
  }

  const initials = viewerName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  async function handleSelectPresetAvatar(bg: string) {
    if (!user || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const dataUri = createPresetAvatarDataUri(bg, initials);
      const updated = await dependencies.updateUserAvatar(dataUri);
      useAuthStore.getState().setUser(updated);
      propagateIdentityUpdate(user.id, {
        displayName: updated.displayName,
        avatarUrl: updated.avatarUrl ?? dataUri,
      });
      setAvatarModalOpen(false);
      setMessage('✅ Đã đổi biểu tượng đại diện trên toàn hệ thống!');
    } catch (error) {
      setMessage(errorMessage(error, 'Không thể lưu ảnh đại diện.'));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function saveProfileDetails() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await preferenceStorage.setItem(
        `${PROFILE_META_KEY}.${viewerId}`,
        JSON.stringify({
          university: university.trim(),
          major: major.trim(),
          locationArea: locationArea.trim(),
          interestsText,
          bio: bio.trim(),
          isPrivateAccount,
          showOnlineStatus,
          coverPresetId,
          customCoverUrl,
        })
      );
      let finalDisplayName = viewerName;
      if (user) {
        if (name.trim().length >= 2 && name.trim() !== user.displayName) {
          const updated = await dependencies.updateDisplayName(name.trim());
          useAuthStore.getState().setUser(updated);
          finalDisplayName = updated.displayName;
        }
        await syncUserProgressToCloud({
          bio: bio.trim(),
          university: university.trim(),
          major: major.trim(),
          coverUrl: customCoverUrl,
        });
      }
      // Propagate Main Profile Name, Bio, Privacy & Interests everywhere across Social Modules!
      propagateIdentityUpdate(viewerId, {
        displayName: finalDisplayName,
        bio: bio.trim(),
        university: university.trim(),
        major: major.trim(),
        locationArea: locationArea.trim(),
        interests: interestsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        coverUrl: customCoverUrl,
        privacy: {
          isPrivateAccount,
          showOnlineStatus,
        },
      });
      setEditModalOpen(false);
      setMessage('✅ Đã lưu Hồ sơ và đồng bộ Tên chính thức trên toàn bộ Bài viết, Bình luận, Nhóm & Tin nhắn!');
    } catch (error) {
      setMessage(errorMessage(error, 'Không lưu được hồ sơ.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleClaimGift(gift: AdminGiftItem) {
    const claimed = claimGift(gift.id, viewerId);
    if (!claimed) return;
    if (claimed.giftType === 'question_set' && claimed.questionSet) {
      const giftedSet = {
        ...claimed.questionSet,
        id: `gift-${claimed.id}`,
        title: `🎁 ${claimed.questionSet.title}`,
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending' as const,
      };
      await saveQuestionSet(dependencies.questionSets, giftedSet).catch(() => undefined);
      usePapyrusStore.getState().saveQuestionSet(giftedSet);
      setMessage(`🎁 Đã lưu bộ đề "${claimed.title}" vào Thư viện!`);
    } else if (claimed.giftType === 'study_document' && claimed.documentText) {
      usePapyrusStore.getState().saveSourceDocument({
        id: `gift-doc-${claimed.id}`,
        title: `🎁 ${claimed.title}`,
        text: claimed.documentText,
        createdAt: new Date().toISOString(),
      });
      setMessage(`📄 Đã lưu tài liệu "${claimed.title}"!`);
    } else if (claimed.giftType === 'vip_days') {
      useMembershipStore.getState().upgradeToVip();
      setMessage('👑 Đã kích hoạt đặc quyền VIP Archmage từ Admin!');
    } else if (claimed.giftType === 'streak_freeze') {
      useStreakStore.getState().addStreakFreeze(2);
      setMessage('❄️ Đã cộng +2 Bùa Đóng Băng Chuỗi!');
    }
    sfx.playLevelUp();
  }

  const handleDownloadAdminDocument = (doc: AdminManagedDocument) => {
    if (!doc.allowDownload) return;
    recordDocumentDownload(doc.id);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([doc.richContent], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || `${doc.title.replace(/\s+/g, '-')}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setMessage(`📥 Đã tải xuống tài liệu «${doc.title}»!`);
  };

  const activeCoverPreset = COVER_PRESETS.find((c) => c.id === coverPresetId) ?? COVER_PRESETS[0]!;
  const winRate = gamesPlayed > 0 ? `${Math.round((wins / gamesPlayed) * 100)}%` : '—';
  const allSets = questionSets.length > 0 ? questionSets : seedQuestionSets;

  return (
    <Screen scroll={false}>
      <TopBar
        title="Trang cá nhân"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở Trung tâm Tin nhắn"
            onPress={() => router.push('/messages')}
            style={[styles.msgBtn, { backgroundColor: palette.paperRaised, borderColor: palette.indigoBorder }]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={palette.indigo} />
            <Text style={{ fontSize: 12, fontWeight: '800', color: palette.ink }}>Tin nhắn</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.container, { paddingHorizontal: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ maxWidth: maxW, alignSelf: 'center', width: '100%' }}>
          {/* ── COVER PHOTO + OVERLAPPING AVATAR + MAIN PROFILE NAME HEADER ── */}
          <SmoothReveal>
            <Card style={styles.fbHeaderCard}>
              <View
                style={[
                  styles.coverBanner,
                  Platform.OS === 'web' && !customCoverUrl
                    ? ({
                        backgroundImage: `linear-gradient(135deg, ${activeCoverPreset.c1} 0%, ${activeCoverPreset.c2} 100%)`,
                      } as object)
                    : { backgroundColor: activeCoverPreset.c1 },
                ]}
              >
                {customCoverUrl ? (
                  <Image source={{ uri: customCoverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : null}

                <View style={styles.coverTopControls}>
                  {COVER_PRESETS.map((cp) => (
                    <Pressable
                      key={cp.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Màu bìa ${cp.label}`}
                      onPress={() => void persistCoverSelection(null, cp.id)}
                      style={[
                        styles.coverColorDot,
                        {
                          backgroundColor: cp.c2,
                          borderColor: coverPresetId === cp.id && !customCoverUrl ? '#FFFFFF' : 'transparent',
                        },
                      ]}
                    />
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    disabled={coverBusy}
                    onPress={() => void handlePickCoverPhoto()}
                    style={styles.changeCoverBtn}
                  >
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' }}>
                      {coverBusy ? 'Đang tải…' : 'Đổi ảnh bìa'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.fbIdentityBody}>
                <View style={styles.avatarRow}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!user}
                    onPress={() => setAvatarModalOpen(true)}
                    style={styles.overlappingAvatarWrap}
                  >
                    {viewerAvatar ? (
                      <Image source={{ uri: viewerAvatar }} style={styles.fbAvatarImg} />
                    ) : (
                      <View
                        style={[
                          styles.fbAvatarImg,
                          { backgroundColor: palette.indigo, alignItems: 'center', justifyContent: 'center' },
                        ]}
                      >
                        <Text style={{ fontSize: 34, fontWeight: '900', color: '#FFFFFF' }}>{initials}</Text>
                      </View>
                    )}
                    {user ? (
                      <View
                        style={[
                          styles.avatarCamBadge,
                          { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
                        ]}
                      >
                        <Ionicons name="camera" size={15} color={palette.ink} />
                      </View>
                    ) : null}
                  </Pressable>
                </View>

                <View style={styles.badgesWrapRow}>
                  <Badge tone="primary">
                    {rankInfo.badge} Cấp {rankInfo.level} · {rankInfo.titleVi}
                  </Badge>
                  {isPrivateAccount && <Badge tone="neutral">🔒 Hồ sơ Riêng tư</Badge>}
                  {membershipTier === 'archmage' && <Badge tone="reward">👑 VIP ARCHMAGE</Badge>}
                </View>

                {/* Main Profile Name ONLY — Zero PAPY-XXXXXX Scholar Code! */}
                <Text style={[typography.heading, { color: palette.ink, marginTop: 6 }]}>
                  {viewerName}
                </Text>
                <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                  {[
                    [major, university].filter(Boolean).join(' · '),
                    locationArea ? `📍 ${locationArea}` : '',
                    !user ? 'Chế độ Khách (Đăng nhập để đồng bộ đa thiết bị)' : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Thành viên Mạng xã hội Học tập Papyrus'}
                </Text>

                {bio ? (
                  <Text style={[typography.body, { color: palette.ink, marginTop: 6 }]}>{bio}</Text>
                ) : null}

                {/* Social Graph Counters */}
                <View style={styles.socialMetricsRow}>
                  <Pressable onPress={() => setActiveTab('friends')} style={styles.metricPill}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: palette.ink }}>
                      {myFollowersCount}
                    </Text>
                    <Text style={{ fontSize: 11, color: palette.inkMuted }}>Người theo dõi</Text>
                  </Pressable>
                  <Pressable onPress={() => setActiveTab('friends')} style={styles.metricPill}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: palette.ink }}>
                      {myFollowingCount}
                    </Text>
                    <Text style={{ fontSize: 11, color: palette.inkMuted }}>Đang theo dõi</Text>
                  </Pressable>
                  <Pressable onPress={() => setActiveTab('friends')} style={styles.metricPill}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: palette.ink }}>
                      {myFriendsCount}
                    </Text>
                    <Text style={{ fontSize: 11, color: palette.inkMuted }}>Bạn bè 2 chiều</Text>
                  </Pressable>
                  <Pressable onPress={() => setActiveTab('insights')} style={styles.metricPill}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: palette.indigo }}>
                      {creatorStats.totalImpressions}
                    </Text>
                    <Text style={{ fontSize: 11, color: palette.inkMuted }}>Lượt tiếp cận</Text>
                  </Pressable>
                </View>

                {/* Action Buttons */}
                <View style={styles.fbActionRow}>
                  <View style={{ flex: 1, minWidth: 120 }}>
                    <Button icon="create-outline" onPress={() => setThreadComposerOpen(true)} fullWidth>
                      Đăng Thread
                    </Button>
                  </View>
                  <View style={{ flex: 1, minWidth: 120 }}>
                    <Button
                      variant="secondary"
                      icon="settings-outline"
                      onPress={() => {
                        setName(user?.displayName ?? '');
                        setEditModalOpen(true);
                      }}
                      fullWidth
                    >
                      Sửa hồ sơ & Quyền riêng tư
                    </Button>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Chia sẻ liên kết hồ sơ"
                    onPress={async () => {
                      if (!user) return;
                      const url = `https://papyrus-lyart-five.vercel.app/user/${user.id}`;
                      await Share.share({
                        message: `Xem trang cá nhân của ${viewerName} trên Papyrus: ${url}`,
                      }).catch(() => undefined);
                    }}
                    style={[
                      styles.moreSquareBtn,
                      { backgroundColor: palette.paper, borderColor: palette.paperMuted },
                    ]}
                  >
                    <Ionicons name="share-social-outline" size={18} color={palette.ink} />
                  </Pressable>
                </View>

                {/* 9:16 Stories Strip */}
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[typography.label, { color: palette.inkMuted, marginBottom: 8 }]}>
                    TIN 24H & TIN NỔI BẬT (ẢNH / VIDEO BÌA TÙY CHỈNH)
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10 }}
                  >
                    <CreateStoryCard916
                      avatarUrl={viewerAvatar}
                      displayName={viewerName}
                      onPress={() => setStoryComposerOpen(true)}
                    />
                    {myStories.map((st) => (
                      <StoryCard916
                        key={st.id}
                        story={st}
                        seen={st.viewedByIds.includes(viewerId)}
                        onPress={() => {
                          markStoryViewed(st.id, viewerId);
                          setViewingStory(st);
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>

                {/* Profile Navigation Tabs */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={[styles.fbTabsBar, { borderTopColor: palette.paperMuted }]}
                  contentContainerStyle={{ gap: 4 }}
                >
                  {(
                    [
                      { id: 'timeline', label: `🧵 Bài viết (${myAuthoredPosts.length})` },
                      { id: 'saved', label: `🔖 Đã lưu (${myBookmarkedPosts.length})` },
                      {
                        id: 'vault',
                        label: `🎁 Học liệu & Quà (${myAccessibleAdminDocs.length + myGifts.length})`,
                      },
                      { id: 'insights', label: '📈 Creator Insights' },
                      {
                        id: 'friends',
                        label: `🤝 Bạn bè${
                          pendingFollowRequestsToMe.length > 0
                            ? ` (+${pendingFollowRequestsToMe.length})`
                            : ''
                        }`,
                      },
                      { id: 'about', label: '🎓 Cấp & Streak' },
                    ] as const
                  ).map((tb) => {
                    const active = activeTab === tb.id;
                    return (
                      <Pressable
                        key={tb.id}
                        onPress={() => setActiveTab(tb.id)}
                        style={[
                          styles.fbTabItem,
                          active && { borderBottomWidth: 3, borderBottomColor: palette.indigo },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: active ? '900' : '700',
                            color: active ? palette.indigo : palette.inkMuted,
                          }}
                        >
                          {tb.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </Card>
          </SmoothReveal>

          {message ? (
            <Card style={{ marginTop: spacing.sm, padding: spacing.sm, borderColor: palette.indigo }}>
              <Text
                style={[
                  typography.caption,
                  { color: palette.indigo, fontWeight: '800', textAlign: 'center' },
                ]}
              >
                {message}
              </Text>
            </Card>
          ) : null}

          {/* ── TAB 1: THREADS TIMELINE & PINNED POSTS ── */}
          {activeTab === 'timeline' && (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {myAuthoredPosts.length === 0 ? (
                <Card style={{ alignItems: 'center', gap: 10, paddingVertical: spacing.xl }}>
                  <Ionicons name="sparkles-outline" size={32} color={palette.indigo} />
                  <Text style={[typography.title, { color: palette.ink }]}>
                    Chưa có bài viết trên Dòng thời gian
                  </Text>
                  <Text
                    style={[typography.caption, { color: palette.inkMuted, textAlign: 'center' }]}
                  >
                    Chia sẻ kiến thức, tạo chuỗi Thread nhiều phần, đính kèm Video/Ảnh hoặc tạo Bình chọn Zalo ngay!
                  </Text>
                  <Button onPress={() => setThreadComposerOpen(true)}>+ Tạo chuỗi Thread đầu tiên</Button>
                </Card>
              ) : (
                myAuthoredPosts.map((rawPost) => {
                  const safePost = projectSafePostForViewer(rawPost, viewerId, false);
                  return (
                    <MetaThreadsPostCard
                      key={rawPost.id}
                      post={safePost}
                      viewerId={viewerId}
                      viewerName={viewerName}
                      viewerAvatar={viewerAvatar}
                      isSavedBookmark={Boolean(mySlice?.bookmarkedPostIds.includes(rawPost.id))}
                      isFavourited={Boolean(mySlice?.favouritePostIds.includes(rawPost.id))}
                      isFollowingAuthor={false}
                      profilesById={profilesById}
                      graph={graph}
                      collections={(mySlice?.collections ?? []).map((c) => ({
                        id: c.id,
                        name: c.name,
                        coverEmoji: c.coverEmoji,
                      }))}
                      conversations={conversations.map((c) => ({
                        id: c.id,
                        title: c.title,
                        kind: c.kind,
                      }))}
                      communities={communities.map((c) => ({ id: c.id, name: c.name }))}
                      onToggleFollow={(tid) => toggleFollowUser(viewerId, tid)}
                      onReactPost={(pid, r) => togglePostEmojiReaction(pid, r, viewerId)}
                      onTogglePureRepost={(pid) => togglePureRepost(pid, viewerId)}
                      onOpenQuoteComposer={(target) => {
                        setQuotedPost(target);
                        setThreadComposerOpen(true);
                      }}
                      onToggleBookmark={(pid, colId) => toggleSaveBookmark(viewerId, pid, colId)}
                      onToggleFavourite={(pid) => toggleFavouritePost(viewerId, pid)}
                      onTogglePin={(pid, sc) => togglePinPost(pid, sc)}
                      onEditPost={(pid, parts, lf) => editSocialPost(pid, viewerId, parts, lf)}
                      onDeleteOrArchive={(pid, mode) => deleteOrArchivePost(pid, viewerId, mode)}
                      onSummarizeAi={(pid) => summarizePostWithAi(pid)}
                      onVotePoll={(pid, oid) => voteUnifiedPoll('post', pid, oid, viewerId)}
                      onAddPollOption={(pid, txt) =>
                        addUnifiedPollOption('post', pid, txt, { id: viewerId, name: viewerName })
                      }
                      onToggleClosePoll={(pid) => toggleCloseUnifiedPoll('post', pid, viewerId)}
                      onVoteDebate={(pid, side) => voteDebateSide(pid, side, viewerId)}
                      onAddDebateArgument={(pid, side, content) =>
                        addDebateArgument(
                          pid,
                          side,
                          { id: viewerId, name: viewerName, avatar: viewerAvatar },
                          content
                        )
                      }
                      onAddReply={(input) =>
                        addThreadedReply({
                          ...input,
                          authorId: viewerId,
                          authorName: viewerName,
                          authorAvatar: viewerAvatar,
                        })
                      }
                      onEditOrDeleteComment={(pid, cid, nextTxt) =>
                        editOrDeleteComment(pid, cid, viewerId, nextTxt)
                      }
                      onReactComment={(pid, cid, r) =>
                        toggleCommentReaction(pid, cid, r, viewerId)
                      }
                      onPinComment={(pid, cid) => togglePinComment(pid, cid)}
                      onShareToTarget={(p, dest, note) =>
                        sharePostToDestination(
                          p,
                          { id: viewerId, name: viewerName, avatar: viewerAvatar },
                          dest,
                          note
                        )
                      }
                      onAlgoFeedback={() => undefined}
                      onBlockOrMuteAuthor={(aid, kind) => toggleUserRelation(viewerId, aid, kind)}
                      onReportTarget={(tType, tid, prev, oid) =>
                        submitModerationReport({
                          reporterId: viewerId,
                          reporterName: viewerName,
                          targetType: tType,
                          targetId: tid,
                          targetPreview: prev,
                          targetOwnerId: oid,
                          reason: 'Báo cáo nội dung',
                          details: '',
                        })
                      }
                    />
                  );
                })
              )}
            </View>
          )}

          {/* ── TAB 2: PRIVATE SAVED BOOKMARKS, SMART COLLECTIONS & FAVOURITES ── */}
          {activeTab === 'saved' && (
            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              <Card style={{ gap: 8 }}>
                <Text style={[typography.label, { color: palette.indigo }]}>
                  🔖 BỘ SƯU TẬP BOOKMARK THÔNG MINH (CHỈ MÌNH BẠN XEM)
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(mySlice?.collections ?? []).map((col) => (
                    <View
                      key={col.id}
                      style={[
                        styles.catEloChip,
                        { backgroundColor: palette.paper, borderColor: palette.paperMuted, borderWidth: 1 },
                      ]}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '800', color: palette.ink }}>
                        {col.coverEmoji} {col.name}
                      </Text>
                      <Badge tone="primary">{col.postIds.length} bài</Badge>
                    </View>
                  ))}
                </View>
              </Card>

              {myBookmarkedPosts.map((bp) => (
                <Pressable
                  key={bp.id}
                  onPress={() => router.push({ pathname: '/post/[postId]', params: { postId: bp.id } })}
                  style={[
                    styles.friendRow,
                    { backgroundColor: palette.paper, borderColor: palette.paperMuted },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: palette.ink }}>
                      {bp.authorName}
                    </Text>
                    <Text style={{ fontSize: 12, color: palette.inkMuted }} numberOfLines={2}>
                      {bp.threadParts[0]}
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={20} color={palette.indigo} />
                </Pressable>
              ))}
            </View>
          )}

          {/* ── TAB 3: GIFTED ADMIN DOCUMENTS & VAULT (SECTION 14.8) ── */}
          {activeTab === 'vault' && (
            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              <Card style={{ gap: 10 }}>
                <Text style={[typography.label, { color: palette.indigo }]}>
                  📑 KHO TÀI LIỆU & GIÁO TRÌNH ĐƯỢC ADMIN TRAO TẶNG ({myAccessibleAdminDocs.length})
                </Text>
                {myAccessibleAdminDocs.length === 0 ? (
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>
                    Chưa có tài liệu chuyên ngành nào được gửi tặng riêng cho bạn.
                  </Text>
                ) : (
                  myAccessibleAdminDocs.map((doc) => (
                    <View
                      key={doc.id}
                      style={[
                        styles.friendRow,
                        {
                          backgroundColor: palette.paper,
                          borderColor: palette.indigoBorder,
                          flexWrap: 'wrap',
                        },
                      ]}
                    >
                      <View style={{ flex: 1, minWidth: 200 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Badge tone="primary">{doc.fileFormat.toUpperCase()}</Badge>
                          <Badge tone="neutral">{doc.category}</Badge>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '900', color: palette.ink, marginTop: 4 }}>
                          {doc.title}
                        </Text>
                        <Text style={{ fontSize: 12, color: palette.inkMuted, marginTop: 2 }}>
                          {doc.description}
                        </Text>
                        {doc.expiresAt ? (
                          <Text style={{ fontSize: 11, color: palette.gold, marginTop: 2 }}>
                            ⏳ Hạn truy cập: {new Date(doc.expiresAt).toLocaleDateString('vi-VN')}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Button size="sm" onPress={() => setReadingAdminDoc(doc)}>
                          Đọc tài liệu
                        </Button>
                        {doc.allowDownload ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => handleDownloadAdminDocument(doc)}
                          >
                            Tải về
                          </Button>
                        ) : null}
                      </View>
                    </View>
                  ))
                )}
              </Card>

              <Card style={{ gap: 8 }}>
                <Text style={[typography.label, { color: palette.gold }]}>
                  🎁 HỘP QUÀ BỘ ĐỀ & ĐẶC QUYỀN TỪ ADMIN ({myGifts.length})
                </Text>
                {myGifts.length === 0 ? (
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>
                    {user
                      ? 'Chưa có quà tặng mới nào gửi tới tài khoản của bạn.'
                      : 'Đăng nhập để nhận quà tặng và học liệu từ Admin.'}
                  </Text>
                ) : (
                  myGifts.map((gift) => {
                    const isClaimed = gift.claimedByIds.includes(viewerId);
                    return (
                      <View
                        key={gift.id}
                        style={[
                          styles.friendRow,
                          { backgroundColor: palette.paper, borderColor: palette.paperMuted },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.body, { color: palette.ink, fontWeight: '800' }]}>
                            {gift.title}
                          </Text>
                          {!!gift.message && (
                            <Text style={[typography.caption, { color: palette.inkMuted }]}>
                              {gift.message}
                            </Text>
                          )}
                        </View>
                        {isClaimed ? (
                          <Badge tone="success">✓ Đã nhận</Badge>
                        ) : (
                          <Button variant="reward" onPress={() => void handleClaimGift(gift)}>
                            Nhận ngay
                          </Button>
                        )}
                      </View>
                    );
                  })
                )}
              </Card>
            </View>
          )}

          {/* ── TAB 4: CREATOR INSIGHTS DASHBOARD & MODERATION APPEALS (SECTIONS 12 & 13) ── */}
          {activeTab === 'insights' && (
            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              <Card style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[typography.title, { color: palette.ink }]}>
                    📈 Creator Insights & Hiệu Suất Nội Dung
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(['7d', '30d'] as const).map((p) => (
                      <Pressable
                        key={p}
                        onPress={() => setInsightsPeriod(p)}
                        style={[
                          styles.editMiniBtn,
                          {
                            backgroundColor:
                              insightsPeriod === p ? palette.indigo : palette.paperRaised,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '800',
                            color: insightsPeriod === p ? '#FFF' : palette.ink,
                          }}
                        >
                          {p === '7d' ? '7 ngày' : '30 ngày'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.catEloGrid}>
                  <View style={[styles.catEloChip, { backgroundColor: palette.paper }]}>
                    <Text style={{ fontSize: 12, color: palette.inkMuted }}>Lượt hiển thị</Text>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: palette.indigo }}>
                      {creatorStats.totalImpressions}
                    </Text>
                  </View>
                  <View style={[styles.catEloChip, { backgroundColor: palette.paper }]}>
                    <Text style={{ fontSize: 12, color: palette.inkMuted }}>Lượt đọc chi tiết</Text>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: palette.mint }}>
                      {creatorStats.totalViews}
                    </Text>
                  </View>
                  <View style={[styles.catEloChip, { backgroundColor: palette.paper }]}>
                    <Text style={{ fontSize: 12, color: palette.inkMuted }}>Tỷ lệ tương tác</Text>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: palette.gold }}>
                      {creatorStats.engagementRate}%
                    </Text>
                  </View>
                  <View style={[styles.catEloChip, { backgroundColor: palette.paper }]}>
                    <Text style={{ fontSize: 12, color: palette.inkMuted }}>Ghế thăm Hồ sơ</Text>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: palette.ink }}>
                      {creatorStats.profileViews}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Moderation Status & User Appeal Submission (Section 13.4) */}
              <Card style={{ gap: 8 }}>
                <Text style={[typography.title, { color: palette.ink }]}>
                  🛡️ Trạng Thái Kiểm Duyệt & Khiếu Nại (Appeals)
                </Text>
                {myModerationCases.length === 0 ? (
                  <Text style={[typography.caption, { color: palette.mint, fontWeight: '700' }]}>
                    ✓ Tài khoản của bạn tuân thủ tốt Tiêu chuẩn Cộng đồng — không có vi phạm nào.
                  </Text>
                ) : (
                  myModerationCases.map((mc) => (
                    <View
                      key={mc.id}
                      style={[
                        styles.friendRow,
                        {
                          backgroundColor: palette.paper,
                          borderColor: palette.paperMuted,
                          flexDirection: 'column',
                          alignItems: 'stretch',
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '800', color: palette.ink }}>
                        Trạng thái: {mc.workflowStatus} · Lý do: {mc.reason}
                      </Text>
                      <Text style={{ fontSize: 12, color: palette.inkMuted }}>{mc.targetPreview}</Text>
                      {mc.workflowStatus === 'action_applied' ? (
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                          <TextInput
                            value={appealDrafts[mc.id] ?? ''}
                            onChangeText={(txt) =>
                              setAppealDrafts((prev) => ({ ...prev, [mc.id]: txt }))
                            }
                            placeholder="Nhập lý do khiếu nại xem xét lại..."
                            placeholderTextColor={palette.inkMuted}
                            style={[
                              styles.input,
                              { flex: 1, minHeight: 38, backgroundColor: palette.paperRaised, color: palette.ink, borderColor: palette.paperMuted },
                            ]}
                          />
                          <Button
                            size="sm"
                            onPress={() => {
                              const reason = (appealDrafts[mc.id] ?? '').trim();
                              if (!reason) return;
                              submitUserAppeal(mc.id, viewerId, reason);
                              setMessage('📨 Đã gửi đơn khiếu nại tới Hội đồng Kiểm duyệt!');
                            }}
                          >
                            Gửi khiếu nại
                          </Button>
                        </View>
                      ) : null}
                    </View>
                  ))
                )}
              </Card>
            </View>
          )}

          {/* ── TAB 5: FOLLOW REQUESTS (PRIVATE ACCOUNT) & FRIENDS DISCOVERY ── */}
          {activeTab === 'friends' && (
            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              {pendingFollowRequestsToMe.length > 0 ? (
                <Card style={{ gap: 8 }}>
                  <Text style={[typography.label, { color: palette.indigo }]}>
                    🔒 YÊU CẦU THEO DÕI HỒ SƠ RIÊNG TƯ ({pendingFollowRequestsToMe.length})
                  </Text>
                  {pendingFollowRequestsToMe.map((req) => {
                    const followerProf = profilesById[req.followerId];
                    return (
                      <View
                        key={req.followerId}
                        style={[
                          styles.friendRow,
                          { backgroundColor: palette.paper, borderColor: palette.paperMuted },
                        ]}
                      >
                        <Text style={{ fontSize: 13.5, fontWeight: '800', color: palette.ink, flex: 1 }}>
                          {followerProf?.displayName || 'Thành viên Papyrus'}
                        </Text>
                        <Button
                          size="sm"
                          onPress={() => respondFollowRequest(viewerId, req.followerId, true)}
                        >
                          Chấp nhận
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => respondFollowRequest(viewerId, req.followerId, false)}
                        >
                          Từ chối
                        </Button>
                      </View>
                    );
                  })}
                </Card>
              ) : null}

              <FriendsDiscoveryHub
                onOpenDirectChat={(scholar) =>
                  router.push({
                    pathname: '/messages',
                    params: { peerId: scholar.id, peerName: scholar.name },
                  })
                }
              />
            </View>
          )}

          {/* ── TAB 6: SCHOLAR RANK, STREAK & CATEGORY ELO ── */}
          {activeTab === 'about' && (
            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              <Card style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: palette.indigo }}>
                    {rankInfo.badge} Cấp {rankInfo.level} ({rankInfo.titleVi}) → Cấp {rankInfo.level + 1}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: palette.inkMuted }}>
                    {rankInfo.currentLevelXp} / {XP_PER_SCHOLAR_LEVEL} XP (Tổng {totalScore.toLocaleString('vi-VN')} XP)
                  </Text>
                </View>
                <ProgressBar progress={rankInfo.progress} tone="primary" />
                {!todayCompleted ? (
                  <Button
                    variant="reward"
                    icon="flame"
                    onPress={() => {
                      const r = checkInToday();
                      if (r.streakUpdated) {
                        addBonusXp(50);
                        sfx.playLevelUp();
                        setMessage(`🔥 Điểm danh thành công (+50 XP)! Chuỗi đạt ${r.newStreak} ngày.`);
                      }
                    }}
                  >
                    Điểm danh giữ chuỗi hôm nay ({currentStreak} ngày · Kỷ lục {longestStreak} ngày)
                  </Button>
                ) : (
                  <Text style={{ fontSize: 12, fontWeight: '700', color: palette.mint }}>
                    ✓ Đã hoàn thành điểm danh hôm nay · Chuỗi {currentStreak} ngày!
                  </Text>
                )}
              </Card>

              <Card>
                <Text style={[typography.label, { color: palette.gold }]}>
                  🔥 LỊCH SỬ ĐIỂM DANH 7 NGÀY GẦN NHẤT
                </Text>
                <View style={styles.weekRow}>
                  {last7Days.map((d) => (
                    <View key={d.key} style={styles.weekCol}>
                      <View
                        style={[
                          styles.weekBar,
                          {
                            height: d.done ? 38 : 12,
                            backgroundColor: d.done ? '#F59E0B' : palette.paperMuted,
                          },
                        ]}
                      />
                      <Text
                        style={{
                          fontSize: 10.5,
                          fontWeight: '700',
                          color: d.isToday ? palette.indigo : palette.inkMuted,
                        }}
                      >
                        {d.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>

              <Card>
                <Text style={[typography.label, { color: palette.indigo, marginBottom: spacing.sm }]}>
                  ⚔️ ELO ĐỐI KHÁNG 1V1 ({eloTier.labelVi} · ĐỈNH {eloPeak} ELO · KỶ LỤC {bestScore}Đ · THẮNG {winRate})
                </Text>
                <View style={styles.catEloGrid}>
                  {DUEL_CATEGORIES.map((cat) => (
                    <View key={cat.id} style={[styles.catEloChip, { backgroundColor: palette.paper }]}>
                      <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]}>
                        {cat.icon} {cat.label}
                      </Text>
                      <Text style={{ fontSize: 12.5, fontWeight: '900', color: palette.indigo }}>
                        {categoryElos[cat.id] ?? eloRating}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </View>
          )}

          {!user && (
            <View style={{ marginTop: spacing.lg }}>
              <Button icon="log-in-outline" onPress={() => router.push('/auth')} fullWidth>
                Đăng nhập để đồng bộ Trang Cá Nhân đa thiết bị
              </Button>
            </View>
          )}

          <View style={{ height: spacing.xxl }} />
        </View>
      </ScrollView>

      {/* ── EDIT PROFILE & PRIVACY SETTINGS MODAL ── */}
      <Modal
        visible={editModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Card
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '90%',
              gap: 12,
              backgroundColor: palette.paper,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[typography.title, { color: palette.ink }]}>
                ✏️ Chỉnh Sửa Hồ Sơ & Quyền Riêng Tư
              </Text>
              <Pressable onPress={() => setEditModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={palette.inkMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {user && (
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Tên hiển thị chính thức (đồng bộ toàn hệ thống)..."
                  placeholderTextColor={palette.inkMuted}
                  style={[
                    styles.input,
                    { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
                  ]}
                />
              )}
              <TextInput
                value={university}
                onChangeText={setUniversity}
                placeholder="Trường Đại học / Học viện..."
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.input,
                  { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
                ]}
              />
              <TextInput
                value={major}
                onChangeText={setMajor}
                placeholder="Chuyên ngành..."
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.input,
                  { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
                ]}
              />
              <TextInput
                value={locationArea}
                onChangeText={setLocationArea}
                placeholder="Khu vực / Thành phố (vd: TP. Hồ Chí Minh, Hà Nội)..."
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.input,
                  { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
                ]}
              />
              <TextInput
                value={interestsText}
                onChangeText={setInterestsText}
                placeholder="Chủ đề quan tâm (vd: CNTT, AI, ToánLýHóa, VănSử)..."
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.input,
                  { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
                ]}
              />
              <TextInput
                value={bio}
                onChangeText={setBio}
                multiline
                placeholder="Tiểu sử giới thiệu..."
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.input,
                  {
                    minHeight: 70,
                    color: palette.ink,
                    borderColor: palette.paperMuted,
                    backgroundColor: palette.paperRaised,
                  },
                ]}
              />

              {/* Privacy Controls */}
              <Pressable
                onPress={() => setIsPrivateAccount((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Ionicons
                  name={isPrivateAccount ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={palette.indigo}
                />
                <Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink, flex: 1 }}>
                  🔒 Chế độ Tài khoản Riêng tư (Duyệt người theo dõi mới)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowOnlineStatus((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Ionicons
                  name={showOnlineStatus ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={palette.indigo}
                />
                <Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink, flex: 1 }}>
                  🟢 Hiển thị trạng thái Đang hoạt động
                </Text>
              </Pressable>
            </ScrollView>

            <Button disabled={busy} onPress={() => void saveProfileDetails()} fullWidth>
              {busy ? 'Đang lưu & đồng bộ…' : 'Lưu toàn bộ hồ sơ'}
            </Button>
          </Card>
        </View>
      </Modal>

      {/* Quick Avatar Picker Modal */}
      <Modal
        visible={avatarModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAvatarModalOpen(false)}>
          <Pressable style={{ width: '100%', maxWidth: 420 }} onPress={() => undefined}>
            <Card style={{ padding: spacing.lg, borderRadius: radii.lg, backgroundColor: palette.paper }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
                <Text style={[typography.title, { color: palette.ink }]}>Cập nhật ảnh đại diện</Text>
                <Pressable onPress={() => setAvatarModalOpen(false)}>
                  <Ionicons name="close" size={22} color={palette.inkMuted} />
                </Pressable>
              </View>
              <Button icon="image-outline" disabled={avatarBusy} onPress={() => void handlePickPhotoAvatar()} fullWidth>
                {avatarBusy ? 'Đang tải ảnh…' : 'Chọn ảnh từ thiết bị'}
              </Button>
              <View style={styles.presetGrid}>
                {AVATAR_PRESETS.map((preset) => (
                  <Pressable
                    key={preset.id}
                    disabled={avatarBusy}
                    onPress={() => void handleSelectPresetAvatar(preset.bg)}
                    style={[
                      styles.presetItem,
                      { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
                    ]}
                  >
                    <View style={[styles.presetCircle, { backgroundColor: preset.bg }]}>
                      <Ionicons name={preset.icon} size={20} color={preset.fg} />
                    </View>
                    <Text style={{ fontSize: 11, color: palette.ink }} numberOfLines={1}>
                      {preset.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Gifted Admin Document Reader Modal */}
      {readingAdminDoc ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setReadingAdminDoc(null)}
        >
          <View style={styles.modalBackdrop}>
            <Card
              style={{
                width: '100%',
                maxWidth: 580,
                maxHeight: '88%',
                gap: 10,
                backgroundColor: palette.paper,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.title, { color: palette.ink, flex: 1 }]}>
                  📑 {readingAdminDoc.title}
                </Text>
                <Pressable onPress={() => setReadingAdminDoc(null)}>
                  <Ionicons name="close" size={22} color={palette.inkMuted} />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 420 }}>
                <Text style={{ fontSize: 13.5, lineHeight: 21, color: palette.ink }}>
                  {readingAdminDoc.richContent}
                </Text>
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                {readingAdminDoc.allowDownload ? (
                  <Button
                    variant="secondary"
                    onPress={() => handleDownloadAdminDocument(readingAdminDoc)}
                  >
                    📥 Tải tệp về máy
                  </Button>
                ) : null}
                <Button
                  onPress={() => {
                    usePapyrusStore.getState().saveSourceDocument({
                      id: `adoc-src-${readingAdminDoc.id}`,
                      title: readingAdminDoc.title,
                      text: readingAdminDoc.richContent,
                      createdAt: new Date().toISOString(),
                    });
                    setReadingAdminDoc(null);
                    router.push('/create/generate');
                  }}
                >
                  ✨ Tạo Quiz AI từ tài liệu này
                </Button>
              </View>
            </Card>
          </View>
        </Modal>
      ) : null}

      <StoryViewerModal
        story={viewingStory}
        viewerId={viewerId}
        onClose={() => setViewingStory(null)}
        onReact={(sid, emo) => reactToStory(sid, emo, viewerId)}
        onDirectMessage={(author) =>
          router.push({
            pathname: '/messages',
            params: { peerId: author.id, peerName: author.name },
          })
        }
      />

      <StoryComposerModal
        visible={storyComposerOpen}
        onClose={() => setStoryComposerOpen(false)}
        onPublish={(data) => {
          addStory({
            authorId: viewerId,
            authorName: viewerName,
            authorAvatar: viewerAvatar,
            authorLevel: rankInfo.level,
            badgeLabel: 'Thành viên Papyrus',
            ...data,
          });
          addBonusXp(20);
          sfx.playLevelUp();
          setMessage('✨ Đã đăng Tin Story mới lên Trang Cá Nhân & Cộng đồng (+20 XP)!');
        }}
      />

      <AdvancedThreadComposerModal
        visible={threadComposerOpen}
        viewerId={viewerId}
        viewerName={viewerName}
        savedDraft={mySlice?.draft ?? null}
        quotedPost={quotedPost}
        communities={communities}
        knownUsers={Object.values(profilesById)}
        questionSets={allSets}
        onSaveDraft={(d) => saveComposerDraft(viewerId, d)}
        onClose={() => {
          setThreadComposerOpen(false);
          setQuotedPost(null);
        }}
        onPublish={(payload) => {
          createSocialPost({
            authorId: viewerId,
            authorName: viewerName,
            authorAvatar: viewerAvatar,
            ...payload,
          });
          addBonusXp(20);
          setQuotedPost(null);
          setMessage('🚀 Đã đăng chuỗi Thread mới lên Trang cá nhân & Bảng tin!');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  fbHeaderCard: { padding: 0, overflow: 'hidden' },
  coverBanner: {
    height: 178,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 12,
    position: 'relative',
  },
  coverTopControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6, 10, 36, 0.68)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  coverColorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  changeCoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 4,
  },
  fbIdentityBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: -46,
  },
  badgesWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    maxWidth: '100%',
  },
  overlappingAvatarWrap: { position: 'relative' },
  fbAvatarImg: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 4,
    borderColor: '#0F172A',
  },
  avatarCamBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.md,
  },
  metricPill: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    alignItems: 'center',
  },
  fbActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.md,
  },
  moreSquareBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbTabsBar: {
    marginTop: spacing.md,
    borderTopWidth: 1,
  },
  fbTabItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 62,
    marginTop: 10,
  },
  weekCol: { alignItems: 'center', gap: 4, flex: 1 },
  weekBar: { width: 18, borderRadius: 6 },
  catEloGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catEloChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
    minWidth: 148,
    flex: 1,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 8, 24, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  editMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.md,
  },
  presetItem: {
    width: '31%',
    minWidth: 96,
    padding: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  presetCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
