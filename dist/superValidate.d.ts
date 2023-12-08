import { type RequestEvent, type ActionFailure } from '@sveltejs/kit';
import { type SuperValidated, type ZodValidation, type UnwrapEffects } from './index.js';
import type { z, AnyZodObject } from 'zod';
import { type StringPathLeaves } from './stringPath.js';
import { type NumericRange } from './utils.js';
export { defaultValues } from './schemaEntity.js';
/**
 * Sends a message with a form, with an optional HTTP status code that will set
 * form.valid to false if status >= 400. A status lower than 400 cannot be sent.
 */
export declare function message<T extends ZodValidation<AnyZodObject>, M>(form: SuperValidated<T, M>, message: M, options?: {
    status?: NumericRange<400, 599>;
}): ActionFailure<{
    form: SuperValidated<T, M>;
}> | {
    form: SuperValidated<T, M>;
};
export declare const setMessage: typeof message;
type SetErrorOptions = {
    overwrite?: boolean;
    status?: NumericRange<400, 599>;
};
/**
 * Sets a form-level error.
 * form.valid is automatically set to false.
 *
 * @param {SuperValidated<T, unknown>} form A validation object, usually returned from superValidate.
 * @param {string | string[]} error Error message(s).
 * @param {SetErrorOptions} options Option to overwrite previous errors and set a different status than 400. The status must be in the range 400-599.
 * @returns fail(status, { form })
 */
export declare function setError<T extends ZodValidation<AnyZodObject>>(form: SuperValidated<T, unknown>, error: string | string[], options?: SetErrorOptions): ActionFailure<{
    form: SuperValidated<T, unknown>;
}>;
/**
 * Sets an error for a form field or array field.
 * form.valid is automatically set to false.
 *
 * @param {SuperValidated<T, unknown>} form A validation object, usually returned from superValidate.
 * @param {'' | StringPathLeaves<z.infer<UnwrapEffects<T>>, '_errors'>} path Path to the form field. Use an empty string to set a form-level error. Array-level errors can be set by appending "._errors" to the field.
 * @param {string | string[]} error Error message(s).
 * @param {SetErrorOptions} options Option to overwrite previous errors and set a different status than 400. The status must be in the range 400-599.
 * @returns fail(status, { form })
 */
export declare function setError<T extends ZodValidation<AnyZodObject>>(form: SuperValidated<T, unknown>, path: '' | StringPathLeaves<z.infer<UnwrapEffects<T>>, '_errors'>, error: string | string[], options?: SetErrorOptions): ActionFailure<{
    form: SuperValidated<T, unknown>;
}>;
export type SuperValidateOptions<T extends AnyZodObject = AnyZodObject> = Partial<{
    strict: boolean;
    errors: boolean;
    id: string;
    warnings: {
        multipleRegexps?: boolean;
        multipleSteps?: boolean;
    };
    preprocessed: (keyof z.infer<T>)[];
}>;
export declare function superValidate<T extends ZodValidation<AnyZodObject>, M = App.Superforms.Message extends never ? any : App.Superforms.Message>(schema: T, options?: SuperValidateOptions<UnwrapEffects<T>>): Promise<SuperValidated<UnwrapEffects<T>, M>>;
export declare function superValidate<T extends ZodValidation<AnyZodObject>, M = App.Superforms.Message extends never ? any : App.Superforms.Message>(data: RequestEvent | Request | FormData | URLSearchParams | URL | Partial<z.infer<UnwrapEffects<T>>> | null | undefined, schema: T, options?: SuperValidateOptions<UnwrapEffects<T>>): Promise<SuperValidated<UnwrapEffects<T>, M>>;
export declare function superValidateSync<T extends ZodValidation<AnyZodObject>, M = App.Superforms.Message extends never ? any : App.Superforms.Message>(schema: T, options?: SuperValidateOptions<UnwrapEffects<T>>): SuperValidated<UnwrapEffects<T>, M>;
export declare function superValidateSync<T extends ZodValidation<AnyZodObject>, M = App.Superforms.Message extends never ? any : App.Superforms.Message>(data: FormData | URLSearchParams | URL | Partial<z.infer<UnwrapEffects<T>>> | null | undefined, schema: T, options?: SuperValidateOptions<UnwrapEffects<T>>): SuperValidated<UnwrapEffects<T>, M>;
/**
 * Cookie configuration options. The defaults are:
 * Path=/; Max-Age=120; SameSite=Strict;
 */
export interface CookieSerializeOptions {
    path?: string | undefined;
    maxAge?: number | undefined;
    sameSite?: 'Lax' | 'Strict' | 'None';
    secure?: boolean | undefined;
}
export declare function actionResult<T extends Record<string, unknown> | App.Error | string, Type extends T extends string ? 'redirect' | 'error' : 'success' | 'failure' | 'error'>(type: Type, data?: T, options?: number | {
    status?: number;
    message?: Type extends 'redirect' ? App.PageData['flash'] : never;
    cookieOptions?: CookieSerializeOptions;
}): Response;
