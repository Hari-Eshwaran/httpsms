const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Initial seed data
const initialData = {
  settings: {
    mode: 'simulator', // 'simulator' or 'live'
    liveApiUrl: 'https://api.httpsms.com',
    apiKey: '',
    webhookUrl: '',
    defaultSender: '+18005550199'
  },
  phones: [
    {
      id: 'phone-pixel-7',
      name: 'Google Pixel 7 Pro (Gateway)',
      status: 'online',
      battery: 92,
      signal: 4,
      fcmToken: 'fcm-token-pixel-gateway-sample-live',
      lastHeartbeat: new Date().toISOString(),
      sims: [
        { slot: 'SIM1', number: '+18005550199', carrier: 'T-Mobile US', active: true },
        { slot: 'SIM2', number: '+18005550198', carrier: 'AT&T Wireless', active: true }
      ]
    }
  ],
  contacts: [
    { name: 'Sarah Connor', phone: '+18005550100', avatar: '👩‍💼', company: 'Cyberdyne Systems' },
    { name: 'John Doe', phone: '+18005550123', avatar: '👨‍💻', company: 'TechCorp' },
    { name: 'Alex Rivera', phone: '+18005550155', avatar: '👨‍🎨', company: 'Creative Studio' },
    { name: 'Dr. Evelyn Reed', phone: '+18005550188', avatar: '👩‍⚕️', company: 'Metro Health' }
  ],
  messages: [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      request_id: 'req-001',
      owner: '+18005550199',
      contact: '+18005550100',
      content: 'Hello Sarah! Your two-factor verification code is 492018. It expires in 5 minutes.',
      attachments: [],
      encrypted: false,
      sim: 'SIM1',
      type: 'mobile-terminated',
      status: 'delivered',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 2 + 3000).toISOString(),
      events: [
        { name: 'PENDING', timestamp: new Date(Date.now() - 3600000 * 2).toISOString() },
        { name: 'SENT', timestamp: new Date(Date.now() - 3600000 * 2 + 1200).toISOString() },
        { name: 'DELIVERED', timestamp: new Date(Date.now() - 3600000 * 2 + 3000).toISOString() }
      ]
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      request_id: null,
      owner: '+18005550199',
      contact: '+18005550100',
      content: 'Received! Thanks for the prompt code, system logged in successfully.',
      attachments: [],
      encrypted: false,
      sim: 'SIM1',
      type: 'mobile-originated',
      status: 'received',
      created_at: new Date(Date.now() - 3600000 * 1.8).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 1.8).toISOString(),
      events: [
        { name: 'RECEIVED', timestamp: new Date(Date.now() - 3600000 * 1.8).toISOString() }
      ]
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      request_id: 'req-002',
      owner: '+18005550199',
      contact: '+18005550123',
      content: 'Hi John, your scheduled appointment with our engineering lead is confirmed for tomorrow at 10:00 AM PST.',
      attachments: [],
      encrypted: false,
      sim: 'SIM1',
      type: 'mobile-terminated',
      status: 'delivered',
      created_at: new Date(Date.now() - 3600000 * 0.9).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 0.9 + 2500).toISOString(),
      events: [
        { name: 'PENDING', timestamp: new Date(Date.now() - 3600000 * 0.9).toISOString() },
        { name: 'SENT', timestamp: new Date(Date.now() - 3600000 * 0.9 + 1000).toISOString() },
        { name: 'DELIVERED', timestamp: new Date(Date.now() - 3600000 * 0.9 + 2500).toISOString() }
      ]
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      request_id: null,
      owner: '+18005550199',
      contact: '+18005550123',
      content: 'Sounds great. Could you also share the meeting link in advance?',
      attachments: [],
      encrypted: false,
      sim: 'SIM1',
      type: 'mobile-originated',
      status: 'received',
      created_at: new Date(Date.now() - 3600000 * 0.4).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 0.4).toISOString(),
      events: [
        { name: 'RECEIVED', timestamp: new Date(Date.now() - 3600000 * 0.4).toISOString() }
      ]
    }
  ]
};

// Database persistence helpers
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error loading data, using defaults:', err.message);
  }
  saveData(initialData);
  return initialData;
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving data:', err.message);
  }
}

let db = loadData();

