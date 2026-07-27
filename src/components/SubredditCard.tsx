import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import { spacing } from "../constants/spacing";
import { fontWeights } from "../constants/typography";
import { Subreddit } from "../models/Subreddit";

interface SubredditCardProps {
  subreddit: Subreddit;
  onRemove: (name: string) => void;
}

export const SubredditCard: React.FC<SubredditCardProps> = ({
  subreddit,
  onRemove,
}) => {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const router = useRouter();

  const handlePress = () => {
    router.push(`/subreddit/${encodeURIComponent(subreddit.name)}` as any);
  };

  const handleLongPress = () => {
    Alert.alert(
      "Remove subreddit?",
      "This won't delete any saved posts.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => onRemove(subreddit.name),
        },
      ],
    );
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.8}
    >
      <View style={styles.nameRow}>
        <Icon name="forum" size={18} color={palette.muted} />
        <Text style={styles.name} numberOfLines={1}>
          r/{subreddit.name}
        </Text>
        {!subreddit.isEnabledForSearch && (
          <Text style={styles.excludedBadge}>excluded</Text>
        )}
      </View>
      <Icon name="chevron-right" size={22} color={palette.muted} />
    </TouchableOpacity>
  );
};

function makeStyles(
  palette: ThemeContextValue["palette"],
  fontSizes: ThemeContextValue["fontSizes"],
) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: palette.background,
      padding: spacing.m,
      borderBottomWidth: 1,
      borderColor: palette.border,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      flexShrink: 1,
    },
    name: {
      fontSize: fontSizes.title * 0.9,
      fontWeight: fontWeights.semibold,
      color: palette.foreground,
      flexShrink: 1,
    },
    excludedBadge: {
      fontSize: fontSizes.small * 0.85,
      color: palette.muted,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
  });
}
