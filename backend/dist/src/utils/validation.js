"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInput = exports.ValidationError = void 0;
const zod_1 = require("zod");
class ValidationError extends Error {
    constructor(message, errors) {
        super(message);
        this.errors = errors;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
const validateInput = (schema, data) => {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const message = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
            throw new ValidationError(`Validation failed: ${message}`, error.issues);
        }
        throw error;
    }
};
exports.validateInput = validateInput;
//# sourceMappingURL=validation.js.map