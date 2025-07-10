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

const SCALE_FACTOR = 0.8; // scale factor for the icon circle

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
  const { width: SCREEN_W } = Dimensions.get("window");
  const COLLAPSED_SIZE = 56; // diameter of the icon circle
  const H_MARGIN = spacing.m; // right + left margin
  const FULL_WIDTH = SCREEN_W - H_MARGIN * 2;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [visible]);

  useEffect(() => {
    const showEvent: import("react-native").KeyboardEventName = Platform.select(
      {
        ios: "keyboardWillShow",
        android: "keyboardDidShow",
      }
    ) as import("react-native").KeyboardEventName;
    const hideEvent: import("react-native").KeyboardEventName = Platform.select(
      {
        ios: "keyboardWillHide",
        android: "keyboardDidHide",
      }
    ) as import("react-native").KeyboardEventName;

    const showSub = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      // Focus the input and open the keyboard when bar is expanded
      setTimeout(() => {
        inputRef.current?.focus();
      }, 1); // Wait for animation to finish
    }
  }, [visible]);

  const barWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLLAPSED_SIZE * SCALE_FACTOR, FULL_WIDTH],
  });

  const offsetBottom = H_MARGIN + insets.bottom + keyboardHeight;

  const handleIconPress = () => {
    if (!visible) return onExpand();
    if (!url.trim()) return;
    onSubmit(url.trim());
    setUrl("");
  };

  return (
    <>
      {/* tappable overlay when open */}
      {visible && (
        <TouchableWithoutFeedback
          onPress={() => {
            setUrl("");
            onClose();
          }}
        >
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      <Animated.View
        style={[
          styles.bar,
          {
            width: barWidth,
            borderRadius: 90,
            bottom: offsetBottom,
            right: H_MARGIN,
          },
        ]}
      >
        {visible && (
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder={placeholder}
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleIconPress}
          />
        )}
      </Animated.View>

      {/* fixed-size icon circle on top */}
      <Animated.View
        style={[styles.iconWrapper, { bottom: offsetBottom, right: H_MARGIN }]}
      >
        <TouchableOpacity onPress={handleIconPress} activeOpacity={0.7}>
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  bar: {
    position: "absolute",
    height: 56 * SCALE_FACTOR,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.s,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.95,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 1,
  },
  input: {
    flex: 1,
    marginRight: spacing.s,
    fontSize: fontSizes.body,
    color: palette.foreground,
  },
  iconWrapper: {
    position: "absolute",
    width: 56 * SCALE_FACTOR,
    height: 56 * SCALE_FACTOR,
    borderRadius: 90,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: palette.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 2,
  },
});
