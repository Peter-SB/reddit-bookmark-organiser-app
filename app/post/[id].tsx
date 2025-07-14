import { Sidebar } from "@/components/Sidebar";
import { StarRating } from "@/components/StarRating";
import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import { usePosts } from "@/hooks/usePosts";
import { Post } from "@/models/models";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const { width: screenWidth } = Dimensions.get("window");

export default function PostScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // grab everything from our hook
  const {
    posts,
    loading,
    updatePost: savePost,
    toggleRead,
    toggleFavorite,
    deletePost,
  } = usePosts();

  const [post, setPost] = useState<Post | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [editedNotes, setEditedNotes] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  // Animation values
  const slideAnim = useState(new Animated.Value(screenWidth))[0];
  const sidebarWidth = screenWidth * 0.8;
  const sidebarAnim = useState(new Animated.Value(sidebarWidth))[0];
  const [overlayOpacity] = useState(new Animated.Value(0));

  const hasUnsavedChanges = () => {
    if (!post) return false;
    const originalTitle = post.customTitle ?? post.title;
    const originalBody = post.customBody ?? post.bodyText;
    const originalNotes = post.notes ?? "";
    return (
      editedTitle !== originalTitle ||
      editedBody !== originalBody ||
      editedNotes !== originalNotes
    );
  };

  // animates out then goes back
  const animateAndGoBack = () => {
    Animated.timing(slideAnim, {
      toValue: screenWidth,
      duration: 150,
      useNativeDriver: true,
    }).start(() => router.back());
  };

  const handleBack = () => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved edits. What would you like to do?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => animateAndGoBack(),
          },
          {
            text: "Save",
            onPress: async () => {
              await handleSave();
              animateAndGoBack();
            },
          },
        ],
        { cancelable: true }
      );
    } else {
      animateAndGoBack();
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );
    return () => subscription.remove();
  }, [editedTitle, editedBody, editedNotes, post]);

  // when posts load (or ID changes), find our post
  useEffect(() => {
    if (id && !loading) {
      const found = posts.find((p) => p.id === parseInt(id, 10));
      if (found) {
        setPost(found);
        setEditedTitle(found.customTitle ?? found.title);
        setEditedBody(found.customBody ?? found.bodyText);
        setEditedNotes(found.notes ?? "");
      }
    }
  }, [id, posts, loading]);

  // slide in
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  // guard while we load
  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : (
          <Text style={styles.errorText}>Post not found</Text>
        )}
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    const updated: Post = {
      ...post,
      customTitle: editedTitle, // !== post.title ? editedTitle : post.customTitle,
      customBody: editedBody, // !== post.bodyText ? editedBody : post.customBody,
      notes: editedNotes,
    };
    await savePost(updated);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await deletePost(post.id);
    handleBack();
  };

  const handleSetRating = async (rating: number) => {
    await savePost({ ...post, rating });
  };

  const handleToggleRead = async () => {
    await toggleRead(post.id);
  };

  const handleToggleFavorite = async () => {
    await toggleFavorite(post.id);
  };

  const toggleSidebar = () => {
    const dur = 150;
    if (!sidebarOpen) {
      setSidebarVisible(true);
      setSidebarOpen(true);
      Animated.parallel([
        Animated.timing(sidebarAnim, {
          toValue: 0,
          duration: dur,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: dur,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      setSidebarOpen(false);
      Animated.parallel([
        Animated.timing(sidebarAnim, {
          toValue: sidebarWidth,
          duration: dur,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: dur,
          useNativeDriver: true,
        }),
      ]).start(() => setSidebarVisible(false));
    }
  };

  const formatDate = (dt: Date) =>
    dt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatRedditUser = (u: string) => (u.startsWith("u/") ? u : `u/${u}`);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[styles.mainContent, { transform: [{ translateX: slideAnim }] }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons
              name="chevron-back"
              size={24}
              color={palette.foreground}
            />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={toggleSidebar}
              style={styles.actionButton}
            >
              <Ionicons name="menu" size={24} color={palette.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setIsEditing((e) => !e);
              }}
              style={styles.actionButton}
            >
              <Ionicons
                name={isEditing ? "checkmark" : "create"}
                size={24}
                color={palette.accent}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
          {/* Title */}
          <View style={styles.titleSection}>
            {isEditing ? (
              <TextInput
                style={styles.title}
                value={editedTitle}
                onChangeText={setEditedTitle}
                multiline
                placeholder="Post title..."
              />
            ) : (
              <Text style={styles.title}>{editedTitle}</Text>
            )}
            <View style={styles.metadata}>
              <Text style={styles.metadataText}>
                {formatDate(post.redditCreatedAt)}
              </Text>
              <Text style={styles.separator}>•</Text>
              <TouchableOpacity>
                <Text style={[styles.metadataText, styles.userLink]}>
                  {formatRedditUser(post.author)}
                </Text>
              </TouchableOpacity>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.metadataText}>r/{post.subreddit}</Text>
            </View>

            {/* Rating & Read */}
            <View style={styles.ratingSection}>
              <StarRating
                rating={post.rating || 0}
                onRate={handleSetRating}
                size={18}
              />
              <TouchableOpacity
                onPress={handleToggleRead}
                style={styles.readToggle}
              >
                <Ionicons
                  name={
                    post.isRead
                      ? "checkmark-circle"
                      : "checkmark-circle-outline"
                  }
                  size={20}
                  color={post.isRead ? palette.accent : palette.muted}
                />
                <Text style={styles.readText}>
                  {post.isRead ? "Read" : "Unread"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleToggleFavorite}
                style={styles.readToggle}
              >
                <Ionicons
                  name={post.isFavorite ? "heart" : "heart-outline"}
                  size={20}
                  color={post.isFavorite ? palette.favHeartRed : palette.muted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Body */}
          <View style={styles.bodySection}>
            {isEditing ? (
              <TextInput
                style={styles.body}
                value={editedBody}
                onChangeText={setEditedBody}
                multiline
                placeholder="Post content..."
                textAlignVertical="top"
              />
            ) : (
              <Text style={styles.body}>{editedBody}</Text>
            )}
          </View>

          {/* Notes */}
          {isEditing && (
            <View style={styles.notesSection}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <TextInput
                style={styles.notesInput}
                value={editedNotes}
                onChangeText={setEditedNotes}
                multiline
                placeholder="Add your notes..."
                textAlignVertical="top"
              />
            </View>
          )}

          {/* Save / Delete */}
          {isEditing && (
            <View style={styles.actionSection}>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
              >
                <Text style={styles.deleteButtonText}>Delete Post</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Sidebar overlay & Sidebar extracted to component */}
      <Sidebar
        sidebarAnim={sidebarAnim}
        sidebarWidth={sidebarWidth}
        insets={insets}
        overlayOpacity={overlayOpacity}
        sidebarOpen={sidebarOpen}
        sidebarVisible={sidebarVisible}
        toggleSidebar={toggleSidebar}
        post={post}
        editedNotes={editedNotes}
        setEditedNotes={setEditedNotes}
        formatDate={formatDate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  mainContent: {
    flex: 1,
    zIndex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backButton: {
    padding: spacing.s,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.s,
  },
  actionButton: {
    padding: spacing.s,
  },
  content: {
    flex: 1,
  },
  titleSection: {
    padding: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  title: {
    fontSize: fontSizes.xlarge,
    fontWeight: fontWeights.bold,
    color: palette.foreground,
    marginBottom: spacing.s,
  },
  metadata: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.m,
  },
  metadataText: {
    fontSize: fontSizes.body * 0.9,
    color: palette.muted,
  },
  separator: {
    fontSize: fontSizes.body,
    color: palette.muted,
    marginHorizontal: spacing.xs,
  },
  userLink: {
    color: palette.accent,
  },
  ratingSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  readToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  readText: {
    fontSize: fontSizes.body,
    color: palette.muted,
  },
  bodySection: {
    padding: spacing.m,
  },
  body: {
    fontSize: fontSizes.body,
    lineHeight: 24,
    color: palette.foreground,
  },
  notesSection: {
    padding: spacing.m,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  sectionTitle: {
    fontSize: fontSizes.large,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
    marginBottom: spacing.s,
  },
  notesInput: {
    fontSize: fontSizes.body,
    color: palette.foreground,
    padding: spacing.s,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    minHeight: 100,
  },
  actionSection: {
    padding: spacing.m,
    gap: spacing.m,
  },
  saveButton: {
    backgroundColor: palette.accent,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    color: palette.background,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  deleteButton: {
    backgroundColor: "transparent",
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  deleteButtonText: {
    color: "#FF3B30",
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  errorText: {
    fontSize: fontSizes.body,
    color: palette.muted,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
