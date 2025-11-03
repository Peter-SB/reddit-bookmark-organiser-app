import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import { FolderRepository } from "@/repository/FolderRepository";
import { PostRepository } from "@/repository/PostRepository";
import * as DocumentPicker from "expo-document-picker";
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

export default function SettingsExportToJson() {
  const [loading, setLoading] = useState(false);

  const getExportData = async () => {
    const postRepo = await PostRepository.create();
    const folderRepo = await FolderRepository.create();
    const [posts, folders] = await Promise.all([
      postRepo.getAll(),
      folderRepo.getAll(),
    ]);

    const exportData = {
      posts,
      folders,
      exportedAt: new Date().toISOString(),
    };

    const json = JSON.stringify(exportData, null, 2);
    const filename = `reddit_export_${Date.now()}.json`;

    return { json, filename };
  };

  // Share
  const shareAllData = async () => {
    setLoading(true);
    try {
      const { json, filename } = await getExportData();
      const fileUri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: "Export All Data as JSON",
      });
    } catch (err) {
      console.error("Export failed:", err);
      Alert.alert("Error", "Failed to export data.");
    } finally {
      setLoading(false);
    }
  };

  // Export to selected folder
  const exportToFolder = async () => {
    setLoading(true);
    try {
      const { json, filename } = await getExportData();
      if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
        const perm =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission denied");
          return;
        }
        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          perm.directoryUri,
          filename,
          "application/json"
        );
        await FileSystem.StorageAccessFramework.writeAsStringAsync(
          fileUri,
          json,
          { encoding: FileSystem.EncodingType.UTF8 }
        );
        Alert.alert("Success", `Saved to ${fileUri}`);
      } else {
        // Fallback: share
        await shareAllData();
      }
    } catch (err) {
      console.error("Export failed:", err);
      Alert.alert("Error", "Failed to export data.");
    } finally {
      setLoading(false);
    }
  };

  // Import from JSON file
  const importFromJson = async () => {
    Alert.alert("To do");
    setLoading(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || !result.assets[0]?.uri) {
        setLoading(false);
        return;
      }
      const fileUri = result.assets[0].uri;
      const jsonString = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const data = JSON.parse(jsonString);
      // TODO: handle importing data
      Alert.alert(
        "To do - Import Success",
        "Data imported successfully!\n" + JSON.stringify(Object.keys(data))
      );
    } catch (err) {
      console.error("Import failed:", err);
      Alert.alert("Error", "Failed to import data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          onPress={exportToFolder}
          style={styles.button}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={palette.accent} />
          ) : (
            <Text style={styles.buttonText}>Export</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={importFromJson}
          style={styles.button}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Import</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={shareAllData}
          style={styles.button}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.m,
    backgroundColor: palette.background,
  },
  description: {
    fontSize: fontSizes.body,
    color: palette.foregroundMidLight,
    marginBottom: spacing.m,
  },
  button: {
    marginTop: spacing.m,
    padding: spacing.s,
    backgroundColor: palette.background,
    borderRadius: 6,
    borderColor: palette.border,
    borderWidth: 1,
    alignItems: "center",
    flex: 1,
  },
  buttonText: {
    color: palette.foreground,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.s,
    marginBottom: spacing.m,
  },
});
