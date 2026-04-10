import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import { useHighlights } from "@/hooks/useHighlights";
import { usePosts } from "@/hooks/usePosts";
import { Highlight } from "@/models/models";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

export default function HighlightsScreen() {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { highlights, loading, refreshHighlights } = useHighlights();
  const { posts } = usePosts();

  // Refresh highlights when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshHighlights();
    }, [refreshHighlights]),
  );

  // Build a title lookup map from the lightweight post list
  const postTitleMap = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const p of posts) {
      map.set(p.id, p.customTitle || p.title);
    }
    return map;
  }, [posts]);

  const getPostTitle = (postId: number): string => {
    return postTitleMap.get(postId) || "Unknown Post";
  };

  const handleHighlightPress = (highlight: Highlight) => {
    router.push(`/post/${highlight.postId}`);
  };

  const renderHighlight = ({ item }: { item: Highlight }) => {
    const postTitle = getPostTitle(item.postId);

    return (
      <TouchableOpacity
        style={styles.highlightCard}
        onPress={() => handleHighlightPress(item)}
      >
        <View style={styles.highlightContent}>
          <Text style={styles.highlightText} numberOfLines={2}>
            &ldquo;{item.text}&rdquo;
          </Text>
          {item.note && (
            <Text style={styles.noteText} numberOfLines={1}>
              Note: {item.note}
            </Text>
          )}
          <Text style={styles.postTitle} numberOfLines={1}>
            <Ionicons
              name="document-text-outline"
              size={14}
              color={palette.muted}
            />{" "}
            {postTitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={palette.muted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={palette.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Highlights</Text>
        <View style={styles.backButton} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={palette.foreground} />
        </View>
      ) : highlights.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="bookmark-outline" size={64} color={palette.muted} />
          <Text style={styles.emptyText}>No highlights yet</Text>
          <Text style={styles.emptySubtext}>
            Select text in a post to create a highlight
          </Text>
        </View>
      ) : (
        <FlatList
          data={highlights}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderHighlight}
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
      justifyContent: "space-between",
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.m,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    backButton: {
      padding: spacing.s,
      width: 40,
    },
    headerTitle: {
      fontSize: fontSizes.large,
      fontWeight: fontWeights.bold,
      color: palette.foreground,
    },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    emptyText: {
      fontSize: fontSizes.title,
      fontWeight: fontWeights.semibold,
      color: palette.muted,
      marginTop: spacing.l,
    },
    emptySubtext: {
      fontSize: fontSizes.body,
      color: palette.muted,
      marginTop: spacing.s,
      textAlign: "center",
    },
    listContent: {
      padding: spacing.m,
    },
    highlightCard: {
      backgroundColor: palette.backgroundDarker,
      borderRadius: 12,
      padding: spacing.m,
      marginBottom: spacing.m,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    highlightContent: {
      flex: 1,
      gap: spacing.xs,
    },
    highlightText: {
      fontSize: fontSizes.body,
      color: palette.foreground,
      fontStyle: "italic",
      lineHeight: 20,
    },
    noteText: {
      fontSize: fontSizes.small,
      color: palette.muted,
      marginTop: spacing.xs,
    },
    postTitle: {
      fontSize: fontSizes.small,
      color: palette.muted,
      marginTop: spacing.xs,
    },
  });
}
