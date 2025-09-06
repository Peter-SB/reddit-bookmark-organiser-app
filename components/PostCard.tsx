import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { palette } from "../constants/Colors";
import { spacing } from "../constants/spacing";
import { fontSizes, fontWeights } from "../constants/typography";
import { Post } from "../models/models";

interface PostCardProps {
  post: Post;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const router = useRouter();

  const handlePress = () => {
    router.push(`/post/${post.id}` as any);
  };
  const formatDate = (timestamp: Date | number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.round(
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
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Top row: Title */}
      <View style={styles.topRow}>
        <Text
          style={[styles.title, post.isRead && styles.readTitle]}
          numberOfLines={4}
        >
          {post.customTitle ?? post.title}
        </Text>
      </View>
      {/* Metadata and actions row */}
      <View style={styles.rowMetaActions}>
        {/* Right: Date and subreddit */}
        <View style={styles.leftMeta}>
          <Text style={styles.metadataText}>#{post.id}</Text>
          <Text style={styles.separator}>•</Text>
          <Text style={styles.metadataText}>r/{post.subreddit}</Text>
          <Text style={styles.separator}>•</Text>
          <Text style={styles.metadataText}>
            {post.author ? `u/${post.author}` : "Unknown User"}
          </Text>
          <Text style={styles.separator}>•</Text>
          <Text style={styles.metadataText}>
            Words:{" "}
            {(post.customBody ?? post.bodyText).trim().split(/\s+/).length}
          </Text>
        </View>

        {/* Left: Heart and rating */}
        <View style={styles.rightMeta}>
          {typeof post.rating === "number" && post.rating > 0 && (
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingText}>{post.rating.toFixed(1)}/5</Text>
              <Ionicons
                name="star"
                size={16}
                color={palette.starYellow}
                style={{ marginRight: 2 }}
              />
            </View>
          )}
          {post.isFavorite && (
            <Ionicons
              name="heart"
              size={16}
              color={palette.favHeartRed}
              style={{ marginRight: 2 }}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.background,
    borderRadius: 0,
    padding: spacing.m,
    marginHorizontal: 0, //spacing.s,
    marginVertical: 0,
    shadowColor: palette.cardShadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    borderWidth: 0,
    borderBottomWidth: 1,
    borderColor: palette.border,
  },
  topRow: {
    marginBottom: spacing.s,
  },
  title: {
    fontSize: fontSizes.title * 0.9,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
    marginBottom: spacing.xs,
    lineHeight: 24 * 0.9,
  },
  readTitle: {
    opacity: 0.6,
  },
  date: {
    fontSize: fontSizes.small,
    color: palette.muted,
  },
  rowMetaActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.s,
  },
  rightMeta: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  ratingText: {
    fontSize: fontSizes.small,
    color: palette.muted,
    marginLeft: 2,
    marginRight: 3,
  },
  leftMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  metadata: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    // marginBottom: spacing.xs,
  },
  metadataText: {
    fontSize: fontSizes.small * 0.8,
    color: palette.muted,
  },
  separator: {
    fontSize: fontSizes.body,
    color: palette.muted,
    marginHorizontal: spacing.xs,
  },
  // userLink: {
  //   color: palette.accent,
  // },
});
