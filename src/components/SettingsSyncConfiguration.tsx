import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import {
  DEFAULT_EMBED_MODEL,
  DEFAULT_SYNC_TABLE,
  SYNC_EMBED_MODEL_KEY,
  SYNC_SERVER_URL_KEY,
  SYNC_TABLE_NAME_KEY,
} from "@/constants/sync";
import { usePostSync } from "@/hooks/usePostSync";
import { SettingsRepository } from "@/repository/SettingsRepository";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function SettingsSyncConfiguration() {
  const [serverUrl, setServerUrl] = useState("");
  const [tableName, setTableName] = useState(DEFAULT_SYNC_TABLE);
  const [embeddingModel, setEmbeddingModel] = useState(DEFAULT_EMBED_MODEL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { syncPending, syncing, lastSyncAt, forceResyncAll } = usePostSync({ autoStart: false });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const settings = await SettingsRepository.getSettings([
          SYNC_SERVER_URL_KEY,
          SYNC_TABLE_NAME_KEY,
          SYNC_EMBED_MODEL_KEY,
        ]);
        if (settings[SYNC_SERVER_URL_KEY]) setServerUrl(settings[SYNC_SERVER_URL_KEY]);
        if (settings[SYNC_TABLE_NAME_KEY]) setTableName(settings[SYNC_TABLE_NAME_KEY]);
        if (settings[SYNC_EMBED_MODEL_KEY]) setEmbeddingModel(settings[SYNC_EMBED_MODEL_KEY]);
      } catch (err) {
        console.warn("Failed to load sync settings:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      await Promise.all([
        SettingsRepository.setSetting(SYNC_SERVER_URL_KEY, serverUrl.trim()),
        SettingsRepository.setSetting(SYNC_TABLE_NAME_KEY, tableName.trim() || DEFAULT_SYNC_TABLE),
        SettingsRepository.setSetting(
          SYNC_EMBED_MODEL_KEY,
          embeddingModel.trim() || DEFAULT_EMBED_MODEL
        ),
      ]);
      setStatusMessage("Sync settings saved.");
    } catch (err) {
      console.error("Failed to save sync settings:", err);
      Alert.alert("Error", "Unable to save sync settings.");
    } finally {
      setSaving(false);
    }
  };

  const triggerManualSync = async () => {
    setStatusMessage(null);
    try {
      const results = await syncPending();
      if (results.length === 0) {
        setStatusMessage("No posts needed syncing or server URL not set.");
        return;
      }
      const success = results.filter((r) => r.success).length;
      const failed = results.length - success;
      setStatusMessage(`Sync finished: ${success} succeeded${failed ? `, ${failed} failed` : ""}.`);
    } catch (err) {
      console.error("Manual sync failed:", err);
      Alert.alert("Sync failed", (err as Error).message);
    }
  };

  const triggerForceResync = async () => {
    setStatusMessage(null);
    try {
      const results = await forceResyncAll();
      if (results.length === 0) {
        setStatusMessage("No posts found to re-sync or server URL not set.");
        return;
      }
      const success = results.filter((r) => r.success).length;
      const failed = results.length - success;
      setStatusMessage(
        `Force re-sync finished: ${success} succeeded${failed ? `, ${failed} failed` : ""}.`
      );
    } catch (err) {
      console.error("Force re-sync failed:", err);
      Alert.alert("Force re-sync failed", (err as Error).message);
    }
  };

  if (loading) {
    return (
      <ActivityIndicator
        style={{ marginVertical: spacing.m }}
        size="small"
        color={palette.accent}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Server URL*</Text>
      <TextInput
        style={styles.input}
        value={serverUrl}
        onChangeText={setServerUrl}
        placeholder="http://127.0.0.1:8000"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>Table Name</Text>
      <TextInput
        style={styles.input}
        value={tableName}
        onChangeText={setTableName}
        placeholder={DEFAULT_SYNC_TABLE}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>Embedding Model</Text>
      <TextInput
        style={styles.input}
        value={embeddingModel}
        onChangeText={setEmbeddingModel}
        placeholder="text-embedding-model"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={save}
          disabled={saving}
        >
          <Text style={styles.buttonText}>{saving ? "Saving..." : "Save"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, syncing && styles.buttonDisabled]}
          onPress={triggerManualSync}
          disabled={syncing}
        >
          <Text style={styles.buttonText}>{syncing ? "Syncing..." : "Sync Pending Now"}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.fullWidthButton, syncing && styles.buttonDisabled]}
        onPress={triggerForceResync}
        disabled={syncing}
      >
        <Text style={styles.buttonText}>
          {syncing ? "Re-syncing..." : "Force Re-sync All Posts"}
        </Text>
      </TouchableOpacity>

      {statusMessage && <Text style={styles.status}>{statusMessage}</Text>}
      {lastSyncAt && (
        <Text style={styles.status}>Last successful sync: {lastSyncAt.toLocaleString()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.m,
    backgroundColor: palette.background,
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
    color: palette.foreground,
    marginTop: spacing.s,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 6,
    padding: spacing.s,
    backgroundColor: palette.backgroundMidLight,
    fontSize: fontSizes.body,
    color: palette.foreground,
  },
  buttonRow: {
    flexDirection: "row",
    marginTop: spacing.m,
    gap: spacing.s,
  },
  button: {
    flex: 1,
    padding: spacing.s,
    backgroundColor: palette.background,
    borderRadius: 6,
    borderColor: palette.border,
    borderWidth: 1,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  fullWidthButton: {
    marginTop: spacing.s,
    flex: 0,
    width: "100%",
  },
  buttonText: {
    color: palette.foreground,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
  },
  status: {
    marginTop: spacing.s,
    fontSize: fontSizes.small,
    color: palette.muted,
  },
});
