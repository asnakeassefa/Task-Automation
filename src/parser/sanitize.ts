import sanitizeHtml from 'sanitize-html';

export function sanitizeBody(textBody: string, htmlBody?: string): string {
  if (textBody && textBody.trim().length > 0) {
    return sanitizeHtml(textBody, { allowedTags: [], allowedAttributes: {} });
  }
  if (htmlBody) {
    return sanitizeHtml(htmlBody, { allowedTags: [], allowedAttributes: {} });
  }
  return '';
}
