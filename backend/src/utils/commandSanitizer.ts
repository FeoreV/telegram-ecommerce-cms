/**
 * Command Sanitizer Utility
 * Prevents command injection attacks by sanitizing inputs used in shell commands
 */

import path from 'path';

/**
 * Sanitize file path to prevent command injection
 * Only allows safe characters and prevents directory traversal
 */
export function sanitizeFilePath(filePath: string): string {
  // Resolve to absolute path to prevent directory traversal
  const resolved = path.resolve(filePath);
  const cwd = process.cwd();

  // Ensure path is within project directory
  if (!resolved.startsWith(cwd)) {
    throw new Error('Path traversal detected: Path must be within project directory');
  }

  // Remove any shell metacharacters
  const sanitized = resolved.replace(/[;&|`$(){}[\]<>]/g, '');

  return sanitized;
}

/**
 * Sanitize package name for npm commands
 * Only allows valid npm package name characters
 */
export function sanitizePackageName(packageName: string): string {
  // npm package names can contain: lowercase letters, numbers, hyphens, underscores, dots, @, /
  // Remove any characters that could be used for command injection
  const sanitized = packageName.replace(/[^a-z0-9\-_.@/]/gi, '');

  // Ensure it doesn't start with dangerous patterns
  if (sanitized.startsWith('-') || sanitized.startsWith('.')) {
    throw new Error('Invalid package name: Cannot start with - or .');
  }

  // Prevent command substitution
  if (sanitized.includes('$') || sanitized.includes('`') || sanitized.includes('$(')) {
    throw new Error('Invalid package name: Contains forbidden characters');
  }

  return sanitized;
}

/**
 * Sanitize version string for npm commands
 * Only allows valid semver characters
 */
export function sanitizeVersion(version: string): string {
  // Version can contain: numbers, dots, hyphens (for pre-release), plus (for build metadata)
  // Remove any characters that could be used for command injection
  const sanitized = version.replace(/[^0-9.\-+a-zA-Z]/g, '');

  // Ensure it's a valid-looking version
  if (!/^[0-9]/.test(sanitized)) {
    throw new Error('Invalid version: Must start with a number');
  }

  // Prevent command substitution
  if (sanitized.includes('$') || sanitized.includes('`')) {
    throw new Error('Invalid version: Contains forbidden characters');
  }

  return sanitized;
}

/**
 * Sanitize compression level (for gzip, etc.)
 * Only allows numbers 1-9
 */
export function sanitizeCompressionLevel(level: number | string): number {
  const num = typeof level === 'string' ? parseInt(level, 10) : level;

  if (isNaN(num) || num < 1 || num > 9) {
    throw new Error('Invalid compression level: Must be between 1 and 9');
  }

  return num;
}

/**
 * Alias for sanitizeCompressionLevel for backward compatibility
 */
export function sanitizeFlagValue(value: number | string): number {
  return sanitizeCompressionLevel(value);
}

/**
 * Sanitize environment variable name
 * Only allows alphanumeric characters and underscores
 */
export function sanitizeEnvVarName(name: string): string {
  const sanitized = name.replace(/[^A-Z0-9_]/gi, '');

  if (sanitized !== name) {
    throw new Error('Invalid environment variable name: Only alphanumeric and underscore allowed');
  }

  return sanitized;
}

/**
 * Escape shell argument
 * Wraps argument in single quotes and escapes any single quotes
 */
export function escapeShellArg(arg: string): string {
  // Replace single quotes with '\'' (end quote, escaped quote, start quote)
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Validate and sanitize command arguments array
 * Ensures no arguments contain shell metacharacters
 */
export function sanitizeCommandArgs(args: string[]): string[] {
  const dangerousChars = /[;&|`$(){}[\]<>\\]/;

  return args.map(arg => {
    if (dangerousChars.test(arg)) {
      throw new Error(`Invalid command argument: Contains dangerous characters: ${arg}`);
    }
    return arg;
  });
}

/**
 * Check if a command is in the allowlist
 */
export function isAllowedCommand(command: string, allowedCommands: string[]): boolean {
  // Only allow exact matches from the allowlist
  return allowedCommands.includes(command);
}

/**
 * Sanitize Docker image reference
 * Only allows valid Docker image reference characters
 */
export function sanitizeImageRef(imageRef: string): string {
  // Docker image refs can contain: alphanumeric, hyphens, underscores, dots, colons, slashes
  // Remove any characters that could be used for command injection
  const sanitized = imageRef.replace(/[;&|`$(){}[\]<>\\]/g, '');

  // Validate format: [registry/][namespace/]image[:tag|@digest]
  const validImagePattern = /^[a-z0-9][a-z0-9._-]*(?::[0-9]+)?(?:\/[a-z0-9._-]+)*(?::[a-z0-9._-]+)?(?:@sha256:[a-f0-9]{64})?$/i;

  if (!validImagePattern.test(sanitized)) {
    throw new Error(`Invalid Docker image reference: ${imageRef}`);
  }

  // Prevent command substitution
  if (sanitized.includes('$') || sanitized.includes('`')) {
    throw new Error('Invalid image reference: Contains forbidden characters');
  }

  return sanitized;
}

/**
 * Safely execute command with validated inputs
 * Returns the command and args that should be used with spawn/execSync
 */
export function prepareSafeCommand(
  command: string,
  args: string[],
  options: {
    allowedCommands?: string[];
    sanitizeArgs?: boolean;
  } = {}
): { command: string; args: string[] } {
  const {
    allowedCommands = ['npm', 'git', 'gzip', 'gunzip', 'dpkg', 'rpm', 'apk'],
    sanitizeArgs = true
  } = options;

  // Validate command is in allowlist
  if (!isAllowedCommand(command, allowedCommands)) {
    throw new Error(`Command not allowed: ${command}`);
  }

  // Sanitize arguments if requested
  const safeArgs = sanitizeArgs ? sanitizeCommandArgs(args) : args;

  return { command, args: safeArgs };
}
