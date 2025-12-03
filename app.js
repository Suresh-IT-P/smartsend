// Brevo Configuration
let BREVO_API_KEY = 'YOUR_BREVO_API_KEY'; // Get from https://app.brevo.com/settings/account/api
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Load environment variables from .env file
async function loadEnv() {
  try {
    const response = await fetch('.env');
    if (response.ok) {
      const envContent = await response.text();
      const lines = envContent.split('\n');
      lines.forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          const trimmedKey = key.trim();
          const trimmedValue = value.trim();
          if (trimmedKey === 'BREVO_API_KEY') {
            BREVO_API_KEY = trimmedValue;
          }
        }
      });
    }
  } catch (error) {
    console.warn('Could not load .env file:', error);
  }
}

// Initialize Brevo
function initBrevo() {
  if (!BREVO_API_KEY || BREVO_API_KEY === 'YOUR_BREVO_API_KEY') {
    showNotification('Warning', 'Brevo API key not configured. Please add your API key to app.js', 'warning', 0);
  }
}

// State
let googleUserEmail = null;
let deliveryResults = null;

// Notification System
function showNotification(title, message, type = 'info', duration = 4000) {
  const container = document.getElementById('notificationContainer');
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  notification.innerHTML = `
    <span class="notification-icon">${icons[type]}</span>
    <div class="notification-content">
      <div class="notification-title">${title}</div>
      <div class="notification-message">${message}</div>
    </div>
    <button class="notification-close">&times;</button>
  `;
  
  container.appendChild(notification);
  
  const closeBtn = notification.querySelector('.notification-close');
  closeBtn.addEventListener('click', () => {
    notification.classList.add('removing');
    setTimeout(() => notification.remove(), 300);
  });
  
  if (duration) {
    setTimeout(() => {
      notification.classList.add('removing');
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }
  
  return notification;
}

// DOM Elements
const senderEmail = document.getElementById('senderEmail');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const googleLogoutBtn = document.getElementById('googleLogoutBtn');
const loginStatus = document.getElementById('loginStatus');
const recipients = document.getElementById('recipients');
const message = document.getElementById('message');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const clientsBtn = document.getElementById('clientsBtn');
const clientsModal = document.getElementById('clientsModal');
const reportModal = document.getElementById('reportModal');
const successBanner = document.getElementById('successBanner');
const clientNameInput = document.getElementById('clientNameInput');
const saveClientBtn = document.getElementById('saveClientBtn');
const clientsList = document.getElementById('clientsList');
const reportTable = document.getElementById('reportTable');
const sentCount = document.getElementById('sentCount');
const failedCount = document.getElementById('failedCount');
const newBatchBtn = document.getElementById('newBatchBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load environment variables
  await loadEnv();

  // Initialize Brevo
  initBrevo();

  // Load saved email on startup
  const saved = localStorage.getItem('googleUserEmail');
  if (saved) {
    googleUserEmail = saved;
    updateLoginUI();
  }

  // Initialize message with default template
  message.value = '';

  // Google Login Handler
  googleLoginBtn.addEventListener('click', handleGoogleLogin);
  googleLogoutBtn.addEventListener('click', handleGoogleLogout);

  // Clear Button
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear all recipients?')) {
      recipients.value = '';
    }
  });

  // Clients Management
  clientsBtn.addEventListener('click', () => {
    renderClients();
    clientsModal.classList.add('active');
  });

  saveClientBtn.addEventListener('click', saveNewClient);

  // Send Button
  sendBtn.addEventListener('click', sendEmails);

  // New Batch Button
  newBatchBtn.addEventListener('click', startNewBatch);

  // Theme toggle
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

  // Initialize theme: prefer saved choice, otherwise follow OS preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    applyTheme(savedTheme);
  } else if (window.matchMedia) {
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    applyTheme(prefersLight ? 'light' : 'dark');
  } else {
    applyTheme('dark');
  }

  

  // Modal Close Handlers
  document.getElementById('closeClientsModal').addEventListener('click', closeClientsModal);
  document.getElementById('closeReportModal').addEventListener('click', closeReportModal);
  document.getElementById('closeReportBtn').addEventListener('click', closeReportModal);

  // Click outside modal to close
  clientsModal.addEventListener('click', (e) => {
    if (e.target === clientsModal) {
      closeClientsModal();
    }
  });

  reportModal.addEventListener('click', (e) => {
    if (e.target === reportModal) {
      closeReportModal();
    }
  });
});

// Google Login Handler
function handleGoogleLogin() {
  const email = prompt('Enter your Google email:');
  if (email && email.includes('@')) {
    googleUserEmail = email;
    localStorage.setItem('googleUserEmail', email);
    updateLoginUI();
  }
}

function handleGoogleLogout() {
  googleUserEmail = null;
  localStorage.removeItem('googleUserEmail');
  updateLoginUI();
}

function updateLoginUI() {
  if (googleUserEmail) {
    senderEmail.value = googleUserEmail;
    googleLoginBtn.classList.add('hidden');
    googleLogoutBtn.classList.remove('hidden');
    loginStatus.textContent = `✅ Logged in as ${googleUserEmail}`;
    loginStatus.classList.add('active');
  } else {
    senderEmail.value = 'Not logged in';
    googleLoginBtn.classList.remove('hidden');
    googleLogoutBtn.classList.add('hidden');
    loginStatus.textContent = 'Click Google Login to authenticate';
    loginStatus.classList.remove('active');
  }
}

