import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { SearchBar } from "@/components/SearchBar";
import { useFolders } from "@/hooks/useFolders";
import { usePosts } from "@/hooks/usePosts";
import { useRedditApi } from "@/hooks/useRedditApi";

const LIST_HEADER_HEIGHT = 44 + 2 * spacing.m; //

export default function HomeScreen() {
  const router = useRouter();
  const { posts, loading: postsLoading, addPost, refresh } = usePosts();
  const { getPostData, loading: redditApiLoading } = useRedditApi();
  const { folders } = useFolders();

  const [isAdding, setIsAdding] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [headerHeight, setHeaderHeight] = useState(LIST_HEADER_HEIGHT);

  // Filter posts by search string
  const filteredPosts = posts.filter((post) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (post.title ?? "").toLowerCase().includes(q) ||
      (post.customTitle ?? "").toLowerCase().includes(q) ||
      (post.bodyText ?? "").toLowerCase().includes(q) ||
      (post.customBody ?? "").toLowerCase().includes(q) ||
      (post.notes ?? "").toLowerCase().includes(q) ||
      (post.author ?? "").toLowerCase().includes(q) ||
      (post.subreddit ?? "").toLowerCase().includes(q)
    );
  });

  const postsListRef = useRef<FlatList<Post>>(null);

  // Hide header on first render. Using this over InteractionManager because this only runs once.
  // InteractionManager would run every time the screen is focused, making searching ui glitch.
  useEffect(() => {
    // wait a tick for FlatList to mount.
    requestAnimationFrame(() => {
      postsListRef.current?.scrollToOffset({
        offset: LIST_HEADER_HEIGHT,
        animated: true,
      });
    });
  }, []);

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

  const isLoading = redditApiLoading || isAdding; // || postsLoading;

  return (
    <SafeAreaView style={styles.container}>
      <MenuSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={handleSelect}
        folders={folders}
      />

      <View
        style={styles.header}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
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

      <LinearGradient
        colors={["rgba(0,0,0,0.06)", "transparent"]}
        style={[styles.headerOuterShadow, { top: headerHeight + 30 }]}
        pointerEvents="none"
      />
      <FlatList
        ref={postsListRef}
        style={{ flex: 1 }}
        data={filteredPosts.sort(
          (a, b) =>
            new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        )}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPost}
        showsVerticalScrollIndicator={true}
        snapToOffsets={[LIST_HEADER_HEIGHT]} // snap to posts start and hide search header
        snapToStart={false}
        snapToEnd={false}
        snapToAlignment="start"
        contentContainerStyle={[
          filteredPosts.length === 0
            ? styles.listContentCentered
            : styles.listContent,
          { minHeight: Dimensions.get("window").height },
        ]}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No bookmarks yet</Text>
            <Text style={styles.emptySubtitle}>
              Add your first Reddit post by pasting a URL above
            </Text>
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search posts…"
            />
            <LinearGradient
              colors={["transparent", "rgba(0, 0, 0, 0.04)"]}
              style={styles.headerInnerShadow}
              pointerEvents="none"
            />
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
    // flexGrow: 1,
    justifyContent: "flex-start", // align top
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
    marginTop: spacing.l,
    height: 30,
  },
  loadingText: {
    fontSize: fontSizes.body,
    color: palette.muted,
    marginLeft: spacing.s,
  },
  listHeader: {
    height: LIST_HEADER_HEIGHT,
    padding: spacing.m,
    backgroundColor: palette.backgroundMidLight,
    borderBottomWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.m,
    justifyContent: "center",
    overflow: "hidden", // add this to clip the shadow
  },
  headerInnerShadow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 4, // increase for a stronger shadow
    zIndex: 2,
    // no border needed for inner shadow
  },
  headerOuterShadow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: undefined,
    height: 4,
    zIndex: 50,
  },
});
