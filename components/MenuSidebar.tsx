import React, { useEffect, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import { Folder } from "@/models/models";

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
  onFavouritesFilterChange: (val: "all" | "yes" | "no") => void;
  onReadFilterChange: (val: "all" | "yes" | "no") => void;
  selectedFolders?: number[];
  onSelectedFoldersChange?: (ids: number[]) => void;
  onDeleteFolder?: (id: number) => void;
}

export const MenuSidebar: React.FC<MenuSidebarProps> = ({
  isOpen,
  onClose,
  onSelect,
  folders,
  favouritesFilter,
  readFilter,
  onFavouritesFilterChange,
  onReadFilterChange,
  selectedFolders = [],
  onSelectedFoldersChange,
  onDeleteFolder,
}) => {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get("window").width;
  const sidebarWidth = screenWidth * 0.8;

  const [translateX] = useState(new Animated.Value(-sidebarWidth));
  const [backdropOpacity] = useState(new Animated.Value(0));
  const [foldersOpen, setFoldersOpen] = useState(true);

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
    // animate expand/collapse
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
      { cancelable: true }
    );
  };

  if (!isOpen) return null;

  // Segmented control component
  const SegmentedControl = ({
    value,
    onChange,
    scale = 0.9,
  }: {
    value: "all" | "yes" | "no";
    onChange: (v: "all" | "yes" | "no") => void;
    scale?: number;
  }) => (
    <View
      style={[
        styles.segmentedContainer,
        { transform: [{ scale }], opacity: value === "all" ? 0.5 : 1 },
      ]}
    >
      {(["all", "yes", "no"] as const).map((option) => (
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
          },
        ]}
      >
        <SafeAreaView style={styles.container}>
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

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
          </View>

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
          {foldersOpen && (
            <FlatList
              data={folders}
              keyExtractor={(f) => f.id.toString()}
              renderItem={({ item }) => {
                const isSelected = selectedFolders.includes(item.id);
                return (
                  <TouchableOpacity
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
                          (id) => id !== item.id
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
              }}
            />
          )}
          {/* Spacer to push settings to bottom, accounting for navigation bar */}
          <View style={{ flex: 1 }} />
          <View style={{ paddingBottom: insets.bottom }}>
            <TouchableOpacity
              style={[styles.item]}
              onPress={() => {
                onSelect("settings");
                onClose();
              }}
            >
              <View style={styles.iconContainer}>
                <Icon
                  name="settings"
                  size={24}
                  style={styles.icon}
                  color={palette.foreground}
                />
              </View>
              <Text style={styles.label}>Settings</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: palette.background,
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
    justifyContent: "space-between", // align icon+label left, segment right
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
    // remove marginLeft if not needed
  },
  segment: {
    paddingVertical: 3,
    paddingHorizontal: 12,
    backgroundColor: palette.backgroundMidLight,
    minWidth: 48, // Ensure consistent width for each segment
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
});
