/**
 * Google Apps Script to Monitor Gmail for PayPal Auth Codes
 * 
 * Setup Instructions:
 * 1. Go to script.google.com
 * 2. Create new project
 * 3. Paste this script
 * 4. Set up trigger: "On new email" or "Time-driven" (every 1 minute)
 * 5. Set webhook URL in WEBHOOK_URL variable
 * 6. Deploy as web app
 */

// Configuration
const WEBHOOK_URL = 'https://your-api-domain.com/api/gmail/webhook';
const PAYPAL_EMAIL_PATTERNS = [
  'noreply@paypal.com',
  'paypal@paypal.com',
  'service@paypal.com',
];

/**
 * Main function - runs on trigger
 */
function checkForPayPalEmails() {
  const threads = GmailApp.search('from:paypal.com is:unread', 0, 10);
  
  for (const thread of threads) {
    const messages = thread.getMessages();
    
    for (const message of messages) {
      if (message.isUnread()) {
        processPayPalEmail(message);
        message.markRead(); // Mark as read after processing
      }
    }
  }
}

/**
 * Process individual PayPal email
 */
function processPayPalEmail(message) {
  const from = message.getFrom();
  const subject = message.getSubject();
  const body = message.getPlainBody();
  const receivedAt = message.getDate();
  
  // Check if it's a PayPal email
  const isPayPalEmail = PAYPAL_EMAIL_PATTERNS.some(pattern => 
    from.toLowerCase().includes(pattern)
  ) || subject.toLowerCase().includes('paypal');
  
  if (!isPayPalEmail) {
    return;
  }
  
  // Extract auth code (6-digit number)
  const authCodeMatch = body.match(/(\d{6})/);
  if (!authCodeMatch) {
    Logger.log('No auth code found in email: ' + subject);
    return;
  }
  
  const authCode = authCodeMatch[1];
  
  // Send to webhook
  sendToWebhook({
    from: from,
    subject: subject,
    body: body,
    receivedAt: receivedAt.toISOString(),
    authCode: authCode,
  });
}

/**
 * Send email data to webhook
 */
function sendToWebhook(emailData) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(emailData),
    muteHttpExceptions: true,
  };
  
  try {
    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log('Webhook response: ' + response.getContentText());
  } catch (error) {
    Logger.log('Error sending to webhook: ' + error.toString());
  }
}

/**
 * Manual trigger function (for testing)
 */
function testEmailProcessing() {
  const threads = GmailApp.search('from:paypal.com', 0, 1);
  if (threads.length > 0) {
    const messages = threads[0].getMessages();
    if (messages.length > 0) {
      processPayPalEmail(messages[messages.length - 1]);
    }
  }
}

