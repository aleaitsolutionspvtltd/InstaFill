/**
 * @jest-environment jsdom
 */

import { detectFieldType, cleanToken } from '../src/content/semantic-detector';

describe('Semantic Field Detector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('cleanToken normalizes strings', () => {
    expect(cleanToken('firstName')).toBe('first name');
    expect(cleanToken('zip_code_1')).toBe('zip code 1');
    expect(cleanToken('ADDRESS-LINE')).toBe('address line');
  });

  test('detects email fields accurately', () => {
    const input = document.createElement('input');
    input.type = 'email';
    expect(detectFieldType(input)).toBe('email');

    input.type = 'text';
    input.name = 'userMailAddress';
    expect(detectFieldType(input)).toBe('email');

    input.name = '';
    input.placeholder = 'Enter your email here';
    expect(detectFieldType(input)).toBe('email');
  });

  test('detects phone fields accurately', () => {
    const input = document.createElement('input');
    input.type = 'tel';
    expect(detectFieldType(input)).toBe('phone');

    input.type = 'text';
    input.placeholder = 'Mobile Number';
    expect(detectFieldType(input)).toBe('phone');
  });

  test('detects address and location fields', () => {
    const input1 = document.createElement('input');
    input1.type = 'text';
    input1.name = 'address';
    expect(detectFieldType(input1)).toBe('address_line1');

    const input2 = document.createElement('input');
    input2.name = 'city';
    expect(detectFieldType(input2)).toBe('city');

    const input3 = document.createElement('input');
    input3.name = 'zipCode';
    expect(detectFieldType(input3)).toBe('zip');

    const input4 = document.createElement('input');
    input4.name = 'country_code';
    expect(detectFieldType(input4)).toBe('country');

  });

  test('detects specific names', () => {
    const input1 = document.createElement('input');
    input1.name = 'fname';
    expect(detectFieldType(input1)).toBe('first_name');

    const input2 = document.createElement('input');
    input2.name = 'lastName';
    expect(detectFieldType(input2)).toBe('last_name');

    const input3 = document.createElement('input');
    input3.placeholder = 'Full Name';
    expect(detectFieldType(input3)).toBe('full_name');
  });

  test('detects modern complex contexts (e.g. adjacent labels)', () => {
    const container = document.createElement('div');
    const label = document.createElement('label');
    label.innerText = 'Time Zone';
    const input = document.createElement('input');
    
    container.appendChild(label);
    container.appendChild(input);
    document.body.appendChild(container);

    expect(detectFieldType(input)).toBe('timezone');
  });

  test('falls back properly based on element type', () => {
    const select = document.createElement('select');
    expect(detectFieldType(select)).toBe('select');

    const textarea = document.createElement('textarea');
    expect(detectFieldType(textarea)).toBe('textarea');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(detectFieldType(checkbox)).toBe('checkbox');
  });
});
