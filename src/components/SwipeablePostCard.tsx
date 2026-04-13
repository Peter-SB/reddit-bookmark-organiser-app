import React, { useCallback, useRef } from "react";
import { StyleSheet, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "@/contexts/ThemeContext";
import { PostListItem } from "@/models/models";
import { PostCard } from "./PostCard";

interface SwipeablePostCardProps {
  post: PostListItem;
  onToggleFavorite: (id: number) => void;
}

const ACTION_WIDTH = 60;

function LeftAction({
  isFavorite,
  palette,
}: {
  isFavorite: boolean;
  palette: any;
}) {
  return (
    <View
      style={[
        styles.leftAction,
        { backgroundColor: palette.favHeartRed, width: ACTION_WIDTH },
      ]}
    >
      <Ionicons
        name={isFavorite ? "heart-dislike" : "heart"}
        size={28}
        color="#fff"
      />
    </View>
  );
}

export const SwipeablePostCard: React.FC<SwipeablePostCardProps> = ({
  post,
  onToggleFavorite,
}) => {
  const { palette } = useTheme();
  const swipeableRef = useRef<SwipeableMethods>(null);

  const handleSwipeOpen = useCallback(
    (direction: "left" | "right") => {
      console.log("Swipe opened in direction:", direction);
      if (direction === "right") {
        // Swiped left-to-right → toggle favourite

        onToggleFavorite(post.id);
      }
      swipeableRef.current?.close();
    },
    [onToggleFavorite, post.id],
  );

  const renderLeftActions = useCallback(() => {
    return <LeftAction isFavorite={post.isFavorite} palette={palette} />;
  }, [post.isFavorite, palette]);

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={ACTION_WIDTH}
      overshootLeft={false}
      renderLeftActions={renderLeftActions}
      onSwipeableOpen={handleSwipeOpen}
    >
      <PostCard post={post} />
    </ReanimatedSwipeable>
  );
};

const styles = StyleSheet.create({
  leftAction: {
    justifyContent: "center",
    alignItems: "center",
  },
});
