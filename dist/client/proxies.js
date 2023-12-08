import { derived } from 'svelte/store';
import { SuperFormError } from '../index.js';
import { traversePath } from '../traversal.js';
import { splitPath } from '../stringPath.js';
const defaultOptions = {
    trueStringValue: 'true',
    dateFormat: 'iso',
    emptyIfZero: true
};
///// Proxy functions ///////////////////////////////////////////////
export function booleanProxy(form, path, options = {
    trueStringValue: 'true'
}) {
    return _stringProxy(form, path, 'boolean', {
        ...defaultOptions,
        ...options
    });
}
export function intProxy(form, path, options = {}) {
    return _stringProxy(form, path, 'int', {
        ...defaultOptions,
        ...options
    });
}
export function numberProxy(form, path, options = {}) {
    return _stringProxy(form, path, 'number', {
        ...defaultOptions,
        ...options
    });
}
export function dateProxy(form, path, options = {
    format: 'iso'
}) {
    return _stringProxy(form, path, 'date', {
        ...defaultOptions,
        dateFormat: options.format,
        empty: options.empty
    });
}
export function stringProxy(form, path, options) {
    return _stringProxy(form, path, 'string', {
        ...defaultOptions,
        empty: options.empty
    });
}
///// Implementation ////////////////////////////////////////////////
/**
 * Creates a string store that will pass its value to a field in the form.
 * @param form The form
 * @param field Form field
 * @param type 'number' | 'int' | 'boolean'
 */
