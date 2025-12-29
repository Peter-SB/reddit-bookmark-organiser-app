import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type ShareBookmarkButtonProps = {
  title: string;
  body: string;
};

function buildFilename(title: string) {
  const safeTitle = title
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .slice(0, 120);
  const base = safeTitle.length > 0 ? safeTitle : "bookmark";
  return `${base}.txt`;
}

// Button to save bookmark as txt file
export const ShareBookmarkButton: React.FC<ShareBookmarkButtonProps> = ({
  title,
  body,
}) => {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    const content = `${title}\n\n${body}`;
    const filename = buildFilename(title);

    setLoading(true);
    try {
      if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
        const permission =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission denied");
          return;
        }
        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permission.directoryUri,
          filename,
          "text/plain"
        );
        await FileSystem.StorageAccessFramework.writeAsStringAsync(
          fileUri,
          content,
          { encoding: FileSystem.EncodingType.UTF8 }
        );
        Alert.alert("Success", `Saved to ${fileUri}`);
      } else {
        const fileUri = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/plain",
          dialogTitle: "Share bookmark",
        });
      }
    } catch (err) {
      console.error("Export failed:", err);
      Alert.alert("Error", "Failed to export bookmark.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleExport}
      disabled={loading}
    >
      <View style={styles.buttonContent}>
        {loading ? (
          <ActivityIndicator color={palette.accent} />
        ) : (
          <>
            <Ionicons
              name="share-outline"
              size={24}
              color={palette.accent}
              style={{ marginRight: spacing.xs }}
            />
            <Text style={styles.buttonText}></Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: "transparent",
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    alignItems: "center",
    flex: 1,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: palette.accent,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
});
