import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StyleSheet,
} from "react-native";
import type { Post } from "@/models/models";
import { fontSizes } from "@/constants/typography";
import { palette } from "@/constants/Colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";

// This is a post summary section. This goes just below the title section and above the main text in the post #[id].tsx.

// before there is a summary, it shows a "AI summaries text with a go button". Once clicked, it shows a loading spinner while fetching the summary. If it fails, it shows an error message with a retry button. If it succeeds, it shows the summary text with an regenerate button. The summary can be edited and saved and isnt saved untill the post is saved.

interface PostSummaryProps {
  post: Post;
  onSave: (summary: string) => void;
  currentFont: {
    fontSize: number;
    lineHeight: number;
  };
  editedSummary: string;
  setEditedSummary: (summary: string) => void;
}

const AI_ENDPOINT_URL = "AI_ENDPOINT_URL";
const AI_MODEL_ID = "AI_MODEL_ID";
const AI_SYSTEM_PROMPT = "AI_SYSTEM_PROMPT";

export default function PostSummary({
  post,
  onSave,
  currentFont,
  editedSummary,
  setEditedSummary,
}: PostSummaryProps) {
  const [status, setStatus] = useState(post.summary ? "success" : "idle");
  const [summary, setSummary] = useState(post.summary || "");
  const [error, setError] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);

  // Track if summary has changed
  useEffect(() => {
    setSummary(editedSummary);
  }, [editedSummary]);

  const fetchSummary = async () => {
    setError(null);
    setStatus("loading");
    try {
      const [endpoint, modelId, systemPrompt] = await Promise.all([
        AsyncStorage.getItem(AI_ENDPOINT_URL),
        AsyncStorage.getItem(AI_MODEL_ID),
        AsyncStorage.getItem(AI_SYSTEM_PROMPT),
      ]);
      if (!endpoint) throw new Error("AI endpoint not configured");
      const url = endpoint.replace(/\/+$/, "") + "/chat/completions";
      const bodyText = post.customBody || post.bodyText || "";
      const payload = {
        model: modelId,
        messages: [
          {
            role: "user",
            content:
              systemPrompt ||
              "You are an assistant that summarizes Reddit posts.",
          },
          {
            role: "system", // changed from user to system to improve response attention
            content: `\n${bodyText}`,
          },
        ],
        max_tokens: 1024,
      };
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const aiSummary =
        data?.choices?.[0]?.message?.content?.trim() || "No summary returned.";
      setSummary(aiSummary);
      setEditedSummary(aiSummary);
      onSave(aiSummary); // auto-save when first generated
      setStatus("success");
    } catch (err: any) {
      setError(err.message || "Failed to fetch summary.");
      setStatus("error");
    }
  };

  const handleRegenerate = () => {
    fetchSummary();
  };

  const handleRetry = () => {
    fetchSummary();
  };

  const handleEdit = (text: string) => {
    setSummary(text);
    setEditedSummary(text);
    setEdited(true);
    onSave(text);
  };

  return (
    <View style={styles.container}>
      {status === "idle" && (
        <View>
          <TouchableOpacity onPress={fetchSummary} style={styles.idleRow}>
            <Text style={styles.infoText}>AI Summarise</Text>
            <Entypo
              name="new-message"
              style={styles.summariseButton}
              size={20}
              color={palette.muted}
            />
          </TouchableOpacity>
        </View>
      )}
      {status === "loading" && (
        <View style={styles.idleRow}>
          <ActivityIndicator size="small" style={{ padding: 8 }} />
          <Text style={styles.infoText}>Generating summary...</Text>
        </View>
      )}
      {status === "error" && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={handleRetry}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {status === "success" && (
        <View>
          <View style={styles.summaryRow}>
            <Text style={styles.label}>AI Summary:</Text>
            <View>
              <TouchableOpacity
                // style={styles.button}
                onPress={handleRegenerate}
              >
                {/* <Text style={styles.buttonText}>Regenerate</Text> */}
                <Entypo
                  name="ccw"
                  style={styles.summariseButton}
                  size={20}
                  color={palette.muted}
                />
              </TouchableOpacity>
            </View>
          </View>
          <TextInput
            style={[styles.body, currentFont]}
            value={summary}
            onChangeText={handleEdit}
            multiline
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    fontSize: 16,
    // marginBottom: 8,
    color: "#555",
  },
  errorText: {
    color: "red",
    marginBottom: 8,
  },
  label: {
    fontWeight: "bold",
    marginBottom: 4,
    fontSize: 16,
    marginRight: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    minHeight: 60,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  body: {
    fontSize: fontSizes.small,
    lineHeight: 16,
    color: palette.foreground,
    padding: 0,
  },
  idleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  summariseButton: {
    paddingVertical: 4,
    paddingHorizontal: 0,
    marginLeft: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    width: "100%",
  },
});
