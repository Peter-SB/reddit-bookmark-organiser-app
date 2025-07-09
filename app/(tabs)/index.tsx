import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

import { InputBar } from "@/components/InputBar";
import { PostCard } from "@/components/PostCard";
import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
//import { useFolderStore } from "@/hooks/useFolderStore"; // assume this exists
import {
  usePostActions,
  usePostsData,
  usePostStore,
} from "@/hooks/usePostStore";
import { useRedditApi } from "@/hooks/useRedditApi";

import { MenuSidebar } from "@/components/MenuSidebar";
import { Post } from "@/models/models";

export default function HomeScreen() {
  const { posts, getPostStats } = usePostsData();
  const { addPost, togglePostRead, setPostRating } = usePostActions();
  const detectDuplicates = usePostStore((s) => s.detectDuplicates);
  const { getPostData, loading: redditApiLoading } = useRedditApi();
  const folders = null; //useFolderStore((s) => s.folders);

  const [isAddingPost, setIsAddingPost] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleAddPost = async (url: string) => {
    if (isAddingPost) return;
    setIsAddingPost(true);
    try {
      const postData = await getPostData(url);
      const duplicates = detectDuplicates(postData);
      if (duplicates.length) {
        Alert.alert(
          "Duplicate Post",
          "This post appears to already exist in your library. Do you want to add it anyway?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Add Anyway", onPress: () => addPost(postData) },
          ]
        );
        return;
      }
      addPost(postData);
    } catch (e) {
      Alert.alert("Error", `Failed to add post: ${(e as Error).message}`);
    } finally {
      setIsAddingPost(false);
    }
  };

  const handleSelect = (key: string | number) => {
    setSidebarOpen(false);
    // navigate or filter based on key
    // e.g. if key === 'home' navigate to Home; if number filter by folderId
  };

  const handleToggleRead = (postId: number) => togglePostRead(postId);
  const handleSetRating = (postId: number, rating: number) =>
    setPostRating(postId, rating);

  const renderPost = ({ item }: { item: Post }) => (
    <PostCard
      id={item.id}
      title={item.customTitle ?? item.title}
      date={item.addedAt.getTime()}
      rating={item.rating || 0}
      read={item.isRead}
      onToggleRead={() => handleToggleRead(item.id)}
      onRate={(r) => handleSetRating(item.id, r)}
    />
  );

  const stats = getPostStats();
  const isLoading = redditApiLoading || isAddingPost;

  return (
    <SafeAreaView style={styles.container}>
      <MenuSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={handleSelect}
        folders=null
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSidebarOpen(true)}>
          <Icon name="menu" size={28} color={palette.foreground} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Reddit Bookmarks</Text>
          <Text style={styles.subtitle}>
            {stats.total} {stats.total === 1 ? "bookmark" : "bookmarks"}
            {stats.unread > 0 && ` • ${stats.unread} unread`}
          </Text>
        </View>
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
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No bookmarks yet</Text>
            <Text style={styles.emptySubtitle}>
              Add your first Reddit post by pasting a URL above
            </Text>
          </View>
        )}
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
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.m,
  },
  headerText: { marginLeft: spacing.s },
  title: {
    fontSize: fontSizes.xlarge,
    fontWeight: fontWeights.bold,
    color: palette.foreground,
  },
  subtitle: {
    fontSize: fontSizes.body,
    color: palette.muted,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.l },
  listContentCentered: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: spacing.l,
  },
  emptyState: { alignItems: "center", paddingHorizontal: spacing.l },
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
