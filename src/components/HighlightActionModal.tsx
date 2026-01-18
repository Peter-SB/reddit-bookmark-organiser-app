import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import { Highlight } from "@/models/models";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface HighlightActionModalProps {
  visible: boolean;
  highlight: Highlight | null;
  onClose: () => void;
  onUpdate: (id: number, changes: { text?: string; note?: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export const HighlightActionModal: React.FC<HighlightActionModalProps> = ({
  visible,
  highlight,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const insets = useSafeAreaInsets();
  const [editedText, setEditedText] = useState("");
  const [editedNote, setEditedNote] = useState("");

  React.useEffect(() => {
    if (highlight) {
      setEditedText(highlight.text);
      setEditedNote(highlight.note || "");
    }
  }, [highlight]);

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
    Alert.alert(
      "Delete Highlight",
      "Are you sure you want to delete this highlight?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await onDelete(highlight.id);
            onClose();
          },
        },
      ]
    );
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
            { paddingBottom: Math.max(insets.bottom, spacing.m) },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Highlight</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Ionicons name="close" size={24} color={palette.foreground} />
            </TouchableOpacity>
          </View>

          <View style={styles.editContainer}>
            <Text style={styles.label}>Highlight Text</Text>
            <TextInput
              style={styles.textInput}
              value={editedText}
              onChangeText={setEditedText}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.label}>Note</Text>
            <TextInput
              style={styles.textInput}
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
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
