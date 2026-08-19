import { SearchBar } from "@/components/SearchBar";
import { SubredditFilterModal } from "@/components/SubredditFilterModal";
import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import {
  SubredditPostPreview,
  SubredditSort,
  SubredditTimeRange,
  useSubredditImport,
} from "@/hooks/useSubredditImport";
import { usePosts } from "@/hooks/usePosts";
import { usePostSync } from "@/hooks/usePostSync";
import { useRedditApi } from "@/hooks/useRedditApi";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { buildSavedLibraryIndex } from "@/utils/savedLibraryIndex";
import { openRedditSubreddit } from "@/utils/redditLinks";
import { parseSubredditNames } from "@/utils/subredditNames";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  InteractionManager,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

/** Rows we try to keep on screen before waiting for the user to scroll. */
const MIN_VISIBLE_POSTS = 15;
/** Upper bound on posts auto-fetched to satisfy MIN_VISIBLE_POSTS. */
const MAX_AUTO_LOADED_POSTS = 300;
/** Idle time before a typed query is applied to the loaded posts. */
const SEARCH_DEBOUNCE_MS = 200;
/**
 * How stale the saved-post list may be before this screen re-queries it on
 * focus. In-app changes update the shared list immediately, so this only
 * bounds drift from writes made outside it.
 */
const SAVED_POSTS_MAX_AGE_MS = 30_000;

