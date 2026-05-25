// @ts-nocheck
import { InstaFillDataGenerator } from '../data-generator/data-generator';

// Find user-defined custom override mapping
export function findOverrideValue(element, fieldType, overrides) {
  if (!overrides || overrides.length === 0) return null;

  const id = (element.id || '').toLowerCase();
  const name = (element.name || '').toLowerCase();
  const placeholder = (element.placeholder || '').toLowerCase();
  
  let labelText = "";
  if (element.labels && element.labels.length > 0) {
    labelText = Array.from(element.labels).map(lbl => lbl.innerText).join(' ');
  }
  labelText = labelText.toLowerCase();

  for (const override of overrides) {
    const oKey = override.key.toLowerCase().trim();
    if (oKey === fieldType) {
      return override.value;
    }
  }

  for (const override of overrides) {
    const oKey = override.key.toLowerCase().trim();
    if (oKey && (id.includes(oKey) || name.includes(oKey) || placeholder.includes(oKey) || labelText.includes(oKey))) {
      return override.value;
    }
  }

  return null;
}

// Native descriptor value injector (controlled inputs compatible)
export function forceInjectValue(element, value) {
  let prototype = null;
  let property = 'value';

  if (element instanceof HTMLInputElement) {
    prototype = window.HTMLInputElement.prototype;
    if (element.type === 'checkbox' || element.type === 'radio') {
      property = 'checked';
    }
  } else if (element instanceof HTMLTextAreaElement) {
    prototype = window.HTMLTextAreaElement.prototype;
  } else if (element instanceof HTMLSelectElement) {
    prototype = window.HTMLSelectElement.prototype;
  }

  if (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element[property] = value;
    }
  } else {
    element[property] = value;
  }

  element.dispatchEvent(new Event('focus', { bubbles: true }));
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  if (element.tagName === 'TEXTAREA' || (element.tagName === 'INPUT' && !['checkbox', 'radio', 'date', 'time', 'datetime-local'].includes(element.type))) {
    const lastChar = String(value).slice(-1);
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: lastChar }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: lastChar }));
  }
  
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

// Select random select option
export function fillSelectElement(selectEl) {
  const options = Array.from(selectEl.options).filter(opt => !opt.disabled);
  if (options.length === 0) return;

  let activeOptions = options.filter((opt, idx) => {
    const val = opt.value.trim();
    const txt = opt.text.trim().toLowerCase();
    if (idx === 0 && (val === '' || txt.includes('select') || txt.includes('choose') || txt.includes('--'))) {
      return false;
    }
    return true;
  });

  if (activeOptions.length === 0) {
    activeOptions = options;
  }

  const selectedOption = activeOptions[Math.floor(Math.random() * activeOptions.length)];
  forceInjectValue(selectEl, selectedOption.value);
}

// Polling helper: Await dependent select options
export function waitForSelectOptions(selectEl, timeout = 3000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    function check() {
      if (selectEl.options && selectEl.options.length > 1) {
        const hasRealOption = Array.from(selectEl.options).some(opt => {
          const val = opt.value.trim();
          const txt = opt.text.trim().toLowerCase();
          return val !== "" && !txt.includes('select') && !txt.includes('choose') && !txt.includes('--');
        });
        
        if (hasRealOption) {
          resolve(true);
          return;
        }
      }
      
      if (Date.now() - startTime > timeout) {
        resolve(false);
      } else {
        setTimeout(check, 100);
      }
    }
    
    check();
  });
}

// Polling helper: Await custom combobox trigger readiness
export function awaitComboboxReady(element, timeout = 1200) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    function check() {
      const isBtnDisabled = element.disabled || element.getAttribute('aria-disabled') === 'true';
      const innerTxt = (element.innerText || element.textContent || '').toLowerCase();
      const isLoading = innerTxt.includes('loading') || innerTxt.includes('fetching');
      
      if (!isBtnDisabled && !isLoading) {
        resolve(true);
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        resolve(false);
      } else {
        setTimeout(check, 40);
      }
    }
    check();
  });
}

// Unified dynamic element awaiter
export async function awaitElementReadyForFilling(el, timeout = 1200) {
  const isCustomCombobox = el.tagName === 'BUTTON' || el.getAttribute('role') === 'combobox';
  if (isCustomCombobox) {
    await awaitComboboxReady(el, timeout);
  } else if (el.tagName === 'SELECT') {
    await waitForSelectOptions(el, timeout);
  } else {
    await new Promise(r => setTimeout(r, 60));
  }
}

