import { AuthorCard } from "@/components/AuthorCard";
import { OrderByRow } from "@/components/OrderByRow";
import { SearchBar } from "@/components/SearchBar";
import { AUTHOR_ORDER_OPTIONS, OrderByOption } from "@/constants/orderBy";
import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import { useAuthors } from "@/hooks/useAuthors";
import { AuthorSummary } from "@/models/AuthorSummary";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
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

export default function AuthorsScreen() {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const router = useRouter();
  const [orderBy, setOrderBy] = useState<OrderByOption>(OrderByOption.AddedAt);
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const { authors, loading, refresh } = useAuthors({
    orderBy,
    orderDirection,
    search,
  });

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

  const renderItem = useCallback(
    ({ item }: { item: AuthorSummary }) => <AuthorCard author={item} />,
    [],
  );

  const totalAuthors = authors.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={26} color={palette.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Authors{" "}
          {hasLoaded && (
            <Text style={styles.headerCount}>({totalAuthors})</Text>
          )}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Sort controls */}
      <View style={styles.sortRow}>
        <OrderByRow
          orderOptions={AUTHOR_ORDER_OPTIONS}
          localOrderBy={orderBy}
          localOrderDirection={orderDirection}
          onOrderByChange={setOrderBy}
          onOrderDirectionChange={setOrderDirection}
        />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search authors..."
        />
      </View>

      {/* Author list */}
      <FlashList
        data={authors}
        keyExtractor={(item) => item.author}
        renderItem={renderItem}
        contentContainerStyle={
          authors.length === 0 ? styles.emptyListContainer : undefined
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
                {search ? "No authors match your search" : "No authors yet"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? "Try a different search term."
                  : "Add some posts to see authors here."}
              </Text>
            </View>
          ) : null
        }
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
    sortRow: {
      paddingHorizontal: spacing.s,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
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
