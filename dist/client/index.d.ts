/// <reference types="svelte" />
import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
import type { Page } from '@sveltejs/kit';
import { type Readable, type Writable, type Updater } from 'svelte/store';
import { type TaintedFields, type SuperValidated, type Validators, type UnwrapEffects, type ZodValidation } from '../index.js';
import type { z, AnyZodObject } from 'zod';
import type { FormFields, MaybePromise } from '../index.js';
import { type FormPathLeaves } from '../stringPath.js';
import { formEnhance, type SuperFormEvents } from './formEnhance.js';
import { validateForm } from './clientValidation.js';
export { intProxy, numberProxy, booleanProxy, dateProxy, fieldProxy, formFieldProxy, stringProxy, arrayProxy, type TaintOptions } from './proxies.js';
export { superValidate, superValidateSync, actionResult, message, setMessage, setError, defaultValues } from '../superValidate.js';
/**
 * Helper type for making onResult strongly typed with ActionData.
 * @example const result = event.result as FormResult<ActionData>;
 */
export type FormResult<T extends Record<string, unknown> | null> = ActionResult<NonNullable<T>, NonNullable<T>>;
export type FormOptions<T extends ZodValidation<AnyZodObject>, M> = Partial<{
    id: string;
    applyAction: boolean;
    invalidateAll: boolean;
    resetForm: boolean | (() => boolean);
    scrollToError: 'auto' | 'smooth' | 'off' | boolean | ScrollIntoViewOptions;
    autoFocusOnError: boolean | 'detect';
    errorSelector: string;
    selectErrorText: boolean;
    stickyNavbar: string;
    taintedMessage: string | false | null;
    SPA: true | {
        failStatus?: number;
    };
    onSubmit: (...params: Parameters<SubmitFunction>) => MaybePromise<unknown | void>;
    onResult: (event: {
        result: ActionResult;
        formEl: HTMLFormElement;
        cancel: () => void;
    }) => MaybePromise<unknown | void>;
    onUpdate: (event: {
        form: SuperValidated<UnwrapEffects<T>, M>;
        formEl: HTMLFormElement;
        cancel: () => void;
    }) => MaybePromise<unknown | void>;
    onUpdated: (event: {
        form: Readonly<SuperValidated<UnwrapEffects<T>, M>>;
    }) => MaybePromise<unknown | void>;
    onError: 'apply' | ((event: {
        result: {
            type: 'error';
            status?: number;
            error: App.Error;
        };
        message: Writable<SuperValidated<UnwrapEffects<T>, M>['message']>;
    }) => MaybePromise<unknown | void>);
    dataType: 'form' | 'json';
    jsonChunkSize: number;
    validators: false | Validators<UnwrapEffects<T>> | ZodValidation<UnwrapEffects<T>>;
    validationMethod: 'auto' | 'oninput' | 'onblur' | 'submit-only';
    defaultValidator: 'keep' | 'clear';
    customValidity: boolean;
    clearOnSubmit: 'errors' | 'message' | 'errors-and-message' | 'none';
    delayMs: number;
    timeoutMs: number;
    multipleSubmits: 'prevent' | 'allow' | 'abort';
    syncFlashMessage?: boolean;
    flashMessage: {
        module: {
            getFlash(page: Readable<Page>): Writable<App.PageData['flash']>;
            updateFlash(page: Readable<Page>, update?: () => Promise<void>): Promise<boolean>;
        };
        onError?: (event: {
            result: {
                type: 'error';
                status?: number;
                error: App.Error;
            };
            message: Writable<App.PageData['flash']>;
        }) => MaybePromise<unknown | void>;
        cookiePath?: string;
        cookieName?: string;
    };
    warnings: {
        duplicateId?: boolean;
        noValidationAndConstraints?: boolean;
    };
}>;
type SuperFormSnapshot<T extends AnyZodObject, M = App.Superforms.Message extends never ? any : App.Superforms.Message> = SuperValidated<T, M> & {
    tainted: TaintedFields<T> | undefined;
};
export type TaintOption<T extends AnyZodObject = AnyZodObject> = boolean | 'untaint' | 'untaint-all' | 'ignore' | {
    fields: FormPathLeaves<z.infer<T>> | FormPathLeaves<z.infer<T>>[];
};
type SuperFormData<T extends ZodValidation<AnyZodObject>> = {
    subscribe: Readable<z.infer<UnwrapEffects<T>>>['subscribe'];
    set(this: void, value: z.infer<UnwrapEffects<T>>, options?: {
        taint?: TaintOption<UnwrapEffects<T>>;
    }): void;
    update(this: void, updater: Updater<z.infer<UnwrapEffects<T>>>, options?: {
        taint?: TaintOption<UnwrapEffects<T>>;
    }): void;
};
export type SuperForm<T extends ZodValidation<AnyZodObject>, M = App.Superforms.Message extends never ? any : App.Superforms.Message> = {
    form: SuperFormData<T>;
    formId: Writable<string | undefined>;
    errors: Writable<SuperValidated<T, M>['errors']> & {
        clear: () => void;
    };
    constraints: Writable<SuperValidated<T, M>['constraints']>;
    message: Writable<SuperValidated<T, M>['message']>;
    tainted: Writable<TaintedFields<UnwrapEffects<T>> | undefined>;
    submitting: Readable<boolean>;
    delayed: Readable<boolean>;
    timeout: Readable<boolean>;
    posted: Readable<boolean>;
    fields: FormFields<UnwrapEffects<T>>;
    allErrors: Readable<{
        path: string;
        messages: string[];
    }[]>;
    options: FormOptions<T, M>;
    enhance: (el: HTMLFormElement, events?: SuperFormEvents<UnwrapEffects<T>, M>) => ReturnType<typeof formEnhance>;
    reset: (options?: Partial<{
        keepMessage: boolean;
        data: Partial<z.infer<UnwrapEffects<T>>>;
        id: string;
    }>) => void;
    capture: () => SuperFormSnapshot<UnwrapEffects<T>, M>;
    restore: (snapshot: SuperFormSnapshot<UnwrapEffects<T>, M>) => void;
    validate: typeof validateForm<UnwrapEffects<T>>;
};
/**
 * @deprecated Use SuperForm instead.
 */
export type EnhancedForm<T extends AnyZodObject, M = any> = SuperForm<T, M>;
/**
 * Initializes a SvelteKit form, for convenient handling of values, errors and sumbitting data.
 * @param {SuperValidated} form Usually data.form from PageData.
 * @param {FormOptions} options Configuration for the form.
 * @returns {SuperForm} An object with properties for the form.
 * @DCI-context
 */
export declare function superForm<T extends ZodValidation<AnyZodObject> = ZodValidation<AnyZodObject>, M = App.Superforms.Message extends never ? any : App.Superforms.Message>(form: SuperValidated<T, M>, options?: FormOptions<UnwrapEffects<T>, M>): SuperForm<UnwrapEffects<T>, M>;