function _stringProxy(form, path, type, options) {
    function toValue(value) {
        if (!value &&
            options.empty !== undefined &&
            (value !== 0 || options.emptyIfZero)) {
            return options.empty === 'null' ? null : undefined;
        }
        if (typeof value === 'number') {
            value = value.toString();
        }
        if (typeof value !== 'string') {
            throw new SuperFormError('stringProxy received a non-string value.');
        }
        if (type == 'string')
            return value;
        else if (type == 'boolean')
            return !!value;
        else if (type == 'date')
            return new Date(value);
        const numberToConvert = options.delimiter
            ? value.replace(options.delimiter, '.')
            : value;
        let num;
        if (type == 'number')
            num = parseFloat(numberToConvert);
        else
            num = parseInt(numberToConvert, 10);
        if (options.empty !== undefined &&
            ((num === 0 && options.emptyIfZero) || isNaN(num))) {
            return options.empty == 'null' ? null : undefined;
        }
        return num;
    }
    const proxy2 = fieldProxy(form, path);
    const proxy = derived(proxy2, (value) => {
        if (value === undefined || value === null)
            return '';
        if (type == 'string') {
            return value;
        }
        else if (type == 'int' || type == 'number') {
            const num = value;
            return isNaN(num) ? '' : String(num);
        }
        else if (type == 'date') {
            const date = value;
            if (isNaN(date))
                return '';
            switch (options.dateFormat) {
                case 'iso':
                    return date.toISOString();
                case 'date':
                    return date.toISOString().slice(0, 10);
                case 'datetime':
                    return date.toISOString().slice(0, 16);
                case 'time':
                    return date.toISOString().slice(11, 16);
                case 'date-utc':
                    return UTCDate(date);
                case 'datetime-utc':
                    return UTCDate(date) + 'T' + UTCTime(date);
                case 'time-utc':
                    return UTCTime(date);
                case 'date-local':
                    return localDate(date);
                case 'datetime-local':
                    return localDate(date) + 'T' + localTime(date);
                case 'time-local':
                    return localTime(date);
            }
        }
        else {
            // boolean
            return value ? options.trueStringValue : '';
        }
    });
    return {
        subscribe: proxy.subscribe,
        set(val) {
            proxy2.set(toValue(val));
        },
        update(updater) {
            proxy2.update((f) => toValue(updater(String(f))));
        }
    };
}
export function arrayProxy(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
superForm, path, options) {
    const formErrors = fieldProxy(superForm.errors, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    `${path}`);
    const onlyFieldErrors = derived(formErrors, ($errors) => {
        const output = [];
        for (const key in $errors) {
            if (key == '_errors')
                continue;
            output[key] = $errors[key];
        }
        return output;
    });
    function updateArrayErrors(errors, value) {
        for (const key in errors) {
            if (key == '_errors')
                continue;
            errors[key] = undefined;
        }
        if (value !== undefined) {
            for (const key in value) {
                errors[key] = value[key];
            }
        }
        return errors;
    }
    const fieldErrors = {
        subscribe: onlyFieldErrors.subscribe,
        update(upd) {
            formErrors.update(($errors) => 
            // @ts-expect-error Type is correct
            updateArrayErrors($errors, upd($errors)));
        },
        set(value) {
            // @ts-expect-error Type is correct
            formErrors.update(($errors) => updateArrayErrors($errors, value));
        }
    };
    return {
        path,
        values: superFieldProxy(superForm, path, options),
        errors: fieldProxy(superForm.errors, 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        `${path}._errors`),
        fieldErrors
    };
}
export function formFieldProxy(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
superForm, path, options) {
    const path2 = splitPath(path);
    // Filter out array indices, the constraints structure doesn't contain these.
    const constraintsPath = path2
        .filter((p) => /\D/.test(String(p)))
        .join('.');
    const taintedProxy = derived(superForm.tainted, ($tainted) => {
        if (!$tainted)
            return $tainted;
        const taintedPath = traversePath($tainted, path2);
        return taintedPath ? taintedPath.value : undefined;
    });
    const tainted = {
        subscribe: taintedProxy.subscribe,
        update(upd) {
            superForm.tainted.update(($tainted) => {
                if (!$tainted)
                    $tainted = {};
                const output = traversePath($tainted, path2, (path) => {
                    if (!path.value)
                        path.parent[path.key] = {};
                    return path.parent[path.key];
                });
                if (output)
                    output.parent[output.key] = upd(output.value);
                return $tainted;
            });
        },
        set(value) {
            superForm.tainted.update(($tainted) => {
                if (!$tainted)
                    $tainted = {};
                const output = traversePath($tainted, path2, (path) => {
                    if (!path.value)
                        path.parent[path.key] = {};
                    return path.parent[path.key];
                });
                if (output)
                    output.parent[output.key] = value;
                return $tainted;
            });
        }
    };
    return {
        path,
        value: superFieldProxy(superForm, path, options),
        errors: fieldProxy(superForm.errors, path),
        constraints: fieldProxy(superForm.constraints, constraintsPath),
        tainted
    };
}
function superFieldProxy(superForm, path, baseOptions) {
    const form = superForm.form;
    const path2 = splitPath(path);
    const proxy = derived(form, ($form) => {
        const data = traversePath($form, path2);
        return data?.value;
    });
    return {
        subscribe(...params) {
            const unsub = proxy.subscribe(...params);
            return () => unsub();
        },
        update(upd, options) {
            form.update((f) => {
                const output = traversePath(f, path2);
                if (output)
                    output.parent[output.key] = upd(output.value);
                return f;
            }, options ?? baseOptions);
        },
        set(value, options) {
            form.update((f) => {
                const output = traversePath(f, path2);
                if (output)
                    output.parent[output.key] = value;
                return f;
            }, options ?? baseOptions);
        }
    };
}
export function fieldProxy(form, path) {
    const path2 = splitPath(path);
    const proxy = derived(form, ($form) => {
        const data = traversePath($form, path2);
        return data?.value;
    });
    return {
        subscribe(...params) {
            const unsub = proxy.subscribe(...params);
            return () => unsub();
        },
        update(upd) {
            form.update((f) => {
                const output = traversePath(f, path2, ({ parent, key, value }) => {
                    if (value === undefined)
                        parent[key] = /\D/.test(key) ? {} : [];
                    return parent[key];
                });
                if (output)
                    output.parent[output.key] = upd(output.value);
                return f;
            });
        },
        set(value) {
            form.update((f) => {
                const output = traversePath(f, path2, ({ parent, key, value }) => {
                    if (value === undefined)
                        parent[key] = /\D/.test(key) ? {} : [];
                    return parent[key];
                });
                if (output)
                    output.parent[output.key] = value;
                return f;
            });
        }
    };
}
function localDate(date) {
    return (date.getFullYear() +
        '-' +
        String(date.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(date.getDate()).padStart(2, '0'));
}
function localTime(date) {
    return (String(date.getHours()).padStart(2, '0') +
        ':' +
        String(date.getMinutes()).padStart(2, '0'));
}
function UTCDate(date) {
    return (date.getUTCFullYear() +
        '-' +
        String(date.getUTCMonth() + 1).padStart(2, '0') +
        '-' +
        String(date.getUTCDate()).padStart(2, '0'));
}
function UTCTime(date) {
    return (String(date.getUTCHours()).padStart(2, '0') +
        ':' +
        String(date.getUTCMinutes()).padStart(2, '0'));
}
/*
function dateToUTC(date: Date) {
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );
}
*/
