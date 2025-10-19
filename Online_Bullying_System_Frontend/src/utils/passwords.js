const PASSWORD_SPECIAL_CHARACTERS = '!@#$%^&*()_+-={}[]:;"\'<>.,?/';
const COMMON_PASSWORD_PATTERNS = [
  'password',
  'passw0rd',
  'letmein',
  'welcome',
  'admin',
  'root',
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'abc123',
  'iloveyou',
];
const KEYBOARD_SEQUENCES = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
const SPECIAL_CHAR_REGEX = new RegExp(`[${escapeRegExp(PASSWORD_SPECIAL_CHARACTERS)}]`);

const normalizePersonalValue = (value) =>
  (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const containsPersonalInfo = (password, context = {}) => {
  const passwordNormalized = normalizePersonalValue(password);
  if (!passwordNormalized) {
    return false;
  }
  const rawValues = [context.fullName, context.email, context.username].filter(Boolean);
  const personalValues = [];
  rawValues.forEach((raw) => {
    const normalizedFull = normalizePersonalValue(raw);
    if (normalizedFull) {
      personalValues.push(normalizedFull);
    }
    String(raw)
      .split(/[\s@._-]+/)
      .forEach((fragment) => {
        const normalizedFragment = normalizePersonalValue(fragment);
        if (normalizedFragment && normalizedFragment.length >= 3) {
          personalValues.push(normalizedFragment);
        }
      });
  });
  return personalValues.some((entry) => passwordNormalized.includes(entry));
};

const hasSequentialCharacters = (value, length = 4) => {
  if (!value) return false;
  const normalized = value.toLowerCase();
  const sequences = [...KEYBOARD_SEQUENCES, 'abcdefghijklmnopqrstuvwxyz', '0123456789'];

  for (const sequence of sequences) {
    for (let index = 0; index <= sequence.length - length; index += 1) {
      if (normalized.includes(sequence.slice(index, index + length))) {
        return true;
      }
    }
  }

  for (let index = 0; index <= normalized.length - length; index += 1) {
    const window = normalized.slice(index, index + length);
    let ascending = true;
    let descending = true;
    for (let offset = 0; offset < window.length - 1; offset += 1) {
      if (window.charCodeAt(offset + 1) - window.charCodeAt(offset) !== 1) {
        ascending = false;
      }
      if (window.charCodeAt(offset) - window.charCodeAt(offset + 1) !== 1) {
        descending = false;
      }
    }
    if (ascending || descending) {
      return true;
    }
  }
  return false;
};

const hasRepeatedCharacters = (value, length = 4) => {
  if (!value) return false;
  for (let index = 0; index <= value.length - length; index += 1) {
    const window = value.slice(index, index + length);
    if (window === window[0].repeat(length)) {
      return true;
    }
  }
  return false;
};

const validateNewPassword = (password, context = {}) => {
  if (!password) {
    return 'Password is required.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number.';
  }
  if (!SPECIAL_CHAR_REGEX.test(password)) {
    return 'Password must include at least one special character (! @ # $ % ^ & * ( ) _ + - = { } [ ] : ; " \' < > , . ? /).';
  }
  const lowered = password.toLowerCase();
  if (COMMON_PASSWORD_PATTERNS.includes(lowered)) {
    return 'Password is too common. Choose something harder to guess.';
  }
  if (COMMON_PASSWORD_PATTERNS.some((pattern) => lowered.includes(pattern))) {
    return "Password should not contain common words like 'password' or '123456'.";
  }
  if (containsPersonalInfo(password, context)) {
    return 'Password must not contain your personal information.';
  }
  if (hasSequentialCharacters(password)) {
    return "Password must not contain sequential patterns like 'abcd' or '1234'.";
  }
  if (hasRepeatedCharacters(password)) {
    return "Password must not contain repeated characters like '1111'.";
  }
  return null;
};

const evaluatePasswordRules = (password, context = {}) => {
  const value = typeof password === 'string' ? password : '';
  const hasValue = value.length > 0;
  const meetsLength = value.length >= 8;
  const hasUppercase = /[A-Z]/.test(value);
  const hasLowercase = /[a-z]/.test(value);
  const hasDigit = /[0-9]/.test(value);
  const hasSpecial = SPECIAL_CHAR_REGEX.test(value);
  const lowered = value.toLowerCase();
  const containsCommonPattern =
    hasValue && COMMON_PASSWORD_PATTERNS.some((pattern) => lowered.includes(pattern));
  const containsPersonalDetails = hasValue && containsPersonalInfo(value, context);
  const containsSequential = hasValue && hasSequentialCharacters(value);
  const containsRepeated = hasValue && hasRepeatedCharacters(value);

  return {
    length: meetsLength,
    uppercase: hasUppercase,
    lowercase: hasLowercase,
    digit: hasDigit,
    special: hasSpecial,
    common: hasValue && !containsCommonPattern && !containsPersonalDetails,
    sequence: hasValue && !containsSequential && !containsRepeated,
  };
};

const PASSWORD_RULE_ITEMS = [
  { id: 'length', label: 'At least 8 characters.' },
  { id: 'uppercase', label: 'At least one uppercase letter (A–Z).' },
  { id: 'lowercase', label: 'At least one lowercase letter (a–z).' },
  { id: 'digit', label: 'At least one number (0–9).' },
  { id: 'special', label: 'At least one special character' },
];

const getPasswordRuleChecklist = (password, context = {}) => {
  const status = evaluatePasswordRules(password, context);
  return PASSWORD_RULE_ITEMS.map((rule) => ({
    ...rule,
    met: Boolean(status[rule.id]),
  }));
};

export {
  PASSWORD_SPECIAL_CHARACTERS,
  COMMON_PASSWORD_PATTERNS,
  SPECIAL_CHAR_REGEX,
  validateNewPassword,
  evaluatePasswordRules,
  getPasswordRuleChecklist,
};
