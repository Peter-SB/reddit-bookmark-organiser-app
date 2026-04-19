import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import { spacing } from "../constants/spacing";
import { fontWeights } from "../constants/typography";
import { AuthorSummary } from "../models/AuthorSummary";
import { useAuthorProfile } from "@/hooks/useAuthorProfile";

interface AuthorCardProps {
  author: AuthorSummary;
}

export const AuthorCard: React.FC<AuthorCardProps> = ({ author }) => {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const router = useRouter();
  const { profile } = useAuthorProfile(author.author);

  const handlePress = () => {
    router.push(`/author/${encodeURIComponent(author.author)}` as any);
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffInDays = Math.round(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Author name */}
      <View style={styles.nameRow}>
        <Text style={styles.authorName} numberOfLines={1}>
          u/{author.author}
        </Text>
        {profile?.isFavorite && (
          <Ionicons name="heart" size={15} color={palette.favHeartRed} />
        )}
        {profile?.rating != null && profile.rating > 0 && (
          <View style={styles.profileRatingChip}>
            <Ionicons name="star" size={12} color={palette.starYellow} />
            <Text style={styles.profileRatingText}>
              {profile.rating.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      {/* Author notes */}
      {profile?.notes ? (
        <Text style={styles.notesText} numberOfLines={2}>
          {profile.notes}
        </Text>
      ) : null}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Ionicons
            name="document-text-outline"
            size={13}
            color={palette.muted}
          />
          <Text style={styles.statText}>{author.postCount}</Text>
        </View>

        <View style={styles.statChip}>
          <Ionicons name="eye-outline" size={13} color={palette.muted} />
          <Text style={styles.statText}>{author.readCount}</Text>
        </View>

        <View style={styles.statChip}>
          <Ionicons
            name={author.favouriteCount > 0 ? "heart" : "heart-outline"}
            size={13}
            color={
              author.favouriteCount > 0 ? palette.favHeartRed : palette.muted
            }
          />
          <Text style={styles.statText}>{author.favouriteCount}</Text>
        </View>

        <View style={styles.statChip}>
          <Ionicons
            name={author.archivedCount > 0 ? "archive" : "archive-outline"}
            size={13}
            color={
              author.archivedCount > 0 ? palette.archiveOrange : palette.muted
            }
          />
          <Text style={styles.statText}>{author.archivedCount}</Text>
        </View>
      </View>

      {/* Rating + date row */}
      <View style={styles.bottomRow}>
        <Text style={styles.dateText}>
          Added {formatDate(author.lastAddedAt)}
        </Text>

        <View style={styles.ratingSection}>
          {author.avgRating != null && author.avgRating > 0 ? (
            <>
              <Ionicons name="star" size={14} color={palette.starYellow} />
              <Text style={styles.ratingText}>
                {author.avgRating.toFixed(1)} avg
              </Text>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.ratingText}>
                {author.totalRating.toFixed(0)} total
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

function makeStyles(
  palette: ThemeContextValue["palette"],
  fontSizes: ThemeContextValue["fontSizes"],
) {
  return StyleSheet.create({
    container: {
      backgroundColor: palette.background,
      padding: spacing.m,
      borderBottomWidth: 1,
      borderColor: palette.border,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      marginBottom: spacing.xs,
    },
    authorName: {
      fontSize: fontSizes.title * 0.9,
      fontWeight: fontWeights.semibold,
      color: palette.foreground,
      flexShrink: 1,
    },
    profileRatingChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    profileRatingText: {
      fontSize: fontSizes.xsmall,
      color: palette.muted,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.m,
      marginTop: spacing.xs,
    },
    statChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    statText: {
      fontSize: fontSizes.small * 0.9,
      color: palette.muted,
    },
    bottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.s,
    },
    dateText: {
      fontSize: fontSizes.small * 0.85,
      color: palette.muted,
    },
    ratingSection: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    ratingText: {
      fontSize: fontSizes.small * 0.85,
      color: palette.muted,
    },
    separator: {
      fontSize: fontSizes.small,
      color: palette.muted,
      marginHorizontal: 2,
    },
    notesText: {
      fontSize: fontSizes.small,
      color: palette.muted,
      fontStyle: "italic",
      marginVertical: spacing.xs,
    },
  });
}
