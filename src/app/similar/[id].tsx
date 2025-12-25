import { PostCard } from "@/components/PostCard";
import { palette } from "@/constants/Colors";
import {
  DEFAULT_SEARCH_INCLUDE_TEXT,
  DEFAULT_SEARCH_RESULTS,
} from "@/constants/search";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import { usePosts } from "@/hooks/usePosts";
import {
  SemanticSearchResult,
  SemanticSearchService,
} from "@/services/SemanticSearchService";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

export default function SimilarPostsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const postId = useMemo(() => parseInt(String(id ?? ""), 10), [id]);

  const { posts, refreshPosts } = usePosts();
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshPosts();
    }, [refreshPosts])
  );

  const postsMap = useMemo(() => {
    const map = new Map<number, (typeof posts)[number]>();
    posts.forEach((p) => map.set(p.id, p));
    return map;
  }, [posts]);

  const fetchSimilar = useCallback(async () => {
    if (!Number.isFinite(postId) || postId <= 0) {
      setError("Invalid post id for similarity search.");
      setResults([]);
      setHasLoaded(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await SemanticSearchService.similar({
        postId,
        includeText: DEFAULT_SEARCH_INCLUDE_TEXT,
        k: 999,
      });
      setResults(res.results);
    } catch (err: any) {
      setError(err?.message || "Failed to load similar posts.");
      setResults([]);
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [postId]);

  useEffect(() => {
    fetchSimilar();
  }, [fetchSimilar]);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.back();
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
    }, [router])
  );

  const renderResult = useCallback(
    ({ item }: { item: SemanticSearchResult }) => {
      const post = postsMap.get(item.postId);
      const snippet =
        item.text && item.text.trim().length > 0 ? (
          <Text style={styles.resultText} numberOfLines={6}>
            {item.text.trim()}
          </Text>
        ) : undefined;

      if (post) {
        return <PostCard post={post} footer={snippet} />;
      }

      return (
        <View style={styles.fallbackCard}>
          <View style={styles.fallbackHeader}>
            <Text style={styles.fallbackTitle} numberOfLines={2}>
              {String(item.metadata?.title || `Result #${item.postId}`)}
            </Text>
            <View style={styles.fallbackBadge}>
              <Text style={styles.fallbackBadgeText}>#{item.postId}</Text>
            </View>
          </View>
          {item.metadata?.subreddit ? (
            <Text style={styles.fallbackMeta}>r/{item.metadata.subreddit}</Text>
          ) : null}
          {item.metadata?.url ? (
            <Text
              style={[styles.fallbackMeta, { color: palette.accent }]}
              numberOfLines={1}
            >
              {item.metadata.url}
            </Text>
          ) : null}
          {snippet}
        </View>
      );
    },
    [postsMap]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={26} color={palette.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Similar Posts</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={[styles.statusText, { marginLeft: spacing.s }]}>
            Searching...
          </Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item, idx) => `${item.postId}-${idx}`}
        renderItem={renderResult}
        contentContainerStyle={
          results.length === 0 ? styles.emptyListContainer : undefined
        }
        ListEmptyComponent={
          !loading && hasLoaded ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No similar posts yet</Text>
              <Text style={styles.emptySubtitle}>
                Try syncing embeddings to populate suggestions.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  headerIconButton: {
    padding: spacing.xs,
  },
  statusRow: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  statusText: {
    fontSize: fontSizes.body,
    color: palette.muted,
  },
  errorText: {
    color: palette.favHeartRed,
    paddingHorizontal: spacing.m,
    paddingBottom: spacing.s,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.m,
    paddingBottom: spacing.s,
  },
  resultText: {
    fontSize: fontSizes.small,
    color: palette.foreground,
    lineHeight: 18,
  },
  fallbackCard: {
    padding: spacing.m,
    borderBottomWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.background,
  },
  fallbackHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  fallbackTitle: {
    fontSize: fontSizes.title * 0.9,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
    flex: 1,
    marginRight: spacing.s,
  },
  fallbackBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: palette.backgroundMidLight,
  },
  fallbackBadgeText: {
    fontSize: fontSizes.small,
    color: palette.muted,
  },
  fallbackMeta: {
    fontSize: fontSizes.small,
    color: palette.muted,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.l,
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
});
