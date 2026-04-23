import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { OrderByOption } from "@/constants/orderBy";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FlashList, FlashListRef } from "@shopify/flash-list";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

import { InputBar } from "@/components/InputBar";

import { SwipeablePostCard } from "@/components/SwipeablePostCard";
import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import { PostListItem } from "@/models/models";
import { scrollToTopWithHeader } from "@/utils/scrollAnimationHelpers";

import { MenuSidebar } from "@/components/MenuSidebar";
import { SearchBar } from "@/components/SearchBar";
import { useFolders } from "@/hooks/useFolders";
import { useFilteredPosts } from "@/hooks/useFilteredPosts";
import { usePosts } from "@/hooks/usePosts";
import { usePostSync } from "@/hooks/usePostSync";
import { useRedditApi } from "@/hooks/useRedditApi";

type TripleFilter = "all" | "yes" | "no";

const LIST_HEADER_HEIGHT = 44 + 2 * spacing.m; //

export default function HomeScreen() {
  const { palette, fontSizes, isDarkMode } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const router = useRouter();
  const { handleAddPost: addPostFromUrl, toggleQueue } = usePosts();
  const { folders, deleteFolder, refreshFolders } = useFolders();
  const { getPostData, loading: redditApiLoading } = useRedditApi();
  const { syncSinglePost } = usePostSync({ autoStart: false });

  const [isAdding, setIsAdding] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isInputVisible, setIsInputVisible] = useState(false);

  const [favouritesFilter, setFavouritesFilter] = useState<TripleFilter>("all");
  const [readFilter, setReadFilter] = useState<TripleFilter>("all");
  const [archivedFilter, setArchivedFilter] = useState<TripleFilter>("no");
  const [queuedFilter, setQueuedFilter] = useState<TripleFilter>("all");
  const [search, setSearch] = useState("");
  // Track selected folders
  const [selectedFolders, setSelectedFolders] = useState<number[]>([]);

  // Add state for orderBy and orderDirection
  const [orderBy, setOrderBy] = useState<OrderByOption>(OrderByOption.AddedAt);
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("desc");
  const [randomSeed, setRandomSeed] = useState<number>(() => Date.now());

  const insets = useSafeAreaInsets();

  // Filter and sort posts in SQL so body text is searchable
  // When a search query is active, include archived posts so they appear in results
  const { posts: filteredPosts, setPostsAt } = useFilteredPosts({
    search,
    selectedFolders,
    favouritesFilter,
    readFilter,
    archivedFilter: search.trim() ? "all" : archivedFilter,
    queuedFilter,
    orderBy,
    orderDirection,
    randomSeed,
  });

  const postsListRef = useRef<FlashListRef<PostListItem>>(null);
  const perfDataReadyRef = useRef<number>(0);
  const perfFirstRenderRef = useRef(false);

  // Perf: log when filtered posts data arrives (measures React reconciliation gap from setPosts → effect)
  useEffect(() => {
    if (filteredPosts.length > 0) {
      const now = Date.now();
      perfDataReadyRef.current = now;
      const reactGap = setPostsAt.current > 0 ? now - setPostsAt.current : -1;
      console.log(
        `[PERF] HomeScreen: filteredPosts ready — ${filteredPosts.length} posts, react reconcile=${reactGap}ms`,
      );
    }
  }, [filteredPosts, setPostsAt]);

  // Hide header on first render. Using this over InteractionManager because this only runs once.
  // InteractionManager would run every time the screen is focused, making searching ui glitch.
  useEffect(() => {
    // wait a tick for FlatList to mount.
    requestAnimationFrame(() => {
      scrollToTopWithHeader(postsListRef, LIST_HEADER_HEIGHT);
    });
  }, []);

  const [total, setTotal] = useState(0);
  const [read, setRead] = useState(0);

  useEffect(() => {
    const newTotal = filteredPosts.length;
    setTotal(newTotal);
    setRead(newTotal - filteredPosts.filter((p) => !p.isRead).length);
  }, [filteredPosts]);

  // Posts are updated optimistically via shared state so no reload is needed here.
  useFocusEffect(
    useCallback(() => {
      refreshFolders();
    }, [refreshFolders]),
  );

  const handleAddPost = useCallback(
    async (url: string) => {
      if (isAdding) return;
      setIsAdding(true);
      try {
        await addPostFromUrl(url, {
          getPostData,
          syncSinglePost,
          onBeforeAdd: () => setIsAdding(false),
          onSuccess: () => setIsInputVisible(false),
        });
      } finally {
        setIsAdding(false);
      }
    },
    [isAdding, addPostFromUrl, getPostData, syncSinglePost],
  );

  const handleSelect = (key: string | number | (number | string)[]) => {
    // key can be "home" | "search" | "favorites" | "unread" | "settings" | "highlights" | folder.id | array of folder ids
    console.log("Selected:", key);
    if (key === "home") {
      setSearch("");
      setFavouritesFilter("all");
      setReadFilter("all");
      setArchivedFilter("no");
      setQueuedFilter("all");
      setSelectedFolders([]);
      setOrderBy(OrderByOption.AddedAt);
      setOrderDirection("desc");
      scrollToTopWithHeader(postsListRef, LIST_HEADER_HEIGHT);
    } else if (key === "semantic-search") {
      router.push("/semantic-search" as any);
    } else if (key === "highlights") {
      router.push("/highlights" as any);
    } else if (key === "authors") {
      router.push("/author/authors" as any);
    } else if (key === "settings") {
      router.push("/settings" as any);
    } else if (key === "search") {
      scrollToTopWithHeader(postsListRef, 0);
    } else if (Array.isArray(key)) {
      setSelectedFolders(key as number[]);
      return;
    } else if (typeof key === "number") {
      setSelectedFolders([key]);
      return;
    }
    setSidebarOpen(false);
  };

  const renderPost = useCallback(
    ({ item }: { item: PostListItem }) => (
      <SwipeablePostCard post={item} onToggleQueue={toggleQueue} />
    ),
    [toggleQueue],
  );

  const onViewableItemsChangedRef = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (
        !perfFirstRenderRef.current &&
        viewableItems.length > 0 &&
        perfDataReadyRef.current > 0
      ) {
        perfFirstRenderRef.current = true;
        console.log(
          `[PERF] HomeScreen: first ${viewableItems.length} items visible — ${Date.now() - perfDataReadyRef.current}ms after data ready`,
        );
      }
    },
  );

  const onSetOrderBy = useCallback((option: OrderByOption) => {
    setOrderBy(option);
    setSidebarOpen(false);
    scrollToTopWithHeader(postsListRef, LIST_HEADER_HEIGHT);
  }, []);

  useEffect(() => {
    async function handleIncoming() {
      // alert("Handling incoming link if any...");
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
      // alert("Handling incoming link if any...");
      const { queryParams } = Linking.parse(url);
      if (queryParams?.text) handleAddPost(queryParams?.text as string);
    });
    return () => sub.remove();
  }, [router, handleAddPost]);

  const isLoading = redditApiLoading || isAdding;

  // Add this callback to open a random post
  const handleOpenRandomPost = useCallback(() => {
    if (filteredPosts.length === 0) return;
    const randomIndex = Math.floor(Math.random() * filteredPosts.length);
    const post = filteredPosts[randomIndex];
    if (post && post.id) {
      router.push(`/post/${post.id}`);
    }
  }, [filteredPosts, router]);

  return (
    <SafeAreaView style={styles.container}>
      <MenuSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={handleSelect}
        folders={folders}
        favouritesFilter={favouritesFilter}
        readFilter={readFilter}
        archivedFilter={archivedFilter}
        queuedFilter={queuedFilter}
        onFavouritesFilterChange={setFavouritesFilter}
        onReadFilterChange={setReadFilter}
        onArchivedFilterChange={setArchivedFilter}
        onQueuedFilterChange={setQueuedFilter}
        selectedFolders={selectedFolders}
        onSelectedFoldersChange={setSelectedFolders}
        onDeleteFolder={deleteFolder}
        orderBy={orderBy}
        orderDirection={orderDirection}
        onOrderByChange={onSetOrderBy}
        onOrderDirectionChange={setOrderDirection}
        onRandomReseed={() => setRandomSeed(Date.now())}
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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View style={styles.headerText}>
              <Text style={styles.title}>Reddit Bookmarks</Text>
              <Text style={styles.subtitle}>
                {total} {total === 1 ? "bookmark" : "bookmarks"}
                {read > 0 && ` • ${read} read`}
              </Text>
            </View>
            <Image
              source={require("@/assets/images/custom-splash-icon.png")}
              style={{
                width: 46,
                height: 46,
                marginLeft: 4,
                ...(isDarkMode ? { tintColor: palette.foreground } : {}),
              }}
              resizeMode="contain"
            />
          </View>
          {/* Random Post button */}
          {filteredPosts.length > 1 && (
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <TouchableOpacity
                onPress={handleOpenRandomPost}
                style={{
                  padding: spacing.xs,
                  marginLeft: spacing.s,
                  marginRight: spacing.xs,
                }}
                accessibilityLabel="Open a random post"
              >
                <Icon name="shuffle" size={28} color={palette.foreground} />
              </TouchableOpacity>
            </View>
          )}
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

      <FlashList
        ref={postsListRef}
        style={{ flex: 1 }}
        data={filteredPosts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPost}
        showsVerticalScrollIndicator={true}
        onViewableItemsChanged={onViewableItemsChangedRef.current}
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
              cancelButtonCallback={() => {
                // setSearch(""); // Done in SearchBar
                setFavouritesFilter("all");
                setReadFilter("all");
                setOrderBy(OrderByOption.AddedAt);
                setOrderDirection("desc");
                setArchivedFilter("no");
                setSelectedFolders([]);
                scrollToTopWithHeader(postsListRef, LIST_HEADER_HEIGHT);
              }}
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

function makeStyles(
  palette: ThemeContextValue["palette"],
  fontSizes: ThemeContextValue["fontSizes"],
) {
  return StyleSheet.create({
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
}
