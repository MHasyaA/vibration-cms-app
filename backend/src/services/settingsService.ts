import { db } from "../db/connection";
import { systemSettings } from "../db/schema";

export const DEFAULT_SETTINGS: Record<string, string> = {
  // 1. Card Kesehatan & Kapasitas
  bobotWarningAlarm: "5",
  bobotCriticalAlarm: "15",
  ambangKapasitasSistem: "5000000",
  
  // 2. Card Kepatuhan Standar ISO 10816
  pilihanKelasMesin: "Class I",
  batasBawahZoneB: "1.12",
  batasBawahZoneC: "2.80",
  batasBawahZoneD: "7.10",
  
  // 3. Card Deviasi Baseline & Deteksi Anomali
  jendelaWaktuBaseline: "7",
  toleransiDeviasiMaksimal: "20",
  sensitivitasDeteksiAnomali: "Medium",
  
  // 4. Card Estimasi Waktu Pemeliharaan
  dataPointsRegression: "14",
  thresholdKritisKegagalan: "7.10",
  batasPeringatanHari: "15",
  
  // 5. Card Top 3 Worst Performance
  metrikPengurutan: "alarmFrequency",
  rentangWaktuEvaluasi: "168", // 7 days in hours
};

export class SettingsService {
  async getSettings(): Promise<Record<string, string>> {
    try {
      const rows = await db.select().from(systemSettings);
      const settings: Record<string, string> = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      
      // Check if any keys are missing and fill them with defaults
      let missingKeys = false;
      for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
        if (settings[key] === undefined) {
          settings[key] = val;
          missingKeys = true;
        }
      }
      
      if (missingKeys) {
        // Run seed in the background to ensure missing values are persistent
        this.seedDefaultSettings().catch((err) => {
          console.error("[SettingsService] Error seeding missing keys:", err);
        });
      }
      
      return settings;
    } catch (error: any) {
      console.error("[SettingsService] Error in getSettings, returning defaults:", error.message);
      return { ...DEFAULT_SETTINGS };
    }
  }

  async updateSettings(newSettings: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(newSettings)) {
      // Upsert value
      await db
        .insert(systemSettings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value },
        });
    }
  }

  async seedDefaultSettings(): Promise<void> {
    try {
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        await db
          .insert(systemSettings)
          .values({ key, value })
          .onConflictDoNothing();
      }
      console.log("[SettingsService] Default settings seeded successfully.");
    } catch (error: any) {
      console.error("[SettingsService] Failed to seed default settings:", error.message);
    }
  }
}
