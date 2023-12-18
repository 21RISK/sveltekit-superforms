import { fail, json } from '@sveltejs/kit';
import { parse, stringify } from 'devalue';
import { SuperFormError } from './index.js';
import { entityData, unwrapZodType, valueOrDefault } from './schemaEntity.js';
import { traversePath } from './traversal.js';
import { splitPath } from './stringPath.js';
import { clone } from './utils.js';
import { mapErrors } from './errors.js';
export { defaultValues } from './schemaEntity.js';
/**
 * Sends a message with a form, with an optional HTTP status code that will set
 * form.valid to false if status >= 400. A status lower than 400 cannot be sent.
 */
export function message(form, message, options) {
    if (options?.status && options.status >= 400) {
        form.valid = false;
    }
    form.message = message;
    return !form.valid ? fail(options?.status ?? 400, { form }) : { form };
}
export const setMessage = message;
export function setError(form, path, error, options) {
    // Unify signatures
    if (error == undefined ||
        (typeof error !== 'string' && !Array.isArray(error))) {
        options = error;
        error = path;
        path = '';
    }
    if (options === undefined)
        options = {};
    const errArr = Array.isArray(error) ? error : [error];
    if (!form.errors)
        form.errors = {};
    if (path === null || path === '') {
        if (!form.errors._errors)
            form.errors._errors = [];
        form.errors._errors = options.overwrite
            ? errArr
            : form.errors._errors.concat(errArr);
    }
    else {
        const realPath = splitPath(path);
        const leaf = traversePath(form.errors, realPath, ({ parent, key, value }) => {
            if (value === undefined)
                parent[key] = {};
            return parent[key];
        });
        if (leaf) {
            leaf.parent[leaf.key] =
                Array.isArray(leaf.value) && !options.overwrite
                    ? leaf.value.concat(errArr)
                    : errArr;
        }
    }
    form.valid = false;
    return fail(options.status ?? 400, { form });
}
function formDataToValidation(data, schemaData, preprocessed) {
    const strictData = {};
    const parsedData = {};
    const { schemaKeys, entityInfo } = schemaData;
    for (const key of schemaKeys) {
        const typeInfo = entityInfo.typeInfo[key];
        const entries = data.getAll(key);
        if (!(typeInfo.zodType._def.typeName == 'ZodArray')) {
            parsedData[key] = parseSingleEntry(key, entries[0], typeInfo);
        }
        else {
            const arrayType = unwrapZodType(typeInfo.zodType._def.type);
            parsedData[key] = entries.map((e) => parseSingleEntry(key, e, arrayType));
        }
        if (!entries.length && !typeInfo.isOptional) {
            strictData[key] = undefined;
        }
        else {
            strictData[key] = parsedData[key];
        }
    }
    for (const key of Object.keys(strictData)) {
        if (strictData[key] === undefined)
            delete strictData[key];
    }
    return { parsed: parsedData, partial: strictData };
    function parseSingleEntry(key, entry, typeInfo) {
        if (preprocessed && preprocessed.includes(key)) {
            return entry;
        }
        if (entry && typeof entry !== 'string') {
            // File object, not supported
            return undefined;
        }
        return parseFormDataEntry(key, entry, typeInfo);
    }
    function parseFormDataEntry(field, value, typeInfo) {
        const newValue = valueOrDefault(value, typeInfo);
        const zodType = typeInfo.zodType;
        const typeName = zodType._def.typeName;
        // If the value was empty, it now contains the default value,
        // so it can be returned immediately, unless it's boolean, which
        // means it could have been posted as a checkbox.
        if (!value && typeName != 'ZodBoolean') {
            return newValue;
        }
        //console.log(`FormData field "${field}" (${typeName}): ${value}`
        if (typeName == 'ZodString') {
            return value;
        }
        else if (typeName == 'ZodNumber') {
            return zodType.isInt
                ? parseInt(value ?? '', 10)
                : parseFloat(value ?? '');
        }
        else if (typeName == 'ZodBoolean') {
            return Boolean(value == 'false' ? '' : value).valueOf();
        }
        else if (typeName == 'ZodDate') {
            return new Date(value ?? '');
        }
        else if (typeName == 'ZodArray') {
            const arrayType = unwrapZodType(zodType._def.type);
            return parseFormDataEntry(field, value, arrayType);
        }
        else if (typeName == 'ZodBigInt') {
            try {
                return BigInt(value ?? '.');
            }
            catch {
                return NaN;
            }
        }
        else if (typeName == 'ZodLiteral') {
            const literalType = typeof zodType.value;
            if (literalType === 'string')
                return value;
            else if (literalType === 'number')
                return parseFloat(value ?? '');
            else if (literalType === 'boolean')
                return Boolean(value).valueOf();
            else {
                throw new SuperFormError('Unsupported ZodLiteral type: ' + literalType);
            }
        }
        else if (typeName == 'ZodUnion' ||
            typeName == 'ZodEnum' ||
            typeName == 'ZodAny') {
            return value;
        }
        else if (typeName == 'ZodNativeEnum') {
            const zodEnum = zodType;
            if (value !== null && value in zodEnum.enum) {
                const enumValue = zodEnum.enum[value];
                if (typeof enumValue === 'number')
                    return enumValue;
                else if (enumValue in zodEnum.enum)
                    return zodEnum.enum[enumValue];
            }
            else if (value !== null &&
                Object.values(zodEnum.enum).includes(value)) {
                return value;
            }
            return undefined;
        }
        else if (typeName == 'ZodSymbol') {
            return Symbol(String(value));
        }
        if (typeName == 'ZodObject') {
            throw new SuperFormError(`Object found in form field "${field}". ` +
                `Set the dataType option to "json" and add use:enhance on the client to use nested data structures. ` +
                `More information: https://superforms.rocks/concepts/nested-data`);
        }
        throw new SuperFormError('Unsupported Zod default type: ' + zodType.constructor.name);
    }
}
/**
 * Check what data to validate. If no parsed data, the default entity
 * may still have to be validated if there are side-effects or errors
 * should be displayed.
 */
