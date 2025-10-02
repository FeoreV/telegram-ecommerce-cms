"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorMessage = getErrorMessage;
exports.getErrorDetails = getErrorDetails;
function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
function getErrorDetails(error) {
    if (error instanceof Error) {
        return {
            message: error.message,
            stack: error.stack,
            name: error.name
        };
    }
    return {
        message: String(error)
    };
}
//# sourceMappingURL=errorUtils.js.map