import { SearchBar } from "@/components/SearchBar";
import { MIN_COUNT_OPTIONS } from "@/constants/search";
import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import type {
  SubredditSearchSort,
  SubredditTimeRange,
} from "@/hooks/useSubredditImport";
import { useSubreddits } from "@/hooks/useSubreddits";
import { buildRedditSearchQuery } from "@/utils/redditSearchQuery";
import { joinSubredditNames, parseSubredditNames } from "@/utils/subredditNames";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

/** Which subreddits the search runs against. */
type SearchScope = "this" | "selected" | "all";

const SORT_OPTIONS: { key: SubredditSearchSort; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "top", label: "Top" },
  { key: "new", label: "New" },
  { key: "hot", label: "Hot" },
  { key: "comments", label: "Most Comments" },
];

/** Reddit only honours `t` on these search sorts. */
const SORTS_WITH_TIME_RANGE: SubredditSearchSort[] = ["relevance", "top"];

const TIME_RANGE_OPTIONS: { key: SubredditTimeRange; label: string }[] = [
  { key: "hour", label: "Hour" },
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "all", label: "All Time" },
];

function firstParam(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

/**
 * Lives at the route root rather than under `subreddit/`: a sibling of the
 * `[subreddit]` dynamic route would be shadowed by it whenever the route
 * manifest is stale, which silently renders a subreddit browse screen instead.
 *
 * Builds a Reddit search over one subreddit, the selected subreddits, or all
 * of Reddit, then hands off to the normal subreddit results screen in search
 * mode. This screen renders no posts of its own.
 *
 * Every field is echoed back in the route params so tapping the search icon on
 * the results screen reopens this form exactly as it was submitted.
 */
export default function SubredditSearchScreen() {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const router = useRouter();
  const params = useLocalSearchParams<{
    subreddit?: string | string[];
    terms?: string | string[];
    exclude?: string | string[];
    titleOnly?: string | string[];
    selfOnly?: string | string[];
    scope?: string | string[];
    ssort?: string | string[];
    t?: string | string[];
    minScore?: string | string[];
    minComments?: string | string[];
  }>();

  /** The subreddit(s) the user came from — one name, or a "+"-joined feed. */
  const incomingNames = useMemo(() => {
    const raw = firstParam(params.subreddit).trim();
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      // Malformed percent-encoding: fall back to the raw param.
    }
    return parseSubredditNames(decoded);
  }, [params.subreddit]);

  const { subreddits } = useSubreddits();
  const enabledNames = useMemo(
    () => subreddits.filter((s) => s.isEnabledForSearch).map((s) => s.name),
    [subreddits],
  );

  const canScopeToThisSub = incomingNames.length === 1;

  const [terms, setTerms] = useState(() => firstParam(params.terms));
  const [exclude, setExclude] = useState(() => firstParam(params.exclude));
  const [titleOnly, setTitleOnly] = useState(
    () => firstParam(params.titleOnly) === "1",
  );
  const [selfOnly, setSelfOnly] = useState(
    () => firstParam(params.selfOnly) === "1",
  );
  const [scope, setScope] = useState<SearchScope>(() => {
    const incoming = firstParam(params.scope) as SearchScope;
    if (incoming === "this" || incoming === "selected" || incoming === "all") {
      return incoming;
    }
    return incomingNames.length === 1 ? "this" : "selected";
  });
  const [sort, setSort] = useState<SubredditSearchSort>(() => {
    const incoming = firstParam(params.ssort) as SubredditSearchSort;
    return SORT_OPTIONS.some((o) => o.key === incoming) ? incoming : "relevance";
  });
  const [timeRange, setTimeRange] = useState<SubredditTimeRange>(() => {
    const incoming = firstParam(params.t) as SubredditTimeRange;
    return TIME_RANGE_OPTIONS.some((o) => o.key === incoming) ? incoming : "all";
  });
  const [minScore, setMinScore] = useState(
    () => parseInt(firstParam(params.minScore), 10) || 0,
  );
  const [minComments, setMinComments] = useState(
    () => parseInt(firstParam(params.minComments), 10) || 0,
  );
  const [error, setError] = useState<string | null>(null);

  console.debug(
    `[RedditSearch] mounted — incoming subreddit="${firstParam(params.subreddit)}" scope=${scope}`,
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

  /** The `q` string that will actually be sent, shown live as a preview. */
  const query = useMemo(
    () => buildRedditSearchQuery({ terms, exclude, titleOnly, selfOnly }),
    [terms, exclude, titleOnly, selfOnly],
  );

  const targetNames = useMemo(() => {
    if (scope === "all") return [];
    if (scope === "this") return incomingNames;
    return enabledNames;
  }, [scope, incomingNames, enabledNames]);

  const handleSearch = useCallback(() => {
    if (!query) {
      setError("Enter something to search for.");
      return;
    }
    if (scope !== "all" && targetNames.length === 0) {
      setError(
        scope === "selected"
          ? "No subreddits are selected for search."
          : "No subreddit to search.",
      );
      return;
    }
    setError(null);

    // "all" is Reddit's own catch-all name; the results screen still needs a
    // path segment, and restrict=0 is what makes the search site-wide.
    const names = scope === "all" ? "all" : joinSubredditNames(targetNames);
    // Replace rather than push: back should return to the screen the search
    // icon was tapped on, not to this form. Params go through the object form
    // so expo-router does the encoding — a hand-built query string would turn
    // the spaces in `q` into "+".
    console.debug(
      `[RedditSearch] submitting q="${query}" names="${names}" sort=${sort} t=${timeRange} restrict=${scope !== "all"}`,
    );
    router.replace({
      pathname: "/subreddit/[subreddit]",
      params: {
        subreddit: names,
        q: query,
        ssort: sort,
        t: timeRange,
        restrict: scope === "all" ? "0" : "1",
        minScore: String(minScore),
        minComments: String(minComments),
        // Echoed so this form can be reopened pre-filled.
        terms,
        exclude,
        titleOnly: titleOnly ? "1" : "0",
        selfOnly: selfOnly ? "1" : "0",
        scope,
      },
    } as any);
  }, [
    query,
    scope,
    targetNames,
    sort,
    timeRange,
    minScore,
    minComments,
    terms,
    exclude,
    titleOnly,
    selfOnly,
    router,
  ]);

  const renderChipRow = <T,>(
    options: { key: T; label: string }[],
    value: T,
    onChange: (key: T) => void,
  ) => (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={String(opt.key)}
          style={[styles.chip, value === opt.key && styles.chipActive]}
          onPress={() => onChange(opt.key)}
        >
          <Text
            style={[
              styles.chipLabel,
              value === opt.key && styles.chipLabelActive,
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderMinCountRow = (
    value: number,
    onChange: (min: number) => void,
  ) =>
    renderChipRow(
      MIN_COUNT_OPTIONS.map((min) => ({
        key: min,
        label: min === 0 ? "Any" : `${min}+`,
      })),
      value,
      onChange,
    );

  const scopeOptions: { key: SearchScope; label: string }[] = [
    ...(canScopeToThisSub
      ? [{ key: "this" as const, label: `r/${incomingNames[0]}` }]
      : []),
    { key: "selected", label: `All selected (${enabledNames.length})` },
    { key: "all", label: "All of Reddit" },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={26} color={palette.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Search Reddit
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>Search Terms</Text>
        <SearchBar
          value={terms}
          onChangeText={setTerms}
          placeholder='e.g. cast iron "dutch oven"'
        />

        <Text style={styles.sectionLabel}>Exclude Terms</Text>
        <TextInput
          style={styles.input}
          value={exclude}
          onChangeText={setExclude}
          placeholder="e.g. vegan keto"
          placeholderTextColor={palette.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>
          Space separated. Use &quot;quotes&quot; for phrases.
        </Text>

        <Text style={styles.sectionLabel}>Search In</Text>
        {renderChipRow(scopeOptions, scope, setScope)}
        {scope === "selected" && enabledNames.length > 0 ? (
          <Text style={styles.hint} numberOfLines={2}>
            {enabledNames.map((n) => `r/${n}`).join(", ")}
          </Text>
        ) : null}

        <Text style={styles.sectionLabel}>Sort By</Text>
        {renderChipRow(SORT_OPTIONS, sort, setSort)}

        {SORTS_WITH_TIME_RANGE.includes(sort) ? (
          <>
            <Text style={styles.sectionLabel}>Time Range</Text>
            {renderChipRow(TIME_RANGE_OPTIONS, timeRange, setTimeRange)}
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Options</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Text posts only</Text>
          <Switch
            value={selfOnly}
            onValueChange={setSelfOnly}
            thumbColor={selfOnly ? palette.foregroundMidLight : palette.border}
            trackColor={{ true: palette.border, false: palette.border }}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Match title only</Text>
          <Switch
            value={titleOnly}
            onValueChange={setTitleOnly}
            thumbColor={titleOnly ? palette.foregroundMidLight : palette.border}
            trackColor={{ true: palette.border, false: palette.border }}
          />
        </View>

        <Text style={styles.sectionLabel}>Min Upvotes</Text>
        {renderMinCountRow(minScore, setMinScore)}

        <Text style={styles.sectionLabel}>Min Comments</Text>
        {renderMinCountRow(minComments, setMinComments)}
        <Text style={styles.hint}>
          Reddit can&apos;t filter by score, so these are applied to the
          results as they load.
        </Text>

        {query ? (
          <>
            <Text style={styles.sectionLabel}>Query</Text>
            <Text style={styles.queryPreview}>{query}</Text>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.searchButton, !query && styles.searchButtonDisabled]}
          onPress={handleSearch}
          disabled={!query}
        >
          <Icon name="search" size={20} color={palette.background} />
          <Text style={styles.searchButtonLabel}>Search</Text>
        </TouchableOpacity>
      </ScrollView>
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
      flex: 1,
      marginHorizontal: spacing.m,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.m,
      paddingBottom: spacing.xl,
    },
    sectionLabel: {
      fontSize: fontSizes.small * 0.85,
      color: palette.muted,
      fontWeight: "600",
      marginTop: spacing.m,
      marginBottom: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      paddingHorizontal: spacing.s,
      paddingVertical: spacing.s,
      minHeight: 44,
      fontSize: fontSizes.body,
      color: palette.foreground,
      backgroundColor: palette.background,
    },
    hint: {
      fontSize: fontSizes.small * 0.8,
      color: palette.muted,
      marginTop: spacing.xs,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    chip: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.border,
    },
    chipActive: {
      backgroundColor: palette.border,
    },
    chipLabel: {
      fontSize: fontSizes.small * 0.9,
      color: palette.foreground,
    },
    chipLabelActive: {
      fontWeight: "bold",
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.xs,
    },
    switchLabel: {
      fontSize: fontSizes.body,
      color: palette.foreground,
    },
    queryPreview: {
      fontSize: fontSizes.small * 0.9,
      color: palette.muted,
      fontFamily: "SpaceMono",
      backgroundColor: palette.backgroundMidLight,
      borderRadius: 6,
      padding: spacing.s,
    },
    error: {
      fontSize: fontSizes.small,
      color: palette.favHeartRed,
      marginTop: spacing.m,
    },
    searchButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.s,
      marginTop: spacing.l,
      paddingVertical: spacing.m,
      borderRadius: 8,
      backgroundColor: palette.accent,
    },
    searchButtonDisabled: {
      opacity: 0.4,
    },
    searchButtonLabel: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: palette.background,
    },
  });
}
