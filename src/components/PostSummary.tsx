import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StyleSheet,
} from "react-native";
import type { Post } from "@/models/models";
import { Ionicons } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";
import { useSummaryJob } from "@/hooks/useSummaryJob";
import { spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";

// This is a post summary section. This goes just below the title section and above the main text in the post #[id].tsx.

// before there is a summary, it shows a "AI summaries text with a go button". Once clicked, it shows a loading spinner while streaming. If it fails, it shows an error message with a retry button. If it succeeds, it shows the summary text with a regenerate button.

// Generation itself lives in SummaryJobService, not here, so it survives
// navigating away from the post. This component only renders the job and lets
// the user edit the text afterwards.

type SummaryStatus = "idle" | "loading" | "success" | "error";

interface PostSummaryProps {
  post: Post;
  onSave: (summary: string) => void;
  /** Called with text the background job has just written to the DB. */
  onCommitted: (summary: string) => void;
  currentFont: {
    fontSize: number;
    lineHeight: number;
  };
  editedSummary: string;
  setEditedSummary: (summary: string) => void;
}

export default function PostSummary({
  post,
  onSave,
  onCommitted,
  currentFont,
  editedSummary,
  setEditedSummary,
}: PostSummaryProps) {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );

  const {
    text: streamedText,
    isStreaming,
    error,
    canRevert,
    start,
    stop,
    revert,
  } = useSummaryJob(post.id, onCommitted);

  // While generating, the job owns the text; otherwise the user's copy does.
  const summary = isStreaming ? streamedText : editedSummary;

  const status: SummaryStatus = isStreaming
    ? "loading"
    : error
      ? "error"
      : summary
        ? "success"
        : "idle";

  const handleStart = () => start(post);

  const handleEdit = (text: string) => {
    setEditedSummary(text);
    onSave(text);
  };

  return (
    <View style={styles.container}>
      {status === "idle" && (
        <View>
          <TouchableOpacity onPress={handleStart} style={styles.idleRow}>
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
                    onPress={stop}
                    style={[styles.stopButton]}
                    accessibilityLabel="Stop generating and keep what has arrived"
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

                <View style={styles.summaryActions}>
                  {/* Only offered while the user is still on the post and there
                      was an older summary to go back to. */}
                  {canRevert && (
                    <TouchableOpacity
                      onPress={revert}
                      accessibilityLabel="Discard this summary and keep the previous one"
                    >
                      <Entypo
                        name="circle-with-cross"
                        style={styles.summariseButton}
                        size={20}
                        color={palette.favHeartRed}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={handleStart}
                    accessibilityLabel="Regenerate summary"
                  >
                    <Ionicons
                      name="refresh"
                      style={styles.summariseButton}
                      size={20}
                      color={palette.muted}
                    />
                  </TouchableOpacity>
                </View>
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
            onPress={handleStart}
            accessibilityLabel="Retry summary"
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

function makeStyles(
  palette: ThemeContextValue["palette"],
  fontSizes: ThemeContextValue["fontSizes"],
) {
  return StyleSheet.create({
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
    summaryActions: {
      flexDirection: "row",
      alignItems: "center",
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
}
