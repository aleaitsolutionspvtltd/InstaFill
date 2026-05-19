// @ts-nocheck
import { MockFillDataGenerator } from '../data-generator/data-generator';
import { getFormElements, filterInteractiveElements, generateUniqueSelector } from './dom-utils';
import { detectFieldType } from './semantic-detector';
import { 
  findOverrideValue, forceInjectValue, fillSelectElement, 
  awaitElementReadyForFilling, fillDropdownField 
} from './injectors';

(function () {
  if (window.MockFillInitialized) return;
  window.MockFillInitialized = true;

  // Check if an element matches any ignored selector
  function isIgnored(el, ignoredSelectors) {
    if (!ignoredSelectors || ignoredSelectors.length === 0) return false;
    try {
      return ignoredSelectors.some(sel => el.matches(sel));
    } catch (e) {
      return false; // ignore invalid selectors
    }
  }

  // Core Smart Asynchronous Fill Router
  async function fillAllInputs() {
    const storageResult = await chrome.storage.local.get(['custom_overrides', 'settings_phone_prefix', 'settings_email_domain', 'ignored_selectors', 'settings_password_length']);
    const overrides = storageResult.custom_overrides || [];
    const phonePrefix = storageResult.settings_phone_prefix || '';
    const emailDomain = storageResult.settings_email_domain || 'yopmail.com';
    const ignoredSelectors = storageResult.ignored_selectors || []; // FEATURE: Ignore Fields
    const passwordLength = storageResult.settings_password_length || 16;

    const generator = new MockFillDataGenerator();
    generator.customPhonePrefix = phonePrefix;
    generator.customEmailDomain = emailDomain;
    
    const firstName = generator.firstName();
    const lastName = generator.lastName();
    const fullName = `${firstName} ${lastName}`;
    const email = generator.email(firstName, lastName);
    const password = generator.password(passwordLength);
    const address = generator.addressDataset();

    const rawElements = getFormElements();
    let fields = filterInteractiveElements(rawElements);
    
    // Filter out ignored fields
    fields = fields.filter(el => !isIgnored(el, ignoredSelectors));

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

        if (fieldType !== 'country' && fieldType !== 'state' && fieldType !== 'city' && fieldType !== 'timezone') {
          const customOverrideVal = findOverrideValue(el, fieldType, overrides);
          if (customOverrideVal !== null) {
            if (el.tagName === 'SELECT') {
              await fillDropdownField(el, fieldType, customOverrideVal, []);
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

        if (el.tagName === 'SELECT') {
          fillSelectElement(el);
          successCount++;
          continue;
        }

        const isCustomCombobox = el.tagName === 'BUTTON' || el.getAttribute('role') === 'combobox';
        if (isCustomCombobox) {
          genericComboboxFields.push(el);
          continue;
        }

        if (el.tagName === 'INPUT' && el.type === 'radio') {
          const groupName = el.name || 'unnamed_radios';
          if (!radioGroups[groupName]) radioGroups[groupName] = [];
          radioGroups[groupName].push(el);
          continue;
        }

        if (el.tagName === 'INPUT' && el.type === 'checkbox') {
          forceInjectValue(el, Math.random() > 0.5);
          successCount++;
          continue;
        }

        let val = "";
        switch (fieldType) {
          case 'first_name': val = firstName; break;
          case 'last_name': val = lastName; break;
          case 'full_name': val = fullName; break;
          case 'email': val = email; break;
          case 'phone': val = generator.phone(); break;
          case 'api_key': val = generator.apiKey(); break;
          case 'json_headers': val = generator.jsonHeaders(); break;
          case 'json_values': val = generator.jsonStaticValues(); break;
          case 'color': val = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'); break;
          case 'date': val = generator.date(el.min, el.max); break;
          case 'time': val = generator.time(); break;
          case 'datetime': val = generator.datetimeLocal(el.min, el.max); break;
          case 'password': val = password; break;
          case 'timezone': val = address.timezone || (generator.region === 'in' ? 'Asia/Kolkata' : 'America/New_York'); break;
          case 'zip': val = address.zip; break;
          case 'address_line1': val = address.street; break;
          case 'address_line2': val = Math.random() > 0.5 ? `Plot ${generator._randomInt(1, 400)}` : ''; break;
          case 'url': val = generator.website(); break;
          case 'username': val = firstName.toLowerCase() + generator._randomInt(10, 99); break;
          case 'company': val = generator.company(); break;
          case 'number': 
            const min = el.min !== "" ? el.min : null;
            const max = el.max !== "" ? el.max : null;
            const step = el.step !== "" ? el.step : 1;
            val = generator.number(min, max, !String(step).includes('.'), Number(step));
            break;
          case 'textarea': val = generator.paragraph(); break;
          case 'text':
          default:
            val = "MockFill Demo";
            break;
        }

        if (el.maxLength && el.maxLength > 0) {
          val = String(val).substring(0, el.maxLength);
        }

        forceInjectValue(el, val);
        successCount++;
      } catch (err) {
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
        if (filledVal) selectedCountryText = filledVal;
        successCount++;
      } catch (err) {
        failedCount++;
      }
    }

    // --- PHASE 3: AUTOMATE STATE FIELDS ---
    if (stateFields.length > 0) {
      if (countryFields.length > 0) await new Promise(r => setTimeout(r, 400));
      await awaitElementReadyForFilling(stateFields[0], 1500);
      
      const isIndia = /india|\bin\b/i.test(selectedCountryText);
      const targetState = isIndia ? generator.addressDataset('IN').state : address.state;
      const targetStateCode = isIndia ? generator.addressDataset('IN').stateCode : address.stateCode;

      for (const stateEl of stateFields) {
        try {
          const stateVal = stateEl.maxLength && stateEl.maxLength <= 3 ? targetStateCode : targetState;
          await fillDropdownField(stateEl, 'state', stateVal, overrides);
          successCount++;
        } catch (err) { failedCount++; }
      }
    }

    // --- PHASE 4: AUTOMATE CITY FIELDS ---
    if (cityFields.length > 0) {
      if (stateFields.length > 0) await new Promise(r => setTimeout(r, 400));
      await awaitElementReadyForFilling(cityFields[0], 1500);
      
      const isIndia = /india|\bin\b/i.test(selectedCountryText);
      const targetCity = isIndia ? generator.addressDataset('IN').city : address.city;

      for (const cityEl of cityFields) {
        try {
          await fillDropdownField(cityEl, 'city', targetCity, overrides);
          successCount++;
        } catch (err) { failedCount++; }
      }
    }

    // --- PHASE 5: GENERIC COMBOBOXES ---
    for (const comboboxEl of genericComboboxFields) {
      try {
        const fieldType = detectFieldType(comboboxEl);
        let targetVal = null;
        if (fieldType === 'timezone') targetVal = address.timezone || 'America/New_York';
        await fillDropdownField(comboboxEl, fieldType, targetVal, overrides);
        successCount++;
      } catch (err) { failedCount++; }
    }

    return {
      success: true,
      fieldsDetected: fields.length,
      successCount: successCount,
      failedCount: failedCount
    };
  }

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

      return { selector, type, value };
    });

    return { url: window.location.href, fields: savedFields };
  }

  async function loadSavedValues(savedFields) {
    let successCount = 0;
    let failedCount = 0;

    for (const field of savedFields) {
      try {
        const el = document.querySelector(field.selector);
        if (el) {
          const isCustomCombobox = el.tagName === 'BUTTON' || el.getAttribute('role') === 'combobox';
          if (isCustomCombobox) await fillDropdownField(el, 'combobox', field.value, []);
          else forceInjectValue(el, field.value);
          successCount++;
        } else {
          failedCount++;
        }
      } catch (e) { failedCount++; }
    }

    return { successCount, failedCount };
  }

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
      } catch (e) {}
    });

    return { success: true, fieldsDetected: fields.length };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const interactive = filterInteractiveElements(getFormElements());

    switch (request.type) {
      case 'GET_PAGE_STATS':
        sendResponse({ url: window.location.href, fieldsDetected: interactive.length });
        break;
      case 'AUTO_FILL':
        fillAllInputs().then(sendResponse).catch(() => sendResponse({ success: false }));
        return true;
      case 'GET_CURRENT_VALUES':
        sendResponse(getCurrentValues());
        break;
      case 'LOAD_SAVED_VALUES':
        loadSavedValues(request.data).then(res => sendResponse({ success: true, ...res }));
        return true;
      case 'RESET_FORM':
        sendResponse({ success: true, ...resetForm() });
        break;
      default:
        sendResponse({ success: false, error: 'Unknown action type' });
    }
  });

})();
