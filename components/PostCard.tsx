import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { palette } from "../constants/Colors";
import { spacing } from "../constants/spacing";
import { fontSizes, fontWeights } from "../constants/typography";
import { StarRating } from "./StarRating";

interface PostCardProps {
  title: string;
  date: number; // epoch timestamp
  rating: number;
  read: boolean;
  onToggleRead: () => void;
  onRate: (rating: number) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  title,
  date,
  rating,
  read,
  onToggleRead,
  onRate,
}) => {
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffInDays === 0) {
      return "Today";
    } else if (diffInDays === 1) {
      return "Yesterday";
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <View style={styles.container}>
      {/* Top row: Title and date */}
      <View style={styles.topRow}>
        <Text
          style={[styles.title, read && styles.readTitle]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text style={styles.date}>{formatDate(date)}</Text>
      </View>

      {/* Bottom row: Star rating and read toggle */}
      <View style={styles.bottomRow}>
        <StarRating rating={rating} onRate={onRate} size={18} />

        <TouchableOpacity
          style={styles.readButton}
          onPress={onToggleRead}
          activeOpacity={0.7}
        >
          <Ionicons
            name={read ? "checkmark-circle" : "checkmark-circle-outline"}
            size={24}
            color={read ? palette.accent : palette.muted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.background,
    borderRadius: 8,
    padding: spacing.m,
    marginHorizontal: spacing.m,
    marginVertical: spacing.s,
    shadowColor: palette.cardShadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: palette.border,
  },
  topRow: {
    marginBottom: spacing.m,
  },
  title: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
    marginBottom: spacing.xs,
    lineHeight: 24,
  },
  readTitle: {
    opacity: 0.6,
  },
  date: {
    fontSize: fontSizes.small,
    color: palette.muted,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  readButton: {
    padding: spacing.xs,
  },
});
