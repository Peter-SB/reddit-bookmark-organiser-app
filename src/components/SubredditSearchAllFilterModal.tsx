import React, { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import { Subreddit } from "@/models/Subreddit";

interface SubredditSearchAllFilterModalProps {
  subreddits: Subreddit[];
  onToggle: (name: string, enabled: boolean) => void;
  onSetAll: (enabled: boolean) => void;
}

/**
 * Lets the user pick which of their added subreddits are included when
 * browsing "Search All". Disabling a subreddit here only removes it from
 * the combined feed — it stays fully browsable on its own.
 */
export function SubredditSearchAllFilterModal({
  subreddits,
  onToggle,
  onSetAll,
}: SubredditSearchAllFilterModalProps) {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const [open, setOpen] = useState(false);

  const enabledCount = subreddits.filter((s) => s.isEnabledForSearch).length;

  return (
    <>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => setOpen(true)}
        accessibilityLabel="Choose subreddits included in Search All"
      >
        <Icon name="filter-list" size={24} color={palette.foreground} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Search All includes</Text>
              <Text style={styles.cardSubtitle}>
                {enabledCount} of {subreddits.length} selected
              </Text>
            </View>

            <View style={styles.bulkRow}>
              <TouchableOpacity onPress={() => onSetAll(true)}>
                <Text style={styles.bulkAction}>Select all</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onSetAll(false)}>
                <Text style={styles.bulkAction}>Select none</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.list} bounces={false}>
              {subreddits.length === 0 ? (
                <Text style={styles.emptyText}>No subreddits added yet.</Text>
              ) : (
                subreddits.map((s) => (
                  <View key={s.name} style={styles.row}>
                    <Text style={styles.rowLabel} numberOfLines={1}>
                      r/{s.name}
                    </Text>
                    <Switch
                      value={s.isEnabledForSearch}
                      onValueChange={(v) => onToggle(s.name, v)}
                      thumbColor={
                        s.isEnabledForSearch
                          ? palette.foregroundMidLight
                          : palette.border
                      }
                      trackColor={{ true: palette.border, false: palette.border }}
                    />
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setOpen(false)}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function makeStyles(
  palette: ThemeContextValue["palette"],
  fontSizes: ThemeContextValue["fontSizes"],
) {
  return StyleSheet.create({
    iconButton: {
      padding: 4,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.4)",
      padding: spacing.l,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      maxHeight: "75%",
      backgroundColor: palette.background,
      borderRadius: 12,
      paddingTop: spacing.m,
      elevation: 10,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
    },
    cardHeader: {
      paddingHorizontal: spacing.m,
      marginBottom: spacing.xs,
    },
    cardTitle: {
      fontSize: fontSizes.title * 0.9,
      fontWeight: fontWeights.semibold,
      color: palette.foreground,
    },
    cardSubtitle: {
      fontSize: fontSizes.small,
      color: palette.muted,
      marginTop: 2,
    },
    bulkRow: {
      flexDirection: "row",
      gap: spacing.l,
      paddingHorizontal: spacing.m,
      paddingBottom: spacing.s,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    bulkAction: {
      fontSize: fontSizes.small,
      color: palette.accent,
      fontWeight: fontWeights.medium,
    },
    list: {
      paddingHorizontal: spacing.m,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.s,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    rowLabel: {
      fontSize: fontSizes.body,
      color: palette.foreground,
      flexShrink: 1,
      marginRight: spacing.s,
    },
    emptyText: {
      fontSize: fontSizes.body,
      color: palette.muted,
      textAlign: "center",
      paddingVertical: spacing.l,
    },
    doneButton: {
      margin: spacing.m,
      paddingVertical: spacing.s,
      borderRadius: 8,
      backgroundColor: palette.border,
      alignItems: "center",
    },
    doneButtonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: palette.foreground,
    },
  });
}
