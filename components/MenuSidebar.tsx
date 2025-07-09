import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { PanGestureHandler } from "react-native-gesture-handler";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

export interface Folder {
  id: number;
  name: string;
  parentId?: number;
  createdAt: Date;
}

type MenuSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (key: string | number) => void;
  folders: Folder[];
};

const { width: screenWidth } = Dimensions.get("window");
const SIDEBAR_WIDTH = screenWidth * 0.8;

export const MenuSidebar: React.FC<MenuSidebarProps> = ({
  isOpen,
  onClose,
  onSelect,
  folders = null,
}) => {
  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [foldersOpen, setFoldersOpen] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: isOpen ? 0 : -SIDEBAR_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: isOpen ? 0.5 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen, translateX, backdropOpacity]);

  return (
    <>
      {isOpen && (
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[styles.backdrop, { opacity: backdropOpacity }]}
          />
        </TouchableWithoutFeedback>
      )}

      <PanGestureHandler
        onGestureEvent={({ nativeEvent }) => {
          // drag logic if desired
          if (nativeEvent.translationX < -SIDEBAR_WIDTH * 0.3) onClose();
        }}
      >
        <Animated.View
          style={[
            styles.container,
            { paddingTop: insets.top, transform: [{ translateX }] },
          ]}
        >
          <SafeAreaView>
            <FlatList
              data={[
                { key: "home", label: "Home", icon: "home" },
                { key: "folders", label: "Folders", icon: "folder" },
                { key: "tags", label: "Tags", icon: "label" },
                { key: "favorites", label: "Favorites", icon: "star" },
                { key: "unread", label: "Unread", icon: "mark-email-unread" },
                { key: "settings", label: "Settings", icon: "settings" },
              ]}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => {
                if (item.key === "folders") {
                  return (
                    <>
                      <TouchableOpacity
                        style={styles.item}
                        onPress={() => setFoldersOpen(!foldersOpen)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: foldersOpen }}
                      >
                        <Icon name={item.icon} size={24} />
                        <Text style={styles.label}>{item.label}</Text>
                        <Icon
                          name={foldersOpen ? "expand-less" : "expand-more"}
                          size={24}
                        />
                      </TouchableOpacity>
                      {foldersOpen &&
                        folders &&
                        folders.map((folder) => (
                          <TouchableOpacity
                            key={folder.id}
                            style={styles.subItem}
                            onPress={() => onSelect(folder.id)}
                          >
                            <Text style={styles.label}>{folder.name}</Text>
                          </TouchableOpacity>
                        ))}
                    </>
                  );
                }
                return (
                  <TouchableOpacity
                    style={styles.item}
                    onPress={() => onSelect(item.key)}
                    accessibilityRole="button"
                  >
                    <Icon name={item.icon} size={24} />
                    <Text style={styles.label}>{item.label}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </SafeAreaView>
        </Animated.View>
      </PanGestureHandler>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
  },
  container: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: "#fff",
    elevation: 5,
    zIndex: 1000,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  subItem: {
    paddingLeft: 48,
    paddingVertical: 8,
  },
  label: {
    marginLeft: 16,
    fontSize: 16,
  },
});
