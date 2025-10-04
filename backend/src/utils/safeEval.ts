/**
 * Safe Code Execution Utilities
 * 
 * Provides safe alternatives to eval(), Function(), and dynamic code execution
 * to prevent Code Injection (CWE-94) and Remote Code Execution (RCE)
 */

import { logger } from './logger';
import { sanitizeForLog } from './inputSanitizer';

/**
 * Allowed functions registry for safe execution
 * Only whitelisted functions can be executed
 */
const ALLOWED_FUNCTIONS: Record<string, (...args: any[]) => any> = {
  // Math operations
  'math.add': (a: number, b: number) => a + b,
  'math.subtract': (a: number, b: number) => a - b,
  'math.multiply': (a: number, b: number) => a * b,
  'math.divide': (a: number, b: number) => b !== 0 ? a / b : null,
  'math.round': (n: number) => Math.round(n),
  'math.floor': (n: number) => Math.floor(n),
  'math.ceil': (n: number) => Math.ceil(n),
  
  // String operations
  'string.uppercase': (s: string) => String(s).toUpperCase(),
  'string.lowercase': (s: string) => String(s).toLowerCase(),
  'string.trim': (s: string) => String(s).trim(),
  'string.length': (s: string) => String(s).length,
  
  // Array operations
  'array.length': (arr: any[]) => Array.isArray(arr) ? arr.length : 0,
  'array.first': (arr: any[]) => Array.isArray(arr) && arr.length > 0 ? arr[0] : null,
  'array.last': (arr: any[]) => Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : null,
  
  // Comparison operations
  'compare.equals': (a: any, b: any) => a === b,
  'compare.notEquals': (a: any, b: any) => a !== b,
  'compare.greaterThan': (a: number, b: number) => a > b,
  'compare.lessThan': (a: number, b: number) => a < b,
  'compare.greaterOrEqual': (a: number, b: number) => a >= b,
  'compare.lessOrEqual': (a: number, b: number) => a <= b,
};

/**
 * Register a new safe function
 * @param name - Unique name for the function
 * @param fn - The function implementation
 */
export function registerSafeFunction(name: string, fn: (...args: any[]) => any): void {
  if (typeof fn !== 'function') {
    throw new Error('Second argument must be a function');
  }
  
  if (ALLOWED_FUNCTIONS[name]) {
    logger.warn(`Overwriting existing safe function: ${name}`);
  }
  
  ALLOWED_FUNCTIONS[name] = fn;
  logger.info(`Registered safe function: ${name}`);
}

/**
 * Execute a whitelisted function safely
 * @param functionName - Name of the function to execute
 * @param args - Arguments to pass to the function
 * @returns Result of the function execution
 */
