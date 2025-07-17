import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import { Picker } from "@react-native-picker/picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { DatabaseService, DEFAULT_DB } from "../services/DatabaseService";

export default function SettingsDatabaseManager() {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>(DEFAULT_DB);
  const [loading, setLoading] = useState<boolean>(true);

  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [newDbName, setNewDbName] = useState<string>("");
  const [customLocation, setCustomLocation] = useState<string | null>(null);

  const router = useRouter();

  // Load available DBs and current selection
  const loadDbs = async () => {
    try {
      setLoading(true);
      const dir = FileSystem.documentDirectory + "SQLite";
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const all = await FileSystem.readDirectoryAsync(dir);
      setFiles(all.filter((f) => f.endsWith(".db")));

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
    await DatabaseService.switchDatabase(name);
    setSelected(name);
    setLoading(false);
    router.replace("/");
  };

  const exportDatabase = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const src = FileSystem.documentDirectory + "SQLite/" + selected;
      const dest = FileSystem.cacheDirectory + selected;
      await FileSystem.copyAsync({ from: src, to: dest });
      await Sharing.shareAsync(dest, {
        mimeType: "application/x-sqlite3",
        dialogTitle: "Share database",
      });
    } catch (err) {
      console.warn("Export failed:", err);
      Alert.alert("Error", "Failed to share database.");
    } finally {
      setLoading(false);
    }
  };

  const saveToFileSystem = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const src = FileSystem.documentDirectory + "SQLite/" + selected;
      if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
        const permission =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission denied");
          return;
        }
        const base64 = await FileSystem.readAsStringAsync(src, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permission.directoryUri,
          selected,
          "application/x-sqlite3"
        );
        await FileSystem.StorageAccessFramework.writeAsStringAsync(
          fileUri,
          base64,
          { encoding: FileSystem.EncodingType.Base64 }
        );
        Alert.alert("Success", `Saved to ${fileUri}`);
      } else {
        await exportDatabase();
      }
    } catch (err) {
      console.error("Save failed:", err);
      Alert.alert("Error", "Failed to save database.");
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
      const data = await FileSystem.readAsStringAsync(defaultUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (
        customLocation &&
        Platform.OS === "android" &&
        FileSystem.StorageAccessFramework
      ) {
        const perm =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission denied");
          return;
        }
        const newFile = await FileSystem.StorageAccessFramework.createFileAsync(
          perm.directoryUri,
          filename,
          "application/x-sqlite3"
        );
        await FileSystem.StorageAccessFramework.writeAsStringAsync(
          newFile,
          data,
          { encoding: FileSystem.EncodingType.Base64 }
        );
      } else {
        const dest = FileSystem.documentDirectory + "SQLite/" + filename;
        await FileSystem.writeAsStringAsync(dest, data, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
      await loadDbs();
      await DatabaseService.switchDatabase(filename);
      setModalVisible(false);
      setNewDbName("");
      setCustomLocation(null);
    } catch (err) {
      console.error("Create failed:", err);
      Alert.alert("Error", "Failed to create.");
    } finally {
      setLoading(false);
    }
  };

  const pickFolder = async () => {
    if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
      const perm =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (perm.granted) setCustomLocation(perm.directoryUri);
      else Alert.alert("Permission denied");
    } else {
      Alert.alert("Unsupported", "Custom folder only on Android.");
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
          "Cannot save files without storage permission."
        );
        return false;
      }
    }
    return true;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={palette.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Database File</Text>
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
        <TouchableOpacity style={styles.button} onPress={saveToFileSystem}>
          <Text style={styles.buttonText}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={exportDatabase}>
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
              <TouchableOpacity onPress={pickFolder} style={styles.smallButton}>
                <Text style={styles.buttonText}>
                  {customLocation ? "Folder ✓" : "Choose Folder"}
                </Text>
              </TouchableOpacity>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  title: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
    margin: spacing.m,
  },
  pickerWrapper: {
    marginHorizontal: spacing.m,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    overflow: "hidden",
  },
  picker: { height: 50, width: "100%" },
  buttonRow: {
    flexDirection: "row",
    margin: spacing.m,
    justifyContent: "space-between",
  },
  button: {
    flex: 1,
    marginHorizontal: spacing.s / 2,
    paddingVertical: spacing.s,
    backgroundColor: palette.background,
    borderRadius: 8,
    alignItems: "center",
  },
  smallButton: {
    flex: 1,
    marginHorizontal: spacing.s / 4,
    paddingVertical: spacing.s,
    backgroundColor: palette.background,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: palette.accent,
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
    borderRadius: 12,
    padding: spacing.m,
  },
  modalTitle: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.semibold,
    color: palette.accent,
    marginBottom: spacing.s,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    padding: spacing.s,
    marginBottom: spacing.m,
  },
  modalButtons: { flexDirection: "row", justifyContent: "space-between" },
});
