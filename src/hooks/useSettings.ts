import { useEffect, useState, useCallback } from "react";
import { SettingsRepository, SettingKey, SettingValue, Settings } from "@/repository/SettingsRepository";

export function useSettings(keys: SettingKey[] = []) {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settingsObj = await SettingsRepository.getSettings(keys);
      setSettings(settingsObj);
    } catch (err: any) {
      setError(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [keys]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const setSetting = useCallback(async (key: SettingKey, value: SettingValue) => {
    setLoading(true);
    setError(null);
    try {
      await SettingsRepository.setSetting(key, value);
      setSettings((prev) => ({ ...prev, [key]: value }));
    } catch (err: any) {
      setError(err.message || "Failed to save setting");
    } finally {
      setLoading(false);
    }
  }, []);

  const removeSetting = useCallback(async (key: SettingKey) => {
    setLoading(true);
    setError(null);
    try {
      await SettingsRepository.removeSetting(key);
      setSettings((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    } catch (err: any) {
      setError(err.message || "Failed to remove setting");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    settings,
    loading,
    error,
    reload: loadSettings,
    setSetting,
    removeSetting,
  };
}