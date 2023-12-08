/// <reference types="svelte" />
import { type Readable, type Updater, type Writable } from 'svelte/store';
import { type InputConstraint, type UnwrapEffects } from '../index.js';
import type { SuperForm } from './index.js';
import type { z, AnyZodObject } from 'zod';
import { type FormPath, type FormPathLeaves, type FormPathType } from '../stringPath.js';
import type { FormPathArrays, ZodValidation } from '../index.js';
type DefaultOptions = {
    trueStringValue: string;
    dateFormat: 'date' | 'datetime' | 'time' | 'date-utc' | 'datetime-utc' | 'time-utc' | 'date-local' | 'datetime-local' | 'time-local' | 'iso';
    delimiter?: '.' | ',';
    empty?: 'null' | 'undefined';
    emptyIfZero?: boolean;
};
export type TaintOptions = boolean | 'untaint' | 'untaint-all';
export declare function booleanProxy<T extends Record<string, unknown>, Path extends FormPath<T>>(form: Writable<T>, path: Path, options?: Pick<DefaultOptions, 'trueStringValue'>): FormPathType<T, Path> extends boolean ? Writable<string> : never;
export declare function intProxy<T extends Record<string, unknown>, Path extends FormPath<T>>(form: Writable<T>, path: Path, options?: Pick<DefaultOptions, 'empty' | 'emptyIfZero'>): FormPathType<T, Path> extends number ? Writable<string> : never;
export declare function numberProxy<T extends Record<string, unknown>, Path extends FormPath<T>>(form: Writable<T>, path: Path, options?: Pick<DefaultOptions, 'empty' | 'emptyIfZero' | 'delimiter'>): FormPathType<T, Path> extends number ? Writable<string> : never;
export declare function dateProxy<T extends Record<string, unknown>, Path extends FormPath<T>>(form: Writable<T>, path: Path, options?: {
    format: DefaultOptions['dateFormat'];
    empty?: DefaultOptions['empty'];
}): FormPathType<T, Path> extends Date ? Writable<string> : never;
export declare function stringProxy<T extends Record<string, unknown>, Path extends FormPath<T>>(form: Writable<T>, path: Path, options: {
    empty: NonNullable<DefaultOptions['empty']>;
}): Writable<string>;
type ArrayFieldErrors = any[];
export declare function arrayProxy<T extends ZodValidation<AnyZodObject>, Path extends FormPathArrays<z.infer<UnwrapEffects<T>>>>(superForm: SuperForm<T, any>, path: Path, options?: {
    taint?: TaintOptions;
}): {
    path: Path;
    values: Writable<FormPathType<z.infer<UnwrapEffects<T>>, Path>>;
    errors: Writable<string[] | undefined>;
    fieldErrors: Writable<ArrayFieldErrors>;
};
export declare function formFieldProxy<T extends ZodValidation<AnyZodObject>, Path extends FormPathLeaves<z.infer<UnwrapEffects<T>>>>(superForm: SuperForm<T, any>, path: Path, options?: {
    taint?: TaintOptions;
}): {
    path: Path;
    value: SuperFieldProxy<FormPathType<z.infer<UnwrapEffects<T>>, Path>>;
    errors: Writable<string[] | undefined>;
    constraints: Writable<InputConstraint | undefined>;
    tainted: Writable<boolean | undefined>;
};
type SuperFieldProxy<T extends object> = {
    subscribe: Readable<T>['subscribe'];
    set(this: void, value: T, options?: {
        taint?: TaintOptions;
    }): void;
    update(this: void, updater: Updater<T>, options?: {
        taint?: TaintOptions;
    }): void;
};
export declare function fieldProxy<T extends object, Path extends FormPath<T>>(form: Writable<T>, path: Path): Writable<FormPathType<T, Path>>;
export {};
