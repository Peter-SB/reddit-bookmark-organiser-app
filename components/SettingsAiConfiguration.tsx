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

const parseEndpoints = (input: string): string[] =>
  input
    .split(";")
    .map((e) => e.trim())
    .filter(Boolean);

export default function SettingsAiConfiguration() {
  const [endpoint, setEndpoint] = useState("");
  const [modelId, setModelId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [showAiSummary, setShowAiSummary] = useState(true);

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
        ]);
        if (settings[AI_ENDPOINT_URL]) setEndpoint(settings[AI_ENDPOINT_URL]);
        if (settings[AI_MODEL_ID]) setModelId(settings[AI_MODEL_ID]);
        if (settings[AI_SYSTEM_PROMPT])
          setSystemPrompt(settings[AI_SYSTEM_PROMPT]);
        if (settings[SHOW_AI_SUMMARY] !== undefined)
          setShowAiSummary(settings[SHOW_AI_SUMMARY] === "true");
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
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        let modelList: string[] = [];
        if (Array.isArray(data?.data)) {
          modelList = data.data.map((m: any) => m.id || m.name || "");
          setTestResult(`Success: ${modelList.length} models found at ${ep}`);
        } else {
          setTestResult(`Success: Response received at ${ep}`);
        }
        setModels(modelList);
        if (!modelId && modelList.length > 0) setModelId(modelList[0]);
        success = true;
        break;
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
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) continue;
        const data = await res.json();
        let modelList: string[] = [];
        if (Array.isArray(data?.data)) {
          modelList = data.data.map((m: any) => m.id || m.name || "");
          setModels(modelList);
          if (!modelId && modelList.length > 0) setModelId(modelList[0]);
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
    <>
      <Text style={styles.title}>AI Endpoint Configuration</Text>
      <View style={styles.container}>
        <Text style={styles.label}>Endpoint URL*</Text>
        <TextInput
          style={styles.input}
          value={endpoint}
          onChangeText={setEndpoint}
          placeholder="https://your-ai-endpoint.com/v1"
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
  buttonRow: {
    flexDirection: "row",
    marginTop: spacing.l,
    justifyContent: "space-between",
  },
  button: {
    flex: 1,
    marginHorizontal: spacing.s / 2,
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
  testResult: {
    marginTop: spacing.m,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
    padding: spacing.s,
    borderRadius: 8,
  },
  success: {
    color: "green",
    backgroundColor: "#e6ffe6",
  },
  error: {
    color: "red",
    backgroundColor: "#ffe6e6",
  },
});