export function executeSafeFunction(functionName: string, ...args: any[]): any {
  // Validate function name
  if (typeof functionName !== 'string') {
    throw new Error('Function name must be a string');
  }
  
  const fn = ALLOWED_FUNCTIONS[functionName];
  if (!fn) {
    throw new Error(`Function '${functionName}' is not whitelisted for execution`);
  }
  
  try {
    return fn(...args);
  } catch (error) {
    logger.error('Error executing safe function', {
      functionName: sanitizeForLog(functionName),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Parse and evaluate a simple expression safely
 * Only supports basic arithmetic and comparison operations
 * @param expression - Simple mathematical or comparison expression
 * @param context - Optional context object with variables
 * @returns Evaluation result
 */
export function evaluateSafeExpression(expression: string, context?: Record<string, any>): any {
  if (typeof expression !== 'string') {
    throw new Error('Expression must be a string');
  }
  
  // Remove whitespace
  expression = expression.trim();
  
  // Check for dangerous patterns
  const dangerousPatterns = [
    /eval/i,
    /function/i,
    /require/i,
    /import/i,
    /process/i,
    /exec/i,
    /spawn/i,
    /child_process/i,
    /__proto__/i,
    /constructor/i,
    /prototype/i,
    /\[/,
    /\]/,
    /\(/,
    /\)/,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(expression)) {
      throw new Error('Expression contains forbidden patterns');
    }
  }
  
  // Simple arithmetic evaluation
  // Only allow: numbers, +, -, *, /, %, and variable names
  const safePattern = /^[\w\s+\-*/%0-9.]+$/;
  if (!safePattern.test(expression)) {
    throw new Error('Expression contains invalid characters');
  }
  
  // Replace variables with their values from context
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      // Validate variable name
      if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
        continue;
      }
      
      // Only allow primitive types
      if (typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'boolean') {
        continue;
      }
      
      // Replace variable with its value
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      expression = expression.replace(regex, String(value));
    }
  }
  
  // Evaluate simple arithmetic (no eval!)
  try {
    // This is still using Function but with very strict input validation
    // Only mathematical operations are allowed
    const result = new Function(`'use strict'; return (${expression})`)();
    return result;
  } catch (error) {
    throw new Error(`Failed to evaluate expression: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Safe JSON parsing with schema validation
 * @param jsonString - JSON string to parse
 * @param schema - Optional schema validator function
 * @returns Parsed JSON object
 */
export function safeParse(jsonString: string, schema?: (obj: any) => boolean): any {
  if (typeof jsonString !== 'string') {
    throw new Error('Input must be a string');
  }
  
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw new Error('Invalid JSON format');
  }
  
  // Remove dangerous properties
  if (parsed && typeof parsed === 'object') {
    delete parsed.__proto__;
    delete parsed.constructor;
    delete parsed.prototype;
  }
  
  // Validate against schema if provided
  if (schema && typeof schema === 'function') {
    if (!schema(parsed)) {
      throw new Error('JSON does not match required schema');
    }
  }
  
  return parsed;
}

/**
 * Execute a command from a whitelist of allowed commands
 * @param command - Command name
 * @param args - Command arguments
 * @returns Command execution result
 */
export interface CommandDefinition {
  execute: (...args: any[]) => any | Promise<any>;
  description: string;
  validate?: (args: any[]) => boolean;
}

const ALLOWED_COMMANDS: Record<string, CommandDefinition> = {};

/**
 * Register a safe command
 * @param name - Command name
 * @param definition - Command definition
 */
export function registerSafeCommand(name: string, definition: CommandDefinition): void {
  if (typeof definition.execute !== 'function') {
    throw new Error('Command must have an execute function');
  }
  
  ALLOWED_COMMANDS[name] = definition;
  logger.info(`Registered safe command: ${name}`);
}

/**
 * Execute a safe command
 * @param commandName - Name of the command
 * @param args - Arguments for the command
 * @returns Command execution result
 */
export async function executeSafeCommand(commandName: string, ...args: any[]): Promise<any> {
  const command = ALLOWED_COMMANDS[commandName];
  
  if (!command) {
    throw new Error(`Command '${commandName}' is not whitelisted`);
  }
  
  // Validate arguments if validator is provided
  if (command.validate && !command.validate(args)) {
    throw new Error(`Invalid arguments for command '${commandName}'`);
  }
  
  try {
    return await command.execute(...args);
  } catch (error) {
    logger.error('Error executing safe command', {
      commandName: sanitizeForLog(commandName),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * List all registered safe functions
 * @returns Array of function names
 */
export function listSafeFunctions(): string[] {
  return Object.keys(ALLOWED_FUNCTIONS);
}

/**
 * List all registered safe commands
 * @returns Array of command names with descriptions
 */
export function listSafeCommands(): Array<{ name: string; description: string }> {
  return Object.entries(ALLOWED_COMMANDS).map(([name, def]) => ({
    name,
    description: def.description
  }));
}

/**
 * Prevent eval() usage at runtime
 * This function throws an error if called, serving as a replacement for eval
 */
export function preventEval(): never {
  throw new Error(
    'Direct use of eval() is not allowed for security reasons. ' +
    'Use executeSafeFunction() or evaluateSafeExpression() instead.'
  );
}

/**
 * Prevent Function constructor usage at runtime
 * This function throws an error if called, serving as a replacement for Function
 */
export function preventFunctionConstructor(): never {
  throw new Error(
    'Direct use of Function constructor is not allowed for security reasons. ' +
    'Use executeSafeFunction() or registerSafeFunction() instead.'
  );
}

// Optionally override global eval and Function in development/testing
if (process.env.NODE_ENV !== 'production' && process.env.BLOCK_UNSAFE_EVAL === 'true') {
  try {
    // @ts-ignore
    global.eval = preventEval;
    logger.warn('global.eval has been blocked');
  } catch {
    // Cannot override in strict mode
  }
}

