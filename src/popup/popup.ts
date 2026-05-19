// @ts-nocheck
/**
 * MockFill - Popup Controller
 * Connects UI actions to content scripts and chrome storage.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const connectionStatus = document.getElementById('connection-status');
  const currentUrlEl = document.getElementById('current-url');
  const fieldsCountEl = document.getElementById('fields-count');
  const formStatusEl = document.getElementById('form-status');
  
  const btnAutofill = document.getElementById('btn-autofill');
  const btnSave = document.getElementById('btn-save');
  const btnClearAll = document.getElementById('btn-clear-all');
  const btnReset = document.getElementById('btn-reset');
  
  const storageStatusEl = document.getElementById('storage-status');
  const timestampRow = document.getElementById('timestamp-row');
  const timestampVal = document.getElementById('timestamp-val');
  const logMessage = document.getElementById('log-message');
  const inactiveOverlay = document.getElementById('inactive-overlay');

  // Custom Field Overrides DOM Elements (Managed in options page)
  const overridesCount = null;
  const overridesContainer = null;
  const overrideKey = null;
  const overrideVal = null;
  const btnAddOverride = null;

  let activeTab = null;
  let tabUrl = "";

  // Helper: Write messages to log panel
  function updateLog(message, isError = false) {
    logMessage.textContent = message;
    logMessage.style.color = isError ? '#f43f5e' : '#94a3b8';
  }

  // Helper: Escape HTML strings to block XSS vulnerabilities
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Get active tab info
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      updateLog("Could not detect active browser tab.", true);
      return;
    }
    
    activeTab = tabs[0];
    tabUrl = activeTab.url || "";
    
    // Check if the URL is restricted (Chrome system pages or Web Store)
    const isRestricted = !tabUrl || 
      tabUrl.startsWith('chrome://') || 
      tabUrl.startsWith('chrome-extension://') || 
      tabUrl.startsWith('view-source:') ||
      tabUrl.includes('chrome.google.com/webstore') ||
      tabUrl.includes('chromewebstore.google.com');

    if (isRestricted) {
      showInactiveOverlay();
      return;
    }

    currentUrlEl.textContent = new URL(tabUrl).hostname;
    currentUrlEl.title = tabUrl;

    // Load and render custom overrides list
    await loadAndRenderOverrides();

    // Connect to content script, with fallback automatic script injection
    await initializeContentScript();
  } catch (err) {
    console.error("Popup setup error:", err);
    updateLog("System initialization failure.", true);
  }

  // Handle dynamic script injection and verify page stats
  async function initializeContentScript() {
    if (connectionStatus) connectionStatus.textContent = "Scanning";
    
    try {
      // Test if content script responds
      const stats = await requestPageStats();
      displayPageStats(stats);
    } catch (err) {
      // Content script has not loaded yet (e.g. freshly installed extension)
      // Inject dynamically to ensure seamless UX without needing a page refresh
      updateLog("Dynamic injector loading...");
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id, allFrames: true },
          files: ['data-generator.js', 'content.js']
        });
        
        // Retry request after small delay
        setTimeout(async () => {
          try {
            const stats = await requestPageStats();
            displayPageStats(stats);
          } catch (retryErr) {
            showInactiveOverlay();
          }
        }, 300);
      } catch (injectErr) {
        console.error("Script injection failed:", injectErr);
        showInactiveOverlay();
      }
    }
  }

  // Request stats from the tab
  function requestPageStats() {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(activeTab.id, { type: 'GET_PAGE_STATS' }, response => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Update popup dashboard elements with tab stats
  async function displayPageStats(stats) {
    if (!stats) return;

    if (connectionStatus) {
      connectionStatus.textContent = "Connected";
      connectionStatus.style.color = '#10b981';
    }
    
    const count = stats.fieldsDetected || 0;
    fieldsCountEl.textContent = count;

    if (count === 0) {
      if (formStatusEl) {
        formStatusEl.textContent = "No Fields";
        formStatusEl.className = "value status-badge badge-neutral";
      }
      btnAutofill.disabled = true;
      btnSave.disabled = true;
      btnReset.disabled = true;
    } else {
      if (formStatusEl) {
        formStatusEl.textContent = "Ready";
        formStatusEl.className = "value status-badge badge-active";
      }
      btnAutofill.disabled = false;
      btnSave.disabled = false;
      btnReset.disabled = false;
    }

    // Refresh Vault status
    await checkMatchingVaultStates();
  }

  // Check and render saved states that match current tab URL
  async function checkMatchingVaultStates() {
    if (!tabUrl) return;
    
    try {
      const allData = await chrome.storage.local.get(null);
      const vaultKeys = Object.keys(allData).filter(k => k.startsWith('vault_'));
      const matchingContainer = document.getElementById('matching-vault-states');
      
      if (!matchingContainer) return;
      
      matchingContainer.innerHTML = '';
      
      const currentTabCleanUrl = tabUrl.split('?')[0];
      const matches = vaultKeys
        .map(key => allData[key])
        .filter(entry => entry && entry.url && entry.url.split('?')[0] === currentTabCleanUrl);
        
      if (matches.length === 0) {
        matchingContainer.classList.add('hidden');
        return;
      }
      
      matchingContainer.classList.remove('hidden');
      
      matches.forEach(entry => {
        const row = document.createElement('div');
        row.className = 'matching-vault-row';
        
        row.innerHTML = `
          <span class="matching-vault-name" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</span>
          <button class="btn btn-primary btn-xs load-matching-vault" data-id="${entry.id}">Load</button>
        `;
        
        row.querySelector('.load-matching-vault').addEventListener('click', () => {
          updateLog("Loading saved state...");
          chrome.tabs.sendMessage(activeTab.id, { type: 'LOAD_SAVED_VALUES', data: entry.fields }, response => {
            if (chrome.runtime.lastError || !response || !response.success) {
              updateLog("Failed to inject vault data.", true);
            } else {
              updateLog(`Restored ${response.successCount} elements successfully!`);
            }
          });
        });
        
        matchingContainer.appendChild(row);
      });
    } catch (err) {
      console.error("Failed to load matching vault states:", err);
    }
  }

  // Render overlay if the page is inaccessible
  function showInactiveOverlay() {
    inactiveOverlay.classList.remove('hidden');
    if (connectionStatus) {
      connectionStatus.textContent = "Blocked";
      connectionStatus.style.color = '#f43f5e';
    }
    currentUrlEl.textContent = "Restricted URL";
    fieldsCountEl.textContent = "-";
    if (formStatusEl) {
      formStatusEl.textContent = "Inactive";
      formStatusEl.className = "value status-badge badge-error";
    }
    
    // Disable all actions
    btnAutofill.disabled = true;
    btnSave.disabled = true;
    if (btnClearAll) btnClearAll.disabled = true;
    btnReset.disabled = true;
    updateLog("MockFill is offline on this page.", true);
  }

  // --- URL COPY HANDLER ---
  const btnCopyUrl = document.getElementById('btn-copy-url');
  if (btnCopyUrl) {
    btnCopyUrl.addEventListener('click', () => {
      navigator.clipboard.writeText(tabUrl).then(() => {
        const originalHtml = btnCopyUrl.innerHTML;
        btnCopyUrl.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="#10b981" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`;
        setTimeout(() => { btnCopyUrl.innerHTML = originalHtml; }, 1500);
      });
    });
  }

  // --- DEDICATED PAGE LINKS ---
  document.getElementById('link-manage-vault').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html?tab=vault') });
  });

  const btnManageOverrides = document.getElementById('btn-manage-overrides');
  if (btnManageOverrides) {
    btnManageOverrides.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html?tab=overrides') });
    });
  }

  document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html?tab=settings') });
  });

  // --- CUSTOM OVERRIDES CONTROLLER ---
  async function loadAndRenderOverrides() {
    if (!overridesContainer) return;
    try {
      const result = await chrome.storage.local.get('custom_overrides');
      const overrides = result.custom_overrides || [];
      
      if (overridesCount) overridesCount.textContent = `${overrides.length} Active`;
      overridesContainer.innerHTML = "";

      if (overrides.length === 0) {
        overridesContainer.innerHTML = '<div class="empty-overrides-msg">No custom mappings active. Form fields will use random realistic data.</div>';
        return;
      }

      overrides.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'override-row';
        
        row.innerHTML = `
          <div class="override-meta">
            <span class="override-key-name">${escapeHtml(item.key)}</span>
            <span class="override-val-text">${escapeHtml(item.value)}</span>
          </div>
          <button class="override-delete-btn" title="Edit Override">
            <svg class="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        `;

        // Edit trigger -> Opens dedicated page in edit mode
        row.querySelector('.override-delete-btn').addEventListener('click', () => {
          chrome.tabs.create({ url: chrome.runtime.getURL(`options.html?tab=overrides&edit=${encodeURIComponent(item.key)}`) });
        });

        overridesContainer.appendChild(row);
      });
    } catch (err) {
      console.error("Overrides rendering failure:", err);
    }
  }

  // --- BUTTON CLICKS ---

  // 1. Auto Fill Form
  btnAutofill.addEventListener('click', () => {
    const btnText = btnAutofill.querySelector('.btn-text');
    const loader = btnAutofill.querySelector('.loader');
    
    btnText.textContent = "Analyzing & Injecting...";
    loader.classList.remove('hidden');
    btnAutofill.disabled = true;

    chrome.tabs.sendMessage(activeTab.id, { type: 'AUTO_FILL' }, response => {
      btnText.textContent = "⚡ Auto Fill Current Page";
      loader.classList.add('hidden');
      btnAutofill.disabled = false;

      if (chrome.runtime.lastError || !response || !response.success) {
        updateLog("Form Injection failed or timed out.", true);
      } else {
        updateLog(`Injected ${response.successCount} inputs! Failed: ${response.failedCount}.`);
      }
    });
  });

  // 2. Save Current Values
  let isPromptingForName = false;
  const vaultSaveNameInput = document.getElementById('vault-save-name');

  btnSave.addEventListener('click', () => {
    if (!isPromptingForName) {
      // First click: show the name input field
      vaultSaveNameInput.classList.remove('hidden');
      vaultSaveNameInput.focus();
      btnSave.innerHTML = `<svg class="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg> Confirm Save`;
      isPromptingForName = true;
      return;
    }

    // Second click: Validate name and proceed
    const customName = vaultSaveNameInput.value.trim();
    if (!customName) {
      updateLog("Please enter a name for this vault state.", true);
      vaultSaveNameInput.focus();
      return;
    }

    updateLog("Reading current page values...");
    
    chrome.tabs.sendMessage(activeTab.id, { type: 'GET_CURRENT_VALUES' }, async response => {
      if (chrome.runtime.lastError || !response || !response.fields) {
        updateLog("Could not capture form values.", true);
        return;
      }

      if (response.fields.length === 0) {
        updateLog("No interactive form fields found to save.", true);
        return;
      }

      // Check if at least one field has some non-empty/non-default data
      const hasSomeData = response.fields.some(field => {
        if (typeof field.value === 'string') {
          return field.value.trim().length > 0;
        }
        if (typeof field.value === 'boolean') {
          return field.value === true; // Checkbox or radio is checked
        }
        return field.value !== null && field.value !== undefined;
      });

      if (!hasSomeData) {
        updateLog("All fields are empty! Please fill the form first.", true);
        return;
      }

      // Generate a unique ID for this saved state
      const stateId = `vault_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const vaultPayload = {
        id: stateId,
        name: customName,
        url: tabUrl,
        savedAt: new Date().toISOString(),
        fields: response.fields
      };

      try {
        await chrome.storage.local.set({ [stateId]: vaultPayload });
        updateLog(`State '${customName}' saved!`);
        
        // Reset save UI
        vaultSaveNameInput.classList.add('hidden');
        vaultSaveNameInput.value = '';
        btnSave.innerHTML = `<svg class="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg> Save Filled Data`;
        isPromptingForName = false;
        
        // Refresh matching states list in popup
        await checkMatchingVaultStates();
      } catch (err) {
        updateLog("Failed to write to local vault.", true);
      }
    });
  });

  // 3. Reset Form elements
  btnReset.addEventListener('click', () => {
    updateLog("Clearing all fields...");
    chrome.tabs.sendMessage(activeTab.id, { type: 'RESET_FORM' }, response => {
      if (chrome.runtime.lastError || !response || !response.success) {
        updateLog("Form reset command failed.", true);
      } else {
        updateLog("Form fields reset to default empty state.");
      }
    });
  });
});
