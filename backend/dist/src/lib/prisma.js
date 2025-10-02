"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.disconnectPrisma = disconnectPrisma;
const database_1 = require("./database");
exports.prisma = new Proxy({}, {
    get(target, prop) {
        const client = database_1.databaseService.getPrisma();
        return typeof client[prop] === 'function'
            ? client[prop].bind(client)
            : client[prop];
    }
});
async function disconnectPrisma() {
    await database_1.databaseService.disconnect();
}
//# sourceMappingURL=prisma.js.map