// Automate dynamic/custom combobox dropdown selection
export async function fillCustomCombobox(comboboxEl, targetValue = null, fieldType = 'country') {
  // For <span role="combobox">, the real trigger is often a parent/ancestor.
  // Build a list of elements to try clicking, from most specific to least.
  const clickTargets = [comboboxEl];
  if (comboboxEl.tagName === 'SPAN' || comboboxEl.tagName === 'DIV') {
    // Walk up to find the closest button, [role="button"], or direct parent
    let ancestor = comboboxEl.parentElement;
    for (let i = 0; i < 4 && ancestor; i++) {
      if (ancestor.tagName === 'BUTTON' || ancestor.getAttribute('role') === 'button') {
        clickTargets.unshift(ancestor); // prefer button ancestors
        break;
      }
      if (i === 0) clickTargets.push(ancestor); // always add immediate parent as fallback
      ancestor = ancestor.parentElement;
    }
  }

  // Helper: click a target and poll for options appearing in the DOM
  async function tryClickAndPoll(triggerEl) {
    triggerEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    let options = [];
    const startTime = Date.now();
    while (Date.now() - startTime < 1000) {
      options = Array.from(document.querySelectorAll(
        '[role="option"], [data-radix-collection-item], .select-item, [role="listbox"] [role="option"], [role="listbox"] li'
      ));

      const hasRealOptions = options.some(opt => {
        const text = opt.innerText.toLowerCase();
        return !text.includes('loading') && !text.includes('fetching') && !text.includes('searching') && text.trim() !== "";
      });

      if (options.length > 0 && hasRealOptions) return options;
      await new Promise(r => setTimeout(r, 30));
    }
    return [];
  }

  // Try each click target in order until options appear
  let options = [];
  for (const target of clickTargets) {
    options = await tryClickAndPoll(target);
    if (options.length > 0) break;
  }

  // Brief settle spacing for portal animation
  await new Promise(r => setTimeout(r, 45));

  // Silently bail if nothing opened — don't pollute logs
  if (options.length === 0) {
    comboboxEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return false;
  }

  let selectedOption = null;
  if (targetValue) {
    const cleanTarget = String(targetValue).toLowerCase().trim();
    selectedOption = options.find(opt => {
      const text = opt.innerText.toLowerCase().trim();
      return text === cleanTarget || text.includes(cleanTarget) || cleanTarget.includes(text);
    });

    // Smart fallback for timezone matching (e.g. "Asia/Kolkata" -> matches option containing "kolkata")
    if (!selectedOption && fieldType === 'timezone') {
      const parts = cleanTarget.split('/');
      const tzCity = parts[parts.length - 1].replace(/[_-]/g, ' ');
      if (tzCity) {
        selectedOption = options.find(opt => {
          const text = opt.innerText.toLowerCase().trim();
          return text.includes(tzCity);
        });
      }
    }

    // Smart fallback for state matching if option lists only state codes (e.g. full name "New York" -> matches "NY")
    if (!selectedOption && fieldType === 'state') {
      const generator = new InstaFillDataGenerator();
      const address = generator.addressDataset();
      const isIndia = /india|\bin\b/i.test(cleanTarget);
      const stateCode = (isIndia ? generator.addressDataset('IN').stateCode : address.stateCode).toLowerCase();

      selectedOption = options.find(opt => {
        const text = opt.innerText.toLowerCase().trim();
        return text === stateCode || text.includes(`(${stateCode})`) || text.includes(` ${stateCode}`);
      });
    }
  }

  if (!selectedOption) {
    const activeOptions = options.filter(opt => {
      const text = opt.innerText.toLowerCase().trim();
      return !text.includes('select') && !text.includes('choose') && !text.includes('--') && text !== "";
    });
    const pool = activeOptions.length > 0 ? activeOptions : options;
    selectedOption = pool[Math.floor(Math.random() * pool.length)];
  }

  if (selectedOption) {
    selectedOption.click();
    await new Promise(resolve => setTimeout(resolve, 60));
    return selectedOption.innerText;
  }

  comboboxEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return false;
}

// Select select option matching override value
export function fillSelectWithSpecificValue(selectEl, customValue) {
  const valClean = String(customValue).toLowerCase().trim();
  const options = Array.from(selectEl.options);

  const exactMatch = options.find(opt => 
    opt.value.toLowerCase().trim() === valClean || 
    opt.text.toLowerCase().trim() === valClean
  );

  if (exactMatch) {
    forceInjectValue(selectEl, exactMatch.value);
    return true;
  }

  const substringMatch = options.find(opt => 
    opt.value.toLowerCase().includes(valClean) || 
    opt.text.toLowerCase().includes(valClean)
  );

  if (substringMatch) {
    forceInjectValue(selectEl, substringMatch.value);
    return true;
  }

  return false;
}

// Unified generic dropdown fields handler
export async function fillDropdownField(el, fieldType, targetValue, overrides) {
  const isCustomCombobox = el.tagName === 'BUTTON' || el.getAttribute('role') === 'combobox';
  const customOverrideVal = findOverrideValue(el, fieldType, overrides);
  const finalVal = customOverrideVal !== null ? customOverrideVal : targetValue;
  
  if (isCustomCombobox) {
    return await fillCustomCombobox(el, finalVal, fieldType);
  } else if (el.tagName === 'SELECT') {
    await waitForSelectOptions(el, 3000);
    const matched = fillSelectWithSpecificValue(el, finalVal);
    if (!matched) fillSelectElement(el);
    return el.value;
  } else {
    forceInjectValue(el, finalVal);
    return finalVal;
  }
}
