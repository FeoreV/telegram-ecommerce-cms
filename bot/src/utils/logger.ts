import winston from 'winston';
import fs from 'fs';
import path from 'path';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'telegram-bot' },
  transports: [
    // File transports are created after ensuring the directory exists below
  ],
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

// Ensure logs directory exists before adding file transports
const logsDir = path.resolve(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (dirError) {
  // Fallback to console if directory cannot be created
  // Avoid throwing which could crash the process
  // eslint-disable-next-line no-console
  console.error('Failed to create logs directory:', dirError);
}

// Remove prior log artifacts so each run starts clean
try {
  const entries = fs.readdirSync(logsDir, { withFileTypes: true });
  for (const entry of entries) {
    const target = path.join(logsDir, entry.name);
    try {
      if (entry.isDirectory()) {
        fs.rmSync(target, { recursive: true, force: true });
      } else {
        fs.unlinkSync(target);
      }
    } catch (entryError) {
      // eslint-disable-next-line no-console
      console.warn('Failed to remove log artifact:', target, entryError);
    }
  }
} catch (cleanupError) {
  // eslint-disable-next-line no-console
  console.warn('Failed to purge logs directory:', logsDir, cleanupError);
}

// Add file transports safely and listen for errors to avoid unhandled events
const errorFileTransport = new winston.transports.File({ filename: path.join(logsDir, 'bot-error.log'), level: 'error' });
const combinedFileTransport = new winston.transports.File({ filename: path.join(logsDir, 'bot-combined.log') });

errorFileTransport.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Winston error file transport error:', err);
});
combinedFileTransport.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Winston combined file transport error:', err);
});

logger.add(errorFileTransport);
logger.add(combinedFileTransport);