// Helper to simulate Android gateway delivery lifecycle
function simulateDeliveryLifecycle(messageId) {
  setTimeout(() => {
    const msg = db.messages.find(m => m.id === messageId);
    if (!msg || msg.status === 'failed' || msg.status === 'delivered') return;
    msg.status = 'sending';
    msg.updated_at = new Date().toISOString();
    msg.events.push({ name: 'SENDING', timestamp: msg.updated_at });
    saveData(db);

    setTimeout(() => {
      const m2 = db.messages.find(m => m.id === messageId);
      if (!m2) return;
      m2.status = 'sent';
      m2.updated_at = new Date().toISOString();
      m2.events.push({ name: 'SENT', timestamp: m2.updated_at });
      saveData(db);

      setTimeout(() => {
        const m3 = db.messages.find(m => m.id === messageId);
        if (!m3) return;
        m3.status = 'delivered';
        m3.updated_at = new Date().toISOString();
        m3.events.push({ name: 'DELIVERED', timestamp: m3.updated_at });
        saveData(db);
      }, 1500);
    }, 1200);
  }, 800);
}

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// Request parser
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization'
  });
  res.end(JSON.stringify(payload));
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization'
    });
    return res.end();
  }

  // API Endpoints
  // 1. Send SMS (POST /v1/messages/send)
  if (method === 'POST' && pathname === '/v1/messages/send') {
    try {
      const body = await parseBody(req);
      if (!body.to || !body.content) {
        return sendJson(res, 422, {
          status: 'error',
          message: 'Validation failed: "to" and "content" are required fields'
        });
      }

      const senderPhone = body.from || db.settings.defaultSender || '+18005550199';
      const simSlot = body.sim || 'SIM1';

      const newMessage = {
        id: crypto.randomUUID(),
        request_id: body.request_id || `req-${Date.now()}`,
        owner: senderPhone,
        contact: body.to,
        content: body.content,
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
        encrypted: !!body.encrypted,
        sim: simSlot,
        type: 'mobile-terminated',
        status: body.send_at ? 'scheduled' : 'pending',
        send_at: body.send_at || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        events: [
          { name: body.send_at ? 'SCHEDULED' : 'PENDING', timestamp: new Date().toISOString() }
        ]
      };

      db.messages.unshift(newMessage);
      saveData(db);

      if (!body.send_at) {
        simulateDeliveryLifecycle(newMessage.id);
      }

      return sendJson(res, 200, {
        status: 'success',
        message: body.send_at ? 'Message scheduled successfully' : 'Message added to queue',
        data: newMessage
      });
    } catch (err) {
      return sendJson(res, 500, { status: 'error', message: err.message });
    }
  }

  // 2. Receive SMS (POST /v1/messages/receive)
  if (method === 'POST' && pathname === '/v1/messages/receive') {
    try {
      const body = await parseBody(req);
      if (!body.from || !body.content) {
        return sendJson(res, 422, {
          status: 'error',
          message: 'Validation failed: "from" and "content" are required'
        });
      }

      const receiverPhone = body.to || db.settings.defaultSender || '+18005550199';
      const simSlot = body.sim || 'SIM1';

      const receivedMsg = {
        id: crypto.randomUUID(),
        request_id: null,
        owner: receiverPhone,
        contact: body.from,
        content: body.content,
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
        encrypted: !!body.encrypted,
        sim: simSlot,
        type: 'mobile-originated',
        status: 'received',
        created_at: body.timestamp || new Date().toISOString(),
        updated_at: body.timestamp || new Date().toISOString(),
        events: [
          { name: 'RECEIVED', timestamp: body.timestamp || new Date().toISOString() }
        ]
      };

      db.messages.unshift(receivedMsg);
      saveData(db);

      // Webhook dispatch simulation
      if (db.settings.webhookUrl) {
        console.log(`[Webhook] Forwarding received SMS to ${db.settings.webhookUrl}`);
      }

      return sendJson(res, 200, {
        status: 'success',
        message: 'Message received successfully',
        data: receivedMsg
      });
    } catch (err) {
      return sendJson(res, 500, { status: 'error', message: err.message });
    }
  }

  // 3. List messages (GET /v1/messages)
  if (method === 'GET' && pathname === '/v1/messages') {
    const { owner, contact, query, status } = parsedUrl.query;
    let list = db.messages.slice();

    if (owner) {
      list = list.filter(m => m.owner === owner);
    }
    if (contact) {
      list = list.filter(m => m.contact === contact);
    }
    if (status) {
      list = list.filter(m => m.status === status);
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(m => 
        m.content.toLowerCase().includes(q) || 
        m.contact.toLowerCase().includes(q) ||
        m.owner.toLowerCase().includes(q)
      );
    }

    return sendJson(res, 200, {
      status: 'success',
      message: `Fetched ${list.length} message(s)`,
      data: list
    });
  }

  // 4. Message Threads (GET /v1/message-threads)
  if (method === 'GET' && pathname === '/v1/message-threads') {
    const { owner } = parsedUrl.query;
    const threadMap = new Map();

    db.messages.forEach(msg => {
      const contactPhone = msg.contact;
      if (!threadMap.has(contactPhone)) {
        const contactInfo = db.contacts.find(c => c.phone === contactPhone) || {
          name: contactPhone,
          phone: contactPhone,
          avatar: '📱',
          company: 'Unknown'
        };

        threadMap.set(contactPhone, {
          contact_phone: contactPhone,
          contact_name: contactInfo.name,
          contact_avatar: contactInfo.avatar,
          contact_company: contactInfo.company,
          last_message: msg.content,
          last_message_at: msg.created_at,
          last_message_status: msg.status,
          last_message_type: msg.type,
          total_messages: 1,
          unread_count: msg.type === 'mobile-originated' ? 1 : 0
        });
      } else {
        const t = threadMap.get(contactPhone);
        t.total_messages += 1;
        if (new Date(msg.created_at) > new Date(t.last_message_at)) {
          t.last_message = msg.content;
          t.last_message_at = msg.created_at;
          t.last_message_status = msg.status;
          t.last_message_type = msg.type;
        }
      }
    });

    const threads = Array.from(threadMap.values()).sort(
      (a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)
    );

    return sendJson(res, 200, {
      status: 'success',
      message: `Fetched ${threads.length} thread(s)`,
      data: threads
    });
  }

  // 5. Get Phones (GET /v1/phones)
  if (method === 'GET' && pathname === '/v1/phones') {
    return sendJson(res, 200, {
      status: 'success',
      message: 'Phones fetched successfully',
      data: db.phones
    });
  }

  // 6. Heartbeats (GET /v1/heartbeats)
  if (method === 'GET' && pathname === '/v1/heartbeats') {
    return sendJson(res, 200, {
      status: 'success',
      message: 'Heartbeats fetched successfully',
      data: [
        {
          id: 'hb-1',
          phone_id: 'phone-pixel-7',
          battery: 92,
          is_charging: true,
          network_type: 'WIFI + 5G',
          created_at: new Date().toISOString()
        }
      ]
    });
  }

  // 7. Dashboard Stats (GET /api/stats)
  if (method === 'GET' && pathname === '/api/stats') {
    const total = db.messages.length;
    const sent = db.messages.filter(m => m.type === 'mobile-terminated' && ['sent', 'delivered'].includes(m.status)).length;
    const received = db.messages.filter(m => m.type === 'mobile-originated').length;
    const delivered = db.messages.filter(m => m.status === 'delivered').length;
    const pending = db.messages.filter(m => ['pending', 'sending'].includes(m.status)).length;
    const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 100;

    return sendJson(res, 200, {
      status: 'success',
      data: {
        total,
        sent,
        received,
        delivered,
        pending,
        deliveryRate,
        gatewayStatus: 'Online',
        activeSims: 2
      }
    });
  }

  // 8. Settings API (GET & POST /api/settings)
  if (pathname === '/api/settings') {
    if (method === 'GET') {
      return sendJson(res, 200, { status: 'success', data: db.settings });
    }
    if (method === 'POST') {
      try {
        const body = await parseBody(req);
        db.settings = { ...db.settings, ...body };
        saveData(db);
        return sendJson(res, 200, { status: 'success', message: 'Settings updated', data: db.settings });
      } catch (err) {
        return sendJson(res, 500, { status: 'error', message: err.message });
      }
    }
  }

  // 9. Reset / Seed Data (POST /api/reset)
  if (method === 'POST' && pathname === '/api/reset') {
    db = JSON.parse(JSON.stringify(initialData));
    saveData(db);
    return sendJson(res, 200, { status: 'success', message: 'Database reset to default seed' });
  }

  // Serve Static Files
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routes
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Internal Server Error');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  httpSMS Interactive App & Dashboard`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  SMS API: http://localhost:${PORT}/v1/messages`);
  console.log(`=======================================================`);
});
