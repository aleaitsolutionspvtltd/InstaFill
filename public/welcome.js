document.addEventListener('DOMContentLoaded', () => {
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnCloseWelcome = document.getElementById('btn-close-welcome');
  const linkDoc = document.getElementById('link-doc');
  const linkSupport = document.getElementById('link-support');

  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
  }

  if (btnCloseWelcome) {
    btnCloseWelcome.addEventListener('click', () => {
      window.close();
    });
  }

  if (linkDoc) {
    linkDoc.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Documentation coming soon!');
    });
  }

  if (linkSupport) {
    linkSupport.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Support page coming soon!');
    });
  }
});
