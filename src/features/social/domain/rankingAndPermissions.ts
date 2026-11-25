import type {
  FollowEdge,
  FriendRecommendationItem,
  FriendRequestRecord,
  FeedModeType,
  SocialCommunityGroup,
  SocialPostItem,
  SocialUserProfile,
  UserRelationType,
  YourAlgoConfig,
} from './models';

export interface SocialGraphSnapshot {
  follows: FollowEdge[];
  friendRequests: FriendRequestRecord[];
  relations: Array<{ actorId: string; targetId: string; type: UserRelationType }>;
  communities: SocialCommunityGroup[];
}

export function removeVietnameseTones(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function matchesVietnameseSearch(haystack: string, query: string): boolean {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return true;
  if (haystack.toLowerCase().includes(cleanQ)) return true;

  const normHay = removeVietnameseTones(haystack);
  const normQ = removeVietnameseTones(cleanQ);
  if (normHay.includes(normQ)) return true;

  const tokens = normQ.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return false;
  return tokens.every((tok) => normHay.includes(tok));
}

export function areUsersBlocked(u1: string, u2: string, graph: SocialGraphSnapshot): boolean {
  if (!u1 || !u2 || u1 === u2) return false;
  return graph.relations.some(
    (r) =>
      r.type === 'block' &&
      ((r.actorId === u1 && r.targetId === u2) || (r.actorId === u2 && r.targetId === u1))
  );
}

export function isUserMutedByViewer(viewerId: string, authorId: string, graph: SocialGraphSnapshot): boolean {
  return graph.relations.some(
    (r) => r.type === 'mute' && r.actorId === viewerId && r.targetId === authorId
  );
}

export function areUsersFriends(u1: string, u2: string, graph: SocialGraphSnapshot): boolean {
  if (!u1 || !u2 || u1 === u2) return false;
  return graph.friendRequests.some(
    (fr) =>
      fr.status === 'accepted' &&
      ((fr.senderId === u1 && fr.receiverId === u2) || (fr.senderId === u2 && fr.receiverId === u1))
  );
}

export function isFollowingAccepted(followerId: string, followingId: string, graph: SocialGraphSnapshot): boolean {
  return graph.follows.some(
    (f) => f.followerId === followerId && f.followingId === followingId && f.status === 'accepted'
  );
}

export function isCloseFriendOfAuthor(authorId: string, viewerId: string, graph: SocialGraphSnapshot): boolean {
  return graph.follows.some(
    (f) => f.followerId === viewerId && f.followingId === authorId && f.isCloseFriend
  );
}

export function hasCommunityReadAccess(
  communityId: string | null | undefined,
  viewerId: string,
  communities: SocialCommunityGroup[]
): boolean {
  if (!communityId) return true;
  const comm = communities.find((c) => c.id === communityId);
  if (!comm || comm.isSuspended) return false;
  if (comm.visibility === 'public') return true;
  return comm.members.some(
    (m) =>
      m.userId === viewerId &&
      (m.role === 'owner' || m.role === 'admin' || m.role === 'moderator' || m.role === 'member')
  );
}

export function isPostExpiredAt(post: SocialPostItem, nowMs = Date.now()): boolean {
  if (post.lifecycleStatus === 'expired') return true;
  if (!post.expiresAt) return false;
  const exp = Date.parse(post.expiresAt);
  return Number.isFinite(exp) && exp <= nowMs;
}

/**
 * Permission-aware Post Visibility Check (used across Feed, Search, Profile, SharedPostCard, Repost/Quote, Notifications & AI!)
 */
export function canViewerAccessPost(
  post: SocialPostItem,
  viewerId: string,
  graph: SocialGraphSnapshot,
  nowMs = Date.now()
): boolean {
  const realAuthor = post.internalAuthorId || post.authorId;
  if (viewerId && realAuthor === viewerId) {
    return post.lifecycleStatus !== 'removed';
  }
  if (post.lifecycleStatus !== 'published') return false;
  if (isPostExpiredAt(post, nowMs)) return false;
  if (viewerId && areUsersBlocked(realAuthor, viewerId, graph)) return false;

  if (post.communityId) {
    return hasCommunityReadAccess(post.communityId, viewerId, graph.communities);
  }

  switch (post.audience) {
    case 'public':
      return true;
    case 'only_me':
      return false;
    case 'selected':
      return Boolean(viewerId && post.selectedAudienceIds.includes(viewerId));
    case 'followers':
      return Boolean(viewerId && isFollowingAccepted(viewerId, realAuthor, graph));
    case 'friends':
      return Boolean(viewerId && areUsersFriends(realAuthor, viewerId, graph));
    case 'close_friends':
      return Boolean(viewerId && isCloseFriendOfAuthor(realAuthor, viewerId, graph));
    case 'community':
      return hasCommunityReadAccess(post.communityId, viewerId, graph.communities);
    default:
      return false;
  }
}

export function canViewerReplyToPost(
  post: SocialPostItem,
  viewerId: string,
  graph: SocialGraphSnapshot
): boolean {
  if (!viewerId || viewerId === 'guest') return false;
  const realAuthor = post.internalAuthorId || post.authorId;
  if (realAuthor === viewerId) return true;
  if (!canViewerAccessPost(post, viewerId, graph)) return false;
  if (areUsersBlocked(realAuthor, viewerId, graph)) return false;

  switch (post.replyPermission) {
    case 'everyone':
      return true;
    case 'nobody':
      return false;
    case 'followers':
      return isFollowingAccepted(viewerId, realAuthor, graph);
    case 'friends':
      return areUsersFriends(realAuthor, viewerId, graph);
    case 'mentioned':
      return post.mentionedUserIds.includes(viewerId);
    case 'selected':
      return Boolean(post.selectedReplyUserIds?.includes(viewerId));
    default:
      return false;
  }
}

/**
 * Masks real identity on Anonymous Posts for non-moderator viewers so identity never leaks!
 */
export function projectSafePostForViewer(
  post: SocialPostItem,
  viewerId: string,
  isAdminOrModerator = false
): SocialPostItem {
  if (!post.isAnonymous) return post;
  const realAuthor = post.internalAuthorId || post.authorId;
  if (isAdminOrModerator || realAuthor === viewerId) {
    return {
      ...post,
      authorName:
        realAuthor === viewerId
          ? 'Thành viên Ẩn danh (Bài của bạn)'
          : `Thành viên Ẩn danh [Kiểm duyệt: ${post.authorName}]`,
      authorAvatar: null,
    };
  }
  return {
    ...post,
    authorId: 'anonymous-member',
    internalAuthorId: undefined,
    authorName: 'Thành viên Ẩn danh',
    authorAvatar: null,
    authorBio: 'Danh tính được bảo vệ theo quy tắc Cộng đồng',
  };
}

/**
 * Multi-Signal Feed Ranking & Your Algo Recommendation Engine
 */
export function rankAndFilterFeedPosts(params: {
  posts: SocialPostItem[];
  viewerId: string;
  mode: FeedModeType;
  algo: YourAlgoConfig;
  graph: SocialGraphSnapshot;
  selectedTopic?: string;
  selectedLocationArea?: string;
  customFeed?: { topics: string[]; accountIds: string[]; communityIds: string[] } | null;
  nowMs?: number;
}): Array<{ post: SocialPostItem; score: number; reason: string }> {
  const nowMs = params.nowMs ?? Date.now();
  const algoActive =
    !params.algo.preferenceExpiresAt || Date.parse(params.algo.preferenceExpiresAt) > nowMs;

  const boostedSet = new Set(
    (algoActive ? params.algo.boostedTopics : []).map((t) => removeVietnameseTones(t))
  );
  const hiddenSet = new Set(
    (algoActive ? params.algo.hiddenTopics : []).map((t) => removeVietnameseTones(t))
  );
  const mutedWords = (algoActive ? params.algo.mutedKeywords : []).map((w) =>
    w.trim().toLowerCase()
  ).filter(Boolean);

  const results: Array<{ post: SocialPostItem; score: number; reason: string }> = [];
  const seenIds = new Set<string>();

  for (const rawPost of params.posts) {
    if (seenIds.has(rawPost.id)) continue;
    seenIds.add(rawPost.id);

    const realAuthor = rawPost.internalAuthorId || rawPost.authorId;
    if (!canViewerAccessPost(rawPost, params.viewerId, params.graph, nowMs)) continue;
    if (params.viewerId && isUserMutedByViewer(params.viewerId, realAuthor, params.graph)) continue;
    if (algoActive && params.algo.notInterestedPostIds.includes(rawPost.id)) continue;

    const fullText = `${rawPost.threadParts.join(' ')} ${rawPost.longFormBody ?? ''}`.toLowerCase();
    if (mutedWords.some((kw) => fullText.includes(kw))) continue;

    const normPostTopics = [...rawPost.topics, ...rawPost.hashtags].map(removeVietnameseTones);
    if (normPostTopics.some((t) => hiddenSet.has(t))) continue;

    // Mode-specific gates
    const isFollowing = isFollowingAccepted(params.viewerId, realAuthor, params.graph);
    const isFriend = areUsersFriends(params.viewerId, realAuthor, params.graph);

    if (params.mode === 'following' && !isFollowing && realAuthor !== params.viewerId) continue;
    if (params.mode === 'friends' && !isFriend && realAuthor !== params.viewerId) continue;
    if (params.mode === 'debate' && rawPost.postKind !== 'debate' && !rawPost.debate) continue;
    if (params.mode === 'nearby') {
      if (!rawPost.locationLabel) continue;
      if (
        params.selectedLocationArea &&
        params.selectedLocationArea !== 'ALL' &&
        !matchesVietnameseSearch(rawPost.locationLabel, params.selectedLocationArea)
      ) {
        continue;
      }
    }
    if (params.mode === 'knowledge' || (algoActive && params.algo.knowledgeMode)) {
      const hasKnowledgeSignal =
        Boolean(rawPost.attachedQuiz) ||
        Boolean(rawPost.codeSnippet) ||
        Boolean(rawPost.longFormBody) ||
        rawPost.threadParts.length >= 2 ||
        rawPost.topics.some((t) => !/giải trí|meme/i.test(t));
      if (!hasKnowledgeSignal && realAuthor !== params.viewerId) continue;
    }
    if (params.mode === 'custom' && params.customFeed) {
      const cf = params.customFeed;
      const matchAcc = cf.accountIds.includes(realAuthor);
      const matchComm = Boolean(rawPost.communityId && cf.communityIds.includes(rawPost.communityId));
      const matchTop = cf.topics.some((ct) =>
        normPostTopics.some((pt) => pt.includes(removeVietnameseTones(ct)))
      );
      if (!matchAcc && !matchComm && !matchTop) continue;
    }

    if (
      params.selectedTopic &&
      params.selectedTopic !== 'ALL' &&
      !rawPost.topics.includes(params.selectedTopic) &&
      !rawPost.hashtags.includes(params.selectedTopic)
    ) {
      continue;
    }

    // Score calculation (Recency + Engagement + Social Graph + Your Algo + Quality)
    const ageHours = Math.max(0.1, (nowMs - Date.parse(rawPost.createdAt)) / 3_600_000);
    const recencyScore = Math.max(5, 100 / Math.pow(ageHours + 1.5, 0.65));

    const totalReactions = Object.values(rawPost.reactions).reduce(
      (acc, arr) => acc + (arr?.length ?? 0),
      0
    );
    const engagementScore =
      totalReactions * 4 +
      rawPost.comments.length * 6 +
      rawPost.repostedByIds.length * 5 +
      rawPost.quoteCount * 7;

    let socialScore = 0;
    let reason = 'Đề xuất nổi bật hôm nay';
    if (realAuthor === params.viewerId) {
      socialScore += 28;
      reason = 'Bài viết của bạn';
    } else if (algoActive && params.algo.prioritizedAccountIds.includes(realAuthor)) {
      socialScore += 45;
      reason = 'Tài khoản bạn ưu tiên trong Your Algo';
    } else if (isFriend) {
      socialScore += 32;
      reason = 'Bạn bè hai chiều của bạn';
    } else if (isFollowing) {
      socialScore += 22;
      reason = 'Tác giả bạn đang theo dõi';
    }

    const matchedBoost = [...rawPost.topics, ...rawPost.hashtags].find((t) =>
      boostedSet.has(removeVietnameseTones(t))
    );
    let algoScore = 0;
    if (matchedBoost) {
      algoScore += 38;
      reason = `Khớp chủ đề bạn ưu tiên #${matchedBoost}`;
    }
    if (algoActive && params.algo.showLessAccountIds.includes(realAuthor)) {
      algoScore -= 45;
    }

    if (params.mode === 'trending' && engagementScore >= 12) {
      reason = `Xu hướng sôi nổi · ${totalReactions + rawPost.comments.length} tương tác`;
    }

    const qualityBonus =
      (rawPost.threadParts.length > 1 ? 10 : 0) +
      (rawPost.mediaItems.length > 0 ? 8 : 0) +
      (rawPost.poll ? 9 : 0) +
      (rawPost.attachedQuiz ? 10 : 0);

    const finalScore =
      params.mode === 'trending'
        ? engagementScore * 2.2 + recencyScore * 0.6 + qualityBonus
        : recencyScore + engagementScore * 0.85 + socialScore + algoScore + qualityBonus;

    results.push({
      post: projectSafePostForViewer(rawPost, params.viewerId, false),
      score: Math.round(finalScore * 10) / 10,
      reason,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Intelligent Topic, Content, Mutual-Graph & Community Friend Recommendation Engine (Section 4.4)
 */
export function computeIntelligentFriendRecommendations(params: {
  candidates: SocialUserProfile[];
  posts: SocialPostItem[];
  viewerId: string;
  viewerInterests: string[];
  graph: SocialGraphSnapshot;
  dismissedUserIds: string[];
}): FriendRecommendationItem[] {
  const viewerAuthoredTopics = new Set<string>(
    params.viewerInterests.map(removeVietnameseTones)
  );
  for (const p of params.posts) {
    if ((p.internalAuthorId || p.authorId) === params.viewerId) {
      p.topics.forEach((t) => viewerAuthoredTopics.add(removeVietnameseTones(t)));
      p.hashtags.forEach((h) => viewerAuthoredTopics.add(removeVietnameseTones(h)));
    }
  }

  const viewerFriendIds = new Set<string>();
  params.graph.friendRequests.forEach((fr) => {
    if (fr.status !== 'accepted') return;
    if (fr.senderId === params.viewerId) viewerFriendIds.add(fr.receiverId);
    if (fr.receiverId === params.viewerId) viewerFriendIds.add(fr.senderId);
  });

  const viewerFollowingIds = new Set<string>(
    params.graph.follows
      .filter((f) => f.followerId === params.viewerId && f.status === 'accepted')
      .map((f) => f.followingId)
  );

  const viewerCommunityIds = new Set<string>(
    params.graph.communities
      .filter((c) => c.members.some((m) => m.userId === params.viewerId))
      .map((c) => c.id)
  );

  const out: FriendRecommendationItem[] = [];

  for (const cand of params.candidates) {
    if (cand.id === params.viewerId) continue;
    if (cand.accountStatus !== 'active') continue;
    if (!cand.privacy.discoverableInRecommendations) continue;
    if (params.dismissedUserIds.includes(cand.id)) continue;
    if (areUsersBlocked(params.viewerId, cand.id, params.graph)) continue;
    if (viewerFriendIds.has(cand.id)) continue;

    // Gather candidate's post topics + profile interests
    const candTopicsRaw = new Set<string>(cand.interests);
    for (const p of params.posts) {
      if (!p.isAnonymous && p.authorId === cand.id && p.audience === 'public') {
        p.topics.forEach((t) => candTopicsRaw.add(t));
        p.hashtags.forEach((h) => candTopicsRaw.add(h));
      }
    }

    const sharedTopics: string[] = [];
    candTopicsRaw.forEach((t) => {
      if (viewerAuthoredTopics.has(removeVietnameseTones(t))) {
        sharedTopics.push(t);
      }
    });

    // Mutual friends
    let mutualFriendsCount = 0;
    params.graph.friendRequests.forEach((fr) => {
      if (fr.status !== 'accepted') return;
      const other = fr.senderId === cand.id ? fr.receiverId : fr.receiverId === cand.id ? fr.senderId : null;
      if (other && viewerFriendIds.has(other)) mutualFriendsCount += 1;
    });

    // Mutual followers
    let mutualFollowersCount = 0;
    params.graph.follows.forEach((f) => {
      if (f.followingId === cand.id && f.status === 'accepted' && viewerFollowingIds.has(f.followerId)) {
        mutualFollowersCount += 1;
      }
    });

    // Shared communities
    const sharedComm = params.graph.communities.find(
      (c) => viewerCommunityIds.has(c.id) && c.members.some((m) => m.userId === cand.id)
    );

    const score =
      sharedTopics.length * 25 +
      mutualFriendsCount * 30 +
      mutualFollowersCount * 15 +
      (sharedComm ? 22 : 0) +
      Math.min(20, Math.round(cand.reputationScore / 50));

    const reasons: string[] = [];
    if (sharedTopics.length > 0) {
      reasons.push(`Cùng chủ đề #${sharedTopics.slice(0, 2).join(', #')}`);
    }
    if (mutualFriendsCount > 0) {
      reasons.push(`${mutualFriendsCount} bạn chung`);
    }
    if (sharedComm) {
      reasons.push(`Cùng nhóm "${sharedComm.name}"`);
    }
    if (reasons.length === 0) {
      reasons.push(cand.major ? `Chuyên ngành ${cand.major}` : 'Thành viên tích cực trên Papyrus');
    }

    out.push({
      profile: cand,
      score: Math.max(10, score),
      reasonLabel: reasons.join(' · '),
      sharedTopics: sharedTopics.slice(0, 4),
      mutualFriendsCount,
      mutualFollowersCount,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}
