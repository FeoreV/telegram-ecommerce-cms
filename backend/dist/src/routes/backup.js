"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const jwt_1 = require("../utils/jwt");
const backupController_1 = require("../controllers/backupController");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/status', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), backupController_1.getBackupStatus);
router.get('/', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), backupController_1.listBackups);
router.post('/', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER]), [
    (0, express_validator_1.body)('includeUploads').optional().isBoolean().withMessage('includeUploads must be boolean'),
    (0, express_validator_1.body)('includeAuditLogs').optional().isBoolean().withMessage('includeAuditLogs must be boolean'),
    (0, express_validator_1.body)('compression').optional().isBoolean().withMessage('compression must be boolean'),
], validation_1.validate, backupController_1.createBackup);
router.get('/download/:filename', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER, jwt_1.UserRole.ADMIN]), [
    (0, express_validator_1.param)('filename').isString().notEmpty().withMessage('Filename is required'),
], validation_1.validate, backupController_1.downloadBackup);
router.post('/restore/:filename', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER]), [
    (0, express_validator_1.param)('filename').isString().notEmpty().withMessage('Filename is required'),
    (0, express_validator_1.body)('restoreUploads').optional().isBoolean().withMessage('restoreUploads must be boolean'),
    (0, express_validator_1.body)('skipExisting').optional().isBoolean().withMessage('skipExisting must be boolean'),
    (0, express_validator_1.body)('confirmRestore').isBoolean().custom((value) => {
        if (value !== true) {
            throw new Error('You must confirm the restore operation by setting confirmRestore to true');
        }
        return true;
    }),
], validation_1.validate, backupController_1.restoreBackup);
router.delete('/:filename', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER]), [
    (0, express_validator_1.param)('filename').isString().notEmpty().withMessage('Filename is required'),
], validation_1.validate, backupController_1.deleteBackup);
router.put('/schedule', (0, auth_1.requireRole)([jwt_1.UserRole.OWNER]), [
    (0, express_validator_1.body)('enabled').isBoolean().withMessage('enabled must be boolean'),
    (0, express_validator_1.body)('schedule').optional().isString().withMessage('schedule must be a cron expression'),
    (0, express_validator_1.body)('options').optional().isObject().withMessage('options must be an object'),
], validation_1.validate, backupController_1.scheduleBackups);
exports.default = router;
//# sourceMappingURL=backup.js.map