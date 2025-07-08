import { InputBar } from "@/components/InputBar";
import { PostCard } from "@/components/PostCard";
import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import { usePostStore } from "@/hooks/usePostStore";
import { useScraper } from "@/hooks/useScraper";
import { Post } from "@/models/Post";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const { posts, isLoading, addPost, toggleRead, setRating } = usePostStore();
  const { extractPostData } = useScraper();

  const handleAddPost = async (url: string): Promise<void> => {
    try {
      // Extract post data using the scraper
      const postData = await extractPostData(url);

      // Add to store
      await addPost(url, postData.title);
    } catch (error) {
      console.error("Failed to add post:", error);
      throw error;
    }
  };

  const handleToggleRead = async (postId: string): Promise<void> => {
    try {
      await toggleRead(postId);
    } catch (error) {
      console.error("Failed to toggle read status:", error);
    }
  };

  const handleSetRating = async (
    postId: string,
    rating: number
  ): Promise<void> => {
    try {
      await setRating(postId, rating);
    } catch (error) {
      console.error("Failed to set rating:", error);
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <PostCard
      title={item.title}
      date={item.dateAdded}
      rating={item.rating}
      read={item.read}
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={styles.loadingText}>Loading bookmarks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reddit Bookmarks</Text>
        <Text style={styles.subtitle}>
          {posts.length} {posts.length === 1 ? "bookmark" : "bookmarks"}
        </Text>
      </View>

      <InputBar onSubmit={handleAddPost} />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: fontSizes.body,
    color: palette.muted,
    marginTop: spacing.m,
  },
});
