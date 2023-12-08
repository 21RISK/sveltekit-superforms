export class SuperFormError extends Error {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, SuperFormError.prototype);
    }
}
export {} from './stringPath.js';
