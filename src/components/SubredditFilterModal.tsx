import React, { useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
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

interface SubredditFilterModalProps {
  sort: SubredditSort;
  timeRange: SubredditTimeRange;
  onSortChange: (sort: SubredditSort) => void;
  onTimeRangeChange: (t: SubredditTimeRange) => void;
}

export function SubredditFilterModal({
  sort,
  timeRange,
  onSortChange,
  onTimeRangeChange,
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

  return (
    <>
      <TouchableOpacity
        ref={buttonRef}
        style={styles.iconButton}
        onPress={toggleOpen}
        accessibilityLabel="Filter posts"
      >
        <Icon name="filter-list" size={24} color={palette.foreground} />
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
          <View
            style={[
              styles.menu,
              { top: menuPos.top, right: menuPos.right + 12 },
            ]}
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
          </View>
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
    },
    menu: {
      position: "absolute",
      minWidth: 160,
      backgroundColor: palette.backgroundMidLight,
      borderRadius: 8,
      paddingVertical: 6,
      elevation: 10,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 3 },
      shadowRadius: 6,
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
