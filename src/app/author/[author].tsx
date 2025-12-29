import { PostCard } from "@/components/PostCard";
import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import { usePosts } from "@/hooks/usePosts";
import { openRedditUser } from "@/utils/redditLinks";
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

export default function AuthorPostsScreen() {
  const router = useRouter();
  const { author } = useLocalSearchParams<{ author?: string | string[] }>();
  const authorParam = useMemo(() => {
    if (!author) return "";
    return Array.isArray(author) ? author[0] ?? "" : author;
  }, [author]);

  const authorName = useMemo(() => {
    const raw = String(authorParam ?? "").trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [authorParam]);

  const { posts, refreshPosts, loading } = usePosts();
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshPosts();
    }, [refreshPosts])
  );

  useEffect(() => {
    if (!loading) {
      setHasLoaded(true);
    }
  }, [loading]);

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

  const authorPosts = useMemo(() => {
    if (!authorName) return [];
    const target = authorName.toLowerCase();
    return posts.filter((p) => (p.author || "").toLowerCase() === target);
  }, [posts, authorName]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshPosts();
    setRefreshing(false);
  }, [refreshPosts]);

  const renderItem = useCallback(
    ({ item }: { item: (typeof posts)[number] }) => <PostCard post={item} />,
    []
  );

  const statusText =
    !authorName && hasLoaded
      ? "Author missing. Open this screen from a saved post to see more from that user."
      : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={26} color={palette.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {authorName ? (
            <>
              {"Posts by "}
              <Text
                style={styles.headerLink}
                onPress={() => openRedditUser(authorName)}
              >
                {`u/${authorName}`}
              </Text>
            </>
          ) : (
            "Same Author"
          )}
        </Text>
      </View>

      {(loading || refreshing) && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={[styles.statusText, { marginLeft: spacing.s }]}>
            Getting posts...
          </Text>
        </View>
      )}

      {statusText ? <Text style={styles.errorText}>{statusText}</Text> : null}

      <FlatList
        data={authorPosts}
        keyExtractor={(item) => `${item.id}`}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={
          authorPosts.length === 0 ? styles.emptyListContainer : undefined
        }
        ListEmptyComponent={
          hasLoaded && authorName ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No other posts yet</Text>
              <Text style={styles.emptySubtitle}>
                Try syncing or importing more posts from this author.
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
  headerLink: {
    // textDecorationLine: "underline",
  },
  headerIconButton: {
    padding: spacing.xs,
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
