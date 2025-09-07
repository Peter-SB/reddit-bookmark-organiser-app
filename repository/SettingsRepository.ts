import { DatabaseService } from "@/services/DatabaseService";

export type SettingKey = string;
export type SettingValue = string;
export interface Settings {
  [key: string]: SettingValue;
}

export class SettingsRepository {
  static async getSettings(keys?: SettingKey[]): Promise<Settings> {
    const dbService = await DatabaseService.getInstance();
    const db = dbService.getDb();
    let result: any[] = [];
    if (keys && keys.length > 0) {
      const placeholders = keys.map(() => '?').join(',');
      result = await db.getAllAsync(
        `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
        keys
      );
    } else {
      result = await db.getAllAsync(`SELECT key, value FROM settings`);
    }
    const settingsObj: Settings = {};
    result.forEach((row: any) => {
      settingsObj[row.key] = row.value;
    });
    return settingsObj;
  }

  static async setSetting(key: SettingKey, value: SettingValue): Promise<void> {
    const dbService = await DatabaseService.getInstance();
    const db = dbService.getDb();
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [key, value]
    );
  }

  static async removeSetting(key: SettingKey): Promise<void> {
    const dbService = await DatabaseService.getInstance();
    const db = dbService.getDb();
    await db.runAsync(`DELETE FROM settings WHERE key = ?`, [key]);
  }
}
