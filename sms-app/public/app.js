/**
 * httpSMS Pulse • Frontend Interactive Controller
 */

// Application State
const state = {
  currentTab: 'messages-tab',
  filter: 'all',
  searchQuery: '',
  activeContactPhone: '+18005550100',
  messages: [],
  threads: [],
  stats: {},
  phones: [],
  settings: {
    mode: 'simulator',
    liveApiUrl: 'https://api.httpsms.com',
    apiKey: '',
    webhookUrl: '',
    defaultSender: '+18005550199'
  }
};

// DOM Element Selectors
const elements = {
  // Navigation
  navButtons: document.querySelectorAll('.sidebar-nav .nav-item'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  pageTitle: document.getElementById('page-title'),
  
  // Counters & Badges
  navCountMessages: document.getElementById('nav-count-messages'),
  navCountThreads: document.getElementById('nav-count-threads'),
  statTotal: document.getElementById('stat-total-messages'),
  statSent: document.getElementById('stat-sent-messages'),
  statReceived: document.getElementById('stat-received-messages'),
  statDeliveryRate: document.getElementById('stat-delivery-rate'),

  // Messages Tab
  messagesTableBody: document.getElementById('messages-tbody'),
  messagesEmptyState: document.getElementById('messages-empty-state'),
  inputSearchMessages: document.getElementById('input-search-messages'),
  filterPills: document.querySelectorAll('.filter-pill'),
  btnRefreshMessages: document.getElementById('btn-refresh-messages'),
  btnExportMessages: document.getElementById('btn-export-messages'),
  btnEmptyCompose: document.getElementById('btn-empty-compose'),

  // Threads Tab
  threadList: document.getElementById('thread-list'),
  inputSearchThreads: document.getElementById('input-search-threads'),
  chatContactName: document.getElementById('chat-contact-name'),
  chatContactPhone: document.getElementById('chat-contact-phone'),
  chatAvatar: document.getElementById('chat-avatar'),
  chatActiveSim: document.getElementById('chat-active-sim'),
  chatMessagesContainer: document.getElementById('chat-messages-container'),
  chatReplyForm: document.getElementById('chat-reply-form'),
  chatReplyInput: document.getElementById('chat-reply-input'),
  chatCharCount: document.getElementById('chat-char-count'),

  // Modals & Drawers
  btnQuickSend: document.getElementById('btn-quick-send'),
  btnQuickReceive: document.getElementById('btn-quick-receive'),
  modalCompose: document.getElementById('modal-compose'),
  btnCloseCompose: document.getElementById('btn-close-compose'),
  btnCancelCompose: document.getElementById('btn-cancel-compose'),
  formCompose: document.getElementById('form-compose-sms'),
  composeSender: document.getElementById('compose-sender'),
  composeSim: document.getElementById('compose-sim'),
  composeRecipient: document.getElementById('compose-recipient'),
  composeContent: document.getElementById('compose-content'),
  composeCharCounter: document.getElementById('compose-char-counter'),
  quickContactChips: document.querySelectorAll('.chip-contact'),

  modalReceive: document.getElementById('modal-receive'),
  btnCloseReceive: document.getElementById('btn-close-receive'),
  btnCancelReceive: document.getElementById('btn-cancel-receive'),
  formReceive: document.getElementById('form-receive-sms'),
  receiveFrom: document.getElementById('receive-from'),
  receiveTo: document.getElementById('receive-to'),
  receiveContent: document.getElementById('receive-content'),

  drawerDetails: document.getElementById('drawer-details'),
  btnCloseDrawer: document.getElementById('btn-close-drawer'),
  drawerContent: document.getElementById('drawer-details-content'),

  // Settings
  formSettings: document.getElementById('form-settings'),
  settingMode: document.getElementById('setting-mode'),
  settingApiUrl: document.getElementById('setting-api-url'),
  settingApiKey: document.getElementById('setting-api-key'),
  settingDefaultSender: document.getElementById('setting-default-sender'),
  settingWebhookUrl: document.getElementById('setting-webhook-url'),
  btnResetData: document.getElementById('btn-reset-data'),

  // Toast
  toastContainer: document.getElementById('toast-container')
};

// ==========================================================================
// Toast Notifications
// ==========================================================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==========================================================================
// API Interaction
// ==========================================================================
async function apiGet(endpoint) {
  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(`API GET error on ${endpoint}:`, err);
    return null;
  }
}

async function apiPost(endpoint, body) {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (err) {
    console.error(`API POST error on ${endpoint}:`, err);
    throw err;
  }
}

