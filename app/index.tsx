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

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
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

type TripleFilter = "all" | "yes" | "no";

const LIST_HEADER_HEIGHT = 44 + 2 * spacing.m; //

export default function HomeScreen() {
  const router = useRouter();
  const {
    posts,
    loading: postsLoading,
    addPost,
    refreshPosts,
    checkForSimilarPosts,
    recomputeMissingMinHashes,
  } = usePosts();
  const { folders, deleteFolder, refreshFolders } = useFolders();
  const { getPostData, loading: redditApiLoading } = useRedditApi();

  const [isAdding, setIsAdding] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isInputVisible, setIsInputVisible] = useState(false);

  const [favouritesFilter, setFavouritesFilter] = useState<TripleFilter>("all");
  const [readFilter, setReadFilter] = useState<TripleFilter>("all");
  const [search, setSearch] = useState("");
  // Track selected folders
  const [selectedFolders, setSelectedFolders] = useState<number[]>([]);

  const insets = useSafeAreaInsets();

  // Filter posts by search string and selected folders
  const filteredPosts = posts
    // text search
    .filter((post) => {
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
    })
    // folder filter
    .filter((post) => {
      if (!selectedFolders || selectedFolders.length === 0) return true;
      // post.folderIds may be undefined/null or an array
      if (!post.folderIds || post.folderIds.length === 0) return false;
      return post.folderIds.some((fid: number) =>
        selectedFolders.includes(fid)
      );
    })
    // favourites filter
    .filter((post) => {
      if (favouritesFilter === "all") return true;
      const isFav = Boolean(post.isFavorite);
      return favouritesFilter === "yes" ? isFav : !isFav;
    })
    // read filter
    .filter((post) => {
      if (readFilter === "all") return true;
      const isRead = Boolean(post.isRead);
      return readFilter === "yes" ? isRead : !isRead;
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

    recomputeMissingMinHashes(); // todo - remove this after initial run
  }, [recomputeMissingMinHashes]);

  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    setTotal(filteredPosts.length);
    setUnread(filteredPosts.filter((p) => !p.isRead).length);
  }, [filteredPosts]);

  // Every time HomeScreen comes into focus, reload posts
  useFocusEffect(
    useCallback(() => {
      refreshPosts();
      refreshFolders();
    }, [refreshPosts, refreshFolders])
  );

  const handleAddPost = useCallback(
    async (url: string) => {
      if (isAdding) return;
      setIsAdding(true);
      try {
        const postData = await getPostData(url);

        // Check for exact duplicates (existing logic)
        const exactDuplicates = posts.filter(
          (p) => p.redditId === postData.redditId
        );

        // Check for similar content
        const similarPosts = await checkForSimilarPosts(
          postData.bodyText || "",
          0.8
        );

        if (exactDuplicates.length > 0) {
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
        } else if (similarPosts.length > 0) {
          const similarTitles = similarPosts
            .slice(0, 2)
            .map((p) => `"${p.title}"`)
            .join("\n");
          Alert.alert(
            "Similar Content Found",
            `Found ${
              similarPosts.length
            } post(s) with similar content:\n\n${similarTitles}${
              similarPosts.length > 3 ? "\n...and more" : ""
            }\n\nAdd anyway?`,
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
    },
    [isAdding, getPostData, posts, checkForSimilarPosts, addPost]
  );

  const handleSelect = (key: string | number | (number | string)[]) => {
    // key can be "home" | "search" | "tags" | "favorites" | "unread" | "settings" | folder.id | array of folder ids
    console.log("Selected:", key);
    if (key === "home") {
      setSearch("");
      setFavouritesFilter("all");
      setReadFilter("all");
      setSelectedFolders([]);
      postsListRef.current?.scrollToOffset({
        offset: LIST_HEADER_HEIGHT,
        animated: true,
      });
    } else if (key === "settings") {
      router.push("/settings" as any);
    } else if (key === "search") {
      postsListRef.current?.scrollToOffset({
        offset: 0,
        animated: true,
      });
    } else if (Array.isArray(key)) {
      setSelectedFolders(key as number[]);
      return;
    } else if (typeof key === "number") {
      setSelectedFolders([key]);
      return;
    }
    setSidebarOpen(false);
  };

  const renderPost = ({ item }: { item: Post }) => <PostCard post={item} />;

  useEffect(() => {
    async function handleIncoming() {
      let shared: string | undefined = undefined;
      // Check for sharedUrl param from router (expo-router v2)
      // Safely get params from router (expo-router v2+ or fallback)
      const params =
        router && "params" in router ? (router as any).params : undefined;
      if (params?.sharedUrl && typeof params.sharedUrl === "string") {
        shared = params.sharedUrl;
        // Remove the param so it doesn't re-add on hot reload
        if (typeof router.setParams === "function") {
          router.setParams({ sharedUrl: undefined });
        }
      } else {
        // Fallback to Linking.getInitialURL for legacy/other cases
        const url = await Linking.getInitialURL();
        if (url) {
          const { queryParams } = Linking.parse(url);
          shared = queryParams?.text as string | undefined;
        }
      }
      if (shared && shared.startsWith("http")) {
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
  }, [router, handleAddPost]);

  const isLoading = redditApiLoading || isAdding; // || postsLoading;

  return (
    <SafeAreaView style={styles.container}>
      <MenuSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={handleSelect}
        folders={folders}
        favouritesFilter={favouritesFilter}
        readFilter={readFilter}
        onFavouritesFilterChange={setFavouritesFilter}
        onReadFilterChange={setReadFilter}
        selectedFolders={selectedFolders}
        onSelectedFoldersChange={setSelectedFolders}
        onDeleteFolder={deleteFolder}
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

      {/* Mask the shadow of the top bar from bleeding into the system status bar */}
      <View style={[styles.topBarMask, { height: insets.top }]} />

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
              cancelButtonCallback={() =>
                postsListRef.current?.scrollToOffset({
                  offset: LIST_HEADER_HEIGHT,
                  animated: true,
                })
              }
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
    backgroundColor: palette.background,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
    zIndex: 20,
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
  topBarMask: {
    position: "absolute",
    top: 0,
    zIndex: 50,
    backgroundColor: palette.background,
    width: "100%",
  },
});
