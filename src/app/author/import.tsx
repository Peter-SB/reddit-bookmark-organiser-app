import { SearchBar } from "@/components/SearchBar";
import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import { useAuthorImport, RedditPostPreview } from "@/hooks/useAuthorImport";
import { usePosts } from "@/hooks/usePosts";
import { usePostSync } from "@/hooks/usePostSync";
import { useRedditApi } from "@/hooks/useRedditApi";
import { openRedditUser } from "@/utils/redditLinks";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

export default function AuthorImportScreen() {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const router = useRouter();
  const { author } = useLocalSearchParams<{ author?: string | string[] }>();
  const authorParam = useMemo(() => {
    if (!author) return "";
    return Array.isArray(author) ? (author[0] ?? "") : author;
  }, [author]);

  const authorName = useMemo(() => {
    const raw = String(authorParam ?? "").trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [authorParam]);

  const {
    posts: redditPosts,
    loading,
    error,
    hasMore,
    loadMore,
  } = useAuthorImport(authorName);
  const {
    posts: savedPosts,
    addPost,
    handleAddPost: addPostFromUrl,
    refreshPosts,
  } = usePosts();
  const { getPostData } = useRedditApi();
  const { syncSinglePost } = usePostSync({ autoStart: false });

  const [addingPostIds, setAddingPostIds] = useState<Set<string>>(new Set());
  const [archivingPostIds, setArchivingPostIds] = useState<Set<string>>(
    new Set(),
  );
  const [hideEmpty, setHideEmpty] = useState(true);
  const [search, setSearch] = useState("");

  // Track which posts are already saved
  const savedRedditIds = useMemo(() => {
    return new Set(savedPosts.map((p) => p.redditId));
  }, [savedPosts]);
  const savedPostByRedditId = useMemo(() => {
    return new Map(savedPosts.map((post) => [post.redditId, post]));
  }, [savedPosts]);
  const savedTitlesForAuthor = useMemo(() => {
    const target = authorName.toLowerCase();
    const titles = new Set<string>();
    for (const post of savedPosts) {
      if ((post.author || "").toLowerCase() !== target) continue;
      if (post.title) titles.add(post.title.trim().toLowerCase());
    }
    return titles;
  }, [savedPosts, authorName]);

  const filteredRedditPosts = useMemo(() => {
    let posts = redditPosts;
    if (hideEmpty) {
      posts = posts.filter((post) => (post.bodyText || "").trim().length > 0);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      posts = posts.filter(
        (post) =>
          (post.title || "").toLowerCase().includes(q) ||
          (post.bodyText || "").toLowerCase().includes(q),
      );
    }
    return posts;
  }, [redditPosts, hideEmpty, search]);

  // Load initial posts when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (redditPosts.length === 0 && !loading && !error) {
        loadMore();
      }
      refreshPosts();
    }, [loadMore, redditPosts.length, loading, error, refreshPosts]),
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

  // Calculate word count for a post
  const getWordCount = useCallback((bodyText: string) => {
    return bodyText.trim().split(/\s+/).filter(Boolean).length;
  }, []);

  const formatPostDate = useCallback((created: number) => {
    if (!created) return "";
    const date = new Date(created * 1000);
    return date.toLocaleDateString();
  }, []);

  // Handle adding a post
  const handleAddPost = useCallback(
    async (redditPost: RedditPostPreview) => {
      if (addingPostIds.has(redditPost.id)) return;

      setAddingPostIds((prev) => new Set(prev).add(redditPost.id));

      try {
        // Construct the full Reddit URL
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

  // Handle adding a post directly to archive
  const handleAddArchived = useCallback(
    async (redditPost: RedditPostPreview) => {
      if (
        addingPostIds.has(redditPost.id) ||
        archivingPostIds.has(redditPost.id)
      )
        return;
      if (savedRedditIds.has(redditPost.id)) return;

      setArchivingPostIds((prev) => new Set(prev).add(redditPost.id));

      try {
        const fullUrl = `https://www.reddit.com${redditPost.permalink}`;
        const postData = await getPostData(fullUrl);
        const created = await addPost({ ...postData, isArchived: true });
        await syncSinglePost(created.id);
        await refreshPosts();
        Alert.alert("Archived", "Post added to archive!");
      } catch (err) {
        Alert.alert(
          "Error",
          `Failed to archive post: ${(err as Error).message}`,
        );
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
      addPost,
      getPostData,
      refreshPosts,
      savedRedditIds,
      syncSinglePost,
    ],
  );

  // Render each Reddit post item
  const renderPostItem = useCallback(
    ({ item }: { item: RedditPostPreview }) => {
      const isAdded = savedRedditIds.has(item.id);
      const isAdding = addingPostIds.has(item.id);
      const isArchiving = archivingPostIds.has(item.id);
      const wordCount = getWordCount(item.bodyText);
      const publishedDate = formatPostDate(item.created);
      const score =
        typeof item.score === "number" ? item.score.toLocaleString() : null;
      const fullUrl = `https://www.reddit.com${item.permalink}`;
      const normalizedTitle = item.title?.trim().toLowerCase() ?? "";
      const isDuplicateTitle = savedTitlesForAuthor.has(normalizedTitle);
      const muteTitle = isDuplicateTitle || wordCount === 0;

      const handlePress = () => {
        if (isAdded) {
          const savedPost = savedPostByRedditId.get(item.id);
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
            <View style={styles.leftMeta}>
              <Text style={styles.metadataText}>r/{item.subreddit}</Text>
              {publishedDate ? (
                <>
                  <Text style={styles.separator}>•</Text>
                  <Text style={styles.metadataText}>{publishedDate}</Text>
                </>
              ) : null}
              {score ? (
                <>
                  <Text style={styles.separator}>•</Text>
                  <Text style={styles.metadataText}>{score} upvotes</Text>
                </>
              ) : null}
              <Text style={styles.separator}>•</Text>
              <Text style={styles.metadataText}>{wordCount} words</Text>
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
        </TouchableOpacity>
      );
    },
    [
      savedRedditIds,
      addingPostIds,
      archivingPostIds,
      getWordCount,
      formatPostDate,
      savedPostByRedditId,
      savedTitlesForAuthor,
      router,
      handleAddPost,
      handleAddArchived,
      styles,
      palette,
    ],
  );

  // Handle end reached (pagination)
  const handleEndReached = useCallback(() => {
    if (!loading && hasMore) {
      loadMore();
    }
  }, [loading, hasMore, loadMore]);

  // Render footer with loading indicator
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

    if (!authorName) return null;

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No posts found</Text>
        <Text style={styles.emptySubtitle}>
          {error
            ? "There was an error loading posts."
            : "This user has no posts or they may be private."}
        </Text>
        <View style={styles.emptyFooter}>
          <Text style={styles.footerHint}>
            {hasMore ? "Swipe to Load More" : "No More Posts"}
          </Text>
        </View>
      </View>
    );
  }, [authorName, error, hasMore, loading, styles, palette]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={26} color={palette.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {authorName ? (
            <>
              {"Import from "}
              <Text
                style={styles.headerLink}
                onPress={() => openRedditUser(authorName)}
              >
                {`u/${authorName}`}
              </Text>
            </>
          ) : (
            "Import Posts"
          )}
        </Text>
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
    leftMeta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
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