// Fetch all dashboard data
async function loadDashboardData() {
  const [messagesRes, threadsRes, statsRes, settingsRes] = await Promise.all([
    apiGet('/v1/messages'),
    apiGet('/v1/message-threads'),
    apiGet('/api/stats'),
    apiGet('/api/settings')
  ]);

  if (messagesRes && messagesRes.data) {
    state.messages = messagesRes.data;
    renderMessagesTable();
  }
  if (threadsRes && threadsRes.data) {
    state.threads = threadsRes.data;
    renderThreadsList();
    renderActiveChat();
  }
  if (statsRes && statsRes.data) {
    state.stats = statsRes.data;
    updateStatsDisplay();
  }
  if (settingsRes && settingsRes.data) {
    state.settings = settingsRes.data;
    syncSettingsFields();
  }
}

// Update UI Stat Counters
function updateStatsDisplay() {
  const { total, sent, received, deliveryRate } = state.stats;
  elements.statTotal.textContent = total ?? state.messages.length;
  elements.statSent.textContent = sent ?? 0;
  elements.statReceived.textContent = received ?? 0;
  elements.statDeliveryRate.textContent = `${deliveryRate ?? 100}%`;

  elements.navCountMessages.textContent = state.messages.length;
  elements.navCountThreads.textContent = state.threads.length;
}

// ==========================================================================
// Messages Feed & Table Rendering
// ==========================================================================
function renderMessagesTable() {
  const tbody = elements.messagesTableBody;
  tbody.innerHTML = '';

  let filtered = state.messages.slice();

  // Apply Filter Pill
  if (state.filter === 'received') {
    filtered = filtered.filter(m => m.type === 'mobile-originated');
  } else if (state.filter === 'sent') {
    filtered = filtered.filter(m => m.type === 'mobile-terminated');
  } else if (state.filter === 'delivered') {
    filtered = filtered.filter(m => m.status === 'delivered');
  } else if (state.filter === 'pending') {
    filtered = filtered.filter(m => ['pending', 'sending'].includes(m.status));
  }

  // Apply Search
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(m => 
      m.content.toLowerCase().includes(q) ||
      m.contact.toLowerCase().includes(q) ||
      m.owner.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    elements.messagesEmptyState.classList.remove('hidden');
    return;
  } else {
    elements.messagesEmptyState.classList.add('hidden');
  }

  filtered.forEach(msg => {
    const tr = document.createElement('tr');

    const isInbound = msg.type === 'mobile-originated';
    const directionBadge = isInbound
      ? `<span class="direction-badge inbound">📥 INBOUND</span>`
      : `<span class="direction-badge outbound">📤 OUTBOUND</span>`;

    const statusPill = `<span class="status-pill ${msg.status}">${msg.status}</span>`;
    const formattedDate = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });

    tr.innerHTML = `
      <td>${directionBadge}</td>
      <td>
        <div class="contact-cell">
          <span class="contact-name">${msg.contact}</span>
          <span class="contact-phone">Via ${msg.owner}</span>
        </div>
      </td>
      <td>
        <div class="content-snippet" title="${escapeHtml(msg.content)}">${escapeHtml(msg.content)}</div>
      </td>
      <td><span class="badge-sim">${msg.sim || 'SIM1'}</span></td>
      <td>${statusPill}</td>
      <td class="time-cell">${formattedDate}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon btn-inspect" data-id="${msg.id}" title="Inspect Message Details">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
      </td>
    `;

    // Attach inspect listener
    tr.querySelector('.btn-inspect').addEventListener('click', () => {
      openMessageDrawer(msg);
    });

    tbody.appendChild(tr);
  });
}

