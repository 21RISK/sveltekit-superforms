/// <reference types="svelte" />
import type { ValidationErrors } from './index.js';
import type { AnyZodObject, ZodFormattedError } from 'zod';
import type { Writable } from 'svelte/store';
/**
 * A tree structure where the existence of a node means that its not a leaf.
 * Used in error mapping to determine whether to add errors to an _error field
 * (as in arrays and objects), or directly on the field itself.
 */
export type ErrorShape = {
    [K in string]: ErrorShape;
};
export declare function errorShape(schema: AnyZodObject): ErrorShape;
export declare function mapErrors<T extends AnyZodObject>(obj: ZodFormattedError<unknown>, errorShape: ErrorShape | undefined, inObject?: boolean): ValidationErrors<T>;
export declare function flattenErrors(errors: ValidationErrors<AnyZodObject>): {
    path: string;
    messages: string[];
}[];
export declare function clearErrors<T extends AnyZodObject>(Errors: Writable<ValidationErrors<T>>, options: {
    undefinePath: string[] | null;
    clearFormLevelErrors: boolean;
}): void;
