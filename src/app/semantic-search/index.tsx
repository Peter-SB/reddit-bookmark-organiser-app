import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

import { SearchBar } from "@/components/SearchBar";
import {
  CHUNK_TYPES,
  DEFAULT_CHUNK_TYPE,
  DEFAULT_SEARCH_RESULTS,
} from "@/constants/search";
import type { ChunkType } from "@/constants/search";
import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import type { SearchHistoryEntry } from "@/repository/SearchHistoryRepository";

const CHUNK_TYPE_LABELS: Record<ChunkType, string> = CHUNK_TYPES.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.label }),
  {} as Record<ChunkType, string>,
);

export default function SemanticSearchHistoryScreen() {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const router = useRouter();
  const { entries, loading, startSearch, deleteEntry } = useSearchHistory();

  const [query, setQuery] = useState("");
  const [kInput, setKInput] = useState(String(DEFAULT_SEARCH_RESULTS));
  const [chunkType, setChunkType] = useState<ChunkType>(DEFAULT_CHUNK_TYPE);
  const [modalVisible, setModalVisible] = useState(false);
  const [starting, setStarting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setFormError("Please enter a search query.");
      return;
    }
    const parsedK = parseInt(kInput, 10);
    const k =
      Number.isFinite(parsedK) && parsedK > 0
        ? parsedK
        : DEFAULT_SEARCH_RESULTS;

    setStarting(true);
    setFormError(null);
    try {
      await startSearch({ query: trimmed, k, chunkType });
      setQuery("");
      setModalVisible(false);
    } catch (err: any) {
      setFormError(err?.message || "Failed to start search");
    } finally {
      setStarting(false);
    }
  }, [query, kInput, chunkType, startSearch]);

  const handleLongPress = useCallback(
    (entry: SearchHistoryEntry) => {
      Alert.alert(
        "Delete search",
        `Remove "${entry.query}" from your search history?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteEntry(entry.id),
          },
        ],
      );
    },
    [deleteEntry],
  );

  const renderEntry = ({ item }: { item: SearchHistoryEntry }) => {
    const statusNode =
      item.status === "pending" ? (
        <View style={styles.statusBadgeRow}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={[styles.statusBadgeText, { marginLeft: spacing.xs }]}>
            Searching...
          </Text>
        </View>
      ) : item.status === "error" ? (
        <View style={styles.statusBadgeRow}>
          <Icon name="error-outline" size={16} color={palette.favHeartRed} />
          <Text
            style={[
              styles.statusBadgeText,
              { color: palette.favHeartRed, marginLeft: spacing.xs },
            ]}
            numberOfLines={1}
          >
            {item.error || "Search failed"}
          </Text>
        </View>
      ) : (
        <Text style={styles.statusBadgeText}>
          {item.results.length} result{item.results.length === 1 ? "" : "s"}
        </Text>
      );

    return (
      <TouchableOpacity
        style={styles.entryCard}
        onPress={() => router.push(`/semantic-search/${item.id}` as any)}
        onLongPress={() => handleLongPress(item)}
      >
        <View style={styles.entryHeader}>
          <Text style={styles.entryQuery} numberOfLines={2}>
            {item.query}
          </Text>
          <View style={styles.entryBadge}>
            <Text style={styles.entryBadgeText}>
              {CHUNK_TYPE_LABELS[item.chunkType] ?? item.chunkType}
            </Text>
          </View>
        </View>
        <View style={styles.entryFooter}>
          <Text style={styles.entryMeta}>
            {item.createdAt.toLocaleString()}
          </Text>
          {statusNode}
        </View>
      </TouchableOpacity>
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
          <Icon name="add" size={26} color={palette.foreground} />
        </TouchableOpacity>
      </View>

      <FlashList
        data={entries}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderEntry}
        contentContainerStyle={
          entries.length === 0 ? styles.emptyListContainer : undefined
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No searches yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap + to search your synced embeddings for similar posts.
              </Text>
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
              <SearchBar
                value={query}
                onChangeText={setQuery}
                placeholder="Search by meaning or topic..."
                cancelButtonCallback={() => setQuery("")}
              />
              <View style={styles.switchRow}>
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
              <View style={styles.chunkTypeSection}>
                <Text style={styles.inputLabel}>Search in</Text>
                <View style={styles.chunkTypeRow}>
                  {CHUNK_TYPES.map((option) => {
                    const selected = option.value === chunkType;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.chunkTypeOption,
                          selected && styles.chunkTypeOptionSelected,
                        ]}
                        onPress={() => setChunkType(option.value)}
                      >
                        <Text
                          style={[
                            styles.chunkTypeOptionText,
                            selected && styles.chunkTypeOptionTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              {formError ? (
                <Text style={styles.errorText}>{formError}</Text>
              ) : null}
              <View style={styles.searchRow}>
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={handleSearch}
                  disabled={starting}
                >
                  {starting ? (
                    <ActivityIndicator size="small" color={palette.background} />
                  ) : (
                    <Icon
                      name="manage-search"
                      size={20}
                      color={palette.background}
                    />
                  )}
                  <Text style={styles.searchButtonText}>
                    {starting ? "Starting..." : "Search"}
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
    errorText: {
      color: palette.favHeartRed,
    },
    entryCard: {
      padding: spacing.m,
      borderBottomWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.background,
      gap: spacing.xs,
    },
    entryHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.s,
    },
    entryQuery: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: palette.foreground,
      flex: 1,
    },
    entryBadge: {
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: palette.backgroundMidLight,
    },
    entryBadgeText: {
      fontSize: fontSizes.small,
      color: palette.muted,
    },
    entryFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    entryMeta: {
      fontSize: fontSizes.small,
      color: palette.muted,
    },
    statusBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    statusBadgeText: {
      fontSize: fontSizes.small,
      color: palette.muted,
      maxWidth: 180,
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
      height: 40,
    },
    chunkTypeSection: {
      gap: spacing.xs,
    },
    chunkTypeRow: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    chunkTypeOption: {
      flex: 1,
      paddingVertical: spacing.xs,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
    },
    chunkTypeOptionSelected: {
      backgroundColor: palette.foregroundLight,
      borderColor: palette.foregroundLight,
    },
    chunkTypeOptionText: {
      fontSize: fontSizes.small,
      color: palette.foreground,
      fontWeight: fontWeights.medium,
    },
    chunkTypeOptionTextSelected: {
      color: palette.background,
    },
    searchRow: {
      paddingTop: spacing.s,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    searchButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.foregroundLight,
      borderRadius: 10,
      paddingVertical: spacing.s,
      paddingHorizontal: spacing.m,
      gap: spacing.s,
    },
    searchButtonText: {
      color: palette.background,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
    },
  });
}
