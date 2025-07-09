import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
// import { useRedditAuth } from "@/hooks/useRedditAuth";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  // const { login, accessToken, loading } = useRedditAuth()

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={router.back} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={palette.foreground} />
        </TouchableOpacity>
        <View style={styles.header}>
          <Ionicons name="settings-outline" size={32} color={palette.accent} />
          <Text style={styles.title}>Settings</Text>
        </View>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* Login Button
        <View style={styles.section}>
          <Button
            title={
              accessToken
                ? "Logged In"
                : loading
                ? "Logging in..."
                : "Sign in with Reddit"
            }
            onPress={login}
            disabled={!!accessToken || loading}
            color={palette.accent}
          />
        </View> */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Reddit Bookmark Manager</Text>
            <Text style={styles.cardText}>
              A simple app to save and organize your favorite Reddit posts. Add
              posts by pasting Reddit URLs, rate them, and mark them as read.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons
                name="bookmark-outline"
                size={20}
                color={palette.accent}
              />
              <Text style={styles.featureText}>
                Save Reddit posts with URLs
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="star-outline" size={20} color={palette.accent} />
              <Text style={styles.featureText}>Rate posts from 0-5 stars</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={palette.accent}
              />
              <Text style={styles.featureText}>Mark posts as read/unread</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons
                name="server-outline"
                size={20}
                color={palette.accent}
              />
              <Text style={styles.featureText}>Local SQLite storage</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Version Info</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>
              POC Version 1.0.0{"\n"}
              Built with Expo & React Native{"\n"}
              Data stored locally on device
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.l,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.m,
    paddingTop: spacing.m,
    paddingBottom: spacing.l,
  },
  title: {
    fontSize: fontSizes.xlarge,
    fontWeight: fontWeights.bold,
    color: palette.foreground,
    marginLeft: spacing.m,
  },
  section: {
    marginBottom: spacing.l,
  },
  sectionTitle: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
    paddingHorizontal: spacing.m,
    marginBottom: spacing.m,
  },
  card: {
    backgroundColor: palette.background,
    borderRadius: 12,
    padding: spacing.m,
    marginHorizontal: spacing.m,
    shadowColor: palette.cardShadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardTitle: {
    fontSize: fontSizes.title,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
    marginBottom: spacing.s,
  },
  cardText: {
    fontSize: fontSizes.body,
    color: palette.muted,
    lineHeight: 20,
  },
  featureList: {
    paddingHorizontal: spacing.m,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.m,
  },
  featureText: {
    fontSize: fontSizes.body,
    color: palette.foreground,
    marginLeft: spacing.m,
    flex: 1,
  },
  backButton: {
    padding: spacing.s,
  },
});
