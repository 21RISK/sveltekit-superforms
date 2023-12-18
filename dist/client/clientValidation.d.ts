import { type SuperValidated, type ZodValidation, type FormPathLeaves, type TaintedFields, type UnwrapEffects } from '../index.js';
import type { z, AnyZodObject } from 'zod';
import type { FormOptions, SuperForm, TaintOption } from './index.js';
import type { FormPathType } from '../stringPath.js';
export type ValidateOptions<V, T extends AnyZodObject = AnyZodObject> = Partial<{
    value: V;
    update: boolean | 'errors' | 'value';
    taint: TaintOption<T>;
    errors: string | string[];
}>;
/**
 * Validate current form data.
 */
export declare function validateForm<T extends AnyZodObject>(): Promise<SuperValidated<ZodValidation<T>>>;
/**
 * Validate a specific field in the form.
 */
export declare function validateForm<T extends AnyZodObject>(path: FormPathLeaves<z.infer<T>>, opts?: ValidateOptions<FormPathType<z.infer<T>, FormPathLeaves<z.infer<T>>>, T>): Promise<string[] | undefined>;
/**
 * Validate form data.
 */
export declare function clientValidation<T extends AnyZodObject, M = unknown>(validators: FormOptions<T, M>['validators'], checkData: z.infer<T>, formId: string | undefined, constraints: SuperValidated<ZodValidation<T>>['constraints'], posted: boolean): Promise<SuperValidated<ZodValidation<T>>>;
/**
 * Validate and set/clear object level errors.
 */
export declare function validateObjectErrors<T extends AnyZodObject, M>(formOptions: FormOptions<T, M>, Form: SuperForm<T, M>['form'], Errors: SuperForm<T, M>['errors'], tainted: TaintedFields<UnwrapEffects<T>> | undefined): Promise<void>;
export type ValidationResult<T extends Record<string, unknown>> = {
    validated: boolean | 'all';
    errors: string[] | undefined;
    data: T | undefined;
};
/**
 * Validate a specific form field.
 * @DCI-context
 */
export declare function validateField<T extends ZodValidation<AnyZodObject>, M>(path: string[], formOptions: FormOptions<T, M>, data: SuperForm<T, M>['form'], Errors: SuperForm<T, M>['errors'], Tainted: SuperForm<T, M>['tainted'], options?: ValidateOptions<unknown, UnwrapEffects<T>>): Promise<ValidationResult<z.infer<T>>>;
