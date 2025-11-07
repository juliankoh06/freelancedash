import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase-config';
import ReminderSettings, { DEFAULT_REMINDER_CONFIG } from '../models/ReminderSettings';

class ReminderSettingsService {
  constructor() {
    this.collectionName = 'reminder_settings';
  }

  // Get reminder settings for a user
  async getUserSettings(userId) {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('projectId', '==', null)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Return default settings if none exist
        return new ReminderSettings({
          userId,
          ...DEFAULT_REMINDER_CONFIG
        });
      }
      
      return ReminderSettings.fromFirebase(snapshot.docs[0]);
    } catch (error) {
      console.error('Error fetching reminder settings:', error);
      throw error;
    }
  }

  // Get reminder settings for a specific project
  async getProjectSettings(userId, projectId) {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('projectId', '==', projectId)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Fall back to user's global settings
        return await this.getUserSettings(userId);
      }
      
      return ReminderSettings.fromFirebase(snapshot.docs[0]);
    } catch (error) {
      console.error('Error fetching project reminder settings:', error);
      throw error;
    }
  }

  // Save or update reminder settings
  async saveSettings(settings) {
    try {
      const validation = settings.validate();
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      if (settings.id) {
        // Update existing settings
        const docRef = doc(db, this.collectionName, settings.id);
        await updateDoc(docRef, settings.toFirebase());
        console.log('✅ Reminder settings updated:', settings.id);
        return { success: true, id: settings.id };
      } else {
        // Create new settings
        const docRef = await addDoc(collection(db, this.collectionName), settings.toFirebase());
        console.log('✅ Reminder settings created:', docRef.id);
        return { success: true, id: docRef.id };
      }
    } catch (error) {
      console.error('❌ Error saving reminder settings:', error);
      throw error;
    }
  }

  // Delete reminder settings
  async deleteSettings(settingsId) {
    try {
      await deleteDoc(doc(db, this.collectionName, settingsId));
      console.log('✅ Reminder settings deleted:', settingsId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting reminder settings:', error);
      throw error;
    }
  }

  // Toggle reminder enabled/disabled
  async toggleEnabled(settingsId, enabled) {
    try {
      const docRef = doc(db, this.collectionName, settingsId);
      await updateDoc(docRef, { 
        enabled,
        updatedAt: new Date()
      });
      console.log(`✅ Reminders ${enabled ? 'enabled' : 'disabled'}:`, settingsId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error toggling reminder settings:', error);
      throw error;
    }
  }

  // Get all active reminder settings (for backend processing)
  async getAllActiveSettings() {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('enabled', '==', true)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ReminderSettings.fromFirebase(doc));
    } catch (error) {
      console.error('Error fetching active reminder settings:', error);
      throw error;
    }
  }

  // Initialize default settings for a user if they don't exist
  async initializeDefaultSettings(userId) {
    try {
      // Check if settings already exist
      const existing = await this.getUserSettings(userId);
      if (existing.id) {
        return existing;
      }

      // Create default settings
      const defaultSettings = new ReminderSettings({
        userId,
        ...DEFAULT_REMINDER_CONFIG
      });

      const result = await this.saveSettings(defaultSettings);
      defaultSettings.id = result.id;
      
      console.log('✅ Default reminder settings initialized for user:', userId);
      return defaultSettings;
    } catch (error) {
      console.error('❌ Error initializing default settings:', error);
      throw error;
    }
  }
}

const reminderSettingsService = new ReminderSettingsService();
export default reminderSettingsService;
