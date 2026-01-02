import { PostSidebar } from "@/components/PostSidebar";
import PostSummary from "@/components/PostSummary";
import { ShareBookmarkButton } from "@/components/ShareBookmarkButton";
import { StarRating } from "@/components/StarRating";
import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import { fontOptions } from "@/constants/fontOptions";
import { usePosts } from "@/hooks/usePosts";
import { usePostSync } from "@/hooks/usePostSync";
import { Post } from "@/models/models";
import { SettingsRepository } from "@/repository/SettingsRepository";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
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

const FONT_INDEX_KEY = "preferredFontOptionIdx";

const { width: screenWidth } = Dimensions.get("window");

export default function PostScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    posts,
    loading,
    updatePost: savePost,
    deletePost,
    setFolders,
    toggleRead,
    toggleFavorite,
  } = usePosts();
  const { syncSinglePost } = usePostSync({ autoStart: false });

  const [post, setPost] = useState<Post | null>(null);

  const [isEditing, setIsEditing] = useState(true);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [editedNotes, setEditedNotes] = useState("");
  const [editedRating, setEditedRating] = useState<number | null>(null);
  const [editedIsRead, setEditedIsRead] = useState<boolean>(false);
  const [editedIsFavorite, setEditedIsFavorite] = useState<boolean>(false);
  const [editedSummary, setEditedSummary] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const slideAnim = useState(new Animated.Value(screenWidth))[0];
  const sidebarWidth = screenWidth * 0.8;
  const sidebarAnim = useState(new Animated.Value(sidebarWidth))[0];
  const [overlayOpacity] = useState(new Animated.Value(0));

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingInput, setRatingInput] = useState<string>("");

  const [fontOptionIdx, setFontOptionIdx] = useState(0);
  const [showAiSummary, setShowAiSummary] = useState(true);

  const hasUnsavedChanges = useCallback(() => {
    if (!post) return false;
    const originalTitle = post.customTitle ?? post.title;
    const originalBody = post.customBody ?? post.bodyText;
    const originalNotes = post.notes ?? "";
    return (
      editedTitle !== originalTitle ||
      editedBody !== originalBody ||
      editedNotes !== originalNotes ||
      (editedRating ?? undefined) !== post.rating ||
      editedIsRead !== post.isRead ||
      editedIsFavorite !== post.isFavorite ||
      editedSummary !== (post.summary || "")
    );
  }, [
    post,
    editedTitle,
    editedBody,
    editedNotes,
    editedRating,
    editedIsRead,
    editedIsFavorite,
    editedSummary,
  ]);
  // animates out then goes back
  const animateAndGoBack = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: screenWidth,
      duration: 150,
      useNativeDriver: true,
    }).start(() => router.back());
  }, [slideAnim, router]);

  const handleSave = useCallback(async () => {
    if (!post) return;
    const updated: Post = {
      ...post,
      customTitle: editedTitle,
      customBody: editedBody,
      notes: editedNotes,
      rating: editedRating ?? undefined,
      isRead: editedIsRead,
      isFavorite: editedIsFavorite,
      summary: editedSummary,
      updatedAt: new Date(),
    };
    const saved = await savePost(updated);
    await syncSinglePost(saved.id);
  }, [
    post,
    editedTitle,
    editedBody,
    editedNotes,
    editedRating,
    editedIsRead,
    editedIsFavorite,
    editedSummary,
    savePost,
    syncSinglePost,
  ]);

  const handleBack = useCallback(() => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved edits. What would you like to do?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              if (post) {
                setEditedTitle(post.customTitle ?? post.title);
                setEditedBody(post.customBody ?? post.bodyText);
                setEditedNotes(post.notes ?? "");
                setEditedSummary(post.summary || "");
              }
              animateAndGoBack();
            },
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
  }, [hasUnsavedChanges, animateAndGoBack, handleSave, post]);

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
  }, [editedTitle, editedBody, editedNotes, post, handleBack]);

  // when posts load (or ID changes), find our post
  useEffect(() => {
    if (id && !loading) {
      const found = posts.find((p) => p.id === parseInt(id, 10));
      if (!found) return;

      setPost(found);

      if (!hasUnsavedChanges()) {
        setEditedTitle(found.customTitle ?? found.title);
        setEditedBody(found.customBody ?? found.bodyText);
        setEditedNotes(found.notes ?? "");
        setEditedRating(found.rating ?? null);
        setEditedSummary(found.summary || "");
      }
      setEditedIsRead(found.isRead);
      setEditedIsFavorite(found.isFavorite);
    }
  }, [id, posts, loading, hasUnsavedChanges]);

  const currentFont = fontOptions[fontOptionIdx];

  const toggleFontOption = () => {
    setFontOptionIdx((idx) => (idx + 1) % fontOptions.length);
  };
  useEffect(() => {
    (async () => {
      try {
        const settings = await SettingsRepository.getSettings([
          "SHOW_AI_SUMMARY",
        ]);
        if (settings["SHOW_AI_SUMMARY"] !== undefined) {
          setShowAiSummary(settings["SHOW_AI_SUMMARY"] === "true");
        }
      } catch (err) {
        // fallback to true if error
        setShowAiSummary(true);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const storedIdx = await AsyncStorage.getItem(FONT_INDEX_KEY);
      if (storedIdx !== null) setFontOptionIdx(Number(storedIdx));
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(FONT_INDEX_KEY, String(fontOptionIdx));
  }, [fontOptionIdx]);

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

  const handleDelete = async () => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deletePost(post!.id);
            handleBack();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const openRatingModal = () => {
    setRatingInput(post?.rating != null ? post.rating.toFixed(1) : "");
    setRatingModalVisible(true);
  };

  const handleToggleRead = async () => {
    if (!post) return;
    await toggleRead(post.id);
    await syncSinglePost(post.id);
  };

  const handleToggleFavorite = async () => {
    if (!post) return;
    await toggleFavorite(post.id);
    await syncSinglePost(post.id);
  };

  const handleSetRating = async (rating: number | null) => {
    setEditedRating(rating); // Not saving instantly like read and fav because we want to allow user to cancel
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
          <View style={[styles.headerActions, { alignItems: "center" }]}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              hitSlop={1}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={palette.foreground}
              />
            </TouchableOpacity>
            {hasUnsavedChanges() && (
              <TouchableOpacity
                onPress={handleSave}
                style={styles.actionButton}
                hitSlop={1}
              >
                <Ionicons name="checkmark" size={22} color="green" />
              </TouchableOpacity>
            )}
            {hasUnsavedChanges() && (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    "Discard Changes",
                    "Are you sure you want to discard your unsaved changes?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Discard",
                        style: "destructive",
                        onPress: () => {
                          if (post) {
                            setEditedTitle(post.customTitle ?? post.title);
                            setEditedBody(post.customBody ?? post.bodyText);
                            setEditedNotes(post.notes ?? "");
                            setEditedSummary(post.summary || "");
                          }
                        },
                      },
                    ],
                    { cancelable: true }
                  );
                }}
                style={styles.actionButton}
                hitSlop={1}
              >
                <Ionicons name="close" size={22} color="#FF3B30" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                setIsEditing((e) => !e);
              }}
              style={styles.actionButton}
              hitSlop={1}
            >
              <Ionicons
                name={isEditing ? "lock-closed" : "create"}
                size={18}
                color={palette.foregroundLight}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.headerActions, { alignItems: "center" }]}>
            <TouchableOpacity
              onPress={toggleFontOption}
              style={styles.actionButton}
              hitSlop={1}
            >
              <MaterialCommunityIcons
                name="format-size"
                size={22}
                color={palette.foreground}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleSidebar}
              style={styles.actionButton}
            >
              <Ionicons name="menu" size={24} color={palette.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <KeyboardAvoidingView
          style={styles.contentWrapper}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
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
                <Text style={[styles.metadataText]}>
                  {formatRedditUser(post.author)}
                </Text>
                <Text style={styles.separator}>•</Text>
                <Text style={[styles.metadataText]}>r/{post.subreddit}</Text>
              </View>

              {/* Rating & Read */}
              <View style={styles.ratingSection}>
                <StarRating
                  rating={editedRating || 0}
                  onRate={openRatingModal}
                  size={16}
                />
                <TouchableOpacity
                  onPress={handleToggleRead}
                  style={styles.readToggle}
                >
                  <Ionicons
                    name={
                      editedIsRead
                        ? "checkmark-circle"
                        : "checkmark-circle-outline"
                    }
                    size={16}
                    color={editedIsRead ? palette.accent : palette.muted}
                  />
                  <Text style={styles.readText}>
                    {editedIsRead ? "Read" : "Unread"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleToggleFavorite}
                  style={styles.readToggle}
                >
                  <Ionicons
                    name={editedIsFavorite ? "heart" : "heart-outline"}
                    size={18}
                    color={
                      editedIsFavorite ? palette.favHeartRed : palette.muted
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
            {/* Summary */}
            {showAiSummary && (
              <View style={styles.summarySection}>
                <PostSummary
                  post={post}
                  onSave={setEditedSummary}
                  currentFont={currentFont}
                  editedSummary={editedSummary}
                  setEditedSummary={setEditedSummary}
                />
              </View>
            )}

            {/* Body */}
            <View style={styles.bodySection}>
              {isEditing ? (
                <TextInput
                  style={[styles.body, currentFont]}
                  value={editedBody}
                  onChangeText={setEditedBody}
                  multiline
                  placeholder="Post content..."
                  textAlignVertical="top"
                />
              ) : (
                <Text style={[styles.body, currentFont]}>{editedBody}</Text>
              )}
            </View>

            {/* Notes */}
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

            {/* Save / Delete */}
            <View style={styles.border}>
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.m,
                  justifyContent: "center",
                  paddingTop: spacing.m,
                }}
              >
                <TouchableOpacity
                  style={[styles.deleteButton, { flex: 1 }]}
                  onPress={handleDelete}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="trash"
                      size={24}
                      color="#FF3B30"
                      style={{ marginRight: spacing.xs }}
                    />
                    <Text style={styles.deleteButtonText}></Text>
                  </View>
                </TouchableOpacity>
                <ShareBookmarkButton title={editedTitle} body={editedBody} />
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { flex: 1, opacity: hasUnsavedChanges() ? 1 : 0.5 },
                  ]}
                  onPress={handleSave}
                  disabled={!hasUnsavedChanges()}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="save-outline"
                      size={24}
                      color={palette.saveGreen}
                      style={{ marginRight: spacing.xs }}
                    />
                    <Text style={styles.saveButtonText}></Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Sidebar overlay & Sidebar extracted to component */}
      <PostSidebar
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
        setFolders={setFolders}
      />
      <Modal
        transparent
        visible={ratingModalVisible}
        animationType="fade"
        onRequestClose={() => setRatingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Custom Rating</Text>
            <TextInput
              style={styles.modalInput}
              value={ratingInput}
              onChangeText={setRatingInput}
              keyboardType="decimal-pad"
              placeholder="0.0 – 5.0"
              maxLength={4} // e.g. "5.0"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setRatingModalVisible(false)}
                style={styles.modalButton}
              >
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  const v = parseFloat(ratingInput);
                  if (isNaN(v) || v < 0 || v > 5) {
                    Alert.alert(
                      "Invalid",
                      "Enter a number between 0.0 and 5.0"
                    );
                    return;
                  }
                  const rounded = Math.round(v * 10) / 10;
                  await handleSetRating(rounded);
                  setRatingModalVisible(false);
                }}
                style={styles.modalButton}
              >
                <Text>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  await handleSetRating(null);
                  setRatingModalVisible(false);
                }}
                style={styles.modalButton}
              >
                <Text>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginRight: spacing.s,
  },
  headerActions: {
    flexDirection: "row",
  },
  actionButton: {
    padding: spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  titleSection: {
    padding: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  summarySection: {
    padding: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  title: {
    fontSize: fontSizes.xlarge,
    fontWeight: fontWeights.bold,
    color: palette.foreground,
    marginBottom: spacing.s,
    padding: 0,
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
    padding: spacing.m - 4,
    paddingBottom: spacing.xxl,
  },
  body: {
    fontSize: fontSizes.small,
    lineHeight: 16,
    color: palette.foreground,
    padding: 0,
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
    backgroundColor: palette.background,
    minHeight: 50,
    padding: 0,
  },
  actionSection: {
    padding: spacing.m,
    gap: spacing.m,
  },
  saveButton: {
    backgroundColor: "transparent",
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    // borderWidth: 1,
    alignItems: "center",
  },
  saveButtonText: {
    color: palette.accent,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  deleteButton: {
    backgroundColor: "transparent",
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    alignItems: "center",
    // borderWidth: 1,
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
  border: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
});
