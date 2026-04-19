import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import { AuthorProfile } from "@/models/AuthorProfile";
import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { StarRating } from "./StarRating";

interface AuthorProfileCardProps {
  authorName: string;
  profile: AuthorProfile | null;
  onToggleFavorite: () => Promise<void>;
  onSetRating: (rating: number | null) => Promise<void>;
  onSetNotes: (notes: string | null) => Promise<void>;
}

export const AuthorProfileCard: React.FC<AuthorProfileCardProps> = ({
  authorName,
  profile,
  onToggleFavorite,
  onSetRating,
  onSetNotes,
}) => {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(profile?.notes ?? "");
  const notesInputRef = useRef<TextInput>(null);

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingInput, setRatingInput] = useState("");

  // Keep notesText in sync if profile changes externally
  const prevNotesRef = useRef(profile?.notes ?? "");
  if (!editingNotes && (profile?.notes ?? "") !== prevNotesRef.current) {
    prevNotesRef.current = profile?.notes ?? "";
    setNotesText(profile?.notes ?? "");
  }

  const isFav = profile?.isFavorite ?? false;
  const rating = profile?.rating ?? 0;

  const handleSaveNotes = async () => {
    setEditingNotes(false);
    await onSetNotes(notesText.trim() || null);
  };

  const openRatingModal = () => {
    setRatingInput(profile?.rating != null ? profile.rating.toFixed(1) : "");
    setRatingModalVisible(true);
  };

  return (
    <View style={styles.card}>
      {/* Row 1: fav + rating */}
      <View style={styles.row}>
        <TouchableOpacity
          onPress={onToggleFavorite}
          style={styles.favButton}
          accessibilityLabel={
            isFav ? "Remove from favorites" : "Add to favorites"
          }
        >
          <Ionicons
            name={isFav ? "heart" : "heart-outline"}
            size={20}
            color={isFav ? palette.favHeartRed : palette.muted}
          />
        </TouchableOpacity>

        <View style={styles.ratingWrap}>
          <StarRating rating={rating} onRate={openRatingModal} size={18} />
        </View>
      </View>

      {/* Row 2: notes */}
      {editingNotes ? (
        <View style={styles.notesEditWrap}>
          <TextInput
            ref={notesInputRef}
            style={styles.notesInput}
            value={notesText}
            onChangeText={setNotesText}
            multiline
            placeholder={`Notes about u/${authorName}…`}
            placeholderTextColor={palette.muted}
            autoFocus
            onBlur={handleSaveNotes}
          />
          <TouchableOpacity
            onPress={handleSaveNotes}
            style={styles.saveNotesBtn}
          >
            <Ionicons name="checkmark" size={18} color={palette.accent} />
            <Text style={styles.saveNotesBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => {
            setNotesText(profile?.notes ?? "");
            setEditingNotes(true);
          }}
          activeOpacity={0.7}
          style={styles.notesReadWrap}
        >
          {profile?.notes ? (
            <Text style={styles.notesText}>{profile.notes}</Text>
          ) : (
            <Text style={styles.notesPlaceholder}>
              <Ionicons name="pencil-outline" size={12} color={palette.muted} />{" "}
              Add notes about this author…
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Rating modal */}
      <Modal
        transparent
        visible={ratingModalVisible}
        animationType="fade"
        onRequestClose={() => setRatingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Author Rating</Text>
            <TextInput
              style={styles.modalInput}
              value={ratingInput}
              onChangeText={setRatingInput}
              keyboardType="decimal-pad"
              placeholder="0.0 – 5.0"
              placeholderTextColor={palette.muted}
              maxLength={4}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setRatingModalVisible(false)}
                style={styles.modalButton}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  const v = parseFloat(ratingInput);
                  if (isNaN(v) || v < 0 || v > 5) {
                    Alert.alert(
                      "Invalid",
                      "Enter a number between 0.0 and 5.0",
                    );
                    return;
                  }
                  const rounded = Math.round(v * 10) / 10;
                  await onSetRating(rounded);
                  setRatingModalVisible(false);
                }}
                style={styles.modalButton}
              >
                <Text style={[styles.modalButtonText]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  await onSetRating(null);
                  setRatingModalVisible(false);
                }}
                style={styles.modalButton}
              >
                <Text style={[styles.modalButtonText]}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

function makeStyles(
  palette: ThemeContextValue["palette"],
  fontSizes: ThemeContextValue["fontSizes"],
) {
  return StyleSheet.create({
    card: {
      backgroundColor: palette.backgroundMidLight,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
      paddingHorizontal: spacing.m,
      paddingTop: spacing.s,
      paddingBottom: spacing.s,
      gap: spacing.xs,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.m,
    },
    favButton: {
      padding: spacing.xs,
    },
    ratingWrap: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      paddingBottom: 3,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.3)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      width: "80%",
      backgroundColor: palette.background,
      padding: spacing.m,
      borderRadius: 8,
      elevation: 5,
    },
    modalTitle: {
      fontSize: fontSizes.large,
      fontWeight: fontWeights.semibold,
      marginBottom: spacing.s,
      color: palette.foreground,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 6,
      padding: spacing.s,
      fontSize: fontSizes.body,
      marginBottom: spacing.m,
      color: palette.foreground,
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    modalButton: {
      padding: spacing.s,
    },
    modalButtonText: {
      fontSize: fontSizes.body,
      color: palette.foreground,
    },
    // kept for layout spacing
    clearRatingBtn: {
      marginLeft: spacing.xs,
      padding: spacing.xs,
    },
    notesReadWrap: {
      minHeight: 28,
      justifyContent: "center",
    },
    notesPlaceholder: {
      fontSize: fontSizes.small,
      color: palette.muted,
      fontStyle: "italic",
    },
    notesText: {
      fontSize: fontSizes.body,
      color: palette.foreground,
      lineHeight: 20,
    },
    notesEditWrap: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 6,
      backgroundColor: palette.background,
      padding: spacing.s,
    },
    notesInput: {
      fontSize: fontSizes.body,
      color: palette.foreground,
      minHeight: 60,
      textAlignVertical: "top",
    },
    saveNotesBtn: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-end",
      marginTop: spacing.xs,
      gap: spacing.xs,
    },
    saveNotesBtnText: {
      fontSize: fontSizes.small,
      color: palette.accent,
      fontWeight: fontWeights.semibold,
    },
  });
}