function dataToValidate(parsed, schemaData, strict) {
    if (!parsed.data) {
        return schemaData.hasEffects || schemaData.opts.errors === true
            ? schemaData.entityInfo.defaultEntity
            : undefined;
    }
    else if (strict && parsed.partialData) {
        return parsed.partialData;
    }
    else
        return parsed.data;
}
function parseFormData(formData, schemaData, options) {
    function tryParseSuperJson() {
        if (formData.has('__superform_json')) {
            try {
                const output = parse(formData.getAll('__superform_json').join('') ?? '');
                if (typeof output === 'object') {
                    return output;
                }
            }
            catch {
                //
            }
        }
        return null;
    }
    const data = tryParseSuperJson();
    const id = formData.get('__superform_id')?.toString() ?? undefined;
    if (data) {
        return { id, data, posted: true, partialData: null };
    }
    const parsed = formDataToValidation(formData, schemaData, options?.preprocessed);
    return {
        id,
        data: parsed.parsed,
        partialData: parsed.partial,
        posted: true
    };
}
function parseSearchParams(data, schemaData, options) {
    if (data instanceof URL)
        data = data.searchParams;
    const convert = new FormData();
    for (const [key, value] of data.entries()) {
        convert.append(key, value);
    }
    // Only FormData can be posted.
    const output = parseFormData(convert, schemaData, options);
    output.posted = false;
    return output;
}
function validateResult(parsed, schemaData, result) {
    const { opts: options, entityInfo } = schemaData;
    const posted = parsed.posted;
    // Determine id for form
    // 1. options.id
    // 2. formData.__superform_id
    // 3. schema hash
    const id = parsed.data
        ? options.id ?? parsed.id ?? entityInfo.hash
        : options.id ?? entityInfo.hash;
    if (!parsed.data) {
        let data = undefined;
        let errors = {};
        const valid = result?.success ?? false;
        const { opts: options, entityInfo } = schemaData;
        if (result) {
            if (result.success) {
                data = result.data;
            }
            else if (options.errors === true) {
                errors = mapErrors(result.error.format(), entityInfo.errorShape);
            }
        }
        return {
            id,
            valid,
            posted,
            errors,
            // Copy the default entity so it's not modified
            data: data ?? clone(entityInfo.defaultEntity),
            constraints: entityInfo.constraints
        };
    }
    else {
        const { opts: options, schemaKeys, entityInfo, unwrappedSchema } = schemaData;
        if (!result) {
            throw new SuperFormError('Validation data exists without validation result.');
        }
        if (!result.success) {
            const partialData = parsed.data;
            const errors = options.errors !== false
                ? mapErrors(result.error.format(), entityInfo.errorShape)
                : {};
            // passthrough, strip, strict
            const zodKeyStatus = unwrappedSchema._def.unknownKeys;
            let data;
            if (options.strict) {
                data = parsed.data;
            }
            else if (zodKeyStatus == 'passthrough') {
                data = { ...clone(entityInfo.defaultEntity), ...partialData };
            }
            else {
                data = Object.fromEntries(schemaKeys.map((key) => [
                    key,
                    key in partialData
                        ? partialData[key]
                        : clone(entityInfo.defaultEntity[key])
                ]));
            }
            return {
                id,
                valid: false,
                posted,
                errors,
                data,
                constraints: entityInfo.constraints
            };
        }
        else {
            return {
                id,
                valid: true,
                posted,
                errors: {},
                data: result.data,
                constraints: entityInfo.constraints
            };
        }
    }
}
function getSchemaData(schema, options) {
    const originalSchema = schema;
    let unwrappedSchema = schema;
    let hasEffects = false;
    while (unwrappedSchema._def.typeName == 'ZodEffects') {
        hasEffects = true;
        unwrappedSchema = unwrappedSchema._def.schema;
    }
    if (!(unwrappedSchema._def.typeName == 'ZodObject')) {
        throw new SuperFormError('Only Zod schema objects can be used with superValidate. ' +
            'Define the schema with z.object({ ... }) and optionally refine/superRefine/transform at the end.');
    }
    const entityInfo = entityData(unwrappedSchema, options?.warnings);
    return {
        originalSchema,
        unwrappedSchema: unwrappedSchema,
        hasEffects,
        entityInfo,
        schemaKeys: entityInfo.keys,
        opts: options ?? {}
    };
}
/**
 * Validates a Zod schema for usage in a SvelteKit form.
 * @param data Data structure for a Zod schema, or RequestEvent/FormData/URL. If falsy, the schema's defaultEntity will be used.
 * @param schema The Zod schema to validate against.
 */
