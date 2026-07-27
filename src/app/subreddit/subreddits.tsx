import { InputBar } from "@/components/InputBar";
import { SearchBar } from "@/components/SearchBar";
import { SubredditCard } from "@/components/SubredditCard";
import { SubredditSearchAllFilterModal } from "@/components/SubredditSearchAllFilterModal";
import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import { useSubreddits } from "@/hooks/useSubreddits";
import { Subreddit } from "@/models/Subreddit";
import { joinSubredditNames } from "@/utils/subredditNames";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  Alert,
  BackHandler,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

export default function SubredditsScreen() {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isInputVisible, setIsInputVisible] = useState(false);

  const { subreddits, loading, refresh, addSubreddit, removeSubreddit } =
    useSubreddits({ search });
  // Unfiltered list — Search All / the include-filter always operate on every
  // added subreddit, independent of what's currently typed into the search box.
  const { subreddits: allSubreddits, setEnabledForSearch } = useSubreddits();

  useEffect(() => {
    if (!loading) setHasLoaded(true);
  }, [loading]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.back();
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
    }, [router]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleAddSubreddit = useCallback(
    async (url: string) => {
      const result = await addSubreddit(url);
      if (result.ok) {
        setIsInputVisible(false);
      } else {
        Alert.alert("Couldn't add subreddit", result.error);
      }
    },
    [addSubreddit],
  );

  const handleRemove = useCallback(
    async (name: string) => {
      await removeSubreddit(name);
    },
    [removeSubreddit],
  );

  const renderItem = useCallback(
    ({ item }: { item: Subreddit }) => (
      <SubredditCard subreddit={item} onRemove={handleRemove} />
    ),
    [handleRemove],
  );

  const totalSubreddits = subreddits.length;

  const enabledSubredditNames = useMemo(
    () => allSubreddits.filter((s) => s.isEnabledForSearch).map((s) => s.name),
    [allSubreddits],
  );

  const handleSearchAll = useCallback(() => {
    if (enabledSubredditNames.length === 0) {
      Alert.alert(
        "No subreddits selected",
        "Use the filter button to include at least one subreddit in Search All.",
      );
      return;
    }
    router.push(
      `/subreddit/${encodeURIComponent(joinSubredditNames(enabledSubredditNames))}` as any,
    );
  }, [enabledSubredditNames, router]);

  const handleToggleEnabledForSearch = useCallback(
    (name: string, enabled: boolean) => {
      setEnabledForSearch(name, enabled);
    },
    [setEnabledForSearch],
  );

  const handleSetAllEnabledForSearch = useCallback(
    (enabled: boolean) => {
      for (const s of allSubreddits) {
        if (s.isEnabledForSearch !== enabled) {
          setEnabledForSearch(s.name, enabled);
        }
      }
    },
    [allSubreddits, setEnabledForSearch],
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={26} color={palette.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Subreddits{" "}
          {hasLoaded && (
            <Text style={styles.headerCount}>({totalSubreddits})</Text>
          )}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Search All */}
      <View style={styles.searchAllRow}>
        <TouchableOpacity
          style={styles.searchAllButton}
          onPress={handleSearchAll}
          accessibilityLabel="Search all included subreddits"
        >
          <Icon name="dynamic-feed" size={18} color={palette.foreground} />
          <Text style={styles.searchAllButtonText}>
            Search All
            {enabledSubredditNames.length > 0
              ? ` (${enabledSubredditNames.length})`
              : ""}
          </Text>
        </TouchableOpacity>
        <SubredditSearchAllFilterModal
          subreddits={allSubreddits}
          onToggle={handleToggleEnabledForSearch}
          onSetAll={handleSetAllEnabledForSearch}
        />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search subreddits..."
        />
      </View>

      {/* Subreddit list */}
      <FlashList
        data={subreddits}
        keyExtractor={(item) => item.name}
        renderItem={renderItem}
        contentContainerStyle={
          subreddits.length === 0 ? styles.emptyListContainer : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.foreground}
          />
        }
        ListEmptyComponent={
          hasLoaded ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {search ? "No subreddits match your search" : "No subreddits yet"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? "Try a different search term."
                  : "Add one by pasting a link below."}
              </Text>
            </View>
          ) : null
        }
      />

      <InputBar
        visible={isInputVisible}
        onExpand={() => setIsInputVisible(true)}
        onClose={() => setIsInputVisible(false)}
        onSubmit={handleAddSubreddit}
        placeholder="Paste subreddit link…"
      />
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
      fontSize: fontSizes.xlarge,
      fontWeight: fontWeights.semibold,
      color: palette.foreground,
      flex: 1,
      marginHorizontal: spacing.m,
    },
    headerCount: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.normal,
      color: palette.muted,
    },
    searchAllRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.m,
      paddingTop: spacing.s,
    },
    searchAllButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.s,
      borderRadius: 8,
      backgroundColor: palette.backgroundMidLight,
    },
    searchAllButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: palette.foreground,
    },
    searchContainer: {
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
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
  });
}
