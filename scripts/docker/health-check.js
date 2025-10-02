#!/usr/bin/env node

const http = require('http');
const https = require('https');

// Конфигурация сервисов для проверки
const services = [
    { name: 'Backend API', url: 'http://localhost:3001/health' },
    { name: 'Frontend', url: 'http://localhost:3000/' },
    { name: 'Redis', host: 'localhost', port: 6379 },
    { name: 'Database (MySQL)', host: 'localhost', port: 3307 }
];

// Цвета для консоли
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function checkHTTP(service) {
    return new Promise((resolve) => {
        const protocol = service.url.startsWith('https://') ? https : http;
        const req = protocol.get(service.url, { timeout: 5000 }, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 400) {
                resolve({ ...service, status: 'OK', details: `Status: ${res.statusCode}` });
            } else {
                resolve({ ...service, status: 'ERROR', details: `HTTP ${res.statusCode}` });
            }
        });

        req.on('error', (error) => {
            resolve({ ...service, status: 'ERROR', details: error.message });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ ...service, status: 'ERROR', details: 'Timeout' });
        });
    });
}

function checkTCP(service) {
    return new Promise((resolve) => {
        const net = require('net');
        const socket = new net.Socket();
        
        socket.setTimeout(5000);
        
        socket.on('connect', () => {
            socket.destroy();
            resolve({ ...service, status: 'OK', details: 'Connection established' });
        });
        
        socket.on('error', (error) => {
            resolve({ ...service, status: 'ERROR', details: error.message });
        });
        
        socket.on('timeout', () => {
            socket.destroy();
            resolve({ ...service, status: 'ERROR', details: 'Timeout' });
        });
        
        socket.connect(service.port, service.host);
    });
}

async function checkAllServices() {
    console.log(`${colors.blue}🔍 Проверка работоспособности сервисов...${colors.reset}\n`);
    
    const results = [];
    
    for (const service of services) {
        let result;
        if (service.url) {
            result = await checkHTTP(service);
        } else if (service.host && service.port) {
            result = await checkTCP(service);
        }
        
        results.push(result);
        
        const statusColor = result.status === 'OK' ? colors.green : colors.red;
        const statusIcon = result.status === 'OK' ? '✅' : '❌';
        
        console.log(`${statusIcon} ${result.name}: ${statusColor}${result.status}${colors.reset} - ${result.details}`);
    }
    
    console.log('\n' + '='.repeat(50));
    
    const okServices = results.filter(r => r.status === 'OK').length;
    const totalServices = results.length;
    
    if (okServices === totalServices) {
        console.log(`${colors.green}🎉 Все сервисы работают корректно! (${okServices}/${totalServices})${colors.reset}`);
    } else {
        console.log(`${colors.yellow}⚠️  Работают: ${okServices}/${totalServices} сервисов${colors.reset}`);
        console.log(`${colors.red}❌ Проблемы с ${totalServices - okServices} сервисами${colors.reset}`);
    }
    
    // Docker контейнеры
    console.log(`\n${colors.blue}🐳 Проверка Docker контейнеров:${colors.reset}`);
    console.log('Выполните: docker-compose -f config/docker/docker-compose.yml ps');
    
    return okServices === totalServices;
}

// Запуск проверки
checkAllServices().then((allOk) => {
    process.exit(allOk ? 0 : 1);
}).catch((error) => {
    console.error(`${colors.red}Ошибка при проверке: ${error.message}${colors.reset}`);
    process.exit(1);
});
