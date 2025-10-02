"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const integrationController_1 = require("../controllers/integrationController");
const router = (0, express_1.Router)();
router.post('/mappings', integrationController_1.upsertMapping);
router.get('/mappings', integrationController_1.getMapping);
exports.default = router;
//# sourceMappingURL=integration.js.map