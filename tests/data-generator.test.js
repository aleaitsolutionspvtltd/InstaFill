import { MockFillDataGenerator } from '../src/data-generator/data-generator';

describe('MockFillDataGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new MockFillDataGenerator();
  });

  test('should generate a full name', () => {
    const fullName = generator.fullName();
    expect(typeof fullName).toBe('string');
    expect(fullName.split(' ').length).toBeGreaterThanOrEqual(2);
  });

  test('should generate an email', () => {
    const email = generator.email('John', 'Doe');
    expect(email).toMatch(/@/);
    expect(email.toLowerCase()).toContain('john');
  });

  test('should generate a realistic number within range', () => {
    const num = generator.number(10, 50, true);
    expect(num).toBeGreaterThanOrEqual(10);
    expect(num).toBeLessThanOrEqual(50);
  });

  test('should respect custom email domain', () => {
    generator.customEmailDomain = 'test.com';
    const email = generator.email('Test', 'User');
    expect(email).toMatch(/@test\.com$/);
  });

  test('should generate strings matching a regex pattern', () => {
    const regexPattern = /^[A-Z]{3}-\d{4}$/;
    const generated = generator.regex(regexPattern);
    expect(generated).toMatch(regexPattern);
  });
});
