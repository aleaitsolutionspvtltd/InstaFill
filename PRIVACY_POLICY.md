# Privacy Policy for InstaFill (MockFill)

**Last updated:** May 19, 2026

InstaFill ("the Extension") is a developer and QA tool designed to automatically fill web forms with mock data. We believe in strict privacy and data security.

### 1. Data Collection and Usage
The Extension **does not** collect, transmit, distribute, or sell any personal data, analytics, or usage metrics. All operations, including generating mock data and interacting with web pages, happen completely locally on your device.

### 2. Local Storage
The Extension uses your browser's local storage (`chrome.storage.local`) exclusively to save form configurations when you explicitly use the "Save Form State" feature (the Local Persistence Vault). This data remains securely on your device, never leaves your browser, and is not accessible by the developer or any third parties.

### 3. Permissions Justification
*   **`activeTab` & `scripting`:** Used solely to inject the mock data into the forms on the specific page you are currently testing.
*   **`contextMenus`:** Used to provide a right-click menu for quick access to the extension's tools.
*   **`storage`:** Used exclusively for your local persistence vault.
*   **`Host Permissions (<all_urls>)`:** Required because the extension must be able to inject mock data on arbitrary development, staging, and production URLs that you choose to test.

### 4. Third-Party Services
The Extension does not use any external APIs, trackers, or third-party services. It operates entirely offline after installation.

### 5. Contact
If you have any questions or concerns regarding this privacy policy, please contact the developer via the support email listed on the Chrome Web Store or open an issue on the project's GitHub repository.
