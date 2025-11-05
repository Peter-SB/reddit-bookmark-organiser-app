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
import { SettingsRepository } from "@/repository/SettingsRepository";
import { Ionicons } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";
import EventSource from "react-native-sse";
import { startSSEChat } from "@/services/SSEChatService";
import { spacing } from "@/constants/spacing";

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
const AI_API_KEY = "AI_API_KEY"
const AI_MODEL_ID = "AI_MODEL_ID";
const AI_SYSTEM_PROMPT = "AI_SYSTEM_PROMPT";
const AI_ATTRIB_REFERER = "AI_ATTRIB_REFERER";
const AI_ATTRIB_TITLE = "AI_ATTRIB_TITLE";
const AI_MAX_TOKENS = "AI_MAX_TOKENS";

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
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamHandle, setStreamHandle] = useState<EventSource | null>(null);
  const latestRef = React.useRef(summary);
  const summaryRef = React.useRef(summary);

  useEffect(
    () => () => {
      if (streamHandle) streamHandle.close();
    },
    [streamHandle]
  );

  useEffect(() => {
    if (!isStreaming) setSummary(editedSummary);
  }, [editedSummary, isStreaming]);

  useEffect(() => {
    summaryRef.current = summary;
  }, [summary]);

  // mirror text to parent after each paint while streaming
  useEffect(() => {
    if (isStreaming) {
      setEditedSummary(summary);
    }
  }, [summary, isStreaming, setEditedSummary]);

  async function startSummary() {
    if (isStreaming) return;
    const settings = await SettingsRepository.getSettings([
      AI_ENDPOINT_URL,
      AI_API_KEY,
      AI_MODEL_ID,
      AI_SYSTEM_PROMPT,
      AI_ATTRIB_REFERER,
      AI_ATTRIB_TITLE,
      AI_MAX_TOKENS,
    ]);
    const endpoints = (settings[AI_ENDPOINT_URL] || "")
      .split(";")
      .map((e) => e.trim())
      .filter(Boolean);
    const apiKey = (settings[AI_API_KEY]?.trim() || "");
    const referer = settings[AI_ATTRIB_REFERER]?.trim() || "";
    const appTitle = settings[AI_ATTRIB_TITLE]?.trim() || "Reddit-Bookmark-App";
    const maxTokens = (() => {
      const v = parseInt(settings[AI_MAX_TOKENS] || "1024", 10);
      return Number.isFinite(v) && v > 0 ? v : 1024;
    })();

    const modelId = settings[AI_MODEL_ID];
    const systemPrompt = settings[AI_SYSTEM_PROMPT];
    if (!endpoints.length) {
      setError("AI Settings Not Configured");
      setStatus("error");
      setIsStreaming(false);
      return;
    }
    const bodyText = post.customBody || post.bodyText || "";
    const titleText = post.customTitle || post.title || "";

    const prompt =
      systemPrompt ||
      "You are an assistant that summarises reddit posts in 3-4 lines.";
    const payload = {
      model: modelId,
      stream: true,
      messages: [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "user",
          content: titleText + " \n" + bodyText + "----End of Text ---" + prompt,
        },
      ],
      max_tokens: maxTokens,
    };
    setError(null);
    setStatus("loading");
    setIsStreaming(true);
    setSummary("");
    summaryRef.current = "";

    let currentEndpointIndex = 0;
    function tryNextEndpoint(errorMsg?: string) {
      if (currentEndpointIndex >= endpoints.length) {
        setError("All endpoints failed." + errorMsg);
        setStatus("error");
        setIsStreaming(false);
        setStreamHandle(null);
        return;
      }
      const endpoint = endpoints[currentEndpointIndex];
      currentEndpointIndex++;
      try {
        const es = startSSEChat({
          endpoint,
          payload,
          onDelta: (delta) => {
            setSummary((prev) => {
              const next = prev + delta;
              summaryRef.current = next; // keep ref inline with state
              return next;
            });
          },
          onFinish: () => {
            requestAnimationFrame(() => {
              setIsStreaming(false);
              setStatus("success");
              setStreamHandle(null);
              setEditedSummary(summaryRef.current);
            });
          },
          onError: (err) => {
            setStreamHandle(null);
            const errMsg =
              typeof err === "string" ? err : err?.message || "Unknown error";
            tryNextEndpoint(errMsg);
          },
          apiKey,
          referer,
          appTitle,
        });
        setStreamHandle(es);
      } catch (err) {
        // Synchronous error, try next
        console.log("AI endpoint error:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        tryNextEndpoint(errMsg);
      }
    }
    tryNextEndpoint();
  }

  const handleRegenerate = () => {
    if (streamHandle) streamHandle.close();
    startSummary();
  };

  const handleStop = () => {
    if (streamHandle) {
      streamHandle.close();
      setIsStreaming(false);
      setStatus("success");
      setStreamHandle(null);
      setEditedSummary(summaryRef.current); // ensure parent gets the last buffered text
    }
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
          <TouchableOpacity onPress={startSummary} style={styles.idleRow}>
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
      {(status === "loading" || status === "success") && (
        <View>
          <View style={styles.idleRow}>
            {status === "loading" && (
              <View style={[styles.idleRow, { marginLeft: 8 }]}>
                <ActivityIndicator size="small" style={{ padding: 8 }} />
                <Text style={styles.infoText}>Generating summary...</Text>
                {isStreaming && (
                  <TouchableOpacity
                    onPress={handleStop}
                    style={[styles.stopButton]}
                  >
                    <Entypo
                      name="circle-with-cross"
                      size={18}
                      color={palette.favHeartRed}
                      style={styles.stopButtonIcon}
                    />
                  </TouchableOpacity>
                )}
              </View>
            )}
            {status === "success" && (
              <View style={styles.summaryRow}>
                <Text
                  style={[
                    styles.infoText,
                    { color: palette.foreground, fontWeight: "semibold" },
                  ]}
                >
                  AI Summary:
                </Text>

                <TouchableOpacity
                  // style={styles.button}
                  onPress={handleRegenerate}
                >
                  <Ionicons
                    name="refresh"
                    style={styles.summariseButton}
                    size={20}
                    color={palette.muted}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
          {summary !== "" && (
            <TextInput
              style={[styles.body, currentFont]}
              value={summary}
              onChangeText={handleEdit}
              multiline
              editable={!isStreaming}
            />
          )}
        </View>
      )}
      {status === "error" && (
        <View style={styles.idleRow}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            // style={styles.button}
            onPress={handleRegenerate}
          >
            <Entypo
              name="ccw"
              style={styles.summariseButton}
              size={20}
              color={palette.muted}
            />
          </TouchableOpacity>
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
    color: palette.favHeartRed,
    flexShrink: 1,
    marginRight: 8,
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
    padding: spacing.xs,
  },
  idleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
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
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 1,
  },
  stopButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  stopButtonIcon: {
    marginLeft: 6,
  },
});
