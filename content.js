/**
 * MockFill - Content Script
 * Scans forms, detects field types semantically, injects values,
 * coordinates overrides, automates dependent dropdowns, and records templates.
 */

(function () {
  // Ensure we don't double-initialize
  if (window.MockFillInitialized) return;
  window.MockFillInitialized = true;

  // Retrieve all form elements, traversing accessible same-origin iframes recursively
  function getFormElements(doc = document) {
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
  function filterInteractiveElements(elements) {
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

  // Helper: Split camelCase and replace snake_case/hyphens with spaces for maximum semantic precision
  function cleanToken(token) {
    if (!token) return "";
    return token
      .replace(/([a-z])([A-Z])/g, '$1 $2') // split camelCase
      .replace(/[_-]/g, ' ')               // replace snake_case and kebab-case with spaces
      .toLowerCase()
      .trim();
  }

  // Extract all textual context for an input element to perform semantic analysis
  function getElementContextText(el) {
    let texts = [];

    if (el.id) texts.push(cleanToken(el.id));
    if (el.name) texts.push(cleanToken(el.name));
    if (el.placeholder) texts.push(cleanToken(el.placeholder));
    if (el.getAttribute('placeholder')) texts.push(cleanToken(el.getAttribute('placeholder')));
    if (el.getAttribute('data-placeholder')) texts.push(cleanToken(el.getAttribute('data-placeholder')));
    if (el.getAttribute('aria-label')) texts.push(cleanToken(el.getAttribute('aria-label')));
    if (el.getAttribute('autocomplete')) texts.push(cleanToken(el.getAttribute('autocomplete')));
    if (el.className) texts.push(cleanToken(el.className));
    if (el.innerText && el.innerText.length < 100) texts.push(cleanToken(el.innerText));

    if (el.labels && el.labels.length > 0) {
      Array.from(el.labels).forEach(lbl => texts.push(cleanToken(lbl.innerText)));
    }

    if (el.id) {
      const explicitLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (explicitLabel) {
        texts.push(cleanToken(explicitLabel.innerText));
      }
    }

    // Try preceding sibling label
    let prevEl = el.previousElementSibling;
    while (prevEl) {
      if (prevEl.tagName === 'LABEL') {
        texts.push(cleanToken(prevEl.innerText));
        break;
      }
      prevEl = prevEl.previousElementSibling;
    }

    const parentLabel = el.closest('label');
    if (parentLabel) {
      texts.push(cleanToken(parentLabel.innerText));
    }

    let sibling = el.previousElementSibling;
    if (sibling && (sibling.tagName === 'LABEL' || sibling.tagName === 'SPAN' || (sibling.tagName === 'DIV' && sibling.innerText.trim().length < 60))) {
      texts.push(cleanToken(sibling.innerText));
    }

    return texts.join(' | ');
  }

  // Analyze element contexts and return a semantic type
  function detectFieldType(el) {
    const context = getElementContextText(el);
    const typeAttr = (el.getAttribute('type') || '').toLowerCase();

    // 1. Specific High-Priority Semantic Handlers
    if (typeAttr === 'email' || /\bemail\b|\bmail\b/i.test(context)) {
      return 'email';
    }

    if (typeAttr === 'password' || /\bpass\b|\bpwd\b|\bsecret\b/i.test(context)) {
      return 'password';
    }

    if (typeAttr === 'tel' || /\bphone\b|\bmobile\b|\btel\b|\bwhatsapp\b|\bphone_number\b|\bcontact.*number\b|\bcontact.*phone\b/i.test(context)) {
      return 'phone';
    }

    if (/\bapi.*key\b|\bapikey\b|\bsecret.*key\b|\bauth.*key\b|\btoken\b/i.test(context)) {
      return 'api_key';
    }

    if (/\bheader\b|\bheaders\b/i.test(context)) {
      return 'json_headers';
    }

    if (/\bjson\b|\bstatic.*value\b|\bpayload\b/i.test(context)) {
      return 'json_values';
    }

    if (/\bzip\b|\bpostal\b|\bpincode\b/i.test(context)) {
      return 'zip';
    }

    if (/\baddress.*2\b|\baddress.*line.*2\b|\bsuite\b|\bapt\b|\bapartment\b|\bunit\b/i.test(context)) {
      return 'address_line2';
    }

    if (/\baddress\b|\bstreet\b|\baddr\b|\blocality\b/i.test(context)) {
      return 'address_line1';
    }

    if (/\bcity\b|\btown\b/i.test(context)) {
      return 'city';
    }

    if (/\bstate\b|\bprovince\b|\bregion\b/i.test(context)) {
      return 'state';
    }

    if (/\bcountry\b/i.test(context)) {
      return 'country';
    }

    if (/\btimezone\b|\btime\s*zone\b|\btz\b/i.test(context)) {
      return 'timezone';
    }

    if (typeAttr === 'url' || /\burl\b|\bwebsite\b|\bweb.*site\b|\bdomain\b|\bhomepage\b/i.test(context)) {
      return 'url';
    }

    if (/\bcompany\b|\borganization\b|\borg\b|\bemployer\b/i.test(context)) {
      return 'company';
    }

    if (/\busername\b|\buser_name\b|\blogin\b/i.test(context)) {
      return 'username';
    }

    if (typeAttr === 'number' || typeAttr === 'range' || /\bnumber\b|\bprice\b|\bamount\b|\bcost\b|\bcharge\b|\bquantity\b|\bqty\b/i.test(context)) {
      return 'number';
    }

    if (typeAttr === 'color') {
      return 'color';
    }

    if (typeAttr === 'date' || /\bdate\b|\bdob\b|\bbirth\b|\bbirthdate\b/i.test(context)) {
      return 'date';
    }

    if (typeAttr === 'time' || /\btime\b/i.test(context)) {
      return 'time';
    }

    if (typeAttr === 'datetime-local' || /\bdatetime\b/i.test(context)) {
      return 'datetime';
    }

    // 2. Name Handlers (Positioned after specific ones, matching strictly)
    if (/\bfirst.*name\b|\bforename\b|\bgiven.*name\b|\bfname\b/i.test(context)) {
      return 'first_name';
    }
    
    if (/\blast.*name\b|\bsurname\b|\bfamily.*name\b|\blname\b/i.test(context)) {
      return 'last_name';
    }
    
    if (/\bfull.*name\b|\bdisplay.*name\b/i.test(context) || (/\bname\b/i.test(context) && !/\bcompany\b|\borg\b|\bcard\b|\buser\b/i.test(context))) {
      return 'full_name';
    }

    // 3. Fallbacks
    if (el.tagName === 'TEXTAREA') return 'textarea';
    if (el.tagName === 'SELECT') return 'select';
    if (typeAttr === 'checkbox') return 'checkbox';
    if (typeAttr === 'radio') return 'radio';

    return 'text';
  }

  // Find user-defined custom override mapping
  function findOverrideValue(element, fieldType, overrides) {
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
  function forceInjectValue(element, value) {
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
  function fillSelectElement(selectEl) {
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
  function waitForSelectOptions(selectEl, timeout = 3000) {
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
  function awaitComboboxReady(element, timeout = 1200) {
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
  async function awaitElementReadyForFilling(el, timeout = 1200) {
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
  async function fillCustomCombobox(comboboxEl, targetValue = null, fieldType = 'country') {
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
        const generator = new window.MockFillDataGenerator();
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

  // Unified generic dropdown fields handler
  async function fillDropdownField(el, fieldType, targetValue, overrides) {
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

  // Select select option matching override value
  function fillSelectWithSpecificValue(selectEl, customValue) {
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

  // Generate unique CSS selector
  function generateUniqueSelector(el) {
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

  // Core Smart Asynchronous Fill Router
  async function fillAllInputs() {
    const storageResult = await chrome.storage.local.get(['custom_overrides', 'settings_phone_prefix', 'settings_email_domain']);
    const overrides = storageResult.custom_overrides || [];
    const phonePrefix = storageResult.settings_phone_prefix || '';
    const emailDomain = storageResult.settings_email_domain || 'yopmail.com';

    // Instantiate MockFillDataGenerator
    const generator = new window.MockFillDataGenerator();
    generator.customPhonePrefix = phonePrefix;
    generator.customEmailDomain = emailDomain;
    
    const firstName = generator.firstName();
    const lastName = generator.lastName();
    const fullName = `${firstName} ${lastName}`;
    const email = generator.email(firstName, lastName);
    const password = generator.password();
    const address = generator.addressDataset();

    const rawElements = getFormElements();
    const fields = filterInteractiveElements(rawElements);

    let successCount = 0;
    let failedCount = 0;

    const countryFields = [];
    const stateFields = [];
    const cityFields = [];
    const genericComboboxFields = [];
    const radioGroups = {};

    // --- PHASE 1: FILL STANDARD TEXT/DATES/NUMBERS ---
    for (const el of fields) {
      try {
        const fieldType = detectFieldType(el);

        // A. Custom Overrides check: Always takes high priority!
        // We handle custom overrides for non-dependent fields immediately here.
        if (fieldType !== 'country' && fieldType !== 'state' && fieldType !== 'city' && fieldType !== 'timezone') {
          const customOverrideVal = findOverrideValue(el, fieldType, overrides);
          if (customOverrideVal !== null) {
            if (el.tagName === 'SELECT') {
              const matched = fillSelectWithSpecificValue(el, customOverrideVal);
              if (!matched) fillSelectElement(el);
            } else if (el.type === 'checkbox' || el.type === 'radio') {
              const checkState = String(customOverrideVal).toLowerCase().trim() === 'true' || customOverrideVal === true || customOverrideVal === 1;
              forceInjectValue(el, checkState);
            } else {
              forceInjectValue(el, customOverrideVal);
            }
            successCount++;
            continue;
          }
        }

        // B. Route Country, State, and City fields to their respective deferred arrays
        if (fieldType === 'country') {
          countryFields.push(el);
          continue;
        } else if (fieldType === 'state') {
          stateFields.push(el);
          continue;
        } else if (fieldType === 'city') {
          cityFields.push(el);
          continue;
        }

        // Handle generic select elements
        if (el.tagName === 'SELECT') {
          fillSelectElement(el);
          successCount++;
          continue;
        }

        // Handle generic custom combobox elements (like Timezone, Currency, Language, Gender, etc.)
        const isCustomCombobox = el.tagName === 'BUTTON' || el.getAttribute('role') === 'combobox';
        if (isCustomCombobox) {
          genericComboboxFields.push(el);
          continue;
        }

        // C. Radio Buttons
        if (el.tagName === 'INPUT' && el.type === 'radio') {
          const groupName = el.name || 'unnamed_radios';
          if (!radioGroups[groupName]) radioGroups[groupName] = [];
          radioGroups[groupName].push(el);
          continue;
        }

        // D. Checkboxes
        if (el.tagName === 'INPUT' && el.type === 'checkbox') {
          forceInjectValue(el, Math.random() > 0.5);
          successCount++;
          continue;
        }

        // E. Standard semantic types router
        let val = "";
        switch (fieldType) {
          case 'first_name':
            val = firstName;
            break;
          case 'last_name':
            val = lastName;
            break;
          case 'full_name':
            val = fullName;
            break;
          case 'email':
            val = email;
            break;
          case 'phone':
            val = generator.phone();
            break;
          case 'api_key':
            val = generator.apiKey();
            break;
          case 'json_headers':
            val = generator.jsonHeaders();
            break;
          case 'json_values':
            val = generator.jsonStaticValues();
            break;
          case 'color':
            val = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
            break;
          case 'date':
            val = generator.date(el.min, el.max);
            break;
          case 'time':
            val = generator.time();
            break;
          case 'datetime':
            val = generator.datetimeLocal(el.min, el.max);
            break;
          case 'password':
            val = password;
            break;
          case 'timezone':
            val = address.timezone || (generator.region === 'in' ? 'Asia/Kolkata' : 'America/New_York');
            break;
          case 'zip':
            val = address.zip;
            break;
          case 'address_line1':
            val = address.street;
            break;
          case 'address_line2':
            val = Math.random() > 0.5 ? `Plot ${generator._randomInt(1, 400)}` : '';
            break;
          case 'url':
            val = generator.website();
            break;
          case 'username':
            val = firstName.toLowerCase() + generator._randomInt(10, 99);
            break;
          case 'company':
            val = generator.company();
            break;
          case 'number':
            const min = el.min !== "" ? el.min : null;
            const max = el.max !== "" ? el.max : null;
            const step = el.step !== "" ? el.step : 1;
            const isInt = !String(step).includes('.');
            val = generator.number(min, max, isInt, Number(step));
            break;
          case 'textarea':
            val = generator.paragraph();
            break;
          case 'text':
          default:
            const placeholder = (el.placeholder || '').toLowerCase();
            const textCtx = getElementContextText(el);
            if (/company|organization|employer/i.test(placeholder) || /company/i.test(textCtx)) {
              val = generator.company();
            } else if (/job|title|position|role/i.test(placeholder) || /job|title|role/i.test(textCtx)) {
              val = generator._randomItem(["Software Engineer", "Product Manager", "UI Designer", "System Analyst"]);
            } else if (/endpoint|webhook|integration|config|url|link/i.test(textCtx)) {
              val = generator._randomItem(["Production Webhook", "Test Endpoint", "Staging Integration", "System Config"]);
            } else {
              val = generator._randomItem(["Test Value", "Sample Data", "Demo Input", "Mock String", "MockFill"]);
            }
            break;
        }

        if (el.maxLength && el.maxLength > 0) {
          val = String(val).substring(0, el.maxLength);
        }

        forceInjectValue(el, val);
        successCount++;
      } catch (err) {
        console.error("MockFill field fill failed:", el, err);
        failedCount++;
      }
    }

    Object.keys(radioGroups).forEach(groupName => {
      try {
        const groupElements = radioGroups[groupName];
        const selectedRadio = groupElements[Math.floor(Math.random() * groupElements.length)];
        forceInjectValue(selectedRadio, true);
        successCount += groupElements.length;
      } catch (err) {
        failedCount++;
      }
    });

    // --- PHASE 2: AUTOMATE COUNTRY FIELDS ---
    let selectedCountryText = address.country;
    for (const countryEl of countryFields) {
      try {
        const filledVal = await fillDropdownField(countryEl, 'country', address.country, overrides);
        if (filledVal) {
          selectedCountryText = filledVal;
        }
        successCount++;
      } catch (err) {
        console.error("MockFill country fill failed:", err);
        failedCount++;
      }
    }

    // --- PHASE 3: AUTOMATE STATE FIELDS (WITH SMART DELAY) ---
    if (stateFields.length > 0) {
      if (countryFields.length > 0) {
        console.log("Waiting 400ms for country cascade to initialize...");
        await new Promise(resolve => setTimeout(resolve, 400));
        console.log("Awaiting dynamic state options to populate...");
        await awaitElementReadyForFilling(stateFields[0], 1500);
      }
      
      const isIndia = /india|\bin\b/i.test(selectedCountryText);
      const targetState = isIndia ? generator.addressDataset('IN').state : address.state;
      const targetStateCode = isIndia ? generator.addressDataset('IN').stateCode : address.stateCode;

      for (const stateEl of stateFields) {
        try {
          const stateVal = stateEl.maxLength && stateEl.maxLength <= 3 ? targetStateCode : targetState;
          await fillDropdownField(stateEl, 'state', stateVal, overrides);
          successCount++;
        } catch (err) {
          console.error("MockFill state fill failed:", err);
          failedCount++;
        }
      }
    }

    // --- PHASE 4: AUTOMATE CITY FIELDS (WITH SMART DELAY) ---
    if (cityFields.length > 0) {
      if (stateFields.length > 0) {
        console.log("Waiting 400ms for state cascade to initialize...");
        await new Promise(resolve => setTimeout(resolve, 400));
        console.log("Awaiting dynamic city options to populate...");
        await awaitElementReadyForFilling(cityFields[0], 1500);
      }
      
      const isIndia = /india|\bin\b/i.test(selectedCountryText);
      const targetCity = isIndia ? generator.addressDataset('IN').city : address.city;

      for (const cityEl of cityFields) {
        try {
          await fillDropdownField(cityEl, 'city', targetCity, overrides);
          successCount++;
        } catch (err) {
          console.error("MockFill city fill failed:", err);
          failedCount++;
        }
      }
    }

    // --- PHASE 5: AUTOMATE GENERIC CUSTOM COMBOBOX FIELDS (TIMEZONE, LANGUAGE, ETC.) ---
    if (genericComboboxFields.length > 0) {
      const geoFieldsFilled = countryFields.length > 0 || stateFields.length > 0 || cityFields.length > 0;
      if (geoFieldsFilled) {
        console.log("Waiting 400ms for geographic cascades to settle before filling generic comboboxes...");
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      for (const comboboxEl of genericComboboxFields) {
        try {
          const fieldType = detectFieldType(comboboxEl);
          let targetVal = null;
          if (fieldType === 'timezone') {
            targetVal = address.timezone || (generator.region === 'in' ? 'Asia/Kolkata' : 'America/New_York');
          }
          await fillDropdownField(comboboxEl, fieldType, targetVal, overrides);
          successCount++;
          // Spacing delay between clicks to prevent portal collision
          await new Promise(resolve => setTimeout(resolve, 60));
        } catch (err) {
          console.error("MockFill generic combobox fill failed:", err);
          failedCount++;
        }
      }
    }

    // --- PHASE 6: FINAL SWEEP AND VERIFICATION PASS ---
    let freshFields = fields;
    if (successCount > 0) {
      console.log("Sweep: Running final safety pass to catch any reset, re-rendered, or empty fields...");
      await new Promise(resolve => setTimeout(resolve, 400));

      // Get fresh DOM elements (to account for any dynamic re-renders/replacements)
      const freshRaw = getFormElements();
      freshFields = filterInteractiveElements(freshRaw);

      for (const el of freshFields) {
        try {
          let isUnfilled = false;
          const fieldType = detectFieldType(el);

          if (el.tagName === 'SELECT') {
            const val = (el.value || '').trim();
            const txt = el.options && el.options.selectedIndex >= 0 ? el.options[el.options.selectedIndex].text.toLowerCase() : '';
            isUnfilled = val === '' || txt.includes('select') || txt.includes('choose') || txt.includes('--');
            
            if (isUnfilled) {
              console.log("Sweep: Found unfilled select, populating...");
              fillSelectElement(el);
              successCount++;
            }
          } 
          else if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'combobox') {
            const text = (el.innerText || el.textContent || '').toLowerCase().trim();
            isUnfilled = text === '' || text.includes('select') || text.includes('choose') || text.includes('--') || text.includes('search');
            
            if (isUnfilled) {
              console.log(`Sweep: Found unfilled combobox [${fieldType}], populating...`);
              let targetVal = null;
              if (fieldType === 'timezone') {
                targetVal = address.timezone || (generator.region === 'in' ? 'Asia/Kolkata' : 'America/New_York');
              } else if (fieldType === 'country') {
                targetVal = address.country;
              } else if (fieldType === 'state') {
                const isIndiaState = /india|\bin\b/i.test(selectedCountryText);
                targetVal = isIndiaState ? generator.addressDataset('IN').state : address.state;
              } else if (fieldType === 'city') {
                const isIndiaCity = /india|\bin\b/i.test(selectedCountryText);
                targetVal = isIndiaCity ? generator.addressDataset('IN').city : address.city;
              }
              await fillDropdownField(el, fieldType, targetVal, overrides);
              successCount++;
              await new Promise(resolve => setTimeout(resolve, 60));
            }
          } 
          else if (el.tagName === 'INPUT') {
            if (el.type === 'checkbox') {
              if (!el.checked) {
                console.log("Sweep: Found unchecked checkbox, checking...");
                forceInjectValue(el, true);
                successCount++;
              }
            } 
            else if (el.type === 'radio') {
              const groupName = el.name;
              if (groupName) {
                const group = Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(groupName)}"]`));
                const anyChecked = group.some(r => r.checked);
                if (!anyChecked && group.length > 0) {
                  console.log(`Sweep: Found unfilled radio group [${groupName}], checking first option...`);
                  forceInjectValue(group[0], true);
                  successCount++;
                }
              }
            } 
            else {
              if ((el.value || '').trim() === '') {
                console.log(`Sweep: Found unfilled text/input [${fieldType}], populating...`);
                let val = "Sweep Value";
                switch (fieldType) {
                  case 'first_name': val = firstName; break;
                  case 'last_name': val = lastName; break;
                  case 'full_name': val = fullName; break;
                  case 'email': val = email; break;
                  case 'phone': val = generator.phone(); break;
                  case 'zip': val = address.zip; break;
                  case 'city': val = address.city; break;
                  case 'state': val = address.state; break;
                  case 'country': val = address.country; break;
                  case 'password': val = password; break;
                  case 'timezone': val = address.timezone || (generator.region === 'in' ? 'Asia/Kolkata' : 'America/New_York'); break;
                  case 'number': val = generator.number(el.min || null, el.max || null, true); break;
                  case 'color': val = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'); break;
                  case 'date': val = generator.date(); break;
                  default: val = "Demo Sweep"; break;
                }
                forceInjectValue(el, val);
                successCount++;
              }
            }
          } 
          else if (el.tagName === 'TEXTAREA') {
            if ((el.value || '').trim() === '') {
              console.log("Sweep: Found unfilled textarea, populating...");
              forceInjectValue(el, generator.paragraph());
              successCount++;
            }
          }
        } catch (err) {
          console.error("Sweep pass failed for element:", el, err);
        }
      }
    }

    return {
      success: true,
      fieldsDetected: freshFields.length,
      successCount: successCount,
      failedCount: failedCount
    };
  }

  // Extract currently populated values
  function getCurrentValues() {
    const rawElements = getFormElements();
    const fields = filterInteractiveElements(rawElements);

    const savedFields = fields.map(el => {
      const selector = generateUniqueSelector(el);
      let value = el.value;
      let type = el.tagName.toLowerCase();

      const isCustomCombobox = el.tagName === 'BUTTON' || el.getAttribute('role') === 'combobox';
      if (isCustomCombobox) {
        type = 'combobox';
        value = el.innerText || el.textContent || '';
      } else if (el.tagName === 'INPUT') {
        type = el.type.toLowerCase();
        if (type === 'checkbox' || type === 'radio') {
          value = el.checked;
        }
      }

      return {
        selector: selector,
        type: type,
        value: value
      };
    });

    return {
      url: window.location.href,
      fields: savedFields
    };
  }

  // Load saved field values and inject them back
  async function loadSavedValues(savedFields) {
    let successCount = 0;
    let failedCount = 0;

    for (const field of savedFields) {
      try {
        const el = document.querySelector(field.selector);
        if (el) {
          const isCustomCombobox = el.tagName === 'BUTTON' || el.getAttribute('role') === 'combobox';
          if (isCustomCombobox) {
            await fillDropdownField(el, 'combobox', field.value, []);
          } else {
            forceInjectValue(el, field.value);
          }
          successCount++;
        } else {
          let selectorFallback = null;
          if (field.selector.includes('[name=')) {
            const nameMatch = field.selector.match(/\[name="([^"]+)"\]/);
            if (nameMatch) selectorFallback = `[name="${nameMatch[1]}"]`;
          } else if (field.selector.includes('[placeholder=')) {
            const placeholderMatch = field.selector.match(/\[placeholder="([^"]+)"\]/);
            if (placeholderMatch) selectorFallback = `[placeholder="${placeholderMatch[1]}"]`;
          }

          if (selectorFallback) {
            const fallbackEl = document.querySelector(selectorFallback);
            if (fallbackEl) {
              const isCustomCombobox = fallbackEl.tagName === 'BUTTON' || fallbackEl.getAttribute('role') === 'combobox';
              if (isCustomCombobox) {
                await fillDropdownField(fallbackEl, 'combobox', field.value, []);
              } else {
                forceInjectValue(fallbackEl, field.value);
              }
              successCount++;
              continue;
            }
          }
          failedCount++;
        }
      } catch (e) {
        failedCount++;
      }
    }

    return {
      successCount: successCount,
      failedCount: failedCount
    };
  }

  // Reset all elements back to empty / unchecked states
  function resetForm() {
    const rawElements = getFormElements();
    const fields = filterInteractiveElements(rawElements);

    fields.forEach(el => {
      try {
        if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
          forceInjectValue(el, false);
        } else {
          forceInjectValue(el, '');
        }
      } catch (e) {
        // Skip
      }
    });

    return {
      success: true,
      fieldsDetected: fields.length
    };
  }

  // Global listener for messages from popup controller or background workers
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const rawElements = getFormElements();
    const interactive = filterInteractiveElements(rawElements);

    switch (request.type) {
      case 'GET_PAGE_STATS':
        sendResponse({
          url: window.location.href,
          fieldsDetected: interactive.length
        });
        break;

      case 'AUTO_FILL':
        fillAllInputs().then(fillResults => {
          sendResponse(fillResults);
        }).catch(err => {
          console.error("MockFill autofill thread crashed:", err);
          sendResponse({ success: false, successCount: 0, failedCount: interactive.length });
        });
        return true; // Keep channel open!

      case 'GET_CURRENT_VALUES':
        const values = getCurrentValues();
        sendResponse(values);
        break;

      case 'LOAD_SAVED_VALUES':
        loadSavedValues(request.data).then(loadResults => {
          sendResponse({
            success: true,
            fieldsDetected: interactive.length,
            ...loadResults
          });
        }).catch(err => {
          sendResponse({ success: false, successCount: 0, failedCount: request.data.length });
        });
        return true; // Keep channel open!

      case 'RESET_FORM':
        const resetResults = resetForm();
        sendResponse({
          success: true,
          ...resetResults
        });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action type' });
    }
  });

})();
