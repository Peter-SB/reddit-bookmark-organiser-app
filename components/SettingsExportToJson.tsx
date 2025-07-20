import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontColours, fontSizes, fontWeights } from "@/constants/typography";
import { FolderRepository } from "@/repository/FolderRepository";
import { PostRepository } from "@/repository/PostRepository";
import { TagRepository } from "@/repository/TagsRepository";
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
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsExportToJson() {
  const [loading, setLoading] = useState(false);

  const getExportData = async () => {
    const postRepo = await PostRepository.create();
    const folderRepo = await FolderRepository.create();
    const tagRepo = await TagRepository.create();
    const [posts, folders, tags] = await Promise.all([
      postRepo.getAll(),
      folderRepo.getAll(),
      tagRepo.getAll(),
    ]);

    const exportData = {
      posts,
      folders,
      tags,
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
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Export Json Data</Text>
      {/* <Text style={styles.description}>
        Export and import your bookmark data in JSON format. Note that when
        importing, this will add to your current library.
      </Text> */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          onPress={exportToFolder}
          style={[styles.button]}
          disabled={loading}
        >
          <TouchableOpacity
            onPress={importFromJson}
            style={[styles.button]}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Import</Text>
          </TouchableOpacity>
          {loading ? (
            <ActivityIndicator color={palette.accent} />
          ) : (
            <Text style={styles.buttonText}>Export</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={shareAllData}
          style={[styles.button]}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Share</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.m,
  },
  title: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
    marginBottom: spacing.m,
  },
  description: {
    fontSize: fontSizes.body,
    color: fontColours.muted,
    marginBottom: spacing.m,
  },
  buttonRow: {
    flexDirection: "row",
    marginBottom: spacing.m,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.s,
    alignItems: "center",
  },
  buttonText: {
    color: palette.accent,
    fontWeight: fontWeights.medium,
    fontSize: fontSizes.body,
  },
});
