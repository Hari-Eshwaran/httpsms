/**
 * httpSMS Client SDK & Command Line Tool
 * Can interact with local dashboard gateway or remote httpSMS API (https://api.httpsms.com)
 */

class HttpSmsClient {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || process.env.HTTPSMS_API_URL || 'http://localhost:3000').replace(/\/$/, '');
    this.apiKey = options.apiKey || process.env.HTTPSMS_API_KEY || '';
    this.defaultSender = options.defaultSender || '+18005550199';
  }

  async _request(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(`[httpSMS API Error ${res.status}]: ${json.message || JSON.stringify(json)}`);
    }
    return json;
  }

  /**
   * Send an SMS message
   * @param {Object} params
   * @param {string} params.to - Recipient phone number in E.164 format (+1...)
   * @param {string} params.content - Message content
   * @param {string} [params.from] - Sender phone number registered in phone/SIM
   * @param {string} [params.sim] - SIM slot: 'SIM1' or 'SIM2'
   * @param {string[]} [params.attachments] - Array of media URLs for MMS
   * @param {string} [params.sendAt] - ISO timestamp for scheduled sending
   */
  async sendSMS({ to, content, from, sim = 'SIM1', attachments = [], sendAt = null }) {
    return this._request('/v1/messages/send', 'POST', {
      from: from || this.defaultSender,
      to,
      content,
      sim,
      attachments,
      send_at: sendAt
    });
  }

  /**
   * Ingest or simulate an incoming SMS message (from an Android phone or test runner)
   * @param {Object} params
   * @param {string} params.from - Sender phone number (+1...)
   * @param {string} params.content - Inbound message content
   * @param {string} [params.to] - Device phone number receiving the SMS
   * @param {string} [params.sim] - SIM slot that received the SMS
   */
  async receiveSMS({ from, content, to, sim = 'SIM1' }) {
    return this._request('/v1/messages/receive', 'POST', {
      from,
      to: to || this.defaultSender,
      content,
      sim,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * List all SMS messages
   * @param {Object} [filter]
   * @param {string} [filter.owner]
   * @param {string} [filter.contact]
   * @param {string} [filter.query]
   */
  async listMessages(filter = {}) {
    const params = new URLSearchParams();
    if (filter.owner) params.append('owner', filter.owner);
    if (filter.contact) params.append('contact', filter.contact);
    if (filter.query) params.append('query', filter.query);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this._request(`/v1/messages${queryString}`, 'GET');
  }

  /**
   * Get all conversation threads
   */
  async getThreads() {
    return this._request('/v1/message-threads', 'GET');
  }

  /**
   * Get connected Android gateway devices
   */
  async getPhones() {
    return this._request('/v1/phones', 'GET');
  }

  /**
   * Get gateway statistics
   */
  async getStats() {
    return this._request('/api/stats', 'GET');
  }
}

// Command Line Interface Execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const client = new HttpSmsClient();

  async function run() {
    try {
      if (command === 'send') {
        const to = args[1] || '+18005550100';
        const content = args[2] || 'Hello! This is a test message from httpSMS client.';
        console.log(`📤 Sending SMS to ${to}...`);
        const res = await client.sendSMS({ to, content });
        console.log(`✅ Message Queued Successfully!`);
        console.log(`   Message ID: ${res.data.id}`);
        console.log(`   Status:     ${res.data.status}`);
        console.log(`   Content:    "${res.data.content}"`);
      } else if (command === 'receive') {
        const from = args[1] || '+18005550100';
        const content = args[2] || 'Hi there! This is a simulated incoming reply.';
        console.log(`📥 Ingesting incoming SMS from ${from}...`);
        const res = await client.receiveSMS({ from, content });
        console.log(`✅ Message Received!`);
        console.log(`   Message ID: ${res.data.id}`);
        console.log(`   Contact:    ${res.data.contact}`);
        console.log(`   Content:    "${res.data.content}"`);
      } else if (command === 'list') {
        console.log(`📋 Fetching SMS messages...`);
        const res = await client.listMessages();
        console.table(res.data.map(m => ({
          ID: m.id.substring(0, 8) + '...',
          Type: m.type,
          From: m.type === 'mobile-terminated' ? m.owner : m.contact,
          To: m.type === 'mobile-terminated' ? m.contact : m.owner,
          Status: m.status,
          Content: m.content.substring(0, 35) + '...'
        })));
      } else if (command === 'threads') {
        console.log(`🧵 Fetching message threads...`);
        const res = await client.getThreads();
        console.table(res.data.map(t => ({
          Contact: `${t.contact_avatar || '📱'} ${t.contact_name}`,
          Phone: t.contact_phone,
          Messages: t.total_messages,
          LastStatus: t.last_message_status,
          LastMessage: t.last_message.substring(0, 35) + '...'
        })));
      } else {
        console.log(`
📱 httpSMS Command Line Interface
===================================
Usage:
  node sms_client.js send <to> <content>
  node sms_client.js receive <from> <content>
  node sms_client.js list
  node sms_client.js threads

Examples:
  node sms_client.js send "+18005550100" "Your security PIN is 7731"
  node sms_client.js receive "+18005550100" "Yes, I got the code!"
  node sms_client.js list
        `);
      }
    } catch (err) {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  }

  run();
}

module.exports = { HttpSmsClient };
