import { spacing } from "@/constants/spacing";
import React, { useMemo } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";

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
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
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

      <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
        <Icon name="close" size={20} color={palette.muted} />
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(
  palette: ThemeContextValue["palette"],
  fontSizes: ThemeContextValue["fontSizes"],
) {
  return StyleSheet.create({
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
}
