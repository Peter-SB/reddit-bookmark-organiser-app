import { InputBar } from "@/components/InputBar";
import { SearchBar } from "@/components/SearchBar";
import { SubredditCard } from "@/components/SubredditCard";
import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import { useSubreddits } from "@/hooks/useSubreddits";
import { Subreddit } from "@/models/Subreddit";
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
