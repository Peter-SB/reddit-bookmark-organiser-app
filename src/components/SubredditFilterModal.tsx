import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import {
  SubredditSort,
  SubredditTimeRange,
} from "@/hooks/useSubredditImport";

const SORT_OPTIONS: { key: SubredditSort; label: string }[] = [
  { key: "hot", label: "Hot" },
  { key: "new", label: "New" },
  { key: "top", label: "Top" },
  { key: "rising", label: "Rising" },
];

const TIME_RANGE_OPTIONS: { key: SubredditTimeRange; label: string }[] = [
  { key: "hour", label: "Hour" },
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "all", label: "All Time" },
];

/** Thresholds offered for the minimum upvote / comment filters. 0 = no minimum. */
const MIN_COUNT_OPTIONS = [0, 5, 10, 25, 50, 100, 500];

interface SubredditFilterModalProps {
  sort: SubredditSort;
  timeRange: SubredditTimeRange;
  /** Minimum upvotes a post must have to be listed (0 = no minimum) */
  minScore: number;
  /** Minimum comments a post must have to be listed (0 = no minimum) */
  minComments: number;
  onSortChange: (sort: SubredditSort) => void;
  onTimeRangeChange: (t: SubredditTimeRange) => void;
  onMinScoreChange: (min: number) => void;
  onMinCommentsChange: (min: number) => void;
}

export function SubredditFilterModal({
  sort,
  timeRange,
  minScore,
  minComments,
  onSortChange,
  onTimeRangeChange,
  onMinScoreChange,
  onMinCommentsChange,
}: SubredditFilterModalProps) {
  const { palette, fontSizes } = useTheme();
  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<View>(null);

  const toggleOpen = () => {
    if (!open && buttonRef.current) {
      buttonRef.current.measure((_x, _y, _width, height, pageX, pageY) => {
        setMenuPos({ top: pageY + height + 4, right: 0 });
        // pageX unused: menu anchored to the right edge of the screen instead
        setOpen(true);
      });
    } else {
      setOpen(false);
    }
  };

  const hasCountFilter = minScore > 0 || minComments > 0;

  const renderMinCountRow = (
    value: number,
    onChange: (min: number) => void,
  ) => (
    <View style={styles.chipRow}>
      {MIN_COUNT_OPTIONS.map((min) => (
        <TouchableOpacity
          key={min}
          style={[styles.chip, value === min && styles.chipActive]}
          onPress={() => onChange(min)}
        >
          <Text
            style={[
              styles.chipLabel,
              value === min && styles.chipLabelActive,
            ]}
          >
            {min === 0 ? "Any" : `${min}+`}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <>
      <TouchableOpacity
        ref={buttonRef}
        style={styles.iconButton}
        onPress={toggleOpen}
        accessibilityLabel="Filter posts"
      >
        <Icon name="filter-list" size={24} color={palette.foreground} />
        {hasCountFilter ? <View style={styles.activeDot} /> : null}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <ScrollView
            style={[
              styles.menu,
              { top: menuPos.top, right: menuPos.right + 12 },
            ]}
            contentContainerStyle={styles.menuContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>Sort By</Text>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.menuItem,
                  sort === opt.key && styles.menuItemActive,
                ]}
                onPress={() => onSortChange(opt.key)}
              >
                <Text
                  style={[
                    styles.menuItemLabel,
                    sort === opt.key && styles.menuItemLabelActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}

            {sort === "top" && (
              <>
                <View style={styles.divider} />
                <Text style={styles.sectionLabel}>Time Range</Text>
                {TIME_RANGE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.menuItem,
                      timeRange === opt.key && styles.menuItemActive,
                    ]}
                    onPress={() => onTimeRangeChange(opt.key)}
                  >
                    <Text
                      style={[
                        styles.menuItemLabel,
                        timeRange === opt.key && styles.menuItemLabelActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>Min Upvotes</Text>
            {renderMinCountRow(minScore, onMinScoreChange)}

            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>Min Comments</Text>
            {renderMinCountRow(minComments, onMinCommentsChange)}
          </ScrollView>
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
    activeDot: {
      position: "absolute",
      top: 2,
      right: 2,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: palette.accent,
    },
    modalBackdrop: {
      flex: 1,
    },
    menu: {
      position: "absolute",
      width: 200,
      maxHeight: 460,
      flexGrow: 0,
      backgroundColor: palette.backgroundMidLight,
      borderRadius: 8,
      elevation: 10,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 3 },
      shadowRadius: 6,
    },
    menuContent: {
      paddingVertical: 6,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chip: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    chipActive: {
      backgroundColor: palette.border,
    },
    chipLabel: {
      fontSize: fontSizes.small * 0.9,
      color: palette.foreground,
    },
    chipLabelActive: {
      fontWeight: "bold",
    },
    sectionLabel: {
      fontSize: fontSizes.small * 0.85,
      color: palette.muted,
      fontWeight: "600",
      paddingHorizontal: 12,
      paddingTop: 6,
      paddingBottom: 2,
    },
    menuItem: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    menuItemActive: {
      backgroundColor: palette.border,
    },
    menuItemLabel: {
      fontSize: fontSizes.body,
      color: palette.foreground,
    },
    menuItemLabelActive: {
      fontWeight: "bold",
    },
    divider: {
      height: 1,
      backgroundColor: palette.border,
      marginVertical: 4,
    },
  });
}
