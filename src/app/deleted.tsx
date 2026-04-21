import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import { usePosts } from "@/hooks/usePosts";
import { PostListItem } from "@/models/models";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

export default function DeletedPostsScreen() {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getDeletedPosts } = usePosts();

  const [deletedPosts, setDeletedPosts] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDeleted = useCallback(async () => {
    setLoading(true);
    try {
      const posts = await getDeletedPosts();
      setDeletedPosts(posts);
    } finally {
      setLoading(false);
    }
  }, [getDeletedPosts]);

  useFocusEffect(
    useCallback(() => {
      loadDeleted();
    }, [loadDeleted]),
  );

  const handlePostPress = (post: PostListItem) => {
    router.push(`/post/${post.id}` as any);
  };

  const renderPost = ({ item }: { item: PostListItem }) => {
    const displayTitle = item.customTitle || item.title;
    const deletedAt = item.updatedAt
      ? item.updatedAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

    return (
      <TouchableOpacity
        style={styles.postCard}
        onPress={() => handlePostPress(item)}
      >
        <View style={styles.postContent}>
          <Text style={styles.postTitle} numberOfLines={2}>
            {displayTitle}
          </Text>
          <View style={styles.postMeta}>
            <Text style={styles.metaText}>
              r/{item.subreddit} · u/{item.author}
            </Text>
            {deletedAt && (
              <Text style={styles.deletedAtText}>Deleted {deletedAt}</Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={palette.muted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <ActivityIndicator style={{}} color={palette.accent} />
      ) : deletedPosts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="trash-outline" size={48} color={palette.muted} />
          <Text style={styles.emptyText}>No deleted posts</Text>
        </View>
      ) : (
        <FlashList
          data={deletedPosts}
          renderItem={renderPost}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
        />
      )}
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
      backgroundColor: palette.backgroundMidLight,
    },
    backButton: {
      marginRight: spacing.s,
    },
    headerTitle: {
      flex: 1,
      fontSize: fontSizes.xlarge,
      fontWeight: fontWeights.semibold,
      color: palette.foreground,
    },
    countBadge: {
      fontSize: fontSizes.small,
      color: palette.muted,
    },
    listContent: {
      padding: spacing.s,
    },
    postCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.backgroundMidLight,
      borderRadius: 8,
      padding: spacing.m,
      marginVertical: spacing.xs,
      borderWidth: 1,
      borderColor: palette.border,
    },
    postContent: {
      flex: 1,
      marginRight: spacing.s,
    },
    postTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: palette.foreground,
      marginBottom: spacing.xs,
    },
    postMeta: {
      flexDirection: "row",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    metaText: {
      fontSize: fontSizes.small,
      color: palette.muted,
    },
    deletedAtText: {
      fontSize: fontSizes.small,
      color: palette.favHeartRed ?? palette.muted,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.m,
    },
    emptyText: {
      fontSize: fontSizes.body,
      color: palette.muted,
    },
  });
}
