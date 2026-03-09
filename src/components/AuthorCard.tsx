import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { palette } from "../constants/Colors";
import { spacing } from "../constants/spacing";
import { fontSizes, fontWeights } from "../constants/typography";
import { AuthorSummary } from "../models/AuthorSummary";

interface AuthorCardProps {
  author: AuthorSummary;
}

export const AuthorCard: React.FC<AuthorCardProps> = ({ author }) => {
  const router = useRouter();

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
      <Text style={styles.authorName} numberOfLines={1}>
        u/{author.author}
      </Text>

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

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.background,
    padding: spacing.m,
    borderBottomWidth: 1,
    borderColor: palette.border,
  },
  authorName: {
    fontSize: fontSizes.title * 0.9,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
    marginBottom: spacing.xs,
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
});
