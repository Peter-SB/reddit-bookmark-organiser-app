import { InputBar } from "@/components/InputBar";
import { PostCard } from "@/components/PostCard";
import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import {
  usePostActions,
  usePostsData,
  usePostStore,
} from "@/hooks/usePostStore";
import { useScraper } from "@/hooks/useScraper";
import { Post } from "@/models/Post";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const { posts, getPostStats } = usePostsData();
  const { addPost, togglePostRead, setPostRating } = usePostActions();
  const detectDuplicates = usePostStore((state) => state.detectDuplicates);
  const { extractPostData, loading: scraperLoading } = useScraper();
  const [isAddingPost, setIsAddingPost] = useState(false);

  const handleAddPost = async (url: string): Promise<void> => {
    if (isAddingPost) return;

    setIsAddingPost(true);
    try {
      // Extract post data using the scraper
      const postData = await extractPostData(url);

      console.log("Extracted post data:", postData);

      // Check for duplicates
      const duplicates = detectDuplicates(postData);
      if (duplicates.length > 0) {
        Alert.alert(
          "Duplicate Post",
          "This post appears to already exist in your library. Do you want to add it anyway?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Add Anyway",
              onPress: () => {
                addPost(postData);
                Alert.alert("Success", "Post added to your library!");
              },
            },
          ]
        );
        return;
      }

      // Add to store
      addPost(postData);
      Alert.alert("Success", "Post added to your library!");
    } catch (error) {
      console.error("Failed to add post:", error);
      Alert.alert(
        "Error",
        "Failed to add post. Please check the URL and try again. \nError: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsAddingPost(false);
    }
  };

  const handleToggleRead = (postId: number): void => {
    try {
      togglePostRead(postId);
    } catch (error) {
      console.error("Failed to toggle read status:", error);
    }
  };

  const handleSetRating = (postId: number, rating: number): void => {
    try {
      setPostRating(postId, rating);
    } catch (error) {
      console.error("Failed to set rating:", error);
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <PostCard
      id={item.id}
      title={item.customTitle || item.title}
      date={item.addedAt.getTime()}
      rating={item.rating || 0}
      read={item.isRead}
      onToggleRead={() => handleToggleRead(item.id)}
      onRate={(rating) => handleSetRating(item.id, rating)}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No bookmarks yet</Text>
      <Text style={styles.emptySubtitle}>
        Add your first Reddit post by pasting a URL above
      </Text>
    </View>
  );

  const stats = getPostStats();
  const isLoading = scraperLoading || isAddingPost;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reddit Bookmarks</Text>
        <Text style={styles.subtitle}>
          {stats.total} {stats.total === 1 ? "bookmark" : "bookmarks"}
          {stats.unread > 0 && ` • ${stats.unread} unread`}
        </Text>
      </View>

      <InputBar onSubmit={handleAddPost} />

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.loadingText}>
            {isAddingPost ? "Adding post..." : "Loading..."}
          </Text>
        </View>
      )}

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPost}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        contentContainerStyle={
          posts.length === 0 ? styles.listContentCentered : styles.listContent
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    paddingHorizontal: spacing.m,
    paddingTop: spacing.m,
    paddingBottom: spacing.s,
  },
  title: {
    fontSize: fontSizes.xlarge,
    fontWeight: fontWeights.bold,
    color: palette.foreground,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSizes.body,
    color: palette.muted,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.l,
  },
  listContentCentered: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: spacing.l,
  },
  emptyState: {
    alignItems: "center",
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
  loadingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.m,
  },
  loadingText: {
    fontSize: fontSizes.body,
    color: palette.muted,
    marginLeft: spacing.s,
  },
});
