const crypto = require('crypto');

/**
 * Generate a secure random password
 * @param {number} length - Length of the password (default: 12)
 * @param {object} options - Options for password generation
 * @returns {string} Generated password
 */
function generatePassword(length = 12, options = {}) {
  const {
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true,
    excludeSimilar = true // Exclude similar looking characters like 0, O, l, I, 1
  } = options;

  let charset = '';
  
  if (includeLowercase) {
    charset += excludeSimilar ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
  }
  
  if (includeUppercase) {
    charset += excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  
  if (includeNumbers) {
    charset += excludeSimilar ? '23456789' : '0123456789';
  }
  
  if (includeSymbols) {
    charset += '!@#$%&*+-=?';
  }

  if (charset === '') {
    throw new Error('At least one character type must be included');
  }

  let password = '';
  const charsetLength = charset.length;
  
  // Use crypto.randomBytes for cryptographically secure random generation
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charsetLength];
  }

  return password;
}

/**
 * Generate multiple unique passwords
 * @param {number} count - Number of passwords to generate
 * @param {number} length - Length of each password
 * @param {object} options - Options for password generation
 * @returns {string[]} Array of generated passwords
 */
function generateMultiplePasswords(count, length = 12, options = {}) {
  const passwords = new Set();
  
  while (passwords.size < count) {
    passwords.add(generatePassword(length, options));
  }
  
  return Array.from(passwords);
}

/**
 * Generate a readable password with specific pattern
 * Format: Word-Word-Numbers (e.g., Blue-Sky-123)
 * @returns {string} Generated readable password
 */
function generateReadablePassword() {
  const adjectives = [
    'Blue', 'Red', 'Green', 'Fast', 'Bright', 'Smart', 'Strong', 'Quick',
    'Bold', 'Fresh', 'Cool', 'Warm', 'Clear', 'Sharp', 'Solid', 'Pure'
  ];
  
  const nouns = [
    'Sky', 'Tree', 'Rock', 'Star', 'Moon', 'Fire', 'Wind', 'Wave',
    'Peak', 'Path', 'Gate', 'Bird', 'Fish', 'Lion', 'Wolf', 'Bear'
  ];
  
  const adjective = adjectives[crypto.randomInt(adjectives.length)];
  const noun = nouns[crypto.randomInt(nouns.length)];
  const numbers = crypto.randomInt(100, 999);
  
  return `${adjective}-${noun}-${numbers}`;
}

module.exports = {
  generatePassword,
  generateMultiplePasswords,
  generateReadablePassword
};