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
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DatabaseService, DEFAULT_DB } from "../services/DatabaseService";

export default function SettingsDatabaseManager() {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>(DEFAULT_DB);
  const [loading, setLoading] = useState<boolean>(true);

  const router = useRouter();

  // Load available DBs and current selection
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const dir = FileSystem.documentDirectory + "SQLite";
        const all = await FileSystem.readDirectoryAsync(dir);
        const dbs = all.filter((f) => f.endsWith(".db"));
        setFiles(dbs);

        const svc = await DatabaseService.getInstance();
        setSelected(svc.getFilename());
      } catch (err) {
        console.warn("Error loading databases:", err);
      } finally {
        setLoading(false);
      }
    })();
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
    const src = FileSystem.documentDirectory + "SQLite/" + selected;
    const dest = FileSystem.cacheDirectory + selected;
    try {
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
    const src = FileSystem.documentDirectory + "SQLite/" + selected;

    try {
      if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
        // request access to a directory
        const res =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!res.granted) {
          Alert.alert("Permission denied");
          return;
        }
        const directoryUri = res.directoryUri;
        // read file as base64
        const base64 = await FileSystem.readAsStringAsync(src, {
          encoding: FileSystem.EncodingType.Base64,
        });
        // create file in chosen directory
        const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
          directoryUri,
          selected,
          "application/x-sqlite3"
        );
        // write to file
        await FileSystem.StorageAccessFramework.writeAsStringAsync(
          newUri,
          base64,
          { encoding: FileSystem.EncodingType.Base64 }
        );
        Alert.alert("Success", `Database saved to ${newUri}`);
      } else {
        // On iOS or if SAF not available, fallback to Share 'Save to Files'
        await exportDatabase();
      }
    } catch (err) {
      console.error("Save to FS failed:", err);
      Alert.alert("Error", "Failed to save database to filesystem.");
    } finally {
      setLoading(false);
    }
  };

  async function importDatabase() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/x-sqlite3",
        copyToCacheDirectory: false,
      });

      if (res.canceled) {
        console.log("User cancelled import");
        return;
      }

      const asset = res.assets[0];
      if (!asset) {
        console.warn("No file selected");
        return;
      }

      const srcUri = asset.uri;
      const dbName = asset.name;
      const destUri = FileSystem.documentDirectory + "SQLite/" + dbName;

      await FileSystem.copyAsync({ from: srcUri, to: destUri });

      await DatabaseService.switchDatabase(dbName);

      Alert.alert("Imported", `Switched to database ${dbName}`);
    } catch (err) {
      console.error("Import failed:", err);
      Alert.alert("Error", "Import failed.");
    }
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
      <View>
        <Text style={styles.title}>Database File</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selected}
            onValueChange={(val) => onChangeDB(val)}
            style={styles.picker}
          >
            {files.map((f) => (
              <Picker.Item key={f} label={f} value={f} />
            ))}
          </Picker>
        </View>
        <View style={styles.buttonRow}>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    borderBlockColor: palette.border,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  card: {
    backgroundColor: palette.background,
    borderRadius: 12,
    padding: spacing.m,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.semibold,
    marginBottom: spacing.s,
    color: palette.foreground,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    overflow: "hidden",
  },
  picker: { height: 50, width: "100%" },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.m,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.s,
    marginHorizontal: spacing.s / 2,
    backgroundColor: palette.background,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: palette.accent,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
  },
});
