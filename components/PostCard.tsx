import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { palette } from "../constants/Colors";
import { spacing } from "../constants/spacing";
import { fontSizes, fontWeights } from "../constants/typography";
import { Post } from "../models/models";

interface PostCardProps {
  post: Post;
  onToggleRead: () => void;
  onRate: (rating: number) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onToggleRead,
  onRate,
}) => {
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

  const formatRedditUser = (u: string) => (u.startsWith("u/") ? u : `u/${u}`);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Top row: Title and date */}
      <View style={styles.topRow}>
        <Text
          style={[styles.title, post.isRead && styles.readTitle]}
          numberOfLines={4}
        >
          {post.title}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        {/* <Text style={styles.date}>{formatDate(post.addedAt)}</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <Text style={styles.date}>u/test • r/test</Text>
        </View> */}
        <View style={styles.metadata}>
          <Text style={styles.metadataText}>
            {formatDate(post.redditCreatedAt)}
          </Text>
          {/* <Text style={styles.separator}>•</Text>
          <TouchableOpacity>
            <Text style={[styles.metadataText, styles.userLink]}>
              {formatRedditUser(post.author)}
            </Text>
          </TouchableOpacity> */}
          <Text style={styles.separator}>•</Text>
          <Text style={styles.metadataText}>r/{post.subreddit}</Text>
        </View>
      </View>

      {/* Bottom row: Star rating and read toggle */}
      {/* <View style={styles.bottomRow}>
        <StarRating rating={post.rating ?? 0} onRate={onRate} size={18} />

        <TouchableOpacity
          style={styles.readButton}
          onPress={(e) => {
            e.stopPropagation();
            onToggleRead();
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={post.isRead ? "checkmark-circle" : "checkmark-circle-outline"}
            size={24}
            color={post.isRead ? palette.accent : palette.muted}
          />
        </TouchableOpacity>
      </View> */}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.backgroundLight,
    borderRadius: 0,
    padding: spacing.m,
    marginHorizontal: 0, //spacing.s,
    marginVertical: 0,
    shadowColor: palette.cardShadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    //shadowOpacity: 0.1,
    //shadowRadius: 4,
    elevation: 2,
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
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  readButton: {
    padding: spacing.xs,
  },
  metadata: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    // marginBottom: spacing.xs,
  },
  metadataText: {
    fontSize: fontSizes.small,
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