// Theme functions
function applyTheme(theme) {
  const body = document.body;
  if (theme === 'light') {
    body.classList.add('light-theme');
    if (themeToggleBtn) themeToggleBtn.textContent = '🌞 Light';
  } else {
    body.classList.remove('light-theme');
    if (themeToggleBtn) themeToggleBtn.textContent = '🌙 Dark';
  }
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const current = document.body.classList.contains('light-theme') ? 'light' : 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
}

// Email Validation
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Save New Client
function saveNewClient() {
  const name = clientNameInput.value.trim();
  if (!name) {
    showNotification('Error', 'Please enter a client name', 'error');
    return;
  }

  const emails = recipients.value
    .split('\n')
    .map(e => e.trim())
    .filter(e => e);

  if (!emails.length) {
    showNotification('Error', 'Add recipients before saving', 'error');
    return;
  }

  const clients = JSON.parse(localStorage.getItem('emailClients') || '{}');
  clients[name] = emails;
  localStorage.setItem('emailClients', JSON.stringify(clients));

  clientNameInput.value = '';
  renderClients();
  showNotification('Success', `Saved "${name}" with ${emails.length} email(s)`, 'success');
}

// Render Clients List
function renderClients() {
  const clients = JSON.parse(localStorage.getItem('emailClients') || '{}');
  const names = Object.keys(clients);

  if (!names.length) {
    clientsList.innerHTML = '<p class="empty-message">No saved clients</p>';
    return;
  }

  clientsList.innerHTML = names.map(name => `
    <div class="client-item">
      <div class="client-info">
        <div class="client-name">${name}</div>
        <div class="client-count">${clients[name].length} emails</div>
      </div>
      <div class="client-actions">
        <button class="btn-small btn-secondary" onclick="loadClient('${name.replace(/'/g, "\\'")}')">Load</button>
        <button class="btn-small btn-danger" onclick="deleteClient('${name.replace(/'/g, "\\'")}')">Delete</button>
      </div>
    </div>
  `).join('');
}

// Load Client
function loadClient(name) {
  const clients = JSON.parse(localStorage.getItem('emailClients') || '{}');
  recipients.value = clients[name].join('\n');
  closeClientsModal();
}

// Delete Client
function deleteClient(name) {
  if (!confirm(`Delete "${name}"?`)) return; // Keep confirm for now to prevent accidental deletes
  const clients = JSON.parse(localStorage.getItem('emailClients') || '{}');
  delete clients[name];
  localStorage.setItem('emailClients', JSON.stringify(clients));
  renderClients();
}


// Close Modals
function closeClientsModal() {
  clientsModal.classList.remove('active');
}

function closeReportModal() {
  reportModal.classList.remove('active');
}

// Send Emails with Brevo
async function sendEmails() {
  if (!googleUserEmail) {
    showNotification('Error', 'Please login with Google first', 'error');
    return;
  }

  if (!BREVO_API_KEY || BREVO_API_KEY === 'YOUR_BREVO_API_KEY') {
    showNotification('Error', 'Brevo API key not configured. Please add your API key to app.js', 'error');
    return;
  }

  const recipientList = recipients.value
    .split('\n')
    .map(e => e.trim())
    .filter(e => e && isValidEmail(e));

  if (!recipientList.length) {
    showNotification('Error', 'Add at least one valid email address', 'error');
    return;
  }

  if (!message.value.trim()) {
    showNotification('Error', 'Please write a message', 'error');
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = '📤 SENDING...';

  const results = [];
  
  for (const email of recipientList) {
    try {
      // Send email using Brevo API
      const response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
        },
        body: JSON.stringify({
          sender: {
            name: 'Smart Send',
            email: googleUserEmail
          },
          to: [
            {
              email: email
            }
          ],
          subject: 'Message from Smart Send',
          htmlContent: `<p>${message.value.replace(/\n/g, '<br>')}</p>`,
          textContent: message.value
        })
      });

      if (response.ok) {
        results.push({
          email,
          status: 'sent'
        });
      } else {
        const errorData = await response.json();
        console.error(`Failed to send to ${email}:`, errorData);
        results.push({
          email,
          status: 'failed'
        });
      }

    } catch (error) {
      console.error(`Failed to send to ${email}:`, error);
      results.push({
        email,
        status: 'failed'
      });
    }

    // Small delay between emails
    await new Promise(r => setTimeout(r, 300));
  }

  sendBtn.disabled = false;
  sendBtn.textContent = '📧 SEND EMAILS';

  deliveryResults = results;
  showReport(results);

  const sent = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status === 'failed').length;
  
  if (failed === 0 && sent > 0) {
    showNotification('Success', `All ${sent} email(s) sent successfully! 🎉`, 'success');
  } else if (sent > 0) {
    showNotification('Partial Success', `${sent} sent, ${failed} failed`, 'warning');
  } else {
    showNotification('Failed', 'No emails were sent', 'error');
  }
}

// Show Report
function showReport(results) {
  const sent = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status === 'failed').length;

  sentCount.textContent = sent;
  failedCount.textContent = failed;

  reportTable.innerHTML = results.map(r => `
    <tr>
      <td>${r.email}</td>
      <td>
        <span class="status-badge status-${r.status}">
          ${r.status === 'sent' ? '✅ Sent' : '❌ Failed'}
        </span>
      </td>
    </tr>
  `).join('');

  reportModal.classList.add('active');
}

// Start New Batch
function startNewBatch() {
  recipients.value = '';
  message.value = '';
  closeReportModal();
}
