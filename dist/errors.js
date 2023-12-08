import { mergePath } from './stringPath.js';
import { unwrapZodType } from './schemaEntity.js';
import { setPaths, traversePaths } from './traversal.js';
const _cachedErrorShapes = new WeakMap();
export function errorShape(schema) {
    if (!_cachedErrorShapes.has(schema)) {
        _cachedErrorShapes.set(schema, _errorShape(schema));
    }
    // Can be casted since it guaranteed to be an object
    return _cachedErrorShapes.get(schema);
}
function _errorShape(type) {
    const unwrapped = unwrapZodType(type).zodType;
    if (unwrapped._def.typeName == 'ZodObject') {
        return Object.fromEntries(Object.entries(unwrapped.shape)
            .map(([key, value]) => {
            return [key, _errorShape(value)];
        })
            .filter((entry) => entry[1] !== undefined));
    }
    else if (unwrapped._def.typeName == 'ZodArray') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return _errorShape(unwrapped._def.type) ?? {};
    }
    else if (unwrapped._def.typeName == 'ZodRecord') {
        return _errorShape(unwrapped._def.valueType) ?? {};
    }
    else if (unwrapped._def.typeName == 'ZodUnion') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const options = unwrapped._def
            .options;
        return options.reduce((shape, next) => {
            const nextShape = _errorShape(next);
            if (nextShape)
                shape = { ...(shape ?? {}), ...nextShape };
            return shape;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }, undefined);
    }
    return undefined;
}
export function mapErrors(obj, errorShape, inObject = true) {
    /*
    console.log('====================================================');
    console.dir(obj, { depth: 7 });
    console.log('----------------------------------------------------');
    console.dir(errorShape, { depth: 7 });
    */
    const output = {};
    const entries = Object.entries(obj);
    if ('_errors' in obj && obj._errors.length) {
        // Check if we are at the end of a node
        if (!errorShape || !inObject) {
            return obj._errors;
        }
        else {
            output._errors = obj._errors;
        }
    }
    for (const [key, value] of entries.filter(([key]) => key !== '_errors')) {
        // Keep current errorShape if the object key is numeric
        // which means we are in an array.
        const numericKey = /^\d+$/.test(key);
        // _errors are filtered out, so casting is fine
        output[key] = mapErrors(value, errorShape ? (numericKey ? errorShape : errorShape[key]) : undefined, !!errorShape?.[key] // We're not in an object if there is no key in the ErrorShape
        );
    }
    return output;
}
export function flattenErrors(errors) {
    return _flattenErrors(errors, []);
}
function _flattenErrors(errors, path) {
    const entries = Object.entries(errors);
    return entries
        .filter(([, value]) => value !== undefined)
        .flatMap(([key, messages]) => {
        if (Array.isArray(messages) && messages.length > 0) {
            const currPath = path.concat([key]);
            return { path: mergePath(currPath), messages };
        }
        else {
            return _flattenErrors(errors[key], path.concat([key]));
        }
    });
}
export function clearErrors(Errors, options) {
    Errors.update(($errors) => {
        traversePaths($errors, (pathData) => {
            if (pathData.path.length == 1 &&
                pathData.path[0] == '_errors' &&
                !options.clearFormLevelErrors) {
                return;
            }
            if (Array.isArray(pathData.value)) {
                return pathData.set(undefined);
            }
        });
        if (options.undefinePath)
            setPaths($errors, [options.undefinePath], undefined);
        return $errors;
    });
}
