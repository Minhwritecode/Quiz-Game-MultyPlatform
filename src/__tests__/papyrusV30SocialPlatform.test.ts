import { answerLocally } from '@/features/assistant/data/localTutor';
import {
  groupStoriesByAuthor,
  isStoryActive24h,
  STORY_TTL_MS,
} from '@/features/community/domain/models';
import { useCommunityStore } from '@/features/community/state/useCommunityStore';
import {
  acknowledgeWebBuildUpdate,
  checkWebAppVersionUpdate,
} from '@/features/release/data/webVersionCheck';
import {
  areUsersBlocked,
  areUsersFriends,
  canViewerAccessPost,
  canViewerReplyToPost,
  computeIntelligentFriendRecommendations,
  matchesVietnameseSearch,
  projectSafePostForViewer,
  rankAndFilterFeedPosts,
} from '@/features/social/domain/rankingAndPermissions';
import { useSocialStore } from '@/features/social/state/useSocialStore';

let mockUuidCounter = 0;
const mockMemoryStorage = new Map<string, string>();

jest.mock('@/composition/platform', () => ({
  broadcastCommunityEvent: jest.fn(),
  persistentJsonStorage: {
    getItem: (name: string) => mockMemoryStorage.get(name) ?? null,
    setItem: (name: string, value: string) => {
      mockMemoryStorage.set(name, value);
    },
    removeItem: (name: string) => {
      mockMemoryStorage.delete(name);
    },
  },
}));

jest.mock('@/composition/social', () => ({
  askPapyAiFeedAssistant: jest.fn(),
  broadcastCommunityEvent: jest.fn(),
  deleteStoryFromSupabase: jest.fn().mockResolvedValue(false),
  fetchRealProfilesDirectory: jest.fn().mockResolvedValue([]),
  fetchSocialHydrationSnapshot: jest.fn().mockResolvedValue(null),
  generateClientUuid: jest.fn(
    () => `00000000-0000-4000-8000-${String(++mockUuidCounter).padStart(12, '0')}`
  ),
  generatePapyAiPostSummary: jest.fn(),
  persistChatMessageToSupabase: jest.fn().mockResolvedValue(false),
  persistCommunityMembershipToSupabase: jest.fn().mockResolvedValue(false),
  persistCommunityToSupabase: jest.fn().mockResolvedValue(false),
  persistConversationToSupabase: jest.fn().mockResolvedValue(false),
  persistFollowEdgeToSupabase: jest.fn().mockResolvedValue(false),
  persistFriendRequestToSupabase: jest.fn().mockResolvedValue(false),
  persistModerationCaseToSupabase: jest.fn().mockResolvedValue(false),
  persistSocialPostToSupabase: jest.fn().mockResolvedValue(false),
  persistStoryToSupabase: jest.fn().mockResolvedValue(false),
  syncPostEngagementToSupabase: jest.fn().mockResolvedValue(false),
  syncUnifiedProfileToSupabase: jest.fn().mockResolvedValue(false),
  triggerServerPostLifecycleSweep: jest.fn().mockResolvedValue(undefined),
  updateStoryPinInSupabase: jest.fn().mockResolvedValue(false),
  uploadAdminDocumentToSupabase: jest.fn().mockResolvedValue({
    syncedToCloud: false,
    storagePath: null,
  }),
}));

