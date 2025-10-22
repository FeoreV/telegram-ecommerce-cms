import { Router, Request, Response } from 'express';
import os from 'os';

const router = Router();

// Простой health check без сложных зависимостей
router.get('/', (req: Request, res: Response) => {
  try {
    const uptime = process.uptime();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsagePercent = (usedMem / totalMem) * 100;

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      system: {
        platform: os.platform(),
        nodeVersion: process.version,
        memory: {
          total: Math.round(totalMem / 1024 / 1024), // MB
          free: Math.round(freeMem / 1024 / 1024), // MB
          used: Math.round(usedMem / 1024 / 1024), // MB
          usagePercent: Math.round(memoryUsagePercent * 100) / 100
        },
        cpus: os.cpus().length,
        loadAverage: os.loadavg()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
