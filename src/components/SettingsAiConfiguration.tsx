import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
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
import { Picker } from "@react-native-picker/picker";
import { SettingsRepository } from "@/repository/SettingsRepository";

const AI_ENDPOINT_URL = "AI_ENDPOINT_URL";
const AI_MODEL_ID = "AI_MODEL_ID";
const AI_SYSTEM_PROMPT = "AI_SYSTEM_PROMPT";
const SHOW_AI_SUMMARY = "SHOW_AI_SUMMARY";
const AI_API_KEY = "AI_API_KEY";
const AI_ATTRIB_REFERER = "AI_ATTRIB_REFERER";
const AI_ATTRIB_TITLE = "AI_ATTRIB_TITLE";
const AI_MAX_TOKENS = "AI_MAX_TOKENS";

const parseEndpoints = (input: string): string[] =>
  input
    .split(";")
    .map((e) => e.trim())
    .filter(Boolean);

const sortModels = (list: string[]): string[] =>
  (list || [])
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

export default function SettingsAiConfiguration() {
  const [endpoint, setEndpoint] = useState("");
  const [modelId, setModelId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [showAiSummary, setShowAiSummary] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [referer, setReferer] = useState("");
  const [appTitle, setAppTitle] = useState("Reddit-Bookmark-App");
  const [maxTokens, setMaxTokens] = useState("1024");

  // Load AI config from DB
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const settings = await SettingsRepository.getSettings([
          AI_ENDPOINT_URL,
          AI_MODEL_ID,
          AI_SYSTEM_PROMPT,
          SHOW_AI_SUMMARY,
          AI_API_KEY,
          AI_ATTRIB_REFERER,
          AI_ATTRIB_TITLE,
          AI_MAX_TOKENS,
        ]);
        if (settings[AI_ENDPOINT_URL]) setEndpoint(settings[AI_ENDPOINT_URL]);
        if (settings[AI_MODEL_ID]) setModelId(settings[AI_MODEL_ID]);
        if (settings[AI_SYSTEM_PROMPT])
          setSystemPrompt(settings[AI_SYSTEM_PROMPT]);
        if (settings[SHOW_AI_SUMMARY] !== undefined)
          setShowAiSummary(settings[SHOW_AI_SUMMARY] === "true");
        if (settings[AI_API_KEY]) setApiKey(settings[AI_API_KEY]);
        if (settings[AI_ATTRIB_REFERER]) setReferer(settings[AI_ATTRIB_REFERER]);
        if (settings[AI_ATTRIB_TITLE]) setAppTitle(settings[AI_ATTRIB_TITLE]);
        if (settings[AI_MAX_TOKENS]) setMaxTokens(settings[AI_MAX_TOKENS]);
      } catch (err) {
        console.warn("Failed to load AI config:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Save AI config to DB
  const save = async () => {
    const endpoints = parseEndpoints(endpoint);
    if (endpoints.length === 0) {
      Alert.alert("Error", "Please enter at least one endpoint.");
      return;
    }
    setLoading(true);
    try {
      await Promise.all([
        SettingsRepository.setSetting(AI_ENDPOINT_URL, endpoint.trim()),
        SettingsRepository.setSetting(AI_MODEL_ID, modelId.trim()),
        SettingsRepository.setSetting(AI_SYSTEM_PROMPT, systemPrompt.trim()),
        SettingsRepository.setSetting(
          SHOW_AI_SUMMARY,
          showAiSummary ? "true" : "false"
        ),
        SettingsRepository.setSetting(AI_API_KEY, apiKey.trim()),
        SettingsRepository.setSetting(AI_ATTRIB_REFERER, referer.trim()),
        SettingsRepository.setSetting(AI_ATTRIB_TITLE, "Reddit-Bookmark-App"),
        SettingsRepository.setSetting(AI_MAX_TOKENS, String(parseInt(maxTokens || "1024", 10) || 1024)),
      ]);
      Alert.alert("Success", "AI configuration saved.");
    } catch (err) {
      console.error("Failed to save AI config:", err);
      Alert.alert("Error", "Failed to save configuration.");
    } finally {
      setLoading(false);
    }
  };

  // Test endpoint by querying /models
  const testEndpoint = async () => {
    const endpoints = parseEndpoints(endpoint);
    if (endpoints.length === 0) {
      Alert.alert("Error", "Please enter at least one endpoint.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    let success = false;
    for (const ep of endpoints) {
      try {
        const url = ep.replace(/\/+$|\/+$/g, "") + "/models";
        console.debug("Testing AI endpoint:", url);
        const headers: Record<string, string> = {};
        if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
        if (referer) headers["HTTP-Referer"] = referer;
        if (appTitle) headers["X-Title"] = appTitle;
        const res = await fetch(url, { method: "GET", headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        let modelList: string[] = [];
        if (Array.isArray(data?.data)) {
          modelList = data.data.map((m: any) => m.id || m.name || "");
          const sorted = sortModels(modelList);
          setTestResult(`Success: ${sorted.length} models found at ${ep}`);
          setModels(sorted);
          if (!modelId && sorted.length > 0) setModelId(sorted[0]);
          success = true;
          break;
        } else {
          setTestResult(`Success: Response received at ${ep}`);
        }
        // Fallback for non-standard responses: leave models as-is
      } catch (err: any) {
        setTestResult(`Error: ${err.message || "Failed to connect"} at ${ep}`);
        setModels([]);
      }
    }
    setTesting(false);
  };

  // Load models when dropdown is focused
  const handleModelDropdownOpen = async () => {
    const endpoints = parseEndpoints(endpoint);
    if (endpoints.length === 0) return;
    if (models.length > 0) return;
    for (const endpoint of endpoints) {
      try {
        const url = endpoint.replace(/\/+$|\/+$/g, "") + "/models";
        const headers: Record<string, string> = {};
        if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
        if (referer) headers["HTTP-Referer"] = referer;
        if (appTitle) headers["X-Title"] = appTitle;
        const res = await fetch(url, { method: "GET", headers });
        if (!res.ok) continue;
        const data = await res.json();
        let modelList: string[] = [];
        if (Array.isArray(data?.data)) {
          modelList = data.data.map((m: any) => m.id || m.name || "");
          const sorted = sortModels(modelList);
          setModels(sorted);
          if (!modelId && sorted.length > 0) setModelId(sorted[0]);
          break;
        }
      } catch {}
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
    <View style={styles.container}>
      <Text style={styles.label}>Endpoint URL*</Text>
      <TextInput
        style={styles.input}
        value={endpoint}
        onChangeText={setEndpoint}
        placeholder="https://open-ai-compatible.endpoint/api/v1"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.label}>Model ID</Text>
      <View style={styles.input}>
        <Picker
          selectedValue={modelId}
          onValueChange={setModelId}
          onFocus={handleModelDropdownOpen}
        >
          {models.length > 0 ? (
            models.map((m) => <Picker.Item key={m} label={m} value={m} />)
          ) : (
            <Picker.Item
              label={modelId || "Enter endpoint and test to load models"}
              value={modelId}
            />
          )}
        </Picker>
      </View>
      <Text style={styles.label}>System Prompt</Text>
      <TextInput
        style={styles.input}
        value={systemPrompt}
        onChangeText={setSystemPrompt}
        placeholder="You are an assistant that summarizes Reddit posts."
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      <Text style={styles.label}>API Key</Text>
      <TextInput
        style={styles.input}
        value={apiKey}
        onChangeText={setApiKey}
        placeholder="API Key...."
        autoCapitalize="none"
        secureTextEntry
      />

      {/* <Text style={styles.label}>Attribution Referer (optional)</Text>
      <TextInput
        style={styles.input}
        value={referer}
        onChangeText={setReferer}
        placeholder="https://your-app-or-repo.example"
        autoCapitalize="none"
        autoCorrect={false}
      /> */}

      {/* <Text style={styles.label}>Attribution App Title (optional)</Text>
      <TextInput
        style={styles.input}
        value={appTitle}
        onChangeText={setAppTitle}
        placeholder="Reddit-Bookmark-App"
        autoCapitalize="none"
        autoCorrect={false}
      /> */}

      <Text style={styles.label}>Max Tokens</Text>
      <TextInput
        style={styles.input}
        value={maxTokens}
        onChangeText={setMaxTokens}
        placeholder="1024"
        keyboardType="number-pad"
      />
      <Text style={styles.label}>Show AI Summary Section</Text>
      <TouchableOpacity
        style={[
          styles.input,
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          },
        ]}
        onPress={() => setShowAiSummary((v) => !v)}
      >
        <Text style={{ fontSize: fontSizes.body }}>
          {showAiSummary ? "On" : "Off"}
        </Text>
        <View
          style={{
            width: 40,
            height: 24,
            borderRadius: 12,
            backgroundColor: showAiSummary ? palette.accent : palette.border,
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: palette.background,
              marginLeft: showAiSummary ? 18 : 2,
              elevation: 2,
            }}
          />
        </View>
      </TouchableOpacity>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={testEndpoint}
          disabled={testing}
        >
          <Text style={styles.buttonText}>
            {testing ? "Testing..." : "Test Endpoint"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={save}>
          <Text style={styles.buttonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {testResult && (
        <Text
          style={[
            styles.testResult,
            testResult.startsWith("Success") ? styles.success : styles.error,
          ]}
        >
          {testResult}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.m,
    backgroundColor: palette.background,
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
    marginTop: spacing.m,
    padding: spacing.s,
    backgroundColor: palette.background,
    borderRadius: 6,
    borderColor: palette.border,
    borderWidth: 1,
    alignItems: "center",
  },
  buttonText: {
    color: palette.foreground,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
  },
  testResult: {
    marginTop: spacing.s,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.medium,
    padding: spacing.s,
    borderRadius: 6,
  },
  success: {
    color: palette.saveGreen,
    backgroundColor: "#e6ffe6",
  },
  error: {
    color: "#dc3545",
    backgroundColor: "#ffe6e6",
  },
});
