import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import { Post } from "@/models/models";
import {
  openRedditPost,
  openRedditSubreddit,
  openRedditUser,
} from "@/utils/redditLinks";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FolderSelector } from "./FolderSelector";

interface SidebarProps {
  sidebarAnim: Animated.Value;
  sidebarWidth: number;
  insets: { top: number };
  overlayOpacity: Animated.Value;
  sidebarOpen: boolean;
  sidebarVisible: boolean;
  toggleSidebar: () => void;
  post: Post;
  editedNotes: string;
  setEditedNotes: (notes: string) => void;
  formatDate: (dt: Date) => string;
  setFolders: (postId: number, folderIds: number[]) => Promise<void>;
}

export const PostSidebar: React.FC<SidebarProps> = ({
  sidebarAnim,
  sidebarWidth,
  insets,
  overlayOpacity,
  sidebarOpen,
  sidebarVisible,
  toggleSidebar,
  post,
  editedNotes,
  setEditedNotes,
  formatDate,
  setFolders,
}) => {
  const [postFolderIds, setPostFolderIds] = useState<number[]>([]);

  const handleFolderChange = async (folderIds: number[]) => {
    console.debug("Updating folders for post:", post.id, "to", folderIds);
    setPostFolderIds(folderIds);
    await setFolders(post.id, folderIds);
  };

  useEffect(() => {
    if (post) {
      setPostFolderIds(post.folderIds);
    }
  }, [post]);

  if (!sidebarVisible) return null;

  return (
    <>
      {/* Sidebar overlay */}
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: overlayOpacity,
            pointerEvents: sidebarOpen ? "auto" : "none",
          },
        ]}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={toggleSidebar}
        />
      </Animated.View>
      {/* Sidebar */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{ translateX: sidebarAnim }],
            paddingTop: insets.top,
            width: sidebarWidth,
          },
        ]}
      >
        <View style={styles.sidebarHeaderNoBorder}>
          <Text style={styles.sidebarTitle}>Details</Text>
          <TouchableOpacity onPress={toggleSidebar}>
            <Ionicons name="close" size={24} color={palette.foreground} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.sidebarContent}>
          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarText}>Bookmark #{post.id}</Text>
          </View>

          {/* Notes */}
          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarSectionTitle}>Notes</Text>
            <TextInput
              style={styles.sidebarText}
              value={editedNotes}
              onChangeText={setEditedNotes}
              multiline
              placeholder="Add your notes..."
              textAlignVertical="top"
            />
          </View>
          {/* Post Info */}
          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarSectionTitle}>Post Info</Text>
            <Text style={styles.sidebarText}>
              Post:{" "}
              <Text
                style={{
                  color: palette.accent,
                  textDecorationLine: "underline",
                }}
                onPress={() => post.url && openRedditPost(post.url)}
              >
                Link
              </Text>
            </Text>
            <Text style={styles.sidebarText}>
              User:{" "}
              <Text
                style={{
                  color: palette.accent,
                  textDecorationLine: "underline",
                }}
                onPress={() => openRedditUser(post.author)}
              >
                u/{post.author || "Unknown"}
              </Text>
            </Text>
            <Text style={styles.sidebarText}>
              Subreddit:{" "}
              <Text
                style={{
                  color: palette.accent,
                  textDecorationLine: "underline",
                }}
                onPress={() => openRedditSubreddit(post.subreddit)}
              >
                r/{post.subreddit}
              </Text>
            </Text>
            <Text style={styles.sidebarText}>
              Added: {formatDate(post.addedAt)}
            </Text>
            <Text style={styles.sidebarText}>
              Posted: {formatDate(post.redditCreatedAt)}
            </Text>
            <Text style={styles.sidebarText}>
              Word count:{" "}
              {
                (post.customBody ?? post.bodyText ?? "")
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean).length
              }
            </Text>
          </View>

          {/* Folder */}
          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarSectionTitle}>Folder</Text>
            <FolderSelector
              postId={post?.id || 0}
              selectedFolderIds={postFolderIds}
              onFoldersChange={handleFolderChange}
            />
            {/* {postFolderIds.length == 0 && (
              <Text style={styles.sidebarText}>No folders selected</Text>
            )} */}
          </View>
        </ScrollView>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.background,
    borderLeftWidth: 1,
    borderLeftColor: palette.border,
    zIndex: 2,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.2)",
    zIndex: 1,
  },
  sidebarHeaderNoBorder: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.m,
  },
  sidebarTitle: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
  },
  sidebarContent: {
    flex: 1,
    padding: spacing.m,
  },
  sidebarSection: {
    marginBottom: spacing.l,
  },
  sidebarSectionTitle: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
    marginBottom: spacing.s,
  },
  sidebarText: {
    fontSize: fontSizes.body,
    color: palette.muted,
    lineHeight: 20,
    padding: 0,
  },
});
