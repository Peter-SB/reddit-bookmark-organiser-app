import React, { useCallback, useRef } from "react";
import { StyleSheet, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "@/contexts/ThemeContext";
import { PostListItem } from "@/models/models";
import { PostCard } from "./PostCard";

// TODO: add optimistic ui updates

interface SwipeablePostCardProps {
  post: PostListItem;
  onToggleQueue: (id: number) => void;
}

const ACTION_WIDTH = 70;

function LeftAction({
  isQueued,
  palette,
}: {
  isQueued: boolean;
  palette: any;
}) {
  return (
    <View
      style={[
        styles.leftAction,
        { backgroundColor: palette.saveGreen, width: ACTION_WIDTH },
      ]}
    >
      <Ionicons name="time" size={28} color="#fff" />
    </View>
  );
}

function areSwipeablePropsEqual(
  prev: SwipeablePostCardProps,
  next: SwipeablePostCardProps,
): boolean {
  const p = prev.post;
  const n = next.post;
  return (
    p.id === n.id &&
    p.title === n.title &&
    p.customTitle === n.customTitle &&
    p.isRead === n.isRead &&
    p.isFavorite === n.isFavorite &&
    p.isArchived === n.isArchived &&
    p.queuedAt === n.queuedAt &&
    p.rating === n.rating &&
    p.author === n.author &&
    p.subreddit === n.subreddit &&
    p.wordCount === n.wordCount &&
    prev.onToggleQueue === next.onToggleQueue
  );
}

export const SwipeablePostCard: React.FC<SwipeablePostCardProps> = React.memo(
  ({ post, onToggleQueue }) => {
    const { palette } = useTheme();
    const swipeableRef = useRef<SwipeableMethods>(null);

    const handleSwipeOpen = useCallback(
      (direction: "left" | "right") => {
        console.log("Swipe opened in direction:", direction);
        if (direction === "right") {
          // Swiped left-to-right → toggle queue

          onToggleQueue(post.id);
        }
        swipeableRef.current?.close();
      },
      [onToggleQueue, post.id],
    );

    const renderLeftActions = useCallback(() => {
      return <LeftAction isQueued={!!post.queuedAt} palette={palette} />;
    }, [post.queuedAt, palette]);

    return (
      <ReanimatedSwipeable
        ref={swipeableRef}
        friction={2}
        leftThreshold={ACTION_WIDTH}
        overshootLeft={true}
        overshootFriction={2}
        renderLeftActions={renderLeftActions}
        onSwipeableOpen={handleSwipeOpen}
      >
        <PostCard post={post} />
      </ReanimatedSwipeable>
    );
  },
  areSwipeablePropsEqual,
);
SwipeablePostCard.displayName = "SwipeablePostCard";

const styles = StyleSheet.create({
  leftAction: {
    justifyContent: "center",
    alignItems: "center",
  },
});
