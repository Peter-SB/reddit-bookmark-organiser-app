import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

import { SearchBar } from "@/components/SearchBar";
import { PostCard } from "@/components/PostCard";
import { palette } from "@/constants/Colors";
import {
  DEFAULT_SEARCH_INCLUDE_TEXT,
  DEFAULT_SEARCH_RESULTS,
} from "@/constants/search";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import { usePosts } from "@/hooks/usePosts";
import {
  SemanticSearchResult,
  SemanticSearchService,
} from "@/services/SemanticSearchService";

export default function SemanticSearchScreen() {
  const router = useRouter();
  const { posts, refreshPosts } = usePosts();

  const [query, setQuery] = useState("");
  const [kInput, setKInput] = useState(String(DEFAULT_SEARCH_RESULTS));
  const [includeText, setIncludeText] = useState(DEFAULT_SEARCH_INCLUDE_TEXT);
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");

  useFocusEffect(
    useCallback(() => {
      refreshPosts();
    }, [refreshPosts])
  );

  useFocusEffect(
    useCallback(() => {
      setModalVisible(true);
    }, [])
  );

  const postsMap = useMemo(() => {
    const map = new Map<number, (typeof posts)[number]>();
    posts.forEach((p) => map.set(p.id, p));
    return map;
  }, [posts]);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setError("Please enter a search query.");
      return;
    }
    const parsedK = parseInt(kInput, 10);
    const k =
      Number.isFinite(parsedK) && parsedK > 0
        ? parsedK
        : DEFAULT_SEARCH_RESULTS;

    setModalVisible(false);
    setLoading(true);
    setError(null);
    try {
      const response = await SemanticSearchService.search({
        query: trimmed,
        k,
        includeText,
      });
      setResults(response.results);
      setLastQuery(trimmed);
      setModalVisible(false);
    } catch (err: any) {
      setError(err?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }, [query, kInput, includeText]);

  const renderResult = ({ item }: { item: SemanticSearchResult }) => {
    const post = postsMap.get(item.postId);
    const snippet =
      item.text && item.text.trim().length > 0 ? (
        <Text style={styles.resultText} numberOfLines={6}>
          {item.text.trim()}
        </Text>
      ) : undefined;

    if (post) {
      return <PostCard post={post} footer={snippet} />;
    }

    return (
      <View style={styles.fallbackCard}>
        <View style={styles.fallbackHeader}>
          <Text style={styles.fallbackTitle} numberOfLines={2}>
            {String(item.metadata?.title || `Result #${item.postId}`)}
          </Text>
          <View style={styles.fallbackBadge}>
            <Text style={styles.fallbackBadgeText}>#{item.postId}</Text>
          </View>
        </View>
        {item.metadata?.subreddit ? (
          <Text style={styles.fallbackMeta}>r/{item.metadata.subreddit}</Text>
        ) : null}
        {item.metadata?.url ? (
          <Text
            style={[styles.fallbackMeta, { color: palette.accent }]}
            numberOfLines={1}
          >
            {item.metadata.url}
          </Text>
        ) : null}
        {snippet}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/")}>
          <Icon name="arrow-back" size={26} color={palette.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Semantic Search</Text>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={styles.headerIconButton}
        >
          <Icon name="search" size={24} color={palette.foreground} />
        </TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusText}>
          {lastQuery
            ? `Results for "${lastQuery}" (${results.length})`
            : "Search your synced embeddings for similar posts."}
        </Text>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={[styles.statusText, { marginLeft: spacing.s }]}>
              Searching...
            </Text>
          </View>
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={results}
        keyExtractor={(item, idx) => `${item.postId}-${idx}`}
        renderItem={renderResult}
        contentContainerStyle={
          results.length === 0 ? styles.emptyListContainer : undefined
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No results yet</Text>
            </View>
          ) : null
        }
      />

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalCenter}
          >
            <View style={styles.modalCard}>
              {/* <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Semantic search</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Icon name="close" size={22} color={palette.foreground} />
                </TouchableOpacity>
              </View> */}
              <SearchBar
                value={query}
                onChangeText={setQuery}
                placeholder="Search by meaning or topic..."
                cancelButtonCallback={() => setQuery("")}
              />
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Results to return</Text>
                <TextInput
                  style={styles.input}
                  value={kInput}
                  onChangeText={setKInput}
                  keyboardType="number-pad"
                  placeholder={String(DEFAULT_SEARCH_RESULTS)}
                  placeholderTextColor={palette.muted}
                  maxLength={4}
                />
              </View>
              <View style={styles.bottomRow}>
                <View style={styles.switchRow}>
                  <View>
                    <Text style={styles.inputLabel}>Show text snippets</Text>
                  </View>
                  <Switch
                    value={includeText}
                    onValueChange={setIncludeText}
                    thumbColor={includeText ? palette.accent : palette.border}
                    trackColor={{ true: palette.border, false: palette.border }}
                  />
                </View>
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={handleSearch}
                  disabled={loading}
                >
                  <Icon
                    name="manage-search"
                    size={20}
                    color={palette.background}
                  />
                  <Text style={styles.searchButtonText}>
                    {loading ? "Searching..." : "Search"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
  },
  headerTitle: {
    fontSize: fontSizes.large,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
  },
  headerIconButton: {
    padding: spacing.xs,
  },
  statusRow: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
  },
  statusText: {
    fontSize: fontSizes.body,
    color: palette.muted,
  },
  errorText: {
    color: palette.favHeartRed,
    paddingHorizontal: spacing.m,
    paddingBottom: spacing.s,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    // paddingHorizontal: spacing.m,
    paddingTop: spacing.s,
  },
  resultText: {
    fontSize: fontSizes.small,
    color: palette.foreground,
    lineHeight: 18,
  },
  fallbackCard: {
    padding: spacing.m,
    borderBottomWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.background,
  },
  fallbackHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  fallbackTitle: {
    fontSize: fontSizes.title * 0.9,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
    flex: 1,
    marginRight: spacing.s,
  },
  fallbackBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: palette.backgroundMidLight,
  },
  fallbackBadgeText: {
    fontSize: fontSizes.small,
    color: palette.muted,
  },
  fallbackMeta: {
    fontSize: fontSizes.small,
    color: palette.muted,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
  modalContainer: {
    flex: 1,
    justifyContent: "center",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCenter: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.l,
  },
  modalCard: {
    backgroundColor: palette.background,
    borderRadius: 12,
    padding: spacing.l,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    gap: spacing.s,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: fontSizes.large,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.s,
  },
  inputLabel: {
    fontSize: fontSizes.body,
    color: palette.foreground,
  },
  input: {
    flex: 0.3,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    color: palette.foreground,
    textAlign: "center",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  helperText: {
    fontSize: fontSizes.small,
    color: palette.muted,
    marginTop: 2,
  },
  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.foreground,
    borderRadius: 10,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.s,
    gap: spacing.s,
  },
  searchButtonText: {
    color: palette.background,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
  },
});
