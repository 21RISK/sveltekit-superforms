/// <reference types="svelte" />
import type { AnyZodObject } from 'zod';
import type { FormOptions } from './index.js';
import type { Writable } from 'svelte/store';
/**
 * @DCI-context
 */
export declare function Form<T extends AnyZodObject, M>(formEl: HTMLFormElement, timers: {
    submitting: Writable<boolean>;
    delayed: Writable<boolean>;
    timeout: Writable<boolean>;
}, options: FormOptions<T, M>): {
    submitting: () => void;
    completed: (cancelled: boolean, clearIfNotNavigating?: boolean) => void;
    scrollToFirstError: () => void;
    isSubmitting: () => boolean;
};
