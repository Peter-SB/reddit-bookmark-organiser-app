// app/settings.tsx
import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import { Picker } from "@react-native-picker/picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DatabaseService } from "../services/DatabaseService";

const defaultDbs = ["reddit_posts.db", "reddit_posts_test2.db"];

export default function SettingsScreen() {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // load available .db files + current selection
  useEffect(() => {
    (async () => {
      console.debug("Loading DBs");
      // list files in the default DB directory
      // const uri = defaultDatabaseDirectory;
      // console.debug("Default DB directory:", uri);
      // const items = await FileSystem.readDirectoryAsync(uri);

      console.debug("Available DB files:", defaultDbs);

      const dbFiles = defaultDbs; // items.filter((f) => f.endsWith(".db"));
      setFiles(dbFiles);

      // current active database
      const svc = await DatabaseService.getInstance();
      setSelected(svc.getFilename());

      setLoading(false);
    })();
  }, []);

  // handle user choice
  const onChange = async (filename: string) => {
    setSelected(filename);
    setLoading(true);
    await DatabaseService.switchDatabase(filename);
    setLoading(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Database File</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selected ?? files[0]}
            onValueChange={(v) => onChange(v)}
          >
            {files.map((f) => (
              <Picker.Item key={f} label={f} value={f} />
            ))}
          </Picker>
        </View>
        <Text style={styles.helperText}>
          Switching the database will reload your app’s data.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.m },
  sectionTitle: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.semibold,
    marginBottom: spacing.s,
    color: palette.foreground,
  },
  pickerContainer: {
    backgroundColor: palette.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  helperText: {
    marginTop: spacing.s,
    fontSize: fontSizes.small,
    color: palette.muted,
  },
});
