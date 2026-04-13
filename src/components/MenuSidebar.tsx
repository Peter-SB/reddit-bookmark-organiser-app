import { OrderByOption, POST_ORDER_BY_LABELS } from "@/constants/orderBy";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

import { spacing } from "@/constants/spacing";
import { fontWeights } from "@/constants/typography";
import type { ThemeContextValue } from "@/contexts/ThemeContext";
import { Folder } from "@/models/models";
import { OrderByRow } from "./OrderByRow";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";

// enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface MenuSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (key: string | number | (number | string)[]) => void;
  folders: Folder[];
  favouritesFilter: "all" | "yes" | "no";
  readFilter: "all" | "yes" | "no";
  archivedFilter: "all" | "yes" | "no";
  queuedFilter: "all" | "yes" | "no";
  onFavouritesFilterChange: (val: "all" | "yes" | "no") => void;
  onReadFilterChange: (val: "all" | "yes" | "no") => void;
  onArchivedFilterChange: (val: "all" | "yes" | "no") => void;
  onQueuedFilterChange: (val: "all" | "yes" | "no") => void;
  selectedFolders?: number[];
  onSelectedFoldersChange?: (ids: number[]) => void;
  onDeleteFolder?: (id: number) => void;
  orderBy?: OrderByOption;
  orderDirection?: "asc" | "desc";
  onOrderByChange?: (val: OrderByOption) => void;
  onOrderDirectionChange?: (val: "asc" | "desc") => void;
  onRandomReseed?: () => void;
}

