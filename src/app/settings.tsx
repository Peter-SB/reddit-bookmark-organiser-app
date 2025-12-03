import SettingsCredentialsManager from "@/components/SettingsCredentialsManager";
import SettingsDatabaseManager from "@/components/SettingsDatabaseManager";
import SettingsExportToJson from "@/components/SettingsExportToJson";
import SettingsSyncConfiguration from "@/components/SettingsSyncConfiguration";
import { palette } from "@/constants/Colors";
import { spacing } from "@/constants/spacing";
import { fontSizes, fontWeights } from "@/constants/typography";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutAnimation,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SettingsAiConfiguration from "@/components/SettingsAiConfiguration";
import Icon from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState({
    sync: true,
    credentials: false,
    ai: false,
    database: true,
    export: false,
  });
  const router = useRouter();

  useEffect(() => {
    // Simple loading state for initialization
    const timer = setTimeout(() => {
      setLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const toggleSection = (section: keyof typeof openSections) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const SettingsSection = ({
    title,
    icon,
    isOpen,
    onToggle,
    children,
  }: {
    title: string;
    icon: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
  }) => (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={onToggle}>
        <View style={styles.sectionHeaderContent}>
          <View style={styles.iconContainer}>
            <Icon name={icon as any} size={24} color={palette.foreground} />
          </View>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Icon
            name={isOpen ? "expand-less" : "expand-more"}
            size={24}
            color={palette.foregroundMidLight}
            style={styles.expandIcon}
          />
        </View>
      </TouchableOpacity>
      {isOpen && <View style={styles.sectionContent}>{children}</View>}
      {/* <View style={styles.divider} /> */}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={palette.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View
        style={[styles.header, { flexDirection: "row", alignItems: "center" }]}
      >
        <TouchableOpacity onPress={() => router.replace("/")}>
          <Icon name="arrow-back" size={28} color={palette.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <SettingsSection
          title="Database Management"
          icon="storage"
          isOpen={openSections.database}
          onToggle={() => toggleSection("database")}
        >
          <SettingsDatabaseManager />
        </SettingsSection>
      
        <SettingsSection
          title="Sync Server"
          icon="sync"
          isOpen={openSections.sync}
          onToggle={() => toggleSection("sync")}
        >
          <SettingsSyncConfiguration />
        </SettingsSection>

        <SettingsSection
          title="Reddit API Credentials"
          icon="vpn-key"
          isOpen={openSections.credentials}
          onToggle={() => toggleSection("credentials")}
        >
          <SettingsCredentialsManager />
        </SettingsSection>

        <SettingsSection
          title="AI Configuration"
          icon="smart-toy"
          isOpen={openSections.ai}
          onToggle={() => toggleSection("ai")}
        >
          <SettingsAiConfiguration />
        </SettingsSection>

        <SettingsSection
          title="Data Export"
          icon="file-download"
          isOpen={openSections.export}
          onToggle={() => toggleSection("export")}
        >
          <SettingsExportToJson />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: 0,
  },
  header: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.backgroundMidLight,
  },
  headerTitle: {
    fontSize: fontSizes.xlarge,
    fontWeight: fontWeights.semibold,
    color: palette.foreground,
    paddingLeft: spacing.m,
  },
  content: {
    padding: 0,
  },
  section: {
    // marginBottom: spacing.xs,
    marginHorizontal: 0,
    borderColor: palette.border,
    borderBottomWidth: 1,
  },
  sectionHeader: {},
  sectionHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.l,
    paddingHorizontal: spacing.m,
  },
  iconContainer: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.s,
  },
  sectionTitle: {
    fontSize: fontSizes.large,
    fontWeight: fontWeights.normal,
    color: palette.foreground,
    flex: 1,
  },
  expandIcon: {
    marginLeft: "auto",
  },
  sectionContent: {},
  divider: {
    height: spacing.s,
  },
});
