import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes } from "@/constants/typography";
import { useFolders } from "@/hooks/useFolders";
import React, { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

interface FolderSelectorProps {
  postId: number;
  selectedFolderIds: number[];
  onFoldersChange: (folderIds: number[]) => void;
}

export function FolderSelector({
  postId,
  selectedFolderIds,
  onFoldersChange,
}: FolderSelectorProps) {
  const { folders, createFolder } = useFolders();
  const [searchText, setSearchText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredFolders = folders.filter((folder) =>
    folder.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const exactMatch = folders.find(
    (folder) => folder.name.toLowerCase() === searchText.toLowerCase()
  );

  const handleToggleFolder = (folderId: number) => {
    if (selectedFolderIds.includes(folderId)) {
      onFoldersChange(selectedFolderIds.filter((id) => id !== folderId));
    } else {
      onFoldersChange([...selectedFolderIds, folderId]);
    }
  };

  const handleCreateAndAdd = async () => {
    console.log(folders + "Creating folder:", searchText.trim());
    if (!searchText.trim() || exactMatch) return;

    try {
      const newFolder = await createFolder(searchText.trim());
      onFoldersChange([...selectedFolderIds, newFolder.id]);
      setSearchText("");
      setShowSuggestions(false);
    } catch (error) {
      console.error("Failed to create folder:", error);
      Alert.alert("Error", "Failed to create folder");
    }
  };

  const selectedFolders = folders.filter((folder) =>
    selectedFolderIds.includes(folder.id)
  );

  return (
    <View style={styles.container}>
      {/* <Text style={styles.title}>Folders</Text> */}

      {/* Selected folders display */}
      <View style={styles.selectedContainer}>
        {selectedFolders.map((folder) => (
          <View key={folder.id} style={styles.folderBubble}>
            <Text style={styles.bubbleText}>{folder.name}</Text>
            <TouchableOpacity
              onPress={() => handleToggleFolder(folder.id)}
              style={styles.removeButton}
            >
              <Icon name="close" size={16} color={palette.background} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Search input */}
      <TextInput
        style={styles.searchInput}
        value={searchText}
        onChangeText={setSearchText}
        onFocus={() => setShowSuggestions(true)}
        placeholder="Add to folder..."
        placeholderTextColor={palette.muted}
      />

      {/* Suggestions */}
      {showSuggestions && searchText.trim() && (
        <View style={styles.suggestionsContainer}>
          {filteredFolders.slice(0, 5).map((folder) => (
            <TouchableOpacity
              key={folder.id}
              style={[
                styles.suggestionItem,
                selectedFolderIds.includes(folder.id) &&
                  styles.selectedSuggestion,
              ]}
              onPress={() => {
                handleToggleFolder(folder.id);
                setSearchText("");
                setShowSuggestions(false);
              }}
            >
              <Icon
                name={
                  selectedFolderIds.includes(folder.id)
                    ? "check-box"
                    : "check-box-outline-blank"
                }
                size={20}
                color={palette.accent}
              />
              <Text style={styles.suggestionText}>{folder.name}</Text>
            </TouchableOpacity>
          ))}

          {/* Create new folder option */}
          {!exactMatch && searchText.trim() && (
            <TouchableOpacity
              style={styles.createOption}
              onPress={() => {
                console.log("creating");
                handleCreateAndAdd();
              }}
            >
              <Icon name="add" size={20} color={palette.accent} />
              <Text style={styles.createText}>
                Create &quot;{searchText}&quot;
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.l,
  },
  title: {
    fontSize: fontSizes.title,
    fontWeight: "600",
    color: palette.foreground,
    marginBottom: spacing.s,
  },
  selectedContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: spacing.s,
  },
  folderBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  bubbleText: {
    color: palette.background,
    fontSize: fontSizes.small,
    fontWeight: "500",
    marginRight: spacing.xs,
  },
  removeButton: {
    padding: 2,
  },
  searchInput: {
    // borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.s,
    fontSize: fontSizes.body,
    color: palette.foreground,
    backgroundColor: palette.background,
  },
  suggestionsContainer: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.background,
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  selectedSuggestion: {
    backgroundColor: palette.backgroundDarker,
  },
  suggestionText: {
    marginLeft: spacing.s,
    fontSize: fontSizes.body,
    color: palette.foreground,
    flex: 1,
  },
  createOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.s,
    backgroundColor: palette.backgroundDarker,
  },
  createText: {
    marginLeft: spacing.s,
    fontSize: fontSizes.body,
    color: palette.accent,
    fontWeight: "500",
  },
});
