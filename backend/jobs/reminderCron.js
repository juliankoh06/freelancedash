const cron = require('node-cron');
const paymentReminderService = require('../services/paymentReminderService');

function startReminderCron() {
  // '* * * * *'
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Running scheduled payment reminders...');
    console.log('[CRON] Time:', new Date().toLocaleString());
    
    try {
      const result = await paymentReminderService.processReminders();
      console.log('[CRON] Reminders processed successfully:', {
        processed: result.processed,
        sent: result.sent,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[CRON] Error processing reminders:', error);
      console.error('Stack:', error.stack);
    }
  });

  console.log('Payment reminder cron job started');
  console.log('Schedule: Daily at 9:00 AM');
  console.log('Current time:', new Date().toLocaleString());
}

module.exports = { startReminderCron };
