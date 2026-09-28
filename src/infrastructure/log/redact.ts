const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

const TOKEN =
  /(?<![A-Za-z0-9_-])(?=[A-Za-z_-]*\d)(?=[\d_-]*[A-Za-z])[A-Za-z0-9_-]{24,}(?![A-Za-z0-9_-])/g;

export const redact = (text: string) =>
  text.replace(EMAIL, '[redacted]').replace(TOKEN, '[redacted]');
