// @ts-nocheck
// Retrieve all form elements, traversing accessible same-origin iframes recursively
export function getFormElements(doc = document) {
  let elements = Array.from(doc.querySelectorAll('input, textarea, select, button[role="combobox"], [role="combobox"]'));

  const iframes = doc.querySelectorAll('iframe');
  for (const iframe of iframes) {
    try {
      if (iframe.contentDocument) {
        elements = elements.concat(getFormElements(iframe.contentDocument));
      }
    } catch (e) {
      // Cross-origin iframe - blocked by browser security, skip silently
    }
  }
  return elements;
}

// Filter elements to get only valid, visible, and interactive inputs
export function filterInteractiveElements(elements) {
  return elements.filter(el => {
    if (el.tagName === 'INPUT' && ['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(el.type)) {
      return false;
    }
    
    if (el.disabled || el.readOnly) {
      return false;
    }

    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const isVisible = el.offsetWidth > 0 || el.offsetHeight > 0 || rect.width > 0 || rect.height > 0;
    const isStyleVisible = style.display !== 'none' && style.visibility !== 'hidden';
    
    return isVisible && isStyleVisible;
  });
}

// Generate unique CSS selector
export function generateUniqueSelector(el) {
  if (el.id && !/^\d|mui|react|vue|angular|[\s:.]/i.test(el.id)) {
    return `#${CSS.escape(el.id)}`;
  }

  if (el.name && document.querySelectorAll(`[name="${CSS.escape(el.name)}"]`).length === 1) {
    return `[name="${CSS.escape(el.name)}"]`;
  }

  const placeholder = el.getAttribute('placeholder');
  if (placeholder && document.querySelectorAll(`[placeholder="${CSS.escape(placeholder)}"]`).length === 1) {
    return `[placeholder="${CSS.escape(placeholder)}"]`;
  }

  let path = [];
  let current = el;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let tagName = current.nodeName.toLowerCase();
    if (current.id && !/^\d|mui|react|vue|angular|[\s:.]/i.test(current.id)) {
      path.unshift(`${tagName}#${CSS.escape(current.id)}`);
      break;
    } else {
      let sibling = current;
      let nth = 1;
      while (sibling = sibling.previousElementSibling) {
        if (sibling.nodeName.toLowerCase() === current.nodeName.toLowerCase()) {
          nth++;
        }
      }
      path.unshift(`${tagName}:nth-of-type(${nth})`);
    }
    current = current.parentNode;
  }
  return path.join(' > ');
}
