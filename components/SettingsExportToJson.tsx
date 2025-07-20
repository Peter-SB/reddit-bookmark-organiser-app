import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import { FolderRepository } from "@/repository/FolderRepository";
import { PostRepository } from "@/repository/PostRepository";
import { TagRepository } from "@/repository/TagsRepository";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsExportToJson() {
  const [loading, setLoading] = useState(false);

  // Share (current behavior)
  const shareAllData = async () => {
    setLoading(true);
    try {
      // Fetch all data
      const postRepo = await PostRepository.create();
      const folderRepo = await FolderRepository.create();
      const tagRepo = await TagRepository.create();
      const [posts, folders, tags] = await Promise.all([
        postRepo.getAll(),
        folderRepo.getAll(),
        tagRepo.getAll(),
      ]);

      // Compose export object
      const exportData = {
        posts,
        folders,
        tags,
        exportedAt: new Date().toISOString(),
      };
      const json = JSON.stringify(exportData, null, 2);

      // Write to file
      const filename = `reddit_export_${Date.now()}.json`;
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

  return (
    <SafeAreaView style={{ padding: spacing.m }}>
      <Text
        style={{
          fontSize: fontSizes.title,
          fontWeight: fontWeights.semibold,
          color: palette.foreground,
          marginBottom: spacing.m,
        }}
      >
        Export Data
      </Text>
      <View style={{ flexDirection: "row", marginBottom: spacing.m }}>
        <TouchableOpacity
          onPress={exportToFolder}
          style={{
            flex: 1,
            marginRight: spacing.s / 2,
            paddingVertical: spacing.s,
            backgroundColor: palette.background,
            borderRadius: 8,
            alignItems: "center",
            borderWidth: 1,
            borderColor: palette.border,
          }}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={palette.accent} />
          ) : (
            <Text
              style={{
                color: palette.accent,
                fontWeight: fontWeights.medium,
                fontSize: fontSizes.body,
              }}
            >
              Export
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={shareAllData}
          style={{
            flex: 1,
            marginLeft: spacing.s / 2,
            paddingVertical: spacing.s,
            backgroundColor: palette.background,
            borderRadius: 8,
            alignItems: "center",
            borderWidth: 1,
            borderColor: palette.border,
          }}
          disabled={loading}
        >
          <Text
            style={{
              color: palette.accent,
              fontWeight: fontWeights.medium,
              fontSize: fontSizes.body,
            }}
          >
            Share
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
