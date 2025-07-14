import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { palette } from "../constants/Colors";
import { spacing } from "../constants/spacing";

interface StarRatingProps {
  rating: number; // 0.0 to 5.0
  onRate?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  onRate,
  size = 20,
  readonly = false,
}) => {
  const renderStar = (index: number) => {
    const filled = rating >= index + 1;
    const halfFilled = rating >= index + 0.5 && rating < index + 1;

    let iconName: keyof typeof Ionicons.glyphMap;
    if (filled) {
      iconName = "star";
    } else if (halfFilled) {
      iconName = "star-half";
    } else {
      iconName = "star-outline";
    }

    const StarComponent = readonly ? View : TouchableOpacity;

    return (
      <StarComponent
        key={index}
        style={styles.starContainer}
        onPress={readonly ? undefined : () => onRate?.(index + 1)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={iconName}
          size={size}
          color={filled || halfFilled ? palette.starYellow : palette.muted}
        />
      </StarComponent>
    );
  };

  return (
    <View style={styles.container}>{[0, 1, 2, 3, 4].map(renderStar)}</View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  starContainer: {
    marginRight: spacing.xs,
  },
});
