import React, { useEffect, useState } from "react";
import {
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

interface MenuSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (key: string | number) => void;
  folders: Folder[];
}

export const MenuSidebar: React.FC<MenuSidebarProps> = ({
  isOpen,
  onClose,
  onSelect,
  folders,
}) => {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get("window").width;
  const sidebarWidth = screenWidth * 0.8;

  const [translateX] = useState(new Animated.Value(-sidebarWidth));
  const [backdropOpacity] = useState(new Animated.Value(0));
  const [foldersOpen, setFoldersOpen] = useState(false);

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
  }, [isOpen]);

  const toggleFolders = () => {
    // animate expand/collapse
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFoldersOpen((o) => !o);
  };

  // top‐level menu items
  const staticItems: { key: string; label: string; icon: string }[] = [
    { key: "home", label: "Home", icon: "home" },
    { key: "search", label: "Search", icon: "search" },
    { key: "tags", label: "Tags", icon: "label" },
    { key: "favorites", label: "Favorites", icon: "favorite" },
    { key: "unread", label: "Unread", icon: "markunread" },
    { key: "settings", label: "Settings", icon: "settings" },
  ];

  if (!isOpen) return null;

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
          {/* Static items up to Folders */}
          {staticItems.slice(0, 2).map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.item}
              onPress={() => {
                onSelect(item.key);
                onClose();
              }}
            >
              <Icon
                name={item.icon}
                size={24}
                style={styles.icon}
                color={palette.foreground}
              />
              <Text style={styles.label}>{item.label}</Text>
            </TouchableOpacity>
          ))}

          {/* Folders expandable */}
          <TouchableOpacity style={styles.item} onPress={toggleFolders}>
            <Icon
              name="folder"
              size={24}
              style={styles.icon}
              color={palette.foreground}
            />
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
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.folderItem}
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                >
                  <Text style={styles.folderLabel}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          )}

          {/* Remaining static items */}
          {staticItems.slice(2).map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.item}
              onPress={() => {
                onSelect(item.key);
                onClose();
              }}
            >
              <Icon
                name={item.icon}
                size={24}
                style={styles.icon}
                color={palette.foreground}
              />
              <Text style={styles.label}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </SafeAreaView>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 10,
  },
  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: palette.background,
    zIndex: 11,
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
  label: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
    color: palette.foreground,
  },
  expandIcon: {
    marginLeft: "auto",
  },
  folderItem: {
    paddingVertical: spacing.s / 2,
    paddingLeft: spacing.l,
  },
  folderLabel: {
    fontSize: fontSizes.body,
    color: palette.foreground,
  },
});