describe('Papyrus v3.0 — Real Data Social Platform, 24h Grouped Stories & Guest Isolation Suite', () => {
  beforeEach(() => {
    mockUuidCounter = 0;
    mockMemoryStorage.clear();
    useSocialStore.setState(useSocialStore.getInitialState(), true);
    useCommunityStore.setState(useCommunityStore.getInitialState(), true);
  });

  it('Urgent Bug #1: webVersionCheck records session baseline build and never loops infinitely on reload', async () => {
    const origWindow = (globalThis as { window?: unknown }).window;
    const origFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');

    const memStorage = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => memStorage.get(k) ?? null,
        setItem: (k: string, v: string) => memStorage.set(k, v),
      },
      sessionStorage: {
        getItem: (k: string) => memStorage.get(`s:${k}`) ?? null,
        setItem: (k: string, v: string) => memStorage.set(`s:${k}`, v),
      },
    };

    let servedBuild = '20261126-0100';
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: jest.fn(async () => ({
        ok: true,
        json: async () => ({ version: '3.0.0', build: servedBuild }),
      })),
    });

    try {
      expect(await checkWebAppVersionUpdate()).toBe(false);
      expect(await checkWebAppVersionUpdate()).toBe(false);

      servedBuild = '20261126-0200';
      expect(await checkWebAppVersionUpdate()).toBe(true);

      acknowledgeWebBuildUpdate('20261126-0200');
      expect(await checkWebAppVersionUpdate()).toBe(false);
    } finally {
      (globalThis as { window?: unknown }).window = origWindow;
      if (origFetch) {
        Object.defineProperty(globalThis, 'fetch', origFetch);
      } else {
        Reflect.deleteProperty(globalThis, 'fetch');
      }
    }
  });

  it('Urgent Bug #3: Papybot responds naturally to greetings and casual Vietnamese dialogue', () => {
    const greet = answerLocally([{ role: 'user', content: 'hi xin chào' }], '/community');
    expect(greet.toLowerCase()).toContain('chào');
    expect(greet).not.toContain('Phân tích học thuật cho chủ đề');

    const howAreYou = answerLocally(
      [{ role: 'user', content: 'hôm nay bạn thế nào' }],
      '/community'
    );
    expect(howAreYou.length).toBeGreaterThan(20);
    expect(howAreYou).not.toContain('Phân tích học thuật cho chủ đề');
  });

  it('Zero Fake Data & Strict Guest Isolation: fresh store has 0 fake profiles/posts/followers and Guests cannot mutate data', () => {
    const social = useSocialStore.getState();
    const comm = useCommunityStore.getState();

    // Zero fake bot users, zero fake posts, zero fake conversations, zero fake stories
    expect(Object.keys(social.profilesById)).toHaveLength(0);
    expect(social.posts).toHaveLength(0);
    expect(social.conversations).toHaveLength(0);
    expect(social.chatMessages).toHaveLength(0);
    expect(social.follows).toHaveLength(0);
    expect(social.friendRequests).toHaveLength(0);
    expect(comm.stories).toHaveLength(0);
    expect(social.communities.every((c) => c.members.length === 0)).toBe(true);

    // Guest write isolation
    expect(
      social.createSocialPost({
        authorId: 'guest',
        authorName: 'Khách',
        authorAvatar: null,
        threadParts: ['Guest post attempt'],
      })
    ).toBeNull();
    expect(
      comm.addStory({
        authorId: 'guest',
        authorName: 'Khách',
        authorAvatar: null,
        authorLevel: 1,
        text: 'Guest story attempt',
        gradient: ['#1C3F94', '#3B5BDB'],
      })
    ).toBeNull();
    expect(social.toggleFollowUser('guest', 'user-1')).toBe('unfollowed');
    social.sendFriendRequest('guest', 'user-1');
    expect(useSocialStore.getState().posts).toHaveLength(0);
    expect(useSocialStore.getState().follows).toHaveLength(0);
    expect(useSocialStore.getState().friendRequests).toHaveLength(0);
    expect(useCommunityStore.getState().stories).toHaveLength(0);
  });

  it('24h Grouped Stories & Profile Pinning: groups multiple <24h stories into 1 box per user, expires >=24h stories, and pins chosen stories', () => {
    const comm = useCommunityStore.getState();
    const now = Date.now();

    const st1 = comm.addStory({
      authorId: 'user-minh',
      authorName: 'Minh',
      authorAvatar: null,
      authorLevel: 2,
      text: 'Slide 1',
      gradient: ['#312E81', '#7C3AED'],
    })!;
    const st2 = comm.addStory({
      authorId: 'user-minh',
      authorName: 'Minh',
      authorAvatar: null,
      authorLevel: 2,
      text: 'Slide 2 Video',
      mediaType: 'video',
      videoUri: 'https://example.com/full-60s.mp4',
      durationSec: 60,
      gradient: ['#065F46', '#0284C7'],
    })!;
    const stOther = comm.addStory({
      authorId: 'user-lan',
      authorName: 'Lan',
      authorAvatar: null,
      authorLevel: 1,
      text: 'Lan Story',
      gradient: ['#9A3412', '#E11D48'],
    })!;

    expect(st2.durationSec).toBe(60); // Full video duration preserved (zero 10s/20s cap!)

    const allActive = useCommunityStore
      .getState()
      .stories.filter((s) => isStoryActive24h(s, now));
    const grouped = groupStoriesByAuthor(allActive);

    // 3 stories across 2 users -> strictly 2 single Story Boxes!
    expect(grouped).toHaveLength(2);
    const minhBox = grouped.find((g) => g.authorId === 'user-minh')!;
    expect(minhBox.stories).toHaveLength(2);
    expect(minhBox.stories.map((s) => s.id)).toEqual([st1.id, st2.id]);

    // Fast-forward 25 hours -> stories expire from 24h status
    const after25h = now + STORY_TTL_MS + 3_600_000;
    expect(isStoryActive24h(st1, after25h)).toBe(false);
    expect(isStoryActive24h(stOther, after25h)).toBe(false);

    // Owner pins `st2` onto their Profile -> only `user-minh` sees/owns it, never leaking to `user-lan`
    expect(comm.togglePinStoryOnProfile(st2.id, 'user-lan')).toBe(false);
    expect(comm.togglePinStoryOnProfile(st2.id, 'user-minh')).toBe(true);
    const updatedSt2 = useCommunityStore.getState().stories.find((s) => s.id === st2.id)!;
    expect(updatedSt2.pinnedOnProfile).toBe(true);
  });

  it('Legacy Content Migration: preserves real user-created posts & messages while discarding legacy fake seeds', () => {
    useCommunityStore.setState({
      posts: [
        {
          id: 'post-seed-1',
          authorId: 'scholar-khanh',
          authorName: 'Khánh Linh',
          authorHandle: '@khanh',
          authorAvatar: null,
          authorLevel: 1,
          threadParts: ['Fake seed post'],
          tags: [],
          reactions: { heart: [], bulb: [], fire: [], clap: [] },
          repostedByIds: [],
          bookmarkedByIds: [],
          comments: [],
          createdAt: '2026-11-24T10:00:00.000Z',
        },
        {
          id: 'real-user-post-1',
          authorId: 'real-uid-999',
          authorName: 'Michael',
          authorHandle: '@michael',
          authorAvatar: null,
          authorLevel: 3,
          threadParts: ['Bài viết thật của người dùng cần được giữ nguyên!'],
          tags: ['CNTT'],
          reactions: { heart: ['u2'], bulb: [], fire: [], clap: [] },
          repostedByIds: [],
          bookmarkedByIds: [],
          comments: [],
          createdAt: '2026-11-25T10:00:00.000Z',
        },
      ],
    });

    useSocialStore.getState().migrateLegacyUserContent();
    const migrated = useSocialStore.getState().posts;
    expect(migrated).toHaveLength(1);
    expect(migrated[0]?.id).toBe('real-user-post-1');
    expect(migrated[0]?.authorName).toBe('Michael');
  });

  it('Section 4: Main Profile Name propagates everywhere & disambiguates same-name users with 0 fake followers', () => {
    const store = useSocialStore.getState();

    const u1 = store.ensureUserProfile({
      id: 'user-khanh-1',
      displayName: 'Khánh Linh',
      major: 'Kỹ thuật Phần mềm',
    });
    const u2 = store.ensureUserProfile({
      id: 'user-khanh-2',
      displayName: 'Khánh Linh',
      major: 'Kinh tế Quốc tế',
    });
    expect(u1.followersCount).toBe(0);
    expect(u2.followersCount).toBe(0);
    expect(u1.id).not.toBe(u2.id);
    expect(u1.major).not.toBe(u2.major);

    const post = store.createSocialPost({
      authorId: 'user-khanh-1',
      authorName: 'Khánh Linh',
      authorAvatar: null,
      communityId: 'comm-software-ai',
      threadParts: ['Kiến trúc hệ thống phân tán'],
    })!;
    store.joinOrLeaveCommunity('comm-software-ai', {
      id: 'user-khanh-1',
      name: 'Khánh Linh',
      avatar: null,
    });
    store.addThreadedReply({
      postId: post.id,
      parentCommentId: null,
      authorId: 'user-khanh-1',
      authorName: 'Khánh Linh',
      authorAvatar: null,
      content: 'Bổ sung tài liệu tham khảo',
    });
    const conv = store.openOrCreateDirectConversation(
      { id: 'user-khanh-1', name: 'Khánh Linh', avatar: null },
      { id: 'user-khanh-2', name: 'Khánh Linh', avatar: null }
    )!;
    const msg = store.sendChatMessage({
      conversationId: conv.id,
      senderId: 'user-khanh-1',
      senderName: 'Khánh Linh',
      senderAvatar: null,
      text: 'Chào bạn!',
    })!;

    // Propagate Profile Name update across all social entities
    store.propagateIdentityUpdate('user-khanh-1', {
      displayName: 'Nguyễn Khánh Linh',
      bio: 'Systems Engineer',
    });

    const updated = useSocialStore.getState();
    expect(updated.profilesById['user-khanh-1']?.displayName).toBe('Nguyễn Khánh Linh');
    const updatedPost = updated.posts.find((p) => p.id === post.id)!;
    expect(updatedPost.authorName).toBe('Nguyễn Khánh Linh');
    expect(updatedPost.comments[0]?.authorName).toBe('Nguyễn Khánh Linh');
    const commMember = updated.communities
      .find((c) => c.id === 'comm-software-ai')!
      .members.find((m) => m.userId === 'user-khanh-1')!;
    expect(commMember.displayName).toBe('Nguyễn Khánh Linh');
    expect(updated.chatMessages.find((m) => m.id === msg.id)?.senderName).toBe(
      'Nguyễn Khánh Linh'
    );
  });

  it('Section 4.4–4.6: Separates 1-way Follow (public vs private) from 2-way Friendship & enforces Block', () => {
    const store = useSocialStore.getState();
    store.ensureUserProfile({ id: 'user-alice', displayName: 'Alice Trần' });
    store.ensureUserProfile({ id: 'user-bob', displayName: 'Bob Lê', isPrivateAccount: false });
    store.ensureUserProfile({
      id: 'user-priv',
      displayName: 'Minh Riêng Tư',
      isPrivateAccount: true,
    });

    const bobPost = store.createSocialPost({
      authorId: 'user-bob',
      authorName: 'Bob Lê',
      authorAvatar: null,
      threadParts: ['Bài viết công khai của Bob'],
    })!;

    expect(store.toggleFollowUser('user-alice', 'user-bob')).toBe('followed');
    expect(store.toggleFollowUser('user-alice', 'user-priv')).toBe('requested');
    store.respondFollowRequest('user-priv', 'user-alice', true);
    expect(
      useSocialStore
        .getState()
        .follows.find((f) => f.followerId === 'user-alice' && f.followingId === 'user-priv')
        ?.status
    ).toBe('accepted');

    store.sendFriendRequest('user-alice', 'user-bob');
    const req = useSocialStore
      .getState()
      .friendRequests.find((r) => r.senderId === 'user-alice' && r.receiverId === 'user-bob')!;
    store.respondFriendRequest(req.id, true);

    let s = useSocialStore.getState();
    expect(
      areUsersFriends('user-alice', 'user-bob', {
        follows: s.follows,
        friendRequests: s.friendRequests,
        relations: s.relations,
        communities: s.communities,
      })
    ).toBe(true);

    store.toggleUserRelation('user-alice', 'user-bob', 'block');
    s = useSocialStore.getState();
    const graphAfterBlock = {
      follows: s.follows,
      friendRequests: s.friendRequests,
      relations: s.relations,
      communities: s.communities,
    };
    expect(areUsersBlocked('user-alice', 'user-bob', graphAfterBlock)).toBe(true);
    expect(areUsersFriends('user-alice', 'user-bob', graphAfterBlock)).toBe(false);
    expect(canViewerAccessPost(bobPost, 'user-alice', graphAfterBlock)).toBe(false);
    expect(canViewerReplyToPost(bobPost, 'user-alice', graphAfterBlock)).toBe(false);
  });

  it('Section 5 & 16.5: Draft auto-save isolation, Edit History, Scheduled publish, Ghost expiry & Anonymous masking', () => {
    const store = useSocialStore.getState();

    store.switchAccountScope('user-a');
    store.saveComposerDraft('user-a', {
      postKind: 'thread',
      threadParts: ['Bản nháp riêng của User A'],
      longFormBody: '',
      mediaItems: [],
      topicsText: 'CNTT',
      audience: 'public',
      replyPermission: 'everyone',
      communityId: null,
      isSpoiler: false,
      spoilerWarning: '',
      isAnonymous: false,
      locationLabel: '',
      scheduledFor: '',
      attachedSetId: '',
      codeSnippet: '',
      debateSideA: '',
      debateSideB: '',
      updatedAt: new Date().toISOString(),
    });
    store.toggleSaveBookmark('user-a', 'post-x');
    store.toggleFavouritePost('user-a', 'post-y');

    store.switchAccountScope('guest');
    const guestSlice = useSocialStore.getState().userSlices.guest!;
    expect(guestSlice.draft).toBeNull();
    expect(guestSlice.bookmarkedPostIds).toHaveLength(0);
    expect(guestSlice.favouritePostIds).toHaveLength(0);

    const futureSchedule = new Date(Date.now() + 60_000).toISOString();
    const scheduled = store.createSocialPost({
      authorId: 'user-a',
      authorName: 'User A',
      authorAvatar: null,
      threadParts: ['Bài hẹn giờ xuất bản'],
      scheduledFor: futureSchedule,
    })!;
    expect(scheduled.lifecycleStatus).toBe('scheduled');

    const ghost = store.createSocialPost({
      authorId: 'user-a',
      authorName: 'User A',
      authorAvatar: null,
      postKind: 'ghost',
      threadParts: ['Bài tự hủy 24h'],
      ghostHours: -1,
    })!;
    store.runScheduledAndGhostSweep();
    const afterSweep = useSocialStore.getState();
    const sweptGhost = afterSweep.posts.find((p) => p.id === ghost.id)!;
    expect(sweptGhost.lifecycleStatus).toBe('expired');
    expect(
      canViewerAccessPost(sweptGhost, 'user-b', {
        follows: afterSweep.follows,
        friendRequests: afterSweep.friendRequests,
        relations: afterSweep.relations,
        communities: afterSweep.communities,
      })
    ).toBe(false);

    const anon = store.createSocialPost({
      authorId: 'user-a',
      authorName: 'User A Thật',
      authorAvatar: 'https://example.com/a.png',
      postKind: 'anonymous',
      isAnonymous: true,
      threadParts: ['Chia sẻ ẩn danh'],
    })!;
    const publicView = projectSafePostForViewer(anon, 'user-b', false);
    expect(publicView.authorId).toBe('anonymous-member');
    expect(publicView.internalAuthorId).toBeUndefined();
    expect(publicView.authorAvatar).toBeNull();

    const modView = projectSafePostForViewer(anon, 'admin-1', true);
    expect(modView.authorName).toContain('User A Thật');

    expect(store.editSocialPost(scheduled.id, 'user-a', ['Nội dung cập nhật v2'])).toBe(true);
    const edited = useSocialStore.getState().posts.find((p) => p.id === scheduled.id)!;
    expect(edited.threadParts[0]).toBe('Nội dung cập nhật v2');
    expect(edited.editHistory).toHaveLength(1);
  });

  it('Section 6, 7 & 9.4: Vietnamese search, Feed ranking, Interactive Polls & Friend Recommendations', () => {
    const store = useSocialStore.getState();

    expect(matchesVietnameseSearch('Kỹ thuật Phần mềm & Hệ Điều Hành', 'he dieu hanh')).toBe(
      true
    );
    expect(matchesVietnameseSearch('Nguyễn Khánh Linh', 'khanh linh')).toBe(true);

    store.ensureUserProfile({ id: 'author-1', displayName: 'Minh Quân', major: 'CNTT' });
    store.ensureUserProfile({ id: 'voter-1', displayName: 'Hải Anh', major: 'CNTT' });

    const pollPost = store.createSocialPost({
      authorId: 'author-1',
      authorName: 'Minh Quân',
      authorAvatar: null,
      topics: ['CNTT', 'AI'],
      threadParts: ['Khảo sát chủ đề ôn tập tuần này'],
      poll: {
        id: 'poll-1',
        scopeType: 'post',
        question: 'Chọn chuyên đề nào?',
        options: [
          { id: 'uopt-1', text: 'Hệ điều hành & Deadlock', voterIds: [] },
          { id: 'uopt-2', text: 'Mạng máy tính', voterIds: [] },
        ],
        allowMultiple: false,
        isAnonymous: false,
        allowAddOptions: true,
        allowChangeVote: true,
        isClosed: false,
        createdBy: 'author-1',
        createdAt: new Date().toISOString(),
      },
    })!;

    const mutedPost = store.createSocialPost({
      authorId: 'author-1',
      authorName: 'Minh Quân',
      authorAvatar: null,
      threadParts: ['Phân tích chi tiết thuật toán chống deadlock'],
    })!;

    store.voteUnifiedPoll('post', pollPost.id, 'uopt-1', 'voter-1');
    store.voteUnifiedPoll('post', pollPost.id, 'uopt-2', 'voter-1');
    let poll = useSocialStore.getState().posts.find((p) => p.id === pollPost.id)!.poll!;
    expect(poll.options[0]?.voterIds).not.toContain('voter-1');
    expect(poll.options[1]?.voterIds).toContain('voter-1');

    store.addUnifiedPollOption('post', pollPost.id, 'Trí tuệ nhân tạo', {
      id: 'voter-1',
      name: 'Hải Anh',
    });
    store.toggleCloseUnifiedPoll('post', pollPost.id, 'author-1');
    store.voteUnifiedPoll('post', pollPost.id, 'uopt-1', 'voter-2');
    poll = useSocialStore.getState().posts.find((p) => p.id === pollPost.id)!.poll!;
    expect(poll.options).toHaveLength(3);
    expect(poll.isClosed).toBe(true);
    expect(poll.options[0]?.voterIds).not.toContain('voter-2');

    store.updateYourAlgo('voter-1', { mutedKeywords: ['deadlock'] });
    const s = useSocialStore.getState();
    const ranked = rankAndFilterFeedPosts({
      posts: s.posts,
      viewerId: 'voter-1',
      mode: 'for_you',
      algo: s.userSlices['voter-1']!.algo,
      graph: {
        follows: s.follows,
        friendRequests: s.friendRequests,
        relations: s.relations,
        communities: s.communities,
      },
    });
    expect(ranked.some((r) => r.post.id === mutedPost.id)).toBe(false);

    const recs = computeIntelligentFriendRecommendations({
      candidates: Object.values(s.profilesById),
      posts: s.posts,
      viewerId: 'voter-1',
      viewerInterests: ['CNTT', 'AI'],
      graph: {
        follows: s.follows,
        friendRequests: s.friendRequests,
        relations: s.relations,
        communities: s.communities,
      },
      dismissedUserIds: [],
    });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.profile.id !== 'voter-1')).toBe(true);
  });

  it('Section 13 & 14.8: Moderation workflow + Appeals restoration + Admin Document Gift distribution & Audit Logs', async () => {
    const store = useSocialStore.getState();
    const targetPost = store.createSocialPost({
      authorId: 'user-haianh',
      authorName: 'Hải Anh',
      authorAvatar: null,
      isSpoiler: true,
      spoilerWarning: 'Đáp án đề thi thử',
      threadParts: ['Lời giải chi tiết đề thi thử'],
    })!;

    const modCase = store.submitModerationReport({
      reporterId: 'user-minhquan',
      reporterName: 'Minh Quân',
      targetType: 'post',
      targetId: targetPost.id,
      targetPreview: 'Lời giải chi tiết đề thi thử',
      targetOwnerId: 'user-haianh',
      reason: 'Kiểm tra chuyên mục',
      details: 'Xem xét lại nhãn ẩn nội dung',
    })!;
    expect(modCase.workflowStatus).toBe('pending_review');

    store.applyAdminModerationAction(
      modCase.id,
      'Admin',
      'action_applied',
      'remove_content',
      'Tạm gỡ chờ xác minh'
    );
    expect(
      useSocialStore.getState().posts.find((p) => p.id === targetPost.id)?.lifecycleStatus
    ).toBe('removed');

    store.submitUserAppeal(modCase.id, 'user-haianh', 'Bài đã gắn nhãn ẩn nội dung hợp lệ');
    expect(
      useSocialStore.getState().moderationCases.find((c) => c.id === modCase.id)?.workflowStatus
    ).toBe('appealed');

    store.resolveUserAppeal(modCase.id, 'Admin', 'accepted', 'Khôi phục bài viết hợp lệ');
    expect(
      useSocialStore.getState().posts.find((p) => p.id === targetPost.id)?.lifecycleStatus
    ).toBe('published');

    const doc = await store.createOrUpdateAdminDocument('Admin', {
      title: 'Đề Cương Ôn Thi Trí Tuệ Nhân Tạo Đại Học',
      description: 'Tài liệu chính thức',
      coverUrl: null,
      category: 'AI',
      tags: ['AI', 'CNTT'],
      fileFormat: 'pdf',
      richContent: '# Chương 1: Tìm kiếm A* & Minimax',
      status: 'published',
      allowDownload: true,
      recipientUserIds: [],
      recipientCommunityIds: [],
    });

    const gifted = store.giftAdminDocument({
      adminName: 'Admin',
      docId: doc.id,
      targetScope: 'user',
      userIds: ['user-haianh'],
      targetLabel: 'Hải Anh',
    });
    expect(gifted?.recipientUserIds).toContain('user-haianh');
    expect(gifted?.giftHistory).toHaveLength(1);
    expect(useSocialStore.getState().auditLogs.length).toBeGreaterThanOrEqual(3);
  });
});
