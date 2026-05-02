export function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} is required`;
  }
  return null;
}

export function validatePhone(value) {
  if (!value) return 'Phone is required';
  if (!/^[0-9+\- ]{7,15}$/.test(value)) return 'Invalid phone number';
  return null;
}

export function validateEmail(value) {
  if (!value) return null; // optional
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email address';
  return null;
}

export function validatePositiveNumber(value, fieldName) {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return `${fieldName} must be a positive number`;
  return null;
}

export function validateForm(fields) {
  const errors = {};
  let hasError = false;
  for (const [key, checks] of Object.entries(fields)) {
    for (const check of checks) {
      const error = check();
      if (error) {
        errors[key] = error;
        hasError = true;
        break;
      }
    }
  }
  return { valid: !hasError, errors };
}

export function showFieldError(inputEl, message) {
  clearFieldError(inputEl);
  inputEl.style.borderColor = 'var(--red)';
  const err = document.createElement('div');
  err.className = 'form-error';
  err.textContent = message;
  inputEl.parentElement.appendChild(err);
}

export function clearFieldError(inputEl) {
  inputEl.style.borderColor = '';
  const existing = inputEl.parentElement.querySelector('.form-error');
  if (existing) existing.remove();
}

export function clearAllErrors(container) {
  container.querySelectorAll('.form-error').forEach(e => e.remove());
  container.querySelectorAll('input, select, textarea').forEach(e => e.style.borderColor = '');
}
