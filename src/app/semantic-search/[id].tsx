import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

import { PostCard } from "@/components/PostCard";
import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import { usePosts } from "@/hooks/usePosts";
import {
  SearchHistoryEntry,
  SearchHistoryRepository,
} from "@/repository/SearchHistoryRepository";
import type { SemanticSearchResult } from "@/services/SemanticSearchService";

const SNIPPET_PREVIEW_CHAR_LIMIT = 240;
const PENDING_POLL_INTERVAL_MS = 1500;

export default function SemanticSearchResultsScreen() {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const entryId = useMemo(() => parseInt(String(id ?? ""), 10), [id]);

  const { posts, refreshPosts } = usePosts();
  const [entry, setEntry] = useState<SearchHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(
    () => new Set(),
  );

  useFocusEffect(
    useCallback(() => {
      refreshPosts();
    }, [refreshPosts]),
  );

  const loadEntry = useCallback(async () => {
    if (!Number.isFinite(entryId) || entryId <= 0) {
      setEntry(null);
      setLoading(false);
      return;
    }
    const repo = await SearchHistoryRepository.create();
    const row = await repo.getById(entryId);
    setEntry(row);
    setLoading(false);
  }, [entryId]);

  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  useEffect(() => {
    if (entry?.status !== "pending") return;
    const interval = setInterval(loadEntry, PENDING_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [entry?.status, loadEntry]);

  const postsMap = useMemo(() => {
    const map = new Map<number, (typeof posts)[number]>();
    posts.forEach((p) => map.set(p.id, p));
    return map;
  }, [posts]);

  const toggleExpanded = useCallback((key: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const renderResult = ({
    item,
    index,
  }: {
    item: SemanticSearchResult;
    index: number;
  }) => {
    const resultKey = `${item.postId}-${index}`;
    const post = postsMap.get(item.postId);
    const trimmedText = item.text?.trim() ?? "";
    const isExpanded = expandedResults.has(resultKey);
    const canExpand = trimmedText.length > SNIPPET_PREVIEW_CHAR_LIMIT;
    const previewText =
      !isExpanded && canExpand
        ? `${trimmedText.slice(0, SNIPPET_PREVIEW_CHAR_LIMIT).trimEnd()}…`
        : trimmedText;
    const snippet =
      trimmedText.length > 0 ? (
        <Text style={styles.resultText}>
          {previewText}
          {canExpand ? (
            <Text
              style={styles.readMoreText}
              onPress={(event) => {
                event.stopPropagation?.();
                toggleExpanded(resultKey);
              }}
              suppressHighlighting
            >
              {isExpanded ? " Read less" : " Read more"}
            </Text>
          ) : null}
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
  };

  const results = entry?.results ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={26} color={palette.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {entry?.query ?? "Search results"}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusText}>
          {entry
            ? entry.status === "complete"
              ? `${results.length} result${results.length === 1 ? "" : "s"}`
              : entry.status === "error"
                ? entry.error || "Search failed"
                : "Searching..."
            : loading
              ? "Loading..."
              : "Search not found"}
        </Text>
        {entry?.status === "pending" && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={palette.accent} />
          </View>
        )}
      </View>

      <FlashList
        data={results}
        keyExtractor={(item, idx) => `${item.postId}-${idx}`}
        renderItem={renderResult}
        contentContainerStyle={
          results.length === 0 ? styles.emptyListContainer : undefined
        }
        ListEmptyComponent={
          entry && entry.status !== "pending" ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {entry.status === "error" ? "Search failed" : "No results"}
              </Text>
            </View>
          ) : null
        }
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
      gap: spacing.m,
    },
    headerTitle: {
      fontSize: fontSizes.large,
      fontWeight: fontWeights.semibold,
      color: palette.foreground,
      flex: 1,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
      backgroundColor: palette.background,
    },
    statusText: {
      fontSize: fontSizes.body,
      color: palette.muted,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    resultText: {
      fontSize: fontSizes.small,
      color: palette.foreground,
      lineHeight: 18,
    },
    readMoreText: {
      fontSize: fontSizes.small,
      fontWeight: fontWeights.medium,
      color: palette.foregroundMidLight,
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
  });
}