export default function SubredditImportScreen() {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const router = useRouter();
  const { subreddit } = useLocalSearchParams<{
    subreddit?: string | string[];
  }>();
  const subredditParam = useMemo(() => {
    if (!subreddit) return "";
    return Array.isArray(subreddit) ? (subreddit[0] ?? "") : subreddit;
  }, [subreddit]);

  const subredditName = useMemo(() => {
    const raw = String(subredditParam ?? "").trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [subredditParam]);

  /** "sub1+sub2+sub3" (Reddit's own multireddit syntax) means "Search All". */
  const subredditNames = useMemo(
    () => parseSubredditNames(subredditName),
    [subredditName],
  );
  const isSearchAll = subredditNames.length > 1;

  const [sort, setSort] = useState<SubredditSort>("hot");
  const [timeRange, setTimeRange] = useState<SubredditTimeRange>("day");

  const {
    posts: redditPosts,
    loading,
    error,
    hasMore,
    loadMore,
  } = useSubredditImport(subredditName, sort, timeRange);
  const {
    posts: savedPosts,
    handleAddPost: addPostFromUrl,
    refreshPosts,
    refreshPostsIfStale,
  } = usePosts();
  const { getPostData } = useRedditApi();
  const { syncSinglePost } = usePostSync({ autoStart: false });

  const [addingPostIds, setAddingPostIds] = useState<Set<string>>(new Set());
  const [archivingPostIds, setArchivingPostIds] = useState<Set<string>>(
    new Set(),
  );
  const [hideEmpty, setHideEmpty] = useState(true);
  const [minScore, setMinScore] = useState(0);
  const [minComments, setMinComments] = useState(0);
  const [search, setSearch] = useState("");

  // Walking the whole library is deferred: React keeps the previous index for
  // the urgent render, so a library reload (or first population) never blocks
  // the Reddit rows from painting — the ticks and author stats fill in on the
  // follow-up low-priority render instead.
  const deferredSavedPosts = useDeferredValue(savedPosts);
  const { savedRedditIds, postByRedditId, authorStats, titlesInSubreddits } =
    useMemo(
      () => buildSavedLibraryIndex(deferredSavedPosts, subredditNames),
      [deferredSavedPosts, subredditNames],
    );

  // Typing re-scans the body of every loaded post, so filter on a debounced
  // copy of the query while the text input itself stays immediate.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const filteredRedditPosts = useMemo(() => {
    let posts = redditPosts;
    if (hideEmpty) {
      posts = posts.filter((post) => post.wordCount > 0);
    }
    if (minScore > 0) {
      posts = posts.filter((post) => (post.score ?? 0) >= minScore);
    }
    if (minComments > 0) {
      posts = posts.filter((post) => post.commentCount >= minComments);
    }
    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      posts = posts.filter(
        (post) =>
          post.titleKey.includes(q) || post.bodyText.toLowerCase().includes(q),
      );
    }
    console.debug(
      `[SubredditScreen] filteredRedditPosts: raw=${redditPosts.length} hideEmpty=${hideEmpty} minScore=${minScore} minComments=${minComments} search="${debouncedSearch}" -> filtered=${posts.length}`,
    );
    return posts;
  }, [redditPosts, hideEmpty, minScore, minComments, debouncedSearch]);

  // Filters are applied client-side, so a strict one (e.g. 100+ upvotes) can
  // drop a whole page and leave too few rows to scroll — which means
  // onEndReached never fires and the list looks empty. Keep pulling pages until
  // the screen is filled or we've fetched a sensible maximum.
  useEffect(() => {
    if (loading || !hasMore) return;
    if (filteredRedditPosts.length >= MIN_VISIBLE_POSTS) return;
    if (redditPosts.length >= MAX_AUTO_LOADED_POSTS) return;
    loadMore();
  }, [
    filteredRedditPosts.length,
    redditPosts.length,
    loading,
    hasMore,
    loadMore,
  ]);

  // Refresh the saved-post list on focus so "already added" ticks stay current.
  // It re-queries the whole library, so it waits until navigation and the first
  // paint are done, and is skipped outright if the list is already fresh.
  // The Reddit listing itself is loaded (and reloaded on sort/time-range
  // changes) by useSubredditImport.
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        refreshPostsIfStale(SAVED_POSTS_MAX_AGE_MS);
      });
      return () => task.cancel();
    }, [refreshPostsIfStale]),
  );

  // Handle back button
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.back();
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
    }, [router]),
  );

  /** Relative post age, e.g. "5m", "2h", "3d", matching Reddit's own display. */
  const formatPostDate = useCallback((created: number) => {
    if (!created) return "";
    const diffSeconds = Math.max(0, Date.now() / 1000 - created);
    const minutes = Math.floor(diffSeconds / 60);
    if (minutes < 1) return "now";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}m`;
    return `${Math.floor(months / 12)}y`;
  }, []);

  const handleAddPost = useCallback(
    async (redditPost: SubredditPostPreview) => {
      if (addingPostIds.has(redditPost.id)) return;

      setAddingPostIds((prev) => new Set(prev).add(redditPost.id));

      try {
        const fullUrl = `https://www.reddit.com${redditPost.permalink}`;

        await addPostFromUrl(fullUrl, {
          getPostData,
          syncSinglePost,
          skipDuplicateCheck: false,
          skipSimilarCheck: false,
          onSuccess: async () => {
            await refreshPosts();
            Alert.alert("Success", "Post added successfully!");
          },
          onError: (err) => {
            Alert.alert("Error", `Failed to add post: ${err.message}`);
          },
        });
      } finally {
        setAddingPostIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(redditPost.id);
          return newSet;
        });
      }
    },
    [addingPostIds, addPostFromUrl, getPostData, syncSinglePost, refreshPosts],
  );

  const handleAddArchived = useCallback(
    async (redditPost: SubredditPostPreview) => {
      if (
        addingPostIds.has(redditPost.id) ||
        archivingPostIds.has(redditPost.id)
      )
        return;
      if (savedRedditIds.has(redditPost.id)) return;

      setArchivingPostIds((prev) => new Set(prev).add(redditPost.id));

      try {
        const fullUrl = `https://www.reddit.com${redditPost.permalink}`;

        await addPostFromUrl(fullUrl, {
          getPostData,
          syncSinglePost,
          addToArchive: true,
          skipDuplicateCheck: false,
          skipSimilarCheck: false,
          onSuccess: async () => {
            await refreshPosts();
            Alert.alert("Archived", "Post added to archive!");
          },
          onError: (err) => {
            Alert.alert("Error", `Failed to archive post: ${err.message}`);
          },
        });
      } finally {
        setArchivingPostIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(redditPost.id);
          return newSet;
        });
      }
    },
    [
      addingPostIds,
      archivingPostIds,
      addPostFromUrl,
      getPostData,
      refreshPosts,
      savedRedditIds,
      syncSinglePost,
    ],
  );

  const renderPostItem = useCallback(
    ({ item }: { item: SubredditPostPreview }) => {
      const isAdded = savedRedditIds.has(item.id);
      const isAdding = addingPostIds.has(item.id);
      const isArchiving = archivingPostIds.has(item.id);
      const wordCount = item.wordCount;
      const publishedDate = formatPostDate(item.created);
      const score =
        typeof item.score === "number" ? item.score.toLocaleString() : null;
      const commentCount = item.commentCount.toLocaleString();
      const fullUrl = `https://www.reddit.com${item.permalink}`;
      const stats = authorStats.get((item.author || "").toLowerCase());
      const isDuplicateTitle = titlesInSubreddits.has(item.titleKey);
      const muteTitle = isDuplicateTitle || wordCount === 0;

      const handlePress = () => {
        if (isAdded) {
          const savedPost = postByRedditId.get(item.id);
          if (savedPost?.id) {
            router.push(`/post/${savedPost.id}` as any);
            return;
          }
        }
        Linking.openURL(fullUrl);
      };

      return (
        <TouchableOpacity
          style={styles.postItem}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <View>
            <Text style={[styles.postTitle, muteTitle && styles.mutedTitle]}>
              {item.title}
            </Text>
          </View>
          <View style={styles.rowMetaActions}>
            <View
              style={styles.leftMeta}
              onStartShouldSetResponder={() => true}
            >
              <TouchableOpacity
                onPress={() =>
                  router.push(
                    `/author/${encodeURIComponent(item.author)}` as any,
                  )
                }
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Text style={styles.metadataText}>
                  {isSearchAll
                    ? `r/${item.subreddit} • u/${item.author}`
                    : `u/${item.author}`}
                </Text>
              </TouchableOpacity>
              {stats && stats.readAvgRating != null ? (
                <View style={styles.authorStat}>
                  <Icon name="star" size={11} color={palette.starYellow} />
                  <Text style={styles.metadataText}>
                    {stats.readAvgRating.toFixed(1)}
                  </Text>
                </View>
              ) : null}
              {stats && stats.activeCount > 0 ? (
                <View style={styles.authorStat}>
                  <Icon
                    name="description"
                    size={11}
                    color={palette.foregroundMidLight}
                  />
                  <Text style={styles.metadataText}>{stats.activeCount}</Text>
                </View>
              ) : null}
              {publishedDate ? (
                <>
                  <Text style={styles.separator}>•</Text>
                  <Text style={styles.metadataText}>{publishedDate}</Text>
                </>
              ) : null}
            </View>
            <View
              style={styles.postAction}
              onStartShouldSetResponder={() => true}
            >
              {isAdding || isArchiving ? (
                <ActivityIndicator
                  size="small"
                  color={palette.foregroundMidLight}
                />
              ) : isAdded ? (
                <Icon name="check-circle" size={20} color={palette.saveGreen} />
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => handleAddPost(item)}
                    style={styles.addButton}
                    accessibilityLabel="Add post"
                  >
                    <Icon
                      name="download"
                      size={20}
                      color={palette.foregroundMidLight}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleAddArchived(item)}
                    style={styles.addButton}
                    accessibilityLabel="Add to archive"
                  >
                    <Icon
                      name="archive"
                      size={18}
                      color={palette.foregroundMidLight}
                      style={{ marginBottom: 2 }}
                    />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
          <View style={styles.rowStats}>
            {score ? (
              <Text style={styles.metadataText}>{score} upvotes</Text>
            ) : null}
            {score ? <Text style={styles.separator}>•</Text> : null}
            <Text style={styles.metadataText}>{commentCount} comments</Text>
            <Text style={styles.separator}>•</Text>
            <Text style={styles.metadataText}>{wordCount} words</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [
      savedRedditIds,
      addingPostIds,
      archivingPostIds,
      formatPostDate,
      postByRedditId,
      titlesInSubreddits,
      authorStats,
      isSearchAll,
      router,
      handleAddPost,
      handleAddArchived,
      styles,
      palette,
    ],
  );

  const handleEndReached = useCallback(() => {
    if (!loading && hasMore) {
      loadMore();
    }
  }, [loading, hasMore, loadMore]);

  const renderFooter = useCallback(() => {
    return (
      <View style={styles.footer}>
        {loading ? (
          <>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.footerText}>Loading more posts...</Text>
          </>
        ) : hasMore ? (
          <Text style={styles.footerText}>Swipe to Load More</Text>
        ) : (
          <Text style={styles.footerText}>No More Posts</Text>
        )}
      </View>
    );
  }, [loading, hasMore, styles, palette]);

  const renderEmpty = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      );
    }

    if (!subredditName) return null;

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No posts found</Text>
        <Text style={styles.emptySubtitle}>
          {error
            ? "There was an error loading posts."
            : "This subreddit has no posts matching this filter."}
        </Text>
        <View style={styles.emptyFooter}>
          <Text style={styles.footerHint}>
            {hasMore ? "Swipe to Load More" : "No More Posts"}
          </Text>
        </View>
      </View>
    );
  }, [subredditName, error, hasMore, loading, styles, palette]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={26} color={palette.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isSearchAll ? (
            `Search All (${subredditNames.length})`
          ) : subredditName ? (
            <Text
              style={styles.headerLink}
              onPress={() => openRedditSubreddit(subredditName)}
            >
              {`r/${subredditName}`}
            </Text>
          ) : (
            "Subreddit"
          )}
        </Text>
        <SubredditFilterModal
          sort={sort}
          timeRange={timeRange}
          minScore={minScore}
          minComments={minComments}
          onSortChange={setSort}
          onTimeRangeChange={setTimeRange}
          onMinScoreChange={setMinScore}
          onMinCommentsChange={setMinComments}
        />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error.message}</Text>
        </View>
      )}

      <FlashList
        data={filteredRedditPosts}
        keyExtractor={(item) => item.id}
        renderItem={renderPostItem}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            <View style={styles.searchContainer}>
              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder="Search loaded posts..."
              />
            </View>
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>Hide empty</Text>
              <Switch
                value={hideEmpty}
                onValueChange={setHideEmpty}
                thumbColor={
                  hideEmpty ? palette.foregroundMidLight : palette.border
                }
                trackColor={{ true: palette.border, false: palette.border }}
              />
            </View>
          </>
        }
        ListFooterComponent={renderFooter}
        ListFooterComponentStyle={styles.footerContainer}
        scrollEventThrottle={16}
        contentContainerStyle={
          filteredRedditPosts.length === 0
            ? styles.emptyListContainer
            : undefined
        }
        ListEmptyComponent={renderEmpty}
      />
    </SafeAreaView>
  );
}

