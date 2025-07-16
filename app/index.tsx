import * as Linking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import { useFolders } from "@/hooks/useFolders";
import { usePosts } from "@/hooks/usePosts";
import { useRedditApi } from "@/hooks/useRedditApi";

export default function HomeScreen() {
  const router = useRouter();
  const { posts, loading: postsLoading, addPost, refresh } = usePosts();
  const { getPostData, loading: redditApiLoading } = useRedditApi();
  const { folders } = useFolders(); // <-- new

  const [isAdding, setIsAdding] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isInputVisible, setIsInputVisible] = useState(false);

  const total = posts.length;
  const unread = posts.filter((p) => !p.isRead).length;

  // Every time HomeScreen comes into focus, reload posts
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

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
      setIsInputVisible(false);
    } catch (e) {
      Alert.alert("Error", `Failed to add post: ${(e as Error).message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleSelect = (key: string | number) => {
    // key is "home" | "search" | "tags" | "favorites" | "unread" | "settings"
    // or a folder.id number
    console.log("Selected:", key);
    if (key === "settings") router.push("/settings");

    // TODO: navigate or filter your list based on key
    setSidebarOpen(false);
  };

  const renderPost = ({ item }: { item: Post }) => <PostCard post={item} />;

  const isLoading = postsLoading || redditApiLoading || isAdding;

  useEffect(() => {
    async function handleIncoming() {
      const url = await Linking.getInitialURL();
      if (!url) return;

      const { queryParams } = Linking.parse(url);
      const shared = queryParams?.text as string | undefined;
      if (shared && shared.startsWith("http")) {
        // auto‑add and then clear it so you don’t re‑add on hot reload:
        try {
          await handleAddPost(shared);
        } catch (e) {
          Alert.alert("Error importing shared post", (e as Error).message);
        }
      }
    }

    handleIncoming();

    // also listen for deep‑link events when the app is already running:
    const sub = Linking.addEventListener("url", ({ url }) => {
      const { queryParams } = Linking.parse(url);
      if (queryParams?.text) handleAddPost(queryParams?.text as string);
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <MenuSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={handleSelect}
        folders={folders}
      />

      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => setSidebarOpen(true)}>
            <Icon
              name="menu"
              size={28}
              color={palette.foreground}
              style={{ marginRight: spacing.xs }}
            />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Reddit Bookmarks</Text>
            <Text style={styles.subtitle}>
              {total} {total === 1 ? "bookmark" : "bookmarks"}
              {unread > 0 && ` • ${unread} unread`}
            </Text>
          </View>
        </View>
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
      </View>

      <FlatList
        data={posts.sort(
          (a, b) =>
            new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        )}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPost}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={
          posts.length === 0 ? styles.listContentCentered : styles.listContent
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No bookmarks yet</Text>
            <Text style={styles.emptySubtitle}>
              Add your first Reddit post by pasting a URL above
            </Text>
          </View>
        )}
        ListHeaderComponent={
          <View
          // style={{
          //   borderBottomWidth: 1,
          //   borderColor: palette.border,
          //   backgroundColor: palette.backgroundLight,
          // }}
          >
            {/* <InputBar onSubmit={handleAddPost} /> */}
          </View>
        }
      />
      <InputBar
        visible={isInputVisible}
        onExpand={() => setIsInputVisible(true)}
        onClose={() => setIsInputVisible(false)}
        onSubmit={handleAddPost}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  header: {
    padding: spacing.m,
    borderBottomWidth: 1.5,
    borderColor: palette.border,
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
    marginTop: spacing.m,
  },
  loadingText: {
    fontSize: fontSizes.body,
    color: palette.muted,
    marginLeft: spacing.s,
  },
});
