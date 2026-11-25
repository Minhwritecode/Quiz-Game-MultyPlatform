import { answerLocally } from '@/features/assistant/data/localTutor';
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

describe('Papyrus v3.0 — Urgent Bug Fixes + Production Social Media & Community Suite', () => {
  beforeEach(() => {
    useSocialStore.setState(useSocialStore.getInitialState(), true);
  });

  it('Urgent Bug #1: webVersionCheck records session baseline build and never loops infinitely on reload', async () => {
    const origWindow = (globalThis as { window?: unknown }).window;
    const origFetch = globalThis.fetch;

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
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ version: '3.0.0', build: servedBuild }),
    })) as unknown as typeof fetch;

    try {
      // Initial check on fresh tab load establishes baseline -> MUST return false
      expect(await checkWebAppVersionUpdate()).toBe(false);
      // Repeated poll against the exact same build -> MUST return false (no loop!)
      expect(await checkWebAppVersionUpdate()).toBe(false);

      // Developer deploys a brand-new build while tab is open -> returns true
      servedBuild = '20261126-0200';
      expect(await checkWebAppVersionUpdate()).toBe(true);

      // Once user clicks Reload / Dismiss, acknowledging suppresses re-prompts for that build
      acknowledgeWebBuildUpdate('20261126-0200');
      expect(await checkWebAppVersionUpdate()).toBe(false);
    } finally {
      (globalThis as { window?: unknown }).window = origWindow;
      globalThis.fetch = origFetch;
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

  it('Section 4: Main Profile Name propagates everywhere & disambiguates same-name users without PAPY codes', () => {
    const store = useSocialStore.getState();

    // Two distinct users share the exact same displayName ("Khánh Linh")
    const khanh1 = store.profilesById['scholar-khanh']!;
    const khanh2 = store.profilesById['scholar-baonam']!;
    expect(khanh1.displayName).toBe('Khánh Linh');
    expect(khanh2.displayName).toBe('Khánh Linh');
    expect(khanh1.id).not.toBe(khanh2.id);
    expect(khanh1.major).not.toBe(khanh2.major);

    // Zero scholar code leakage across profiles
    for (const p of Object.values(store.profilesById)) {
      expect(p.displayName).not.toMatch(/PAPY-/i);
    }

    // Propagating a Profile Name update updates authored posts, comments, communities & chat messages
    store.propagateIdentityUpdate('scholar-khanh', {
      displayName: 'Nguyễn Khánh Linh',
      bio: 'Principal Systems Architect',
    });

    const updated = useSocialStore.getState();
    expect(updated.profilesById['scholar-khanh']?.displayName).toBe('Nguyễn Khánh Linh');
    const authoredPost = updated.posts.find((p) => p.id === 'spost-1')!;
    expect(authoredPost.authorName).toBe('Nguyễn Khánh Linh');
    const authoredReply = authoredPost.comments.find((c) => c.id === 'scmt-2')!;
    expect(authoredReply.authorName).toBe('Nguyễn Khánh Linh');
    const commOwner = updated.communities
      .find((c) => c.id === 'comm-software-ai')!
      .members.find((m) => m.userId === 'scholar-khanh')!;
    expect(commOwner.displayName).toBe('Nguyễn Khánh Linh');
    const chatMsg = updated.chatMessages.find((m) => m.id === 'cmsg-1')!;
    expect(chatMsg.senderName).toBe('Nguyễn Khánh Linh');
  });

  it('Section 4.4–4.6: Separates 1-way Follow (public vs private) from 2-way Friendship & enforces Block', () => {
    const store = useSocialStore.getState();
    store.ensureUserProfile({ id: 'user-alice', displayName: 'Alice Trần' });

    // 1-way Follow on public account -> immediately accepted
    expect(store.toggleFollowUser('user-alice', 'scholar-haianh')).toBe('followed');

    // 1-way Follow on private account (scholar-baonam) -> pending request until approved
    expect(store.toggleFollowUser('user-alice', 'scholar-baonam')).toBe('requested');
    expect(
      useSocialStore
        .getState()
        .follows.find((f) => f.followerId === 'user-alice' && f.followingId === 'scholar-baonam')
        ?.status
    ).toBe('pending');
    store.respondFollowRequest('scholar-baonam', 'user-alice', true);
    expect(
      useSocialStore
        .getState()
        .follows.find((f) => f.followerId === 'user-alice' && f.followingId === 'scholar-baonam')
        ?.status
    ).toBe('accepted');

    // 2-way Friend Request lifecycle
    store.sendFriendRequest('user-alice', 'scholar-haianh');
    const req = useSocialStore
      .getState()
      .friendRequests.find(
        (r) => r.senderId === 'user-alice' && r.receiverId === 'scholar-haianh'
      )!;
    expect(req.status).toBe('pending');
    store.respondFriendRequest(req.id, true);

    let s = useSocialStore.getState();
    const graph1 = {
      follows: s.follows,
      friendRequests: s.friendRequests,
      relations: s.relations,
      communities: s.communities,
    };
    expect(areUsersFriends('user-alice', 'scholar-haianh', graph1)).toBe(true);

    // Blocking severs friendships & follows and revokes post access
    store.toggleUserRelation('user-alice', 'scholar-haianh', 'block');
    s = useSocialStore.getState();
    const graph2 = {
      follows: s.follows,
      friendRequests: s.friendRequests,
      relations: s.relations,
      communities: s.communities,
    };
    expect(areUsersBlocked('user-alice', 'scholar-haianh', graph2)).toBe(true);
    expect(areUsersFriends('user-alice', 'scholar-haianh', graph2)).toBe(false);
    const haianhPost = s.posts.find((p) => p.id === 'spost-3')!;
    expect(canViewerAccessPost(haianhPost, 'user-alice', graph2)).toBe(false);
    expect(canViewerReplyToPost(haianhPost, 'user-alice', graph2)).toBe(false);
  });

  it('Section 5 & 16.5: Draft auto-save isolation across accounts, Edit History, Scheduled publish, Ghost expiry & Anonymous masking', () => {
    const store = useSocialStore.getState();

    // Account A saves a composer draft & bookmark
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
    store.toggleSaveBookmark('user-a', 'spost-1');
    store.toggleFavouritePost('user-a', 'spost-2');

    // Switching to Guest / User B never leaks User A's draft, bookmarks, or favourites
    store.switchAccountScope('guest');
    const guestSlice = useSocialStore.getState().userSlices.guest!;
    expect(guestSlice.draft).toBeNull();
    expect(guestSlice.bookmarkedPostIds).toHaveLength(0);
    expect(guestSlice.favouritePostIds).toHaveLength(0);

    // Scheduled Post -> stays scheduled until time arrives
    const pastDueSchedule = new Date(Date.now() + 60_000).toISOString();
    const scheduled = store.createSocialPost({
      authorId: 'user-a',
      authorName: 'User A',
      authorAvatar: null,
      threadParts: ['Bài hẹn giờ xuất bản'],
      scheduledFor: pastDueSchedule,
    });
    expect(scheduled.lifecycleStatus).toBe('scheduled');

    // Ghost Post -> expires after window and becomes inaccessible to other viewers
    const ghost = store.createSocialPost({
      authorId: 'user-a',
      authorName: 'User A',
      authorAvatar: null,
      postKind: 'ghost',
      threadParts: ['Ghost 24h biến mất sau hạn'],
      ghostHours: -1, // Already past expiry
    });
    store.runScheduledAndGhostSweep();
    const afterSweep = useSocialStore.getState();
    const sweptGhost = afterSweep.posts.find((p) => p.id === ghost.id)!;
    expect(sweptGhost.lifecycleStatus).toBe('expired');
    expect(
      canViewerAccessPost(sweptGhost, 'scholar-khanh', {
        follows: afterSweep.follows,
        friendRequests: afterSweep.friendRequests,
        relations: afterSweep.relations,
        communities: afterSweep.communities,
      })
    ).toBe(false);

    // Anonymous Post -> masks real authorId/authorName for non-moderators while keeping moderator accountability
    const anon = store.createSocialPost({
      authorId: 'user-a',
      authorName: 'User A Thật',
      authorAvatar: 'https://example.com/a.png',
      postKind: 'anonymous',
      isAnonymous: true,
      threadParts: ['Tâm sự ẩn danh mùa thi'],
    });
    const publicView = projectSafePostForViewer(anon, 'scholar-haianh', false);
    expect(publicView.authorId).toBe('anonymous-member');
    expect(publicView.internalAuthorId).toBeUndefined();
    expect(publicView.authorName).toBe('Thành viên Ẩn danh');
    expect(publicView.authorAvatar).toBeNull();

    const modView = projectSafePostForViewer(anon, 'admin-1', true);
    expect(modView.authorName).toContain('User A Thật');

    // Edit Post -> preserves previous version in editHistory
    expect(store.editSocialPost(scheduled.id, 'user-a', ['Nội dung đã cập nhật v2'])).toBe(true);
    const edited = useSocialStore.getState().posts.find((p) => p.id === scheduled.id)!;
    expect(edited.threadParts[0]).toBe('Nội dung đã cập nhật v2');
    expect(edited.editHistory).toHaveLength(1);
    expect(edited.editHistory[0]?.previousParts[0]).toBe('Bài hẹn giờ xuất bản');
  });

  it('Section 6, 7, 8.5 & 9.4: Vietnamese search, Your Algo ranking, Unified Zalo Polls & SharedPostCard permissions', () => {
    const store = useSocialStore.getState();

    // Vietnamese diacritic-insensitive search
    expect(matchesVietnameseSearch('Kỹ thuật Phần mềm & Hệ Điều Hành', 'he dieu hanh')).toBe(true);
    expect(matchesVietnameseSearch('Nguyễn Khánh Linh', 'khanh linh')).toBe(true);

    // Unified Zalo Poll single-choice vote switching, option adding & closing
    store.voteUnifiedPoll('post', 'spost-2', 'uopt-1', 'voter-1');
    store.voteUnifiedPoll('post', 'spost-2', 'uopt-2', 'voter-1'); // Single-choice switches cleanly
    let poll = useSocialStore.getState().posts.find((p) => p.id === 'spost-2')!.poll!;
    expect(poll.options[0]?.voterIds).not.toContain('voter-1');
    expect(poll.options[1]?.voterIds).toContain('voter-1');

    store.addUnifiedPollOption('post', 'spost-2', 'Phương án Hybrid', {
      id: 'voter-1',
      name: 'Voter Một',
    });
    store.toggleCloseUnifiedPoll('post', 'spost-2', 'scholar-minhquan');
    store.voteUnifiedPoll('post', 'spost-2', 'uopt-1', 'voter-2'); // Ignored when closed!
    poll = useSocialStore.getState().posts.find((p) => p.id === 'spost-2')!.poll!;
    expect(poll.options).toHaveLength(3);
    expect(poll.isClosed).toBe(true);
    expect(poll.options[0]?.voterIds).not.toContain('voter-2');

    // Your Algo muted keywords filter out unwanted posts
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
    expect(ranked.some((r) => r.post.id === 'spost-1')).toBe(false);

    // Intelligent Friend Recommendations exclude blocked & self
    store.ensureUserProfile({ id: 'voter-1', displayName: 'Voter Một' });
    const latest = useSocialStore.getState();
    const recs = computeIntelligentFriendRecommendations({
      candidates: Object.values(latest.profilesById),
      posts: latest.posts,
      viewerId: 'voter-1',
      viewerInterests: ['CNTT', 'AI'],
      graph: {
        follows: latest.follows,
        friendRequests: latest.friendRequests,
        relations: latest.relations,
        communities: latest.communities,
      },
      dismissedUserIds: [],
    });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.profile.id !== 'voter-1')).toBe(true);
  });

  it('Section 13 & 14.8: Moderation workflow + Appeals restoration + Admin Document Gift distribution & Audit Logs', async () => {
    const store = useSocialStore.getState();

    // 1. Report post -> Admin removes content -> User appeals -> Admin accepts appeal & restores post
    const modCase = store.submitModerationReport({
      reporterId: 'scholar-minhquan',
      reporterName: 'Minh Quân',
      targetType: 'post',
      targetId: 'spost-3',
      targetPreview: 'Đáp án chi tiết đề thi thử',
      targetOwnerId: 'scholar-haianh',
      reason: 'Nghi ngờ nhầm mục',
      details: 'Kiểm tra lại chuyên mục',
    });
    expect(modCase.workflowStatus).toBe('pending_review');

    store.applyAdminModerationAction(
      modCase.id,
      'Admin',
      'action_applied',
      'remove_content',
      'Tạm gỡ chờ xác minh'
    );
    expect(useSocialStore.getState().posts.find((p) => p.id === 'spost-3')?.lifecycleStatus).toBe(
      'removed'
    );

    store.submitUserAppeal(modCase.id, 'scholar-haianh', 'Bài đã gắn nhãn Spoiler đúng nội quy');
    expect(
      useSocialStore.getState().moderationCases.find((c) => c.id === modCase.id)?.workflowStatus
    ).toBe('appealed');

    store.resolveUserAppeal(modCase.id, 'Admin', 'accepted', 'Khôi phục bài viết hợp lệ');
    expect(useSocialStore.getState().posts.find((p) => p.id === 'spost-3')?.lifecycleStatus).toBe(
      'published'
    );

    // 2. Admin creates & gifts an academic document -> recorded in giftHistory & immutable auditLogs
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
      userIds: ['scholar-haianh'],
      targetLabel: 'Hải Anh',
    });
    expect(gifted?.recipientUserIds).toContain('scholar-haianh');
    expect(gifted?.giftHistory).toHaveLength(1);
    expect(useSocialStore.getState().auditLogs.length).toBeGreaterThanOrEqual(3);
  });
});
