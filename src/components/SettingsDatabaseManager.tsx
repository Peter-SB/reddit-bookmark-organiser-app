import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { Picker } from "@react-native-picker/picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { DatabaseService, DEFAULT_DB } from "../services/DatabaseService";
import MediaStoreExport from "../modules/media-store-export";
import { resetSharedPostsState } from "@/hooks/usePosts";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";

export default function SettingsDatabaseManager() {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>(DEFAULT_DB);
  const [loading, setLoading] = useState<boolean>(true);

  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [newDbName, setNewDbName] = useState<string>("");
  const router = useRouter();

  // Load available DBs and current selection
  const loadDbs = async () => {
    try {
      setLoading(true);
      const dir = FileSystem.documentDirectory + "SQLite";
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const all = await FileSystem.readDirectoryAsync(dir);
      setFiles(
        all.filter(
          (f) => f.includes(".db") && !f.includes("wal") && !f.includes("shm"),
        ),
      );

      const svc = await DatabaseService.getInstance();
      setSelected(svc.getFilename());
    } catch (err) {
      console.warn("Error loading databases:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDbs();
  }, []);

  const onChangeDB = async (name: string) => {
    setLoading(true);
    resetSharedPostsState();
    await DatabaseService.switchDatabase(name);
    setSelected(name);
    setLoading(false);
    router.replace("/");
  };

  const saveErrorLog = async (context: string, err: unknown) => {
    const timestamp = new Date().toISOString();
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack =
      err instanceof Error ? (err.stack ?? "No stack trace") : "No stack trace";

    const logContent = [
      "Reddit Post Organiser - Error Log",
      "==================================",
      `Timestamp: ${timestamp}`,
      `Platform: ${Platform.OS} ${Platform.Version}`,
      `Context: ${context}`,
      `Selected Database: ${selected}`,
      "",
      "Error Message:",
      errorMessage,
      "",
      "Stack Trace:",
      errorStack,
    ].join("\n");

    try {
      const safeTimestamp = timestamp.replace(/[:.]/g, "-");
      const filename = `error-log-${safeTimestamp}.txt`;
      const cacheUri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(cacheUri, logContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
        const perm =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (perm.granted) {
          const base64 = await FileSystem.readAsStringAsync(cacheUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const destUri =
            await FileSystem.StorageAccessFramework.createFileAsync(
              perm.directoryUri,
              filename,
              "text/plain",
            );
          await FileSystem.StorageAccessFramework.writeAsStringAsync(
            destUri,
            base64,
            { encoding: FileSystem.EncodingType.Base64 },
          );
          Alert.alert("Saved", `Error log saved to device.`);
          return;
        }
      }

      await Sharing.shareAsync(cacheUri, {
        mimeType: "text/plain",
        dialogTitle: "Save error log",
      });
    } catch (logErr) {
      console.error("Failed to save error log:", logErr);
      Alert.alert("Error", "Failed to save error log.");
    }
  };

  // Makes sure WAL checkpoint is merged before sharing
  const checkpointDbAndGetSrc = async (filename: string) => {
    console.debug("Checkpointing database:", filename);
    const svc = await DatabaseService.getInstance();
    await svc.getDb().execAsync("PRAGMA wal_checkpoint(TRUNCATE)");
    return FileSystem.documentDirectory + "SQLite/" + filename;
  };

  const shareDatabase = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      console.debug("Sharing database:", selected);
      const src = await checkpointDbAndGetSrc(selected);
      const dest = FileSystem.cacheDirectory + selected;
      await FileSystem.copyAsync({ from: src, to: dest });
      await Sharing.shareAsync(dest, {
        mimeType: "application/x-sqlite3",
        dialogTitle: "Share database",
      });
    } catch (err) {
      console.warn("Export failed:", err);
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(
        "Share Failed",
        `${message}\n\nWould you like to save a full error log?`,
        [
          { text: "Dismiss", style: "cancel" },
          {
            text: "Save Error Log",
            onPress: () => saveErrorLog("Share Database", err),
          },
        ],
      );
    } finally {
      setLoading(false);
    }
  };

  // No expo-file-system API can stream a write into a SAF/content:// destination
  // (copyAsync only supports file:// destinations; writeAsStringAsync truncates on
  // every call, so chunked writes aren't possible either) - the only way to save a
  // large file into a user-picked folder via expo-file-system is to hold the whole
  // thing as a base64 JS string, which is exactly what OOMs on large databases.
  // MediaStoreExport (src/modules/media-store-export) is a small local native module
  // that streams the file straight into the public Downloads folder natively, so
  // memory use stays bounded regardless of file size.
  const exportDatabase = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const src = await checkpointDbAndGetSrc(selected);
      if (Platform.OS === "android" && MediaStoreExport) {
        if (!(await ensureStoragePermission())) return;
        const location = await MediaStoreExport.saveToDownloads(
          src,
          selected,
          "application/x-sqlite3",
        );
        Alert.alert("Success", `Saved to ${location}`);
      } else {
        await shareDatabase();
      }
    } catch (err) {
      console.error("Save failed:", err);
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(
        "Export Failed",
        `${message}\n\nWould you like to save a full error log?`,
        [
          { text: "Dismiss", style: "cancel" },
          {
            text: "Save Error Log",
            onPress: () => saveErrorLog("Export Database", err),
          },
        ],
      );
    } finally {
      setLoading(false);
    }
  };

  async function importDatabase() {
    await ensureStoragePermission();
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;

      if (!asset.name.includes(".db")) {
        Alert.alert("Please pick a .db file");
        return;
      }

      const src = asset.uri;
      const name = asset.name;
      const dest = FileSystem.documentDirectory + "SQLite/" + name;
      await FileSystem.copyAsync({ from: src, to: dest }); // Copy to app's SQLite directory necessary for consistency
      await DatabaseService.switchDatabase(name);
      Alert.alert("Imported", `Switched to ${name}`);
      await loadDbs();
    } catch (err) {
      console.error("Import failed:", err);
      Alert.alert("Error", "Import failed.");
    }
  }

  const createDatabase = async () => {
    const name = newDbName.trim();
    if (!name) {
      Alert.alert("Error", "Enter a database name.");
      return;
    }
    const filename = `${name}.db`;
    setLoading(true);
    try {
      const defaultUri = FileSystem.documentDirectory + "SQLite/" + DEFAULT_DB;
      const dest = FileSystem.documentDirectory + "SQLite/" + filename;
      // Native file copy (no base64 round-trip) - avoids loading the DB into a JS string.
      await FileSystem.copyAsync({ from: defaultUri, to: dest });
      await loadDbs();
      await DatabaseService.switchDatabase(filename);
      setModalVisible(false);
      setNewDbName("");
    } catch (err) {
      console.error("Create failed:", err);
      Alert.alert("Error", "Failed to create.");
    } finally {
      setLoading(false);
    }
  };

  // Ensure storage permissions on Android
  async function ensureStoragePermission() {
    if (Platform.OS === "android" && Platform.Version < 29) {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]);
      if (
        granted["android.permission.READ_EXTERNAL_STORAGE"] !== "granted" ||
        granted["android.permission.WRITE_EXTERNAL_STORAGE"] !== "granted"
      ) {
        Alert.alert(
          "Permission denied",
          "Cannot save files without storage permission.",
        );
        return false;
      }
    }
    return true;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={selected}
          onValueChange={onChangeDB}
          style={styles.picker}
        >
          {files.map((f) => (
            <Picker.Item key={f} label={f} value={f} />
          ))}
        </Picker>
      </View>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.buttonText}>New DB</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={importDatabase}>
          <Text style={styles.buttonText}>Import</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={exportDatabase}>
          <Text style={styles.buttonText}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={shareDatabase}>
          <Text style={styles.buttonText}>Share</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Database</Text>
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={newDbName}
              onChangeText={setNewDbName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={createDatabase}
                style={styles.smallButton}
              >
                <Text style={styles.buttonText}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.smallButton}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(
  palette: ThemeContextValue["palette"],
  fontSizes: ThemeContextValue["fontSizes"],
) {
  return StyleSheet.create({
    container: {
      padding: spacing.m,
      backgroundColor: palette.background,
    },
    pickerWrapper: {
      marginBottom: spacing.s,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 6,
      backgroundColor: palette.backgroundMidLight,
      overflow: "hidden",
    },
    picker: {
      height: 50,
      width: "100%",
      color: palette.foreground,
    },
    buttonRow: {
      flexDirection: "row",
      gap: spacing.s,
      marginBottom: spacing.s,
    },
    button: {
      flex: 1,
      paddingVertical: spacing.s,
      backgroundColor: palette.background,
      borderRadius: 6,
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    smallButton: {
      flex: 1,
      paddingVertical: spacing.s,
      backgroundColor: palette.backgroundMidLight,
      borderRadius: 6,
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    buttonText: {
      color: palette.foreground,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      width: "80%",
      backgroundColor: palette.background,
      borderRadius: 8,
      padding: spacing.m,
      borderWidth: 1,
      borderColor: palette.border,
    },
    modalTitle: {
      fontSize: fontSizes.title,
      fontWeight: fontWeights.semibold,
      color: palette.foreground,
      marginBottom: spacing.s,
    },
    input: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 6,
      padding: spacing.s,
      marginBottom: spacing.m,
      backgroundColor: palette.backgroundMidLight,
      fontSize: fontSizes.body,
      color: palette.foreground,
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.s,
    },
  });
}
