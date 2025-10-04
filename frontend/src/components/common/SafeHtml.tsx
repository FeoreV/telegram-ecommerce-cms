/**
 * SafeHtml Component
 * SECURITY: Safely renders HTML content to prevent XSS (CWE-79)
 * Using DOMPurify for production-grade sanitization
 *
 * Usage:
 *   <SafeHtml content={userGeneratedHtml} />
 */

import React from 'react';
import { sanitizeHtml } from '../../utils/sanitizer';

interface SafeHtmlProps {
  content: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Component that safely renders HTML content with DOMPurify sanitization
 */
export const SafeHtml: React.FC<SafeHtmlProps> = ({
  content,
  className = '',
  as: Component = 'div'
}) => {
  // Sanitize the HTML content using DOMPurify (via sanitizeHtml)
  const sanitized = sanitizeHtml(content);

  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};

export default SafeHtml;

