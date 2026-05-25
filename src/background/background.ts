// @ts-nocheck
/**
 * InstaFill - Service Worker (Background Script)
 * Manages context menu registrations, keyboard hotkeys, and script injections.
 */

// 1. Context Menus Registration on Install
chrome.runtime.onInstalled.addListener((details) => {
  // Show welcome page on first install
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'welcome.html' });
  }

  // Parent Menu
  chrome.contextMenus.create({
    id: "instafill_parent",
    title: "InstaFill",
    contexts: ["page", "editable"]
  });

  // Action Submenus
  chrome.contextMenus.create({
    id: "instafill_autofill",
    parentId: "instafill_parent",
    title: "⚡ Auto Fill Current Page",
    contexts: ["page", "editable"]
  });

  chrome.contextMenus.create({
    id: "instafill_save",
    parentId: "instafill_parent",
    title: "💾 Save Form State",
    contexts: ["page", "editable"]
  });

  chrome.contextMenus.create({
    id: "instafill_load",
    parentId: "instafill_parent",
    title: "🔄 Load Form State",
    contexts: ["page", "editable"]
  });

  chrome.contextMenus.create({
    id: "instafill_reset",
    parentId: "instafill_parent",
    title: "🧹 Reset Form Fields",
    contexts: ["page", "editable"]
  });
});

// Helper: Ensure script is injected and send tab messages safely
async function safeSendMessage(tabId, tabUrl, messagePayload) {
  const isRestricted = !tabUrl || 
    tabUrl.startsWith('chrome://') || 
    tabUrl.startsWith('chrome-extension://') || 
    tabUrl.startsWith('view-source:') ||
    tabUrl.includes('chrome.google.com/webstore') ||
    tabUrl.includes('chromewebstore.google.com');

  if (isRestricted) {
    console.warn("InstaFill cannot run on restricted page:", tabUrl);
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, messagePayload);
  } catch (err) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId, allFrames: true },
        files: ['content.js']
      });

      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, messagePayload).catch(e => {
          console.error("Message retry failed:", e);
        });
      }, 150);
    } catch (injectErr) {
      console.error("Background injection helper failed:", injectErr);
    }
  }
}

// 2. Listen to Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab) return;
  const tabId = tab.id;
  const tabUrl = tab.url || "";

  switch (info.menuItemId) {
    case "instafill_autofill":
      await safeSendMessage(tabId, tabUrl, { type: "AUTO_FILL" });
      break;

    case "instafill_save":
      try {
        const response = await chrome.tabs.sendMessage(tabId, { type: "GET_CURRENT_VALUES" });
        if (response && response.fields && response.fields.length > 0) {
          const stateId = `vault_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          let domainName = "Page";
          try {
            domainName = new URL(tabUrl).hostname;
          } catch (urlErr) {}
          
          const vaultPayload = {
            id: stateId,
            name: `Context Menu - ${domainName}`,
            url: tabUrl,
            savedAt: new Date().toISOString(),
            fields: response.fields
          };
          await chrome.storage.local.set({ [stateId]: vaultPayload });
          console.log("InstaFill state saved successfully via context menu.");
        }
      } catch (err) {
        await safeSendMessage(tabId, tabUrl, { type: "GET_CURRENT_VALUES" });
      }
      break;
 
    case "instafill_load":
      try {
        const allData = await chrome.storage.local.get(null);
        const vaultKeys = Object.keys(allData).filter(k => k.startsWith('vault_'));
        const currentCleanUrl = tabUrl.split('?')[0];
        
        const matches = vaultKeys
          .map(k => allData[k])
          .filter(entry => entry && entry.url && entry.url.split('?')[0] === currentCleanUrl);
          
        if (matches.length > 0) {
          // Sort by savedAt descending (newest first)
          matches.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
          const newestMatch = matches[0];
          await safeSendMessage(tabId, tabUrl, { type: "LOAD_SAVED_VALUES", data: newestMatch.fields });
        }
      } catch (err) {
        console.error("Background Load State error:", err);
      }
      break;

    case "instafill_reset":
      await safeSendMessage(tabId, tabUrl, { type: "RESET_FORM" });
      break;
  }
});

// 3. Listen for global keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "quick_fill") {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        const activeTab = tabs[0];
        await safeSendMessage(activeTab.id, activeTab.url || "", { type: "AUTO_FILL" });
      }
    } catch (err) {
      console.error("Keyboard shortcut command failed:", err);
    }
  }
});
