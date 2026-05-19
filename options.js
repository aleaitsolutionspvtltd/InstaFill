document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const logMessage = document.getElementById('log-message');

  // Vault Elements
  const vaultTableBody = document.getElementById('vault-table-body');
  const vaultEmptyState = document.getElementById('vault-empty-state');

  // Overrides Elements
  const overridesTableBody = document.getElementById('overrides-table-body');
  const overridesEmptyState = document.getElementById('overrides-empty-state');
  const overrideForm = document.getElementById('override-form');
  const overrideFormTitle = document.getElementById('override-form-title');
  const overrideKeyInput = document.getElementById('override-key');
  const overrideValueInput = document.getElementById('override-value');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');

  // Modal Elements
  const vaultModal = document.getElementById('vault-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnSaveModalChanges = document.getElementById('btn-save-modal-changes');
  const modalTitle = document.getElementById('modal-title');
  const modalInfoName = document.getElementById('modal-info-name');
  const modalInfoUrl = document.getElementById('modal-info-url');
  const modalFieldsList = document.getElementById('modal-fields-list');

  // State Management
  let activeTabId = 'vault';
  let openTabs = [];
  let editingOverrideIndex = -1; // -1 means add mode, otherwise index of existing
  let currentEditingVaultEntry = null;

  // Utility: HTML Escaping to prevent XSS
  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  // Logger
  function showLog(msg, isError = false) {
    logMessage.textContent = msg;
    logMessage.style.color = isError ? '#f43f5e' : '#6366f1';
    logMessage.style.borderColor = isError ? 'rgba(244, 63, 94, 0.2)' : 'rgba(99, 102, 241, 0.2)';
    logMessage.style.background = isError ? 'rgba(244, 63, 94, 0.05)' : 'rgba(99, 102, 241, 0.05)';
    setTimeout(() => {
      logMessage.textContent = '';
    }, 4000);
  }

  // --- TAB ROUTING ---
  function switchTab(tabId) {
    activeTabId = tabId;
    navItems.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabId}`);
    });
    
    if (tabId === 'vault') {
      loadVaultEntries();
    } else if (tabId === 'overrides') {
      loadOverrides();
    } else if (tabId === 'settings') {
      loadSettings();
    }
  }

  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      // Strip query parameters to avoid state lock on edit
      window.history.pushState({}, document.title, window.location.pathname + `?tab=${tabId}`);
      switchTab(tabId);
    });
  });

  // --- TAB QUERY SCANNER ---
  // Detects all open tabs to check if any saved Vault URL matches an open page.
  async function scanOpenTabs() {
    return new Promise((resolve) => {
      chrome.tabs.query({}, (tabs) => {
        openTabs = tabs || [];
        resolve();
      });
    });
  }

  // --- LOCAL PERSISTENCE VAULT LOGIC ---
  async function loadVaultEntries() {
    await scanOpenTabs();
    try {
      const allData = await chrome.storage.local.get(null);
      // Retrieve keys matching vault_ pattern
      const vaultKeys = Object.keys(allData).filter(key => key.startsWith('vault_'));
      
      vaultTableBody.innerHTML = '';
      
      if (vaultKeys.length === 0) {
        vaultEmptyState.classList.remove('hidden');
        return;
      }
      
      vaultEmptyState.classList.add('hidden');

      // Sort entries by date (newest first)
      const entries = vaultKeys.map(k => allData[k]);
      entries.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

      entries.forEach(entry => {
        const tr = document.createElement('tr');
        
        // Format date
        const dateObj = new Date(entry.savedAt);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Check if there is an open browser tab matching this saved URL
        const matchingTab = openTabs.find(tab => tab.url && tab.url.split('?')[0] === entry.url.split('?')[0]);
        const isRefillActive = !!matchingTab;

        tr.innerHTML = `
          <td><strong>${escapeHtml(entry.name || 'Untitled Saved State')}</strong></td>
          <td><div class="url-cell" title="${escapeHtml(entry.url)}">${escapeHtml(entry.url)}</div></td>
          <td class="date-cell">${dateStr}</td>
          <td><span class="badge-count">${entry.fields ? entry.fields.length : 0} fields</span></td>
          <td class="actions-col">
            <div class="actions-cell-wrapper">
              <button class="btn-icon-only action-refill" data-id="${entry.id}" title="${isRefillActive ? 'Refill into active tab' : 'No open matching tab found'}" ${isRefillActive ? '' : 'disabled'}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
              <button class="btn-icon-only action-view" data-id="${entry.id}" title="View/Edit Details">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button class="btn-icon-only action-delete" data-id="${entry.id}" title="Delete Entry">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </td>
        `;

        // Refill Handler
        tr.querySelector('.action-refill').addEventListener('click', () => {
          if (matchingTab) {
            // Focus matching tab
            chrome.tabs.update(matchingTab.id, { active: true });
            chrome.windows.update(matchingTab.windowId, { drawAttention: true, focused: true });
            
            // Send refill message
            chrome.tabs.sendMessage(matchingTab.id, { type: 'LOAD_SAVED_VALUES', data: entry.fields }, response => {
              if (chrome.runtime.lastError || !response || !response.success) {
                showLog("Failed to fill form. Ensure page is not reloaded or closed.", true);
              } else {
                showLog(`Restored ${response.successCount} fields successfully!`);
              }
            });
          }
        });

        // View/Edit Detail Modal Handler
        tr.querySelector('.action-view').addEventListener('click', () => {
          openVaultModal(entry);
        });

        // Delete Handler
        tr.querySelector('.action-delete').addEventListener('click', async () => {
          if (confirm(`Are you sure you want to delete '${entry.name}'?`)) {
            await chrome.storage.local.remove(entry.id);
            showLog("Vault entry removed.");
            loadVaultEntries();
          }
        });

        vaultTableBody.appendChild(tr);
      });

    } catch (err) {
      console.error("Vault loading failed:", err);
    }
  }

  // --- DETAIL MODAL LOGIC ---
  function openVaultModal(entry) {
    currentEditingVaultEntry = entry;
    modalTitle.textContent = `Configure saved state: ${entry.name}`;
    modalInfoName.textContent = entry.name;
    modalInfoUrl.textContent = entry.url;
    modalFieldsList.innerHTML = '';

    entry.fields.forEach((field, index) => {
      const row = document.createElement('div');
      row.className = 'modal-field-row';
      
      row.innerHTML = `
        <span class="modal-field-selector" title="${escapeHtml(field.selector)}">${escapeHtml(field.selector.substring(0, 35))}${field.selector.length > 35 ? '...' : ''}</span>
        <input type="text" class="modal-field-input" data-index="${index}" value="${escapeHtml(field.value === true ? 'true' : (field.value === false ? 'false' : field.value))}">
      `;
      
      modalFieldsList.appendChild(row);
    });

    vaultModal.classList.remove('hidden');
  }

  btnCloseModal.addEventListener('click', () => {
    vaultModal.classList.add('hidden');
    currentEditingVaultEntry = null;
  });

  btnSaveModalChanges.addEventListener('click', async () => {
    if (!currentEditingVaultEntry) return;

    const inputs = modalFieldsList.querySelectorAll('.modal-field-input');
    inputs.forEach(input => {
      const idx = parseInt(input.getAttribute('data-index'));
      const val = input.value;
      const field = currentEditingVaultEntry.fields[idx];
      
      if (field.type === 'checkbox' || field.type === 'radio') {
        field.value = (val.toLowerCase() === 'true');
      } else {
        field.value = val;
      }
    });

    currentEditingVaultEntry.savedAt = new Date().toISOString();

    try {
      await chrome.storage.local.set({ [currentEditingVaultEntry.id]: currentEditingVaultEntry });
      showLog("Vault entry successfully updated!");
      vaultModal.classList.add('hidden');
      loadVaultEntries();
    } catch(err) {
      showLog("Failed to save changes to storage.", true);
    }
  });

  // --- CUSTOM OVERRIDES LOGIC ---
  async function loadOverrides(highlightKey = null) {
    try {
      const result = await chrome.storage.local.get('custom_overrides');
      const overrides = result.custom_overrides || [];

      overridesTableBody.innerHTML = '';

      if (overrides.length === 0) {
        overridesEmptyState.classList.remove('hidden');
        return;
      }

      overridesEmptyState.classList.add('hidden');

      overrides.forEach((item, index) => {
        const tr = document.createElement('tr');
        
        // Highlight row if currently editing
        if (highlightKey && item.key.toLowerCase() === highlightKey.toLowerCase()) {
          tr.style.background = 'rgba(99, 102, 241, 0.08)';
          tr.style.borderLeft = '3px solid var(--color-indigo)';
          
          // Pre-populate Form for Edit
          editingOverrideIndex = index;
          overrideKeyInput.value = item.key;
          overrideValueInput.value = item.value;
          overrideFormTitle.textContent = "Edit Field Override";
          btnCancelEdit.classList.remove('hidden');
        }

        tr.innerHTML = `
          <td><strong>${escapeHtml(item.key)}</strong></td>
          <td><code>${escapeHtml(item.value)}</code></td>
          <td class="actions-col">
            <div class="actions-cell-wrapper">
              <button class="btn-icon-only action-edit-override" data-index="${index}" title="Edit Override">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button class="btn-icon-only action-delete" data-index="${index}" title="Delete Override">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </td>
        `;

        // Edit Inline click handler
        tr.querySelector('.action-edit-override').addEventListener('click', () => {
          startEditOverride(index, item.key, item.value);
        });

        // Delete click handler
        tr.querySelector('.action-delete').addEventListener('click', async () => {
          if (confirm(`Remove override mapping for keyword: '${item.key}'?`)) {
            overrides.splice(index, 1);
            await chrome.storage.local.set({ 'custom_overrides': overrides });
            showLog("Override mapping deleted.");
            loadOverrides();
            if (editingOverrideIndex === index) {
              resetOverrideForm();
            }
          }
        });

        overridesTableBody.appendChild(tr);
      });
    } catch(err) {
      console.error("Overrides loading failed:", err);
    }
  }

  function startEditOverride(index, key, val) {
    editingOverrideIndex = index;
    overrideKeyInput.value = key;
    overrideValueInput.value = val;
    overrideFormTitle.textContent = "Edit Field Override";
    btnCancelEdit.classList.remove('hidden');
    overrideValueInput.focus();
  }

  function resetOverrideForm() {
    editingOverrideIndex = -1;
    overrideForm.reset();
    overrideFormTitle.textContent = "Add Field Override";
    btnCancelEdit.classList.add('hidden');
  }

  btnCancelEdit.addEventListener('click', resetOverrideForm);

  // Form Submit Handler
  overrideForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = overrideKeyInput.value.trim();
    const val = overrideValueInput.value.trim();

    if (!key || !val) return;

    try {
      const result = await chrome.storage.local.get('custom_overrides');
      const overrides = result.custom_overrides || [];

      if (editingOverrideIndex > -1) {
        // Edit mode
        overrides[editingOverrideIndex] = { key, value: val };
        showLog("Override mapping updated!");
      } else {
        // Add mode -> Check duplicate key (case-insensitive)
        const duplicateIdx = overrides.findIndex(o => o.key.toLowerCase() === key.toLowerCase());
        if (duplicateIdx > -1) {
          overrides[duplicateIdx].value = val;
          showLog("Updated existing override with same key.");
        } else {
          overrides.push({ key, value: val });
          showLog("Override mapping added!");
        }
      }

      await chrome.storage.local.set({ 'custom_overrides': overrides });
      resetOverrideForm();
      loadOverrides();
    } catch(err) {
      showLog("Failed to write to local storage.", true);
    }
  });

  // --- GLOBAL SETTINGS LOGIC ---
  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get(['settings_phone_prefix', 'settings_email_domain']);
      document.getElementById('settings-phone-prefix').value = result.settings_phone_prefix || '';
      document.getElementById('settings-email-domain').value = result.settings_email_domain || '';
    } catch (err) {
      console.error("Settings loading failed:", err);
    }
  }

  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prefix = document.getElementById('settings-phone-prefix').value.trim();
      const domain = document.getElementById('settings-email-domain').value.trim();

      try {
        await chrome.storage.local.set({
          'settings_phone_prefix': prefix,
          'settings_email_domain': domain
        });
        showLog("Global settings saved successfully!");
      } catch (err) {
        showLog("Failed to write settings to local storage.", true);
      }
    });
  }

  // --- QUERY STRING PARSING & INITIATION ---
  function initRouting() {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') || 'vault';
    const editKey = params.get('edit');

    switchTab(tabParam);

    if (tabParam === 'overrides' && editKey) {
      loadOverrides(editKey);
    }
  }

  // Init
  initRouting();
});
