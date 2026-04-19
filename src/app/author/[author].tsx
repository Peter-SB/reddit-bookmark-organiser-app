import { OrderByRow } from "@/components/OrderByRow";
import { PostCard } from "@/components/PostCard";
import { OrderByOption, AUTHOR_POST_ORDER_OPTIONS } from "@/constants/orderBy";
import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import { useFilteredPosts } from "@/hooks/useFilteredPosts";
import { PostListItem } from "@/models/models";
import { openRedditUser } from "@/utils/redditLinks";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

export default function AuthorPostsScreen() {
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

  const [orderBy, setOrderBy] = useState<OrderByOption>(OrderByOption.PostedAt);
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("desc");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { posts: authorPosts, loading } = useFilteredPosts({
    authorFilter: authorName || undefined,
    orderBy,
    orderDirection,
    archivedFilter: "all",
  });

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
    }, [router]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // useFilteredPosts auto-refreshes via subscribeToPostChanges
    setTimeout(() => setRefreshing(false), 300);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: PostListItem }) => <PostCard post={item} />,
    [],
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

      {/* Sort controls */}
      <View style={styles.sortRow}>
        <OrderByRow
          orderOptions={AUTHOR_POST_ORDER_OPTIONS}
          localOrderBy={orderBy}
          localOrderDirection={orderDirection}
          onOrderByChange={setOrderBy}
          onOrderDirectionChange={setOrderDirection}
        />
      </View>

      {statusText ? <Text style={styles.errorText}>{statusText}</Text> : null}

      <FlashList
        data={authorPosts}
        keyExtractor={(item) => `${item.id}`}
        renderItem={renderItem}
        contentContainerStyle={
          authorPosts.length === 0 ? styles.emptyListContainer : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.foreground}
          />
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
        ListFooterComponent={
          authorPosts.length > 0 && authorName ? (
            <View style={styles.footerContainer}>
              <TouchableOpacity
                style={styles.importButton}
                onPress={() =>
                  router.push(
                    `/author/import?author=${encodeURIComponent(authorName)}`,
                  )
                }
              >
                <Icon
                  name="cloud-download"
                  size={24}
                  color={palette.foregroundLight}
                />
                <Text style={styles.importButtonText}>
                  Find More Posts by {authorName}
                </Text>
              </TouchableOpacity>
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
    sortRow: {
      paddingHorizontal: spacing.s,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
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
    footerContainer: {
      padding: spacing.m,
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: palette.border,
      // marginTop: spacing.m,
    },
    importButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.s,
      marginBottom: spacing.m,
      paddingVertical: spacing.m,
      paddingHorizontal: spacing.l,
      backgroundColor: palette.backgroundMidLight,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette.border,
      gap: spacing.s,
    },
    importButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: palette.foregroundLight,
    },
  });
}
