import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { Highlight } from "@/models/models";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fontOptions } from "@/constants/fontOptions";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";

interface HighlightActionModalProps {
  visible: boolean;
  highlight: Highlight | null;
  onClose: () => void;
  onUpdate: (
    id: number,
    changes: { text?: string; note?: string },
  ) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  fontOptionIdx: number;
}

export const HighlightActionModal: React.FC<HighlightActionModalProps> = ({
  visible,
  highlight,
  onClose,
  onUpdate,
  onDelete,
  fontOptionIdx,
}) => {
  const insets = useSafeAreaInsets();
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const [editedText, setEditedText] = useState("");
  const [editedNote, setEditedNote] = useState("");
  const scrollViewRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    if (highlight) {
      setEditedText(highlight.text);
      setEditedNote(highlight.note || "");
    }
  }, [highlight]);

  // Scroll to end only when modal becomes visible
  React.useEffect(() => {
    if (visible && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 1);
    }
  }, [visible]);

  const handleSave = async () => {
    if (!highlight) return;
    await onUpdate(highlight.id, {
      text: editedText,
      note: editedNote,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!highlight) return;
    onDelete(highlight.id);
    onClose();
  };

  const handleCancel = () => {
    if (highlight) {
      setEditedText(highlight.text);
      setEditedNote(highlight.note || "");
    }
    onClose();
  };

  if (!highlight) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleCancel}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.modalContent,
            // { paddingBottom: Math.max(insets.bottom, spacing.m) },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Highlight</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Ionicons name="close" size={24} color={palette.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={[styles.editContainer]}
            contentContainerStyle={{}}
            ref={scrollViewRef}
          >
            <Text style={styles.label}>Highlight Text</Text>
            <TextInput
              style={[
                styles.textInput,
                { fontSize: fontOptions[fontOptionIdx].fontSize * 1.1 },
              ]}
              value={editedText}
              onChangeText={setEditedText}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.label}>Note</Text>
            <TextInput
              style={[
                styles.textInput,
                { fontSize: fontOptions[fontOptionIdx].fontSize * 1.1 },
              ]}
              value={editedNote}
              onChangeText={setEditedNote}
              multiline
              placeholder="Add a note..."
              textAlignVertical="top"
            />
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.deleteButton]}
                onPress={handleDelete}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={palette.favHeartRed}
                  style={{ marginRight: spacing.xs }}
                />
                <Text style={[styles.buttonText, styles.deleteText]}>
                  Delete
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={[styles.buttonText, styles.saveButtonText]}>
                  OK
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

function makeStyles(
  palette: ThemeContextValue["palette"],
  fontSizes: ThemeContextValue["fontSizes"],
) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: palette.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: spacing.m,
      maxHeight: "90%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.m,
    },
    modalTitle: {
      fontSize: fontSizes.title,
      fontWeight: fontWeights.bold,
      color: palette.foreground,
    },
    editContainer: {
      gap: spacing.m,
    },
    label: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: palette.foreground,
      marginBottom: spacing.xs,
    },
    textInput: {
      backgroundColor: palette.backgroundDarker,
      borderRadius: 12,
      padding: spacing.m,
      fontSize: fontSizes.body,
      color: palette.foreground,
      minHeight: 80,
      borderWidth: 1,
      borderColor: palette.border,
    },
    buttonRow: {
      flexDirection: "row",
      gap: spacing.m,
      marginTop: spacing.m,
    },
    button: {
      flex: 1,
      flexDirection: "row",
      padding: spacing.m,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    deleteButton: {
      backgroundColor: palette.backgroundDarker,
      borderWidth: 1,
      borderColor: palette.border,
    },
    saveButton: {
      backgroundColor: palette.accent,
    },
    buttonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: palette.foreground,
    },
    deleteText: {
      color: palette.favHeartRed,
    },
    saveButtonText: {
      color: "#fff",
    },
  });
}