export const MenuSidebar: React.FC<MenuSidebarProps> = ({
  isOpen,
  onClose,
  onSelect,
  folders,
  favouritesFilter,
  readFilter,
  archivedFilter,
  queuedFilter,
  onFavouritesFilterChange,
  onReadFilterChange,
  onArchivedFilterChange,
  onQueuedFilterChange,
  selectedFolders = [],
  onSelectedFoldersChange,
  onDeleteFolder,
  orderBy = OrderByOption.AddedAt,
  orderDirection = "desc",
  onOrderByChange,
  onOrderDirectionChange,
  onRandomReseed,
}) => {
  const { palette, fontSizes, isDarkMode, toggleDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get("window").width;
  const sidebarWidth = screenWidth * 0.8;

  const [translateX] = useState(new Animated.Value(-sidebarWidth));
  const [backdropOpacity] = useState(new Animated.Value(0));
  const [foldersOpen, setFoldersOpen] = useState(true);

  // Use controlled state if provided
  const [localOrderBy, setLocalOrderBy] = useState<OrderByOption>(orderBy);
  const [localOrderDirection, setLocalOrderDirection] = useState<
    "asc" | "desc"
  >(orderDirection);
  useEffect(() => {
    setLocalOrderBy(orderBy ?? OrderByOption.AddedAt);
  }, [orderBy]);
  useEffect(() => {
    setLocalOrderDirection(orderDirection);
  }, [orderDirection]);

  // Order options
  const orderOptions = [
    ...Object.entries(POST_ORDER_BY_LABELS).map(([key, label]) => ({
      key: key as OrderByOption,
      label: label as string,
    })),
  ];

  // slide + fade animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: isOpen ? 0 : -sidebarWidth,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: isOpen ? 0.5 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen, translateX, backdropOpacity, sidebarWidth]);

  const toggleFolders = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFoldersOpen((o) => !o);
  };

  const confirmDelete = (id: number) => {
    Alert.alert(
      "Delete Folder?",
      "Deleting a folder won't delete the bookmarks in it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDeleteFolder && onDeleteFolder(id);
            if (onSelectedFoldersChange) {
              const newSelected = selectedFolders.filter((fid) => fid !== id);
              onSelectedFoldersChange(newSelected);
              onSelect(newSelected.length === 0 ? [] : newSelected);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const styles = useMemo(
    () => makeStyles(palette, fontSizes),
    [palette, fontSizes],
  );

  if (!isOpen) return null;

  // Segmented control component
  const SegmentedControl = ({
    value,
    onChange,
    scale = 0.9,
    order = ["all", "yes", "no"] as ("all" | "yes" | "no")[],
  }: {
    value: "all" | "yes" | "no";
    onChange: (v: "all" | "yes" | "no") => void;
    scale?: number;
    order?: ("all" | "yes" | "no")[];
  }) => (
    <View
      style={[
        styles.segmentedContainer,
        { transform: [{ scale }], opacity: value === order[0] ? 0.5 : 1 },
      ]}
    >
      {order.map((option) => (
        <TouchableOpacity
          key={option}
          style={[styles.segment, value === option && styles.segmentActive]}
          onPress={() => onChange(option)}
        >
          <Text
            style={[
              styles.segmentLabel,
              value === option && styles.segmentLabelActive,
            ]}
          >
            {option === "all" ? "All" : option === "yes" ? "Yes" : "No"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        />
      </TouchableWithoutFeedback>

      {/* Sidebar */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            width: sidebarWidth,
            transform: [{ translateX }],
            paddingTop: insets.top,
            backgroundColor: palette.background,
          },
        ]}
      >
        <View style={styles.container}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Home */}
            <TouchableOpacity
              style={[styles.item, { paddingTop: 20 }]}
              onPress={() => {
                onSelect("home");
                onClose();
              }}
            >
              <View style={styles.iconContainer}>
                <Icon
                  name="home"
                  size={24}
                  style={styles.icon}
                  color={palette.foreground}
                />
              </View>
              <Text style={[styles.label, { fontSize: fontSizes.body * 1.15 }]}>
                Home
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                onSelect("semantic-search");
                onClose();
              }}
            >
              <View style={styles.iconContainer}>
                <Icon
                  name="manage-search"
                  size={24}
                  style={styles.icon}
                  color={palette.foreground}
                />
              </View>
              <Text style={styles.label}>Semantic Search</Text>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
            </View>

            {/* Search */}
            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                onSelect("search");
                onClose();
              }}
            >
              <View style={styles.iconContainer}>
                <Icon
                  name="search"
                  size={24}
                  style={styles.icon}
                  color={palette.foreground}
                />
              </View>
              <Text style={styles.label}>Search</Text>
            </TouchableOpacity>

            {/* Favorites segmented control */}
            <View style={styles.filterRow}>
              <View style={{ flexDirection: "row" }}>
                <View style={styles.iconContainer}>
                  <Icon
                    name="favorite"
                    size={20}
                    color={palette.foreground}
                    style={styles.icon}
                  />
                </View>
                <Text style={styles.filterLabel}>Favorites:</Text>
              </View>
              <SegmentedControl
                value={favouritesFilter}
                onChange={onFavouritesFilterChange}
              />
            </View>

            {/* Read segmented control */}
            <View style={styles.filterRow}>
              <View style={{ flexDirection: "row" }}>
                <View style={styles.iconContainer}>
                  <Icon
                    name="markunread"
                    size={20}
                    color={palette.foreground}
                    style={styles.icon}
                  />
                </View>
                <Text style={styles.filterLabel}>Read:</Text>
              </View>
              <SegmentedControl
                value={readFilter}
                onChange={onReadFilterChange}
              />
            </View>

            {/* Order By row */}
            <OrderByRow
              orderOptions={orderOptions}
              localOrderBy={localOrderBy}
              localOrderDirection={localOrderDirection}
              onOrderByChange={(val) => {
                setLocalOrderBy(val);
                if (onOrderByChange) onOrderByChange(val);
              }}
              onOrderDirectionChange={(val) => {
                setLocalOrderDirection(val);
                if (onOrderDirectionChange) onOrderDirectionChange(val);
              }}
              onRandomReseed={onRandomReseed}
            />
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
            </View>

            {/* Highlights */}
            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                onSelect("highlights");
                onClose();
              }}
            >
              <View style={styles.iconContainer}>
                <Icon
                  name="highlight"
                  size={24}
                  style={styles.icon}
                  color={palette.foreground}
                />
              </View>
              <Text style={styles.label}>Highlights</Text>
            </TouchableOpacity>

            {/* Authors */}
            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                onSelect("authors");
                onClose();
              }}
            >
              <View style={styles.iconContainer}>
                <Icon
                  name="people"
                  size={24}
                  style={styles.icon}
                  color={palette.foreground}
                />
              </View>
              <Text style={styles.label}>Authors</Text>
            </TouchableOpacity>

            {/* Queue toggle button */}
            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                let next: "all" | "yes" | "no";
                if (queuedFilter === "all") next = "yes";
                else if (queuedFilter === "yes") next = "no";
                else next = "all";
                onQueuedFilterChange(next);
              }}
            >
              <View style={styles.iconContainer}>
                <Icon
                  name="queue"
                  size={24}
                  style={styles.icon}
                  color={palette.foreground}
                />
              </View>
              <Text style={styles.label}>
                Queue{" "}
                {queuedFilter === "yes"
                  ? "(Yes)"
                  : queuedFilter === "no"
                    ? "(No)"
                    : ""}
              </Text>
            </TouchableOpacity>

            {/* Archived toggle button */}
            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                let next: "all" | "yes" | "no";
                if (archivedFilter === "yes") next = "all";
                else if (archivedFilter === "all") next = "no";
                else next = "yes";
                onArchivedFilterChange(next);
                onSelect("archived");
                onClose();
              }}
            >
              <View style={styles.iconContainer}>
                <Icon
                  name="archive"
                  size={24}
                  style={styles.icon}
                  color={palette.foreground}
                />
              </View>
              <Text style={styles.label}>
                Archived{" "}
                {archivedFilter === "yes"
                  ? "(Yes)"
                  : archivedFilter === "all"
                    ? "(All)"
                    : ""}
              </Text>
            </TouchableOpacity>

            {/* Folders expandable */}
            <TouchableOpacity style={styles.item} onPress={toggleFolders}>
              <View style={styles.iconContainer}>
                <Icon
                  name="folder"
                  size={24}
                  style={styles.icon}
                  color={palette.foreground}
                />
              </View>
              <Text style={styles.label}>Folders</Text>
              <Icon
                name={foldersOpen ? "expand-less" : "expand-more"}
                size={24}
                style={styles.expandIcon}
                color={palette.foreground}
              />
            </TouchableOpacity>
            {foldersOpen &&
              folders.map((item) => {
                const isSelected = selectedFolders.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id.toString()}
                    style={[
                      styles.folderItem,
                      isSelected && {
                        backgroundColor: palette.backgroundMidLight,
                      },
                    ]}
                    onLongPress={() => confirmDelete(item.id)}
                    onPress={() => {
                      let newSelected: number[];
                      if (isSelected) {
                        newSelected = selectedFolders.filter(
                          (id) => id !== item.id,
                        );
                      } else {
                        newSelected = [...selectedFolders, item.id];
                      }
                      if (onSelectedFoldersChange)
                        onSelectedFoldersChange(newSelected);
                      onSelect(newSelected.length === 0 ? [] : newSelected);
                    }}
                  >
                    <View style={styles.folderContent}>
                      <Text
                        style={[
                          styles.folderLabel,
                          isSelected && { fontWeight: "bold" },
                        ]}
                      >
                        {item.name}
                      </Text>
                      <View>
                        <Text style={[styles.folderCount, { opacity: 0.5 }]}>
                          {item.folderPostIds.length}
                        </Text>
                      </View>
                      <Text style={styles.folderCount}>
                        {/* {isSelected ? "" : ""} */}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            {/* Big bottom padding to give scroll breathing room */}
            <View style={{ height: spacing.xl * 2 }} />
          </ScrollView>

          {/* Fixed bottom bar: Settings | Dark mode | Text size */}
          <View
            style={[
              styles.bottomBar,
              {
                borderTopColor: palette.border,
                paddingBottom: insets.bottom || spacing.s,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.bottomItem}
              onPress={() => {
                onSelect("settings");
                onClose();
              }}
            >
              <Icon name="settings" size={24} color={palette.foreground} />
              <Text style={styles.bottomLabel}>Settings</Text>
            </TouchableOpacity>

            <View style={styles.bottomRight}>
              <TouchableOpacity
                style={styles.bottomIconBtn}
                onPress={toggleDarkMode}
                accessibilityLabel="Toggle dark mode"
              >
                <Ionicons
                  name={isDarkMode ? "sunny" : "moon"}
                  size={isDarkMode ? 22 : 18}
                  color={palette.foreground}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    </>
  );
};

function makeStyles(
  palette: ThemeContextValue["palette"],
  fontSizes: ThemeContextValue["fontSizes"],
) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "#000",
      zIndex: 100,
    },
    sidebar: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 101,
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowOffset: { width: 3, height: 0 },
      shadowRadius: 5,
      elevation: 10,
    },
    container: {
      flex: 1,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
    },
    scrollContent: {
      paddingBottom: spacing.m,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.s,
    },
    icon: {
      marginRight: spacing.s,
    },
    iconContainer: {
      width: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: palette.foreground,
    },
    expandIcon: {
      marginLeft: "auto",
      opacity: 0.2,
    },
    folderItem: {
      paddingVertical: spacing.s / 2,
      paddingLeft: spacing.l,
    },
    folderContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    folderLabel: {
      fontSize: fontSizes.body,
      color: palette.foreground,
      flex: 1,
    },
    folderCount: {
      width: 16,
      fontSize: fontSizes.body,
      color: palette.foregroundMidLight,
      marginLeft: spacing.s,
    },
    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 4,
      justifyContent: "space-between",
    },
    filterLabel: {
      fontSize: fontSizes.body,
      color: palette.foreground,
      marginRight: 8,
      fontWeight: fontWeights.medium,
    },
    dividerContainer: {
      marginVertical: spacing.m,
      justifyContent: "center",
      alignItems: "center",
    },
    dividerLine: {
      height: 1,
      width: "100%",
      backgroundColor: palette.border,
    },
    segmentedContainer: {
      flexDirection: "row",
      backgroundColor: palette.backgroundMidLight,
      borderRadius: 8,
      overflow: "hidden",
      marginLeft: 8,
    },
    segment: {
      paddingVertical: 3,
      paddingHorizontal: 12,
      backgroundColor: palette.backgroundMidLight,
      minWidth: 48,
      alignItems: "center",
    },
    segmentActive: {
      backgroundColor: palette.border,
    },
    segmentLabel: {
      fontSize: fontSizes.body,
      color: palette.foreground,
    },
    segmentLabelActive: {
      fontWeight: fontWeights.bold,
    },
    bottomBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      paddingTop: spacing.s,
      marginHorizontal: -spacing.m,
      paddingHorizontal: spacing.m,
    },
    bottomItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.s,
    },
    bottomLabel: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: palette.foreground,
      marginLeft: spacing.s,
    },
    bottomRight: {
      flexDirection: "row",
      alignItems: "center",
    },
    bottomIconBtn: {
      padding: spacing.s,
      marginLeft: spacing.xs,
    },
  });
}
