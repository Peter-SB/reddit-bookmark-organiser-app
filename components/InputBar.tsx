import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import { palette } from "../constants/Colors";
import { spacing } from "../constants/spacing";
import { fontSizes } from "../constants/typography";

interface InputBarProps {
  visible: boolean;
  onExpand: () => void;
  onClose: () => void;
  onSubmit: (url: string) => Promise<void>;
  placeholder?: string;
}

export const InputBar: React.FC<InputBarProps> = ({
  visible,
  onExpand,
  onClose,
  onSubmit,
  placeholder = "Paste Reddit URL…",
}) => {
  const [url, setUrl] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const SCREEN_W = Dimensions.get("window").width;
  const COLLAPSED_SIZE = 56;

  // Animate expand/collapse
  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [visible]);

  // Keyboard listeners
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Interpolate width & border-radius
  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLLAPSED_SIZE, SCREEN_W - spacing.l * 2],
  });
  const borderRadius = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLLAPSED_SIZE / 2, 12],
  });

  const handlePress = () => {
    if (!visible) return onExpand();
    if (!url.trim()) return;
    onSubmit(url.trim());
    setUrl("");
  };

  return (
    <>
      {visible && (
        <TouchableWithoutFeedback
          onPress={() => {
            onClose();
            setUrl("");
          }}
        >
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      <Animated.View
        style={[
          styles.fabContainer,
          {
            width,
            borderRadius,
            bottom: spacing.m + insets.bottom + keyboardHeight,
          },
        ]}
      >
        {visible && (
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder={placeholder}
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handlePress}
          />
        )}

        <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
          <Icon
            name={url.trim() ? "check" : "add"}
            size={28}
            color={palette.accent}
          />
        </TouchableOpacity>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    position: "absolute",
    right: spacing.m,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.s,
    shadowColor: palette.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  input: {
    flex: 1,
    marginRight: spacing.s,
    fontSize: fontSizes.body,
    color: palette.foreground,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
});
