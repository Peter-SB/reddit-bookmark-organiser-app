import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import { STORAGE_KEYS } from "@/hooks/useRedditApi";
import * as SecureStore from "expo-secure-store";
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

// SecureStore keys for API credentials

export default function SettingsCredentialsManager() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [userAgent, setUserAgent] = useState("");
  const [loading, setLoading] = useState(true);

  // Load existing credentials
  useEffect(() => {
    (async () => {
      try {
        const [u, p, id, secret, ua] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_KEYS.USERNAME),
          SecureStore.getItemAsync(STORAGE_KEYS.PASSWORD),
          SecureStore.getItemAsync(STORAGE_KEYS.CLIENT_ID),
          SecureStore.getItemAsync(STORAGE_KEYS.CLIENT_SECRET),
          SecureStore.getItemAsync(STORAGE_KEYS.USER_AGENT),
        ]);
        if (u) setUsername(u);
        if (p) setPassword(p);
        if (id) setClientId(id);
        if (secret) setClientSecret(secret);
        if (ua) setUserAgent(ua);
      } catch (err) {
        console.warn("Failed to load credentials:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Save credentials to SecureStore
  const save = async () => {
    if (!username || !clientId || !clientSecret || !userAgent) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }
    setLoading(true);
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.USERNAME, username);
      await SecureStore.setItemAsync(STORAGE_KEYS.PASSWORD, password);
      await SecureStore.setItemAsync(STORAGE_KEYS.CLIENT_ID, clientId);
      await SecureStore.setItemAsync(STORAGE_KEYS.CLIENT_SECRET, clientSecret);
      await SecureStore.setItemAsync(STORAGE_KEYS.USER_AGENT, userAgent);
      Alert.alert("Success", "Credentials saved securely.");
    } catch (err) {
      console.error("Failed to save credentials:", err);
      Alert.alert("Error", "Failed to save credentials.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ActivityIndicator
        style={{ marginTop: 20 }}
        size="large"
        color={palette.accent}
      />
    );
  }

  return (
    <>
      <Text style={styles.title}>Reddit API Credentials</Text>
      <View style={styles.container}>
        <Text style={styles.label}>Username*</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
        />

        <Text style={styles.label}>Client ID*</Text>
        <TextInput
          style={styles.input}
          value={clientId}
          onChangeText={setClientId}
          placeholder="Client ID"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Client Secret*</Text>
        <TextInput
          style={styles.input}
          value={clientSecret}
          onChangeText={setClientSecret}
          placeholder="Client Secret"
          autoCapitalize="none"
        />

        <Text style={styles.label}>User Agent*</Text>
        <TextInput
          style={styles.input}
          value={userAgent}
          onChangeText={setUserAgent}
          placeholder="User Agent"
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.button} onPress={save}>
          <Text style={styles.buttonText}>Save Credentials</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.m,
    paddingTop: 0,
    backgroundColor: palette.background,
  },
  title: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
    margin: spacing.m,
  },
  label: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
    marginTop: spacing.m / 2,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    padding: spacing.s,
    marginTop: spacing.s / 2,
    backgroundColor: palette.background,
  },
  button: {
    marginTop: spacing.l,
    padding: spacing.m,
    backgroundColor: palette.accent,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: palette.background,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
  },
});
