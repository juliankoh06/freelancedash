import React, { useState, useEffect } from 'react';
import { Bell, Clock, AlertTriangle, AlertCircle, X, Save, RefreshCw } from 'lucide-react';
import reminderSettingsService from '../services/reminderSettingsService';
import ReminderSettings from '../models/ReminderSettings';

const ReminderSettingsModal = ({ currentUser, onClose, onSave }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    enabled: true,
    beforeDueReminders: [7, 3, 1],
    overdueReminders: [1, 3, 7, 14, 30],
    sendWarningAt: 14,
    sendFinalNoticeAt: 30,
    customReminderMessage: '',
    customWarningMessage: '',
    customFinalNoticeMessage: '',
    ccFreelancer: false,
    pauseRemindersOnWeekends: false
  });

  useEffect(() => {
    loadSettings();
  }, [currentUser]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const userSettings = await reminderSettingsService.getUserSettings(currentUser.uid);
      setSettings(userSettings);
      setFormData({
        enabled: userSettings.enabled,
        beforeDueReminders: userSettings.beforeDueReminders,
        overdueReminders: userSettings.overdueReminders,
        sendWarningAt: userSettings.sendWarningAt,
        sendFinalNoticeAt: userSettings.sendFinalNoticeAt,
        customReminderMessage: userSettings.customReminderMessage || '',
        customWarningMessage: userSettings.customWarningMessage || '',
        customFinalNoticeMessage: userSettings.customFinalNoticeMessage || '',
        ccFreelancer: userSettings.ccFreelancer,
        pauseRemindersOnWeekends: userSettings.pauseRemindersOnWeekends
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      alert('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updatedSettings = new ReminderSettings({
        id: settings?.id,
        userId: currentUser.uid,
        ...formData
      });

      const validation = updatedSettings.validate();
      if (!validation.isValid) {
        alert('Validation error: ' + validation.errors.join(', '));
        return;
      }

      await reminderSettingsService.saveSettings(updatedSettings);
      alert('Reminder settings saved successfully!');
      if (onSave) onSave();
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleArrayChange = (field, value) => {
    const numbers = value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n > 0);
    setFormData({ ...formData, [field]: numbers });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto my-4">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <h2 className="text-2xl font-bold text-gray-900">Payment Reminder Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div>
              <h3 className="font-semibold text-gray-900">Enable Automatic Reminders</h3>
              <p className="text-sm text-gray-600">Automatically send payment reminders to clients</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Before Due Date Reminders */}
          <div className="space-y-2">
            <div className="flex items-center">
              <h3 className="font-semibold text-gray-900">Before Due Date Reminders</h3>
            </div>
            <p className="text-sm text-gray-600">
              Days before the due date to send reminders (comma-separated)
            </p>
            <input
              type="text"
              value={formData.beforeDueReminders.join(', ')}
              onChange={(e) => handleArrayChange('beforeDueReminders', e.target.value)}
              placeholder="7, 3, 1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500">
              Example: "7, 3, 1" will send reminders 7 days, 3 days, and 1 day before due date
            </p>
          </div>

          {/* Overdue Reminders */}
          <div className="space-y-2">
            <div className="flex items-center">
              <h3 className="font-semibold text-gray-900">Overdue Payment Reminders</h3>
            </div>
            <p className="text-sm text-gray-600">
              Days after the due date to send reminders (comma-separated)
            </p>
            <input
              type="text"
              value={formData.overdueReminders.join(', ')}
              onChange={(e) => handleArrayChange('overdueReminders', e.target.value)}
              placeholder="1, 3, 7, 14, 30"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500">
              Example: "1, 3, 7, 14, 30" will send reminders on these days after the due date
            </p>
          </div>

          {/* Warning Threshold */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center">
                <h3 className="font-semibold text-gray-900">Warning After (Days)</h3>
              </div>
              <input
                type="number"
                value={formData.sendWarningAt}
                onChange={(e) => setFormData({ ...formData, sendWarningAt: parseInt(e.target.value) })}
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500">
                Send warning emails after this many days overdue
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center">
                <h3 className="font-semibold text-gray-900">Final Notice After (Days)</h3>
              </div>
              <input
                type="number"
                value={formData.sendFinalNoticeAt}
                onChange={(e) => setFormData({ ...formData, sendFinalNoticeAt: parseInt(e.target.value) })}
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500">
                Send final notice after this many days overdue
              </p>
            </div>
          </div>

          {/* Custom Messages */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Custom Messages (Optional)</h3>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Regular Reminder Message</label>
              <textarea
                value={formData.customReminderMessage}
                onChange={(e) => setFormData({ ...formData, customReminderMessage: e.target.value })}
                rows="2"
                placeholder="Add a personal message to regular reminders..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Warning Message</label>
              <textarea
                value={formData.customWarningMessage}
                onChange={(e) => setFormData({ ...formData, customWarningMessage: e.target.value })}
                rows="2"
                placeholder="Add a message for warning emails..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Final Notice Message</label>
              <textarea
                value={formData.customFinalNoticeMessage}
                onChange={(e) => setFormData({ ...formData, customFinalNoticeMessage: e.target.value })}
                rows="2"
                placeholder="Add a message for final notice emails..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Additional Options */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Additional Options</h3>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.ccFreelancer}
                onChange={(e) => setFormData({ ...formData, ccFreelancer: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">CC me on reminder emails</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.pauseRemindersOnWeekends}
                onChange={(e) => setFormData({ ...formData, pauseRemindersOnWeekends: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Don't send reminders on weekends</span>
            </label>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Bell className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-gray-700">
                <p className="font-semibold mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Reminders are sent automatically based on your settings</li>
                  <li>Only unpaid invoices will receive reminders</li>
                  <li>Reminders are sent once per configured day</li>
                  <li>You can manually send reminders from the invoice list at any time</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReminderSettingsModal;
