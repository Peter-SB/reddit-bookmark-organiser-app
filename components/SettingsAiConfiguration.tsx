import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const AI_ENDPOINT_URL = "AI_ENDPOINT_URL";
const AI_MODEL_ID = "AI_MODEL_ID";
const AI_SYSTEM_PROMPT = "AI_SYSTEM_PROMPT";

export default function SettingsAiConfiguration() {
  const [endpoint, setEndpoint] = useState("");
  const [modelId, setModelId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);

  // Load AI config from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const [endpointValue, modelValue, promptValue] = await Promise.all([
          AsyncStorage.getItem(AI_ENDPOINT_URL),
          AsyncStorage.getItem(AI_MODEL_ID),
          AsyncStorage.getItem(AI_SYSTEM_PROMPT),
        ]);
        if (endpointValue) setEndpoint(endpointValue);
        if (modelValue) setModelId(modelValue);
        if (promptValue) setSystemPrompt(promptValue);
      } catch (err) {
        console.warn("Failed to load AI config:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Save AI config to AsyncStorage
  const save = async () => {
    if (!endpoint.trim()) {
      Alert.alert("Error", "Please enter an endpoint.");
      return;
    }
    setLoading(true);
    try {
      await Promise.all([
        AsyncStorage.setItem(AI_ENDPOINT_URL, endpoint.trim()),
        AsyncStorage.setItem(AI_MODEL_ID, modelId.trim()),
        AsyncStorage.setItem(AI_SYSTEM_PROMPT, systemPrompt.trim()),
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
    if (!endpoint.trim()) {
      Alert.alert("Error", "Please enter an endpoint.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const url = endpoint.trim().replace(/\/+$/, "") + "/models";
      console.debug("Testing AI endpoint:", url);
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let modelList: string[] = [];
      if (Array.isArray(data?.data)) {
        modelList = data.data.map((m: any) => m.id || m.name || "");
        setTestResult(`Success: ${modelList.length} models found`);
      } else {
        setTestResult("Success: Response received");
      }
      setModels(modelList);
      // If no model selected, pick first
      if (!modelId && modelList.length > 0) setModelId(modelList[0]);
    } catch (err: any) {
      setTestResult(`Error: ${err.message || "Failed to connect"}`);
      setModels([]);
    } finally {
      setTesting(false);
    }
  };

  // Load models when dropdown is focused
  const handleModelDropdownOpen = async () => {
    if (!endpoint.trim()) return;
    if (models.length > 0) return;
    try {
      const url = endpoint.trim().replace(/\/+$/, "") + "/models";
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) return;
      const data = await res.json();
      let modelList: string[] = [];
      if (Array.isArray(data?.data)) {
        modelList = data.data.map((m: any) => m.id || m.name || "");
        setModels(modelList);
        if (!modelId && modelList.length > 0) setModelId(modelList[0]);
      }
    } catch {}
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
