import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes } from "@/constants/typography";
import React from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  cancelButtonCallback?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search posts...",
  cancelButtonCallback = () => {},
}: SearchBarProps) {
  const handleClear = () => {
    onChangeText("");
    cancelButtonCallback();
  };

  return (
    <View style={styles.searchbar}>
      <Icon
        name="search"
        size={20}
        color={palette.muted}
        style={styles.searchIcon}
      />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <Icon name="close" size={20} color={palette.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchbar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: spacing.s,
    minHeight: 44,
  },
  searchIcon: {
    marginRight: spacing.s,
  },
  input: {
    flex: 1,
    fontSize: fontSizes.body,
    color: palette.foreground,
    paddingVertical: spacing.s,
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.s,
  },
});