export async function superValidate(data, schema, options) {
    if (data && typeof data === 'object' && 'safeParseAsync' in data) {
        options = schema;
        schema = data;
        data = null;
    }
    const schemaData = getSchemaData(schema, options);
    async function tryParseFormData(request) {
        let formData = undefined;
        try {
            formData = await request.formData();
        }
        catch (e) {
            if (e instanceof TypeError &&
                e.message.includes('already been consumed')) {
                // Pass through the "body already consumed" error, which applies to
                // POST requests when event/request is used after formData has been fetched.
                throw e;
            }
            // No data found, return an empty form
            return {
                id: undefined,
                data: undefined,
                posted: false,
                partialData: undefined
            };
        }
        return parseFormData(formData, schemaData, options);
    }
    async function parseRequest() {
        let parsed;
        if (data instanceof FormData) {
            parsed = parseFormData(data, schemaData, options);
        }
        else if (data instanceof URL || data instanceof URLSearchParams) {
            parsed = parseSearchParams(data, schemaData, options);
        }
        else if (data instanceof Request) {
            parsed = await tryParseFormData(data);
        }
        else if (data &&
            typeof data === 'object' &&
            'request' in data &&
            data.request instanceof Request) {
            parsed = await tryParseFormData(data.request);
        }
        else if (options?.strict) {
            // Ensure that defaults are set on data if strict mode is enabled (Should this maybe always happen?)
            const params = new URLSearchParams(data);
            parsed = parseSearchParams(params, schemaData, options);
        }
        else {
            parsed = {
                id: undefined,
                posted: false,
                data: data,
                partialData: data
            };
        }
        //////////////////////////////////////////////////////////////////////
        // This logic is shared between superValidate and superValidateSync //
        const toValidate = dataToValidate(parsed, schemaData, options?.strict || false);
        const result = toValidate
            ? await schemaData.originalSchema.safeParseAsync(toValidate)
            : undefined;
        //////////////////////////////////////////////////////////////////////
        return { parsed, result };
    }
    const { parsed, result } = await parseRequest();
    const superValidated = validateResult(parsed, schemaData, result);
    return superValidated;
}
/**
 * Validates a Zod schema for usage in a SvelteKit form.
 * @param data Data structure for a Zod schema, or RequestEvent/FormData/URL. If falsy, the schema's defaultEntity will be used.
 * @param schema The Zod schema to validate against.
 */
export function superValidateSync(data, schema, options) {
    if (data && typeof data === 'object' && 'safeParse' in data) {
        options = schema;
        schema = data;
        data = null;
    }
    const schemaData = getSchemaData(schema, options);
    const parsed = data instanceof FormData
        ? parseFormData(data, schemaData, options)
        : data instanceof URL || data instanceof URLSearchParams
            ? parseSearchParams(data, schemaData)
            : {
                id: undefined,
                data: data,
                partialData: data,
                posted: false
            }; // Only schema, null or undefined left
    //////////////////////////////////////////////////////////////////////
    // This logic is shared between superValidate and superValidateSync //
    const toValidate = dataToValidate(parsed, schemaData, options?.strict || false);
    const result = toValidate
        ? schemaData.originalSchema.safeParse(toValidate)
        : undefined;
    //////////////////////////////////////////////////////////////////////
    return validateResult(parsed, schemaData, result);
}
export function actionResult(type, data, options) {
    function cookieData() {
        if (typeof options === 'number' || !options?.message)
            return '';
        const extra = [
            `Path=${options?.cookieOptions?.path || '/'}`,
            `Max-Age=${options?.cookieOptions?.maxAge || 120}`,
            `SameSite=${options?.cookieOptions?.sameSite ?? 'Strict'}`
        ];
        if (options?.cookieOptions?.secure) {
            extra.push(`Secure`);
        }
        return (`flash=${encodeURIComponent(JSON.stringify(options.message))}; ` +
            extra.join('; '));
    }
    const status = options && typeof options !== 'number' ? options.status : options;
    const result = (struct) => {
        return json({ type, ...struct }, {
            status: struct.status,
            headers: typeof options === 'object' && options.message
                ? {
                    'Set-Cookie': cookieData()
                }
                : undefined
        });
    };
    if (type == 'error') {
        return result({
            status: status || 500,
            error: typeof data === 'string' ? { message: data } : data
        });
    }
    else if (type == 'redirect') {
        return result({
            status: status || 303,
            location: data
        });
    }
    else if (type == 'failure') {
        return result({
            status: status || 400,
            data: stringify(data)
        });
    }
    else {
        return result({ status: status || 200, data: stringify(data) });
    }
}
