import { SuperFormError } from '../index.js';
import { isInvalidPath, setPaths, traversePath, traversePaths, traversePathsAsync } from '../traversal.js';
import { errorShape, mapErrors, clearErrors } from '../errors.js';
import { clone } from '../utils.js';
import { get } from 'svelte/store';
export function validateForm(path, opts) {
    // See the validate function inside superForm for implementation.
    throw new SuperFormError('validateForm can only be used as superForm.validate.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { path, opts };
}
/**
 * Validate form data.
 */
export async function clientValidation(validators, checkData, formId, constraints, posted) {
    return _clientValidation(validators, checkData, formId, constraints, posted);
}
async function _clientValidation(validators, checkData, formId, constraints, posted) {
    let valid = true;
    let clientErrors = {};
    if (validators) {
        if ('safeParseAsync' in validators) {
            // Zod validator
            const validator = validators;
            const result = await validator.safeParseAsync(checkData);
            valid = result.success;
            if (!result.success) {
                clientErrors = mapErrors(result.error.format(), errorShape(validator)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                );
            }
            else {
                checkData = result.data;
            }
        }
        else {
            // SuperForms validator
            checkData = { ...checkData };
            // Add top-level validator fields to non-existing checkData fields
            // so they will be validated even if the field doesn't exist
            for (const [key, value] of Object.entries(validators)) {
                if (typeof value === 'function' && !(key in checkData)) {
                    // @ts-expect-error Setting undefined fields so they will be validated based on field existance.
                    checkData[key] = undefined;
                }
            }
            const validator = validators;
            const newErrors = [];
            await traversePathsAsync(checkData, async ({ value, path }) => {
                // Filter out array indices, the validator structure doesn't contain these.
                const validationPath = path.filter((p) => /\D/.test(String(p)));
                const maybeValidator = traversePath(validator, validationPath);
                if (typeof maybeValidator?.value === 'function') {
                    const check = maybeValidator.value;
                    let errors;
                    if (Array.isArray(value)) {
                        for (const key in value) {
                            try {
                                errors = await check(value[key]);
                                if (errors) {
                                    valid = false;
                                    newErrors.push({
                                        path: path.concat([key]),
                                        errors: typeof errors === 'string'
                                            ? [errors]
                                            : errors ?? undefined
                                    });
                                }
                            }
                            catch (e) {
                                valid = false;
                                console.error(`Error in form validators for field "${path}":`, e);
                            }
                        }
                    }
                    else {
                        try {
                            errors = await check(value);
                            if (errors) {
                                valid = false;
                                newErrors.push({
                                    path,
                                    errors: typeof errors === 'string'
                                        ? [errors]
                                        : errors ?? undefined
                                });
                            }
                        }
                        catch (e) {
                            valid = false;
                            console.error(`Error in form validators for field "${path}":`, e);
                        }
                    }
                }
            });
            for (const { path, errors } of newErrors) {
                const errorPath = traversePath(clientErrors, path, ({ parent, key, value }) => {
                    if (value === undefined)
                        parent[key] = {};
                    return parent[key];
                });
                if (errorPath) {
                    const { parent, key } = errorPath;
                    parent[key] = errors;
                }
            }
        }
    }
    return {
        valid,
        posted,
        errors: clientErrors,
        data: checkData,
        constraints,
        message: undefined,
        id: formId
    };
}
/**
 * Validate and set/clear object level errors.
 */
export async function validateObjectErrors(formOptions, Form, Errors, tainted) {
    if (typeof formOptions.validators !== 'object' ||
        !('safeParseAsync' in formOptions.validators)) {
        return;
    }
    const validators = formOptions.validators;
    const result = await validators.safeParseAsync(get(Form));
    if (!result.success) {
        const newErrors = mapErrors(result.error.format(), errorShape(validators));
        Errors.update((currentErrors) => {
            // Clear current object-level errors
            traversePaths(currentErrors, (pathData) => {
                if (pathData.key == '_errors') {
                    return pathData.set(undefined);
                }
            });
            // Add new object-level errors and tainted field errors
            traversePaths(newErrors, (pathData) => {
                if (pathData.key == '_errors') {
                    // Check if the parent path (the actual array) is tainted
                    // Form-level errors are always "tainted"
                    const taintedPath = pathData.path.length == 1
                        ? { value: true }
                        : tainted &&
                            traversePath(tainted, pathData.path.slice(0, -1));
                    if (taintedPath && taintedPath.value) {
                        return setPaths(currentErrors, [pathData.path], pathData.value);
                    }
                }
            });
            return currentErrors;
        });
    }
    else {
        Errors.update((currentErrors) => {
            // Clear current object-level errors
            traversePaths(currentErrors, (pathData) => {
                if (pathData.key == '_errors') {
                    return pathData.set(undefined);
                }
            });
            return currentErrors;
        });
        // Disable if form values shouldn't be updated immediately:
        //if (result.data) Form.set(result.data);
    }
}
/**
 * Validate a specific form field.
 * @DCI-context
 */
export async function validateField(path, formOptions, data, Errors, Tainted, options = {}) {
    function Errors_clear() {
        clearErrors(Errors, { undefinePath: path, clearFormLevelErrors: true });
    }
    function Errors_update(errorMsgs) {
        if (typeof errorMsgs === 'string')
            errorMsgs = [errorMsgs];
        if (options.update === true || options.update == 'errors') {
            Errors.update((errors) => {
                const error = traversePath(errors, path, (node) => {
                    if (isInvalidPath(path, node)) {
                        throw new SuperFormError('Errors can only be added to form fields, not to arrays or objects in the schema. Path: ' +
                            node.path.slice(0, -1));
                    }
                    else if (node.value === undefined) {
                        node.parent[node.key] = {};
                        return node.parent[node.key];
                    }
                    else {
                        return node.value;
                    }
                });
                if (!error)
                    throw new SuperFormError('Error path could not be created: ' + path);
                error.parent[error.key] = errorMsgs ?? undefined;
                return errors;
            });
        }
        return errorMsgs ?? undefined;
    }
    const result = await _validateField(path, formOptions.validators, data, Errors, Tainted, options);
    if (result.validated) {
        if (result.validated === 'all' && !result.errors) {
            // We validated the whole data structure, so clear all errors on success after delayed validators.
            // it will also set the current path to undefined, so it can be used in
            // the tainted+error check in oninput.
            Errors_clear();
        }
        else {
            result.errors = Errors_update(result.errors);
        }
    }
    else if (result.validated === false &&
        formOptions.defaultValidator == 'clear') {
        result.errors = Errors_update(result.errors);
    }
    return result;
}
// @DCI-context
async function _validateField(path, validators, data, Errors, Tainted, options = {}) {
    if (options.update === undefined)
        options.update = true;
    if (options.taint === undefined)
        options.taint = false;
    if (typeof options.errors == 'string')
        options.errors = [options.errors];
    const Context = {
        value: options.value,
        shouldUpdate: true,
        currentData: undefined,
        // Remove numeric indices, they're not used for validators.
        validationPath: path.filter((p) => /\D/.test(String(p)))
    };
    async function defaultValidate() {
        return { validated: false, errors: undefined, data: undefined };
    }
    ///// Roles ///////////////////////////////////////////////////////
    function Tainted_isPathTainted(path, tainted) {
        if (tainted === undefined)
            return false;
        const leaf = traversePath(tainted, path);
        if (!leaf)
            return false;
        return leaf.value;
    }
    function Errors_update(updater) {
        Errors.update(updater);
    }
    function Errors_clearAll() {
        clearErrors(Errors, { undefinePath: null, clearFormLevelErrors: true });
    }
    function Errors_fromZod(errors, validator) {
        return mapErrors(errors.format(), errorShape(validator));
    }
    ///////////////////////////////////////////////////////////////////
    if (!('value' in options)) {
        // Use value from data
        Context.currentData = get(data);
        const dataToValidate = traversePath(Context.currentData, path);
        Context.value = dataToValidate?.value;
    }
    else if (options.update === true || options.update === 'value') {
        // Value should be updating the data
        data.update(($data) => {
            setPaths($data, [path], Context.value);
            return (Context.currentData = $data);
        }, { taint: options.taint });
    }
    else {
        Context.shouldUpdate = false;
    }
    //console.log('🚀 ~ file: index.ts:871 ~ validate:', path, value);
    if (typeof validators !== 'object') {
        return defaultValidate();
    }
    if ('safeParseAsync' in validators) {
        // Zod validator
        if (!Context.shouldUpdate) {
            // If value shouldn't update, clone and set the new value
            Context.currentData = clone(Context.currentData ?? get(data));
            setPaths(Context.currentData, [path], Context.value);
        }
        const result = await validators.safeParseAsync(Context.currentData);
        if (!result.success) {
            const newErrors = Errors_fromZod(result.error, validators);
            if (options.update === true || options.update == 'errors') {
                // Set errors for other (tainted) fields, that may have been changed
                const taintedFields = get(Tainted);
                Errors_update((currentErrors) => {
                    // Clear current object-level errors
                    traversePaths(currentErrors, (pathData) => {
                        if (pathData.key == '_errors') {
                            return pathData.set(undefined);
                        }
                    });
                    // Add new object-level errors and tainted field errors
                    traversePaths(newErrors, (pathData) => {
                        if (pathData.key == '_errors' &&
                            (pathData.path.length == 1 ||
                                Tainted_isPathTainted(pathData.path.slice(0, -1), taintedFields))) {
                            return setPaths(currentErrors, [pathData.path], pathData.value);
                        }
                        if (!Array.isArray(pathData.value))
                            return;
                        if (Tainted_isPathTainted(pathData.path, taintedFields)) {
                            setPaths(currentErrors, [pathData.path], pathData.value);
                        }
                        return 'skip';
                    });
                    return currentErrors;
                });
            }
            // Finally, set errors for the specific field
            // it will be set to undefined if no errors, so the tainted+error check
            // in oninput can determine if errors should be displayed or not.
            const current = traversePath(newErrors, path);
            return {
                validated: true,
                errors: options.errors ?? current?.value,
                data: undefined
            };
        }
        else {
            Errors_clearAll();
            return {
                validated: true,
                errors: undefined,
                data: result.data // For a successful Zod result, return the possibly transformed data.
            };
        }
    }
    else {
        // SuperForms validator
        const validator = traversePath(validators, Context.validationPath);
        if (!validator || validator.value === undefined) {
            // No validator, use default
            return defaultValidate();
        }
        else {
            const result = (await validator.value(Context.value));
            return {
                validated: true,
                errors: result ? options.errors ?? result : result,
                data: undefined // No transformation for Superforms validators
            };
        }
    }
}
