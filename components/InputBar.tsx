import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { palette } from "../constants/Colors";
import { spacing } from "../constants/spacing";
import { fontSizes } from "../constants/typography";

interface InputBarProps {
  onSubmit: (url: string) => Promise<void>;
  placeholder?: string;
}

export const InputBar: React.FC<InputBarProps> = ({
  onSubmit,
  placeholder = "Paste Reddit URL here...",
}) => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validateRedditUrl = (url: string): boolean => {
    const redditUrlPattern =
      /^https?:\/\/(www\.)?(reddit\.com|old\.reddit\.com)/;
    return redditUrlPattern.test(url);
  };

  const handleSubmit = async () => {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      Alert.alert("Error", "Please enter a URL");
      return;
    }

    if (!validateRedditUrl(trimmedUrl)) {
      Alert.alert("Error", "Please enter a valid Reddit URL");
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit(trimmedUrl);
      setUrl(""); // Clear input on success
    } catch (error) {
      Alert.alert("Error", "Failed to add post. Please try again.");
      console.error("Failed to add post:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={false}
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
        editable={!isLoading}
      />

      <TouchableOpacity
        style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
        onPress={handleSubmit}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isLoading ? "hourglass-outline" : "add-circle"}
          size={24}
          color={isLoading ? palette.muted : palette.accent}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    marginHorizontal: spacing.m,
    marginVertical: spacing.m,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    shadowColor: palette.cardShadow,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  input: {
    flex: 1,
    fontSize: fontSizes.body,
    color: palette.foreground,
    paddingVertical: spacing.s,
    paddingRight: spacing.s,
  },
  saveButton: {
    padding: spacing.s,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
});
