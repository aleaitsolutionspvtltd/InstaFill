// @ts-nocheck
// Helper: Split camelCase and replace snake_case/hyphens with spaces for maximum semantic precision
export function cleanToken(token) {
  if (!token) return "";
  return token
    .replace(/([a-z])([A-Z])/g, '$1 $2') // split camelCase
    .replace(/[_-]/g, ' ')               // replace snake_case and kebab-case with spaces
    .toLowerCase()
    .trim();
}

// Extract all textual context for an input element to perform semantic analysis
export function getElementContextText(el) {
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
export function detectFieldType(el) {
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
