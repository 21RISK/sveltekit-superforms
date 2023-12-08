/// <reference types="svelte" />
import type { ActionResult } from '@sveltejs/kit';
import { type Readable, type Writable } from 'svelte/store';
import { type TaintedFields, type SuperValidated } from '../index.js';
import type { z, AnyZodObject } from 'zod';
import type { Entity } from '../schemaEntity.js';
import type { FormOptions } from './index.js';
export type FormUpdate = (result: Exclude<ActionResult, {
    type: 'error';
}>, untaint?: boolean) => Promise<void>;
export type SuperFormEvents<T extends AnyZodObject, M> = Pick<FormOptions<T, M>, 'onError' | 'onResult' | 'onSubmit' | 'onUpdate' | 'onUpdated'>;
export type SuperFormEventList<T extends AnyZodObject, M> = {
    [Property in keyof SuperFormEvents<T, M>]-?: NonNullable<SuperFormEvents<T, M>[Property]>[];
};
export declare function cancelFlash<T extends AnyZodObject, M>(options: FormOptions<T, M>): void;
export declare function shouldSyncFlash<T extends AnyZodObject, M>(options: FormOptions<T, M>): boolean | undefined;
/**
 * Custom use:enhance version. Flash message support, friendly error messages, for usage with initializeForm.
 * @param formEl Form element from the use:formEnhance default parameter.
 */
export declare function formEnhance<T extends AnyZodObject, M>(formEl: HTMLFormElement, submitting: Writable<boolean>, delayed: Writable<boolean>, timeout: Writable<boolean>, errs: Writable<unknown>, Form_updateFromActionResult: FormUpdate, options: FormOptions<T, M>, data: Writable<z.infer<T>>, message: Writable<M | undefined>, enableTaintedForm: () => void, formEvents: SuperFormEventList<T, M>, formId: Readable<string | undefined>, constraints: Readable<Entity<T>['constraints']>, tainted: Writable<TaintedFields<T> | undefined>, lastChanges: Writable<string[][]>, Context_findValidationForms: (data: Record<string, unknown>) => SuperValidated<AnyZodObject>[], posted: Readable<boolean>): {
    destroy(): void;
};