function makeStyles(
  palette: ThemeContextValue["palette"],
  fontSizes: ThemeContextValue["fontSizes"],
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
      backgroundColor: palette.background,
    },
    headerTitle: {
      fontSize: fontSizes.large,
      fontWeight: fontWeights.semibold,
      color: palette.foreground,
      flex: 1,
      marginHorizontal: spacing.m,
    },
    headerLink: {
      // textDecorationLine: "underline",
    },
    errorContainer: {
      backgroundColor: palette.favHeartRed,
      padding: spacing.m,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    errorText: {
      color: palette.background,
      fontSize: fontSizes.body,
    },
    postItem: {
      backgroundColor: palette.background,
      borderRadius: 0,
      padding: spacing.m,
      marginHorizontal: 0,
      marginVertical: 0,
      shadowColor: palette.cardShadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      borderWidth: 0,
      borderBottomWidth: 1,
      borderColor: palette.border,
    },
    postTitle: {
      fontSize: fontSizes.title * 0.9,
      fontWeight: fontWeights.semibold,
      color: palette.foreground,
      marginBottom: spacing.xs,
      lineHeight: 24 * 0.9,
    },
    mutedTitle: {
      color: palette.muted,
    },
    rowMetaActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.s,
    },
    rowStats: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 0,
    },
    leftMeta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      flexShrink: 1,
      flexWrap: "wrap",
    },
    authorStat: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      marginLeft: spacing.s,
    },
    metadataText: {
      fontSize: fontSizes.small * 0.8,
      color: palette.muted,
    },
    separator: {
      fontSize: fontSizes.body,
      color: palette.muted,
      marginHorizontal: spacing.xs,
    },
    postAction: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.s,
    },
    addButton: {
      padding: spacing.xs / 2,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.m,
    },
    footerContainer: {
      paddingBottom: spacing.l,
    },
    footerText: {
      fontSize: fontSizes.body,
      color: palette.muted,
      marginLeft: spacing.s,
    },
    footerHint: {
      fontSize: fontSizes.small,
      color: palette.muted,
    },
    emptyFooter: {
      marginTop: spacing.l,
    },
    emptyListContainer: {
      flexGrow: 1,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.l,
      paddingVertical: spacing.xl,
    },
    emptyTitle: {
      fontSize: fontSizes.title,
      fontWeight: fontWeights.semibold,
      color: palette.foreground,
      marginBottom: spacing.s,
    },
    emptySubtitle: {
      fontSize: fontSizes.body,
      color: palette.muted,
      textAlign: "center",
      lineHeight: 20,
    },
    loadingText: {
      fontSize: fontSizes.body,
      color: palette.muted,
      marginTop: spacing.m,
    },
    searchContainer: {
      paddingHorizontal: spacing.m,
      paddingTop: spacing.s,
      paddingBottom: spacing.xs,
      borderBottomWidth: 0,
      borderBottomColor: palette.border,
    },
    listHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.s,
      paddingHorizontal: spacing.m,
      paddingTop: 0,
      paddingBottom: spacing.xs,
      backgroundColor: palette.background,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    listHeaderText: {
      fontSize: fontSizes.small,
      color: palette.muted,
      paddingLeft: 4,
    },
  });
}
