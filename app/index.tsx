import { useRouter } from "expo-router";
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
import { Post } from "@/models/models";

import { MenuSidebar } from "@/components/MenuSidebar";
import { useFolders } from "@/hooks/useFolders"; // <-- new
import { usePosts } from "@/hooks/usePosts";
import { useRedditApi } from "@/hooks/useRedditApi";

export default function HomeScreen() {
  const router = useRouter();
  const {
    posts,
    loading: postsLoading,
    addPost,
    updatePost,
    toggleRead,
    toggleFavorite,
  } = usePosts();
  const { getPostData, loading: redditApiLoading } = useRedditApi();
  const { folders } = useFolders(); // <-- new

  const [isAdding, setIsAdding] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const total = posts.length;
  const unread = posts.filter((p) => !p.isRead).length;

  const detectDuplicates = (redditId: string) =>
    posts.filter((p) => p.redditId === redditId);

  const handleAddPost = async (url: string) => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      const postData = await getPostData(url);
      const duplicates = detectDuplicates(postData.redditId);
      if (duplicates.length) {
        Alert.alert(
          "Duplicate Post",
          "This post appears to already exist. Add anyway?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Add Anyway",
              onPress: () => addPost(postData),
            },
          ]
        );
      } else {
        await addPost(postData);
      }
    } catch (e) {
      Alert.alert("Error", `Failed to add post: ${(e as Error).message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleRead = (id: number) => toggleRead(id);
  const handleToggleFavorite = (id: number) => toggleFavorite(id);
  const handleSetRating = async (id: number, rating: number) => {
    const post = posts.find((p) => p.id === id);
    if (post) {
      await updatePost({ ...post, rating });
    }
  };

  // when sidebar item is tapped
  const handleSelect = (key: string | number) => {
    // key is "home" | "search" | "tags" | "favorites" | "unread" | "settings"
    // or a folder.id number
    console.log("Selected:", key);
    if (key === "settings") router.push("/settings");

    // TODO: navigate or filter your list based on key
    setSidebarOpen(false);
  };

  const renderPost = ({ item }: { item: Post }) => (
    <PostCard
      id={item.id}
      title={item.customTitle ?? item.title}
      date={item.addedAt.getTime()}
      rating={item.rating || 0}
      read={item.isRead}
      onToggleRead={() => handleToggleRead(item.id)}
      onRate={(r) => handleSetRating(item.id, r)}
      // onToggleFavorite={() => handleToggleFavorite(item.id)}
    />
  );

  const isLoading = postsLoading || redditApiLoading || isAdding;

  return (
    <SafeAreaView style={styles.container}>
      <MenuSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={handleSelect}
        folders={folders}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSidebarOpen(true)}>
          <Icon name="menu" size={28} color={palette.foreground} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Reddit Bookmarks</Text>
          <Text style={styles.subtitle}>
            {total} {total === 1 ? "bookmark" : "bookmarks"}
            {unread > 0 && ` • ${unread} unread`}
          </Text>
        </View>
      </View>

      <InputBar onSubmit={handleAddPost} />

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.loadingText}>
            {isAdding
              ? "Adding post..."
              : redditApiLoading
              ? "Fetching from Reddit..."
              : "Loading posts..."}
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