// ==========================================================================
// Conversation Threads & Chat
// ==========================================================================
function renderThreadsList() {
  const container = elements.threadList;
  container.innerHTML = '';

  state.threads.forEach(t => {
    const item = document.createElement('div');
    item.className = `thread-item ${t.contact_phone === state.activeContactPhone ? 'active' : ''}`;
    
    const formattedDate = new Date(t.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    item.innerHTML = `
      <div class="thread-item-avatar">${t.contact_avatar || '📱'}</div>
      <div class="thread-item-content">
        <div class="thread-item-top">
          <span class="thread-item-name">${t.contact_name}</span>
          <span class="thread-item-time">${formattedDate}</span>
        </div>
        <div class="thread-item-preview">${escapeHtml(t.last_message)}</div>
      </div>
    `;

    item.addEventListener('click', () => {
      state.activeContactPhone = t.contact_phone;
      renderThreadsList();
      renderActiveChat();
    });

    container.appendChild(item);
  });
}

function renderActiveChat() {
  const activeThread = state.threads.find(t => t.contact_phone === state.activeContactPhone) || state.threads[0];
  if (!activeThread) return;

  elements.chatContactName.textContent = activeThread.contact_name;
  elements.chatContactPhone.textContent = activeThread.contact_phone;
  elements.chatAvatar.textContent = activeThread.contact_avatar || '📱';

  // Filter messages for this contact
  const threadMessages = state.messages
    .filter(m => m.contact === activeThread.contact_phone)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const container = elements.chatMessagesContainer;
  container.innerHTML = '';

  threadMessages.forEach(msg => {
    const isSent = msg.type === 'mobile-terminated';
    const row = document.createElement('div');
    row.className = `chat-bubble-row ${isSent ? 'sent' : 'received'}`;

    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const checkmarks = isSent && msg.status === 'delivered' ? '✓✓' : (isSent ? '✓' : '');

    row.innerHTML = `
      <div class="chat-bubble">
        <div class="chat-bubble-text">${escapeHtml(msg.content)}</div>
        <div class="chat-bubble-meta">
          <span>${time}</span>
          ${checkmarks ? `<span class="delivery-ticks">${checkmarks}</span>` : ''}
        </div>
      </div>
    `;

    container.appendChild(row);
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// ==========================================================================
// Inspector Drawer
// ==========================================================================
function openMessageDrawer(msg) {
  const container = elements.drawerContent;
  
  const eventsHtml = (msg.events || []).map(ev => `
    <div class="timeline-event">
      <div class="timeline-dot ${ev.name.toLowerCase()}"></div>
      <div class="timeline-title">${ev.name}</div>
      <div class="timeline-time">${new Date(ev.timestamp).toLocaleString()}</div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="drawer-field">
      <label>Message ID</label>
      <div class="code-block">${msg.id}</div>
    </div>

    <div class="drawer-field" style="margin-top: 1rem;">
      <label>Recipient / Contact</label>
      <div style="font-weight: 600; color: #38bdf8;">${msg.contact}</div>
    </div>

    <div class="drawer-field" style="margin-top: 0.75rem;">
      <label>Gateway Sender Number</label>
      <div>${msg.owner} (${msg.sim || 'SIM1'})</div>
    </div>

    <div class="drawer-field" style="margin-top: 0.75rem;">
      <label>Status</label>
      <div><span class="status-pill ${msg.status}">${msg.status}</span></div>
    </div>

    <div class="drawer-field" style="margin-top: 1rem;">
      <label>Full Content</label>
      <div style="background: rgba(255,255,255,0.04); padding: 0.75rem; border-radius: 8px; margin-top: 0.3rem;">
        ${escapeHtml(msg.content)}
      </div>
    </div>

    <div style="margin-top: 1.5rem;">
      <label>Delivery Lifecycle Timeline</label>
      <div class="timeline">
        ${eventsHtml}
      </div>
    </div>

    <div style="margin-top: 1.5rem;">
      <label>Raw Payload JSON</label>
      <pre class="code-block" style="max-height: 160px; overflow-y: auto;"><code>${JSON.stringify(msg, null, 2)}</code></pre>
    </div>
  `;

  elements.drawerDetails.classList.remove('hidden');
}

// ==========================================================================
// Segment & Character Counter
// ==========================================================================
function updateCharCounter(text, labelElement) {
  const len = text.length;
  const segments = len === 0 ? 1 : Math.ceil(len / 160);
  labelElement.textContent = `${len} / 160 characters (${segments} SMS segment${segments > 1 ? 's' : ''})`;
}

// Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Sync settings
function syncSettingsFields() {
  if (!elements.settingMode) return;
  elements.settingMode.value = state.settings.mode || 'simulator';
  elements.settingApiUrl.value = state.settings.liveApiUrl || 'https://api.httpsms.com';
  elements.settingApiKey.value = state.settings.apiKey || '';
  elements.settingDefaultSender.value = state.settings.defaultSender || '+18005550199';
  elements.settingWebhookUrl.value = state.settings.webhookUrl || '';
}

// ==========================================================================
// Event Listeners & Wiring
// ==========================================================================
function setupEventListeners() {
  // Navigation tabs
  elements.navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.navButtons.forEach(b => b.classList.remove('active'));
      elements.tabPanes.forEach(pane => pane.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');

      const titles = {
        'messages-tab': 'SMS Dispatch & Activity',
        'threads-tab': 'Chat Conversations',
        'gateway-tab': 'Android Gateway Monitor',
        'settings-tab': 'API Configuration & Snippets'
      };
      elements.pageTitle.textContent = titles[targetId] || 'SMS Dashboard';
    });
  });

  // Filter pills
  elements.filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      elements.filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.filter = pill.getAttribute('data-filter');
      renderMessagesTable();
    });
  });

  // Search input
  elements.inputSearchMessages.addEventListener('input', e => {
    state.searchQuery = e.target.value.trim();
    renderMessagesTable();
  });

  // Refresh button
  elements.btnRefreshMessages.addEventListener('click', () => {
    loadDashboardData();
    showToast('Refreshed message queue', 'info');
  });

  // Export messages
  elements.btnExportMessages.addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.messages, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `httpsms_export_${Date.now()}.json`);
    dlAnchor.click();
    showToast('Exported messages to JSON', 'success');
  });

  // Compose Modal Handlers
  const openCompose = () => elements.modalCompose.classList.remove('hidden');
  const closeCompose = () => elements.modalCompose.classList.add('hidden');

  elements.btnQuickSend.addEventListener('click', openCompose);
  elements.btnEmptyCompose.addEventListener('click', openCompose);
  elements.btnCloseCompose.addEventListener('click', closeCompose);
  elements.btnCancelCompose.addEventListener('click', closeCompose);

  // Quick contact chips
  elements.quickContactChips.forEach(chip => {
    chip.addEventListener('click', () => {
      elements.composeRecipient.value = chip.getAttribute('data-phone');
      elements.composeContent.focus();
    });
  });

  // Character counter for compose
  elements.composeContent.addEventListener('input', e => {
    updateCharCounter(e.target.value, elements.composeCharCounter);
  });

  // Send SMS Form
  elements.formCompose.addEventListener('submit', async e => {
    e.preventDefault();
    const to = elements.composeRecipient.value.trim();
    const content = elements.composeContent.value.trim();
    const from = elements.composeSender.value;
    const sim = elements.composeSim.value;

    try {
      const res = await apiPost('/v1/messages/send', { to, content, from, sim });
      showToast(`SMS Queued! ID: ${res.data.id.substring(0, 8)}...`, 'success');
      closeCompose();
      elements.composeContent.value = '';
      await loadDashboardData();
    } catch (err) {
      showToast(err.message || 'Failed to send SMS', 'error');
    }
  });

  // Receive Simulator Modal Handlers
  const openReceive = () => elements.modalReceive.classList.remove('hidden');
  const closeReceive = () => elements.modalReceive.classList.add('hidden');

  elements.btnQuickReceive.addEventListener('click', openReceive);
  elements.btnCloseReceive.addEventListener('click', closeReceive);
  elements.btnCancelReceive.addEventListener('click', closeReceive);

  // Inbound SMS Submit
  elements.formReceive.addEventListener('submit', async e => {
    e.preventDefault();
    const from = elements.receiveFrom.value.trim();
    const to = elements.receiveTo.value;
    const content = elements.receiveContent.value.trim();

    try {
      const res = await apiPost('/v1/messages/receive', { from, to, content, sim: 'SIM1' });
      showToast(`Inbound SMS Received from ${from}!`, 'success');
      closeReceive();
      await loadDashboardData();
    } catch (err) {
      showToast(err.message || 'Failed to receive SMS', 'error');
    }
  });

  // Quick reply inside Chat thread
  elements.chatReplyForm.addEventListener('submit', async e => {
    e.preventDefault();
    const content = elements.chatReplyInput.value.trim();
    if (!content) return;

    try {
      await apiPost('/v1/messages/send', {
        to: state.activeContactPhone,
        content: content,
        from: state.settings.defaultSender || '+18005550199',
        sim: 'SIM1'
      });
      elements.chatReplyInput.value = '';
      elements.chatCharCount.textContent = '0 / 160 chars';
      showToast('Reply dispatched via SIM1', 'success');
      await loadDashboardData();
    } catch (err) {
      showToast('Error replying to thread', 'error');
    }
  });

  elements.chatReplyInput.addEventListener('input', e => {
    elements.chatCharCount.textContent = `${e.target.value.length} / 160 chars`;
  });

  // Close Drawer
  elements.btnCloseDrawer.addEventListener('click', () => {
    elements.drawerDetails.classList.add('hidden');
  });

  // Settings Save
  elements.formSettings.addEventListener('submit', async e => {
    e.preventDefault();
    const newSettings = {
      mode: elements.settingMode.value,
      liveApiUrl: elements.settingApiUrl.value.trim(),
      apiKey: elements.settingApiKey.value.trim(),
      defaultSender: elements.settingDefaultSender.value.trim(),
      webhookUrl: elements.settingWebhookUrl.value.trim()
    };

    try {
      await apiPost('/api/settings', newSettings);
      state.settings = newSettings;
      showToast('Gateway configuration saved!', 'success');
    } catch (err) {
      showToast('Error saving settings', 'error');
    }
  });

  // Reset sample data
  elements.btnResetData.addEventListener('click', async () => {
    if (confirm('Reset database to default sample messages?')) {
      await apiPost('/api/reset', {});
      showToast('Sample data reset successfully', 'info');
      await loadDashboardData();
    }
  });
}

// Background auto-refresh poll every 3 seconds to update delivery states
setInterval(() => {
  loadDashboardData();
}, 3000);

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadDashboardData();
});
