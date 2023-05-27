import type { MaybePromise, SubmitFunction } from '$app/forms';
import { beforeNavigate } from '$app/navigation';
import { page } from '$app/stores';
import type { ActionResult } from '@sveltejs/kit';
import type { Page } from '@sveltejs/kit';
import {
  derived,
  get,
  writable,
  type Readable,
  type Writable,
  type Updater
} from 'svelte/store';
import { onDestroy, tick } from 'svelte';
import { browser } from '$app/environment';
import {
  SuperFormError,
  type TaintedFields,
  type Validation,
  type Validators,
  type UnwrapEffects,
  type ZodValidation
} from '../index.js';
import type { z, AnyZodObject, ZodEffects } from 'zod';
import type { FormFields } from '../index.js';
import {
  findErrors,
  comparePaths,
  setPaths,
  pathExists,
  isInvalidPath
} from '../traversal.js';
import { fieldProxy } from './proxies.js';
import { clearErrors, clone } from '../utils.js';
import {
  splitPath,
  type StringPath,
  type StringPathLeaves
} from '../stringPath.js';
import { validateField, type Validate } from './validateField.js';
import {
  formEnhance,
  shouldSyncFlash,
  type FormUpdate,
  type SuperFormEvents,
  type SuperFormEventList
} from './formEnhance.js';

export {
  intProxy,
  numberProxy,
  booleanProxy,
  dateProxy,
  fieldProxy,
  formFieldProxy,
  stringProxy
} from './proxies.js';

export {
  superValidate,
  superValidateSync,
  actionResult,
  message,
  setMessage,
  setError,
  defaultValues
} from '../superValidate.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormOptions<T extends ZodValidation<AnyZodObject>, M> = Partial<{
  id: string;
  applyAction: boolean;
  invalidateAll: boolean;
  resetForm: boolean | (() => boolean);
  scrollToError: 'auto' | 'smooth' | 'off';
  autoFocusOnError: boolean | 'detect';
  errorSelector: string;
  selectErrorText: boolean;
  stickyNavbar: string;
  taintedMessage: string | false | null;
  SPA: true | { failStatus?: number };

  onSubmit: (
    ...params: Parameters<SubmitFunction>
  ) => MaybePromise<unknown | void>;
  onResult: (event: {
    result: ActionResult;
    formEl: HTMLFormElement;
    cancel: () => void;
  }) => MaybePromise<unknown | void>;
  onUpdate: (event: {
    form: Validation<UnwrapEffects<T>, M>;
    formEl: HTMLFormElement;
    cancel: () => void;
  }) => MaybePromise<unknown | void>;
  onUpdated: (event: {
    form: Readonly<Validation<UnwrapEffects<T>, M>>;
  }) => MaybePromise<unknown | void>;
  onError:
    | 'apply'
    | ((event: {
        result: {
          type: 'error';
          status?: number;
          error: App.Error;
        };
        message: Writable<Validation<UnwrapEffects<T>, M>['message']>;
      }) => MaybePromise<unknown | void>);
  dataType: 'form' | 'json';
  jsonChunkSize: number;
  validators:
    | false
    | Validators<UnwrapEffects<T>>
    | T
    | ZodEffects<T>
    | ZodEffects<ZodEffects<T>>
    | ZodEffects<ZodEffects<ZodEffects<T>>>
    | ZodEffects<ZodEffects<ZodEffects<ZodEffects<T>>>>
    | ZodEffects<ZodEffects<ZodEffects<ZodEffects<ZodEffects<T>>>>>;
  validationMethod: 'auto' | 'oninput' | 'onblur' | 'submit-only';
  defaultValidator: 'keep' | 'clear';
  clearOnSubmit: 'errors' | 'message' | 'errors-and-message' | 'none';
  delayMs: number;
  timeoutMs: number;
  multipleSubmits: 'prevent' | 'allow' | 'abort';
  syncFlashMessage?: boolean;
  flashMessage: {
    module: {
      getFlash(page: Readable<Page>): Writable<App.PageData['flash']>;
      updateFlash(
        page: Readable<Page>,
        update?: () => Promise<void>
      ): Promise<void>;
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
  };
}>;

const defaultFormOptions = {
  applyAction: true,
  invalidateAll: true,
  resetForm: false,
  autoFocusOnError: 'detect',
  scrollToError: 'smooth',
  errorSelector: '[data-invalid],[aria-invalid="true"]',
  selectErrorText: false,
  stickyNavbar: undefined,
  taintedMessage:
    'Do you want to leave this page? Changes you made may not be saved.',
  onSubmit: undefined,
  onResult: undefined,
  onUpdate: undefined,
  onUpdated: undefined,
  onError: (event: { result: { error: unknown } }) => {
    console.warn(
      'Unhandled Superform error, use onError event to handle it:',
      event.result.error
    );
  },
  dataType: 'form',
  validators: undefined,
  defaultValidator: 'keep',
  clearOnSubmit: 'errors-and-message',
  delayMs: 500,
  timeoutMs: 8000,
  multipleSubmits: 'prevent',
  validation: undefined,
  SPA: undefined,
  validateMethod: 'auto'
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SuperFormSnapshot<T extends AnyZodObject, M = any> = Validation<
  T,
  M
> & { tainted: TaintedFields<T> | undefined };

export type TaintOption = boolean | 'untaint' | 'untaint-all';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SuperForm<T extends ZodValidation<AnyZodObject>, M = any> = {
  form: {
    subscribe: Readable<z.infer<T>>['subscribe'];
    set(
      this: void,
      value: z.infer<T>,
      options?: { taint?: TaintOption }
    ): void;
    update(
      this: void,
      updater: Updater<z.infer<T>>,
      options?: { taint?: TaintOption }
    ): void;
  };
  formId: Writable<string | undefined>;
  errors: Writable<Validation<T, M>['errors']> & {
    clear: () => void;
  };
  constraints: Writable<Validation<T, M>['constraints']>;
  message: Writable<Validation<T, M>['message']>;
  tainted: Writable<TaintedFields<UnwrapEffects<T>> | undefined>;

  valid: Readable<boolean>;
  empty: Readable<boolean>;
  submitting: Readable<boolean>;
  delayed: Readable<boolean>;
  timeout: Readable<boolean>;

  fields: FormFields<UnwrapEffects<T>>;
  firstError: Readable<{ path: string[]; messages: string[] } | null>;
  allErrors: Readable<{ path: string[]; messages: string[] }[]>;

  options: FormOptions<T, M>;

  enhance: (
    el: HTMLFormElement,
    events?: SuperFormEvents<UnwrapEffects<T>, M>
  ) => ReturnType<typeof formEnhance>;

  reset: (options?: { keepMessage: boolean }) => void;

  capture: () => SuperFormSnapshot<UnwrapEffects<T>, M>;
  restore: (snapshot: SuperFormSnapshot<UnwrapEffects<T>, M>) => void;

  validate: Validate<UnwrapEffects<T>, StringPathLeaves<z.infer<T>>>;
};

/**
 * @deprecated Use SuperForm instead.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EnhancedForm<T extends AnyZodObject, M = any> = SuperForm<T, M>;

/**
 * Initializes a SvelteKit form, for convenient handling of values, errors and sumbitting data.
 * @param {Validation} form Usually data.form from PageData.
 * @param {FormOptions} options Configuration for the form.
 * @returns {SuperForm} An object with properties for the form.
 * @DCI-context
 */
export function superForm<
  T extends ZodValidation<AnyZodObject> = ZodValidation<AnyZodObject>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  M = any
>(
  form:
    | z.infer<UnwrapEffects<T>>
    | Validation<UnwrapEffects<T>, M>
    | null
    | undefined,
  options: FormOptions<UnwrapEffects<T>, M> = {}
): SuperForm<UnwrapEffects<T>, M> {
  type UnwrappedT = UnwrapEffects<T>;

  // Option guards
  {
    options = {
      ...(defaultFormOptions as FormOptions<UnwrappedT, M>),
      ...options
    };

    if (options.SPA && options.validators === undefined) {
      console.warn(
        'No validators set for Superform in SPA mode. Add them to the validators option, or set it to false to disable this warning.'
      );
    }
  }

  let _formId: string | undefined = options.id;

  // Normalize form argument to Validation<T, M>
  if (!form) {
    form = Context_newEmptyForm(); // Takes care of null | undefined
  } else if (Context_isValidationObject(form) === false) {
    form = Context_newEmptyForm(form); // Takes care of Partial<z.infer<T>>
  } else {
    if (_formId === undefined) _formId = form.id;
  }

  // Detect if a form is posted without JavaScript.
  const postedData = get(page).form;
  if (postedData && typeof postedData === 'object') {
    for (const postedForm of Context_findValidationForms(
      postedData
    ).reverse()) {
      if (postedForm.id === _formId) {
        const pageDataForm = form as Validation<T, M>;
        form = postedForm as Validation<T, M>;
        // Do the non-use:enhance stuff
        if (
          form.valid &&
          options.resetForm &&
          (options.resetForm === true || options.resetForm())
        ) {
          form = clone(pageDataForm);
          form.message = postedForm.message;
        }
        break;
      }
    }
  }

  const form2 = form as Validation<T, M>;

  // Need to clone the validation data, in case it's used to populate multiple forms.
  const initialForm = clone(form2);

  if (typeof initialForm.valid !== 'boolean') {
    throw new SuperFormError(
      'A non-validation object was passed to superForm. ' +
        "Check what's passed to its first parameter (null/undefined is allowed)."
    );
  }

  // Underlying store for Errors
  const _errors = writable(form2.errors);

  ///// Roles ///////////////////////////////////////////////////////

  const FormId = writable<string | undefined>(_formId);

  const Context = {
    taintedMessage: options.taintedMessage,
    taintedFormState: clone(initialForm.data)
  };

  function Context_randomId(length = 8) {
    return Math.random()
      .toString(36)
      .substring(2, length + 2);
  }

  function Context_setTaintedFormState(data: typeof initialForm.data) {
    Context.taintedFormState = clone(data);
  }

  function Context_newEmptyForm(
    data: Partial<z.infer<T>> = {}
  ): Validation<T, M> {
    return {
      valid: false,
      errors: {},
      data,
      empty: true,
      constraints: {} as Validation<T, M>['constraints']
    };
  }

  function Context_findValidationForms(data: Record<string, unknown>) {
    const forms = Object.values(data).filter(
      (v) => Context_isValidationObject(v) !== false
    ) as Validation<AnyZodObject>[];
    if (forms.length > 1 && options.warnings?.duplicateId !== false) {
      const duplicateId = new Set<string | undefined>();
      for (const form of forms) {
        if (duplicateId.has(form.id)) {
          console.warn(
            `Duplicate form id found: "${form.id}"` +
              '. Multiple forms will receive the same data. Use the id option to differentiate between them, or if this is intended, set warnings.duplicateId option to false to disable this message.'
          );
          break;
        } else {
          duplicateId.add(form.id);
        }
      }
    }
    return forms;
  }

  /**
   * Return false if object isn't a validation object, otherwise the form id,
   * which may be undefined, so a falsy check isn't enough.
   */
  function Context_isValidationObject(
    object: unknown
  ): string | undefined | false {
    if (!object || typeof object !== 'object') return false;

    if (
      !(
        'valid' in object &&
        'empty' in object &&
        typeof object.valid === 'boolean'
      )
    ) {
      return false;
    }

    return 'id' in object && typeof object.id === 'string'
      ? object.id
      : undefined;
  }

  function Context_useEnhanceEnabled() {
    options.taintedMessage = Context.taintedMessage;
    if (_formId === undefined) FormId.set(Context_randomId());
  }

  function Context_newFormStore(data: (typeof form2)['data']) {
    const _formData = writable(data);
    return {
      subscribe: _formData.subscribe,
      set: (
        value: Parameters<typeof _formData.set>[0],
        options: { taint?: TaintOption } = {}
      ) => {
        Tainted_update(
          value,
          Context.taintedFormState,
          options.taint ?? true
        );
        Context.taintedFormState = clone(value);
        return _formData.set(value);
      },
      update: (
        updater: Parameters<typeof _formData.update>[0],
        options: { taint?: TaintOption } = {}
      ) => {
        return _formData.update((value) => {
          const output = updater(value);
          Tainted_update(
            output,
            Context.taintedFormState,
            options.taint ?? true
          );
          Context.taintedFormState = clone(value);
          return output;
        });
      }
    };
  }

  const Unsubscriptions: (() => void)[] = [
    FormId.subscribe((id) => (_formId = id))
  ];

  function Unsubscriptions_add(func: () => void) {
    Unsubscriptions.push(func);
  }

  function Unsubscriptions_unsubscribe() {
    Unsubscriptions.forEach((unsub) => unsub());
  }

  // Stores for the properties of Validation<T, M>
  const Form = Context_newFormStore(form2.data);

  // Check for nested objects, throw if datatype isn't json
  function Form_checkForNestedData(key: string, value: unknown) {
    if (!value || typeof value !== 'object') return;

    if (Array.isArray(value)) {
      if (value.length > 0) Form_checkForNestedData(key, value[0]);
    } else if (!(value instanceof Date)) {
      throw new SuperFormError(
        `Object found in form field "${key}". Set options.dataType = 'json' and use:enhance to use nested data structures.`
      );
    }
  }

  async function Form_updateFromValidation(
    form: Validation<T, M>,
    untaint: boolean
  ) {
    if (
      form.valid &&
      options.resetForm &&
      (options.resetForm === true || options.resetForm())
    ) {
      Form_reset(form.message);
    } else {
      rebind(form, untaint);
    }

    // onUpdated may check stores, so need to wait for them to update.
    if (formEvents.onUpdated.length) {
      await tick();
    }

    // But do not await on onUpdated itself, since we're already finished with the request
    for (const event of formEvents.onUpdated) {
      event({ form });
    }
  }

  function Form_reset(message?: M) {
    rebind(clone(initialForm), true, message);
  }

  const Form_updateFromActionResult: FormUpdate = async (
    result,
    untaint?: boolean
  ) => {
    if (result.type == ('error' as string)) {
      throw new SuperFormError(
        `ActionResult of type "${result.type}" cannot be passed to update function.`
      );
    }

    if (result.type == 'redirect') {
      // All we need to do if redirected is to reset the form.
      // No events should be triggered because technically we're somewhere else.
      if (
        options.resetForm &&
        (options.resetForm === true || options.resetForm())
      ) {
        Form_reset();
      }
      return;
    }

    if (typeof result.data !== 'object') {
      throw new SuperFormError(
        'Non-object validation data returned from ActionResult.'
      );
    }

    const forms = Context_findValidationForms(result.data);
    if (!forms.length) {
      throw new SuperFormError(
        'No form data returned from ActionResult. Make sure you return { form } in the form actions.'
      );
    }

    for (const newForm of forms) {
      if (newForm.id !== _formId) continue;
      await Form_updateFromValidation(
        newForm as Validation<T, M>,
        untaint ?? (result.status >= 200 && result.status < 300)
      );
    }
  };

  const LastChanges = writable<string[][]>([]);
  const Valid = writable(form2.valid);
  const Empty = writable(form2.empty);
  const Message = writable<M | undefined>(form2.message);
  const Constraints = writable(form2.constraints);

  // eslint-disable-next-line dci-lint/grouped-rolemethods
  const Errors = {
    subscribe: _errors.subscribe,
    set: _errors.set,
    update: _errors.update,
    /**
     * To work with client-side validation, errors cannot be deleted but must
     * be set to undefined, to know where they existed before (tainted+error check in oninput)
     */
    clear: () =>
      clearErrors(_errors, {
        undefinePath: null,
        clearFormLevelErrors: true
      })
  };

  const Tainted = writable<TaintedFields<UnwrappedT> | undefined>();

  function Tainted_data() {
    return get(Tainted);
  }

  function Tainted_isTainted(obj: unknown): boolean {
    if (obj === null)
      throw new SuperFormError('$tainted store contained null');

    if (typeof obj === 'object') {
      for (const obj2 of Object.values(obj)) {
        if (Tainted_isTainted(obj2)) return true;
      }
    }
    return obj === true;
  }

  function Tainted__validate(path: string[], taint: TaintOption) {
    if (
      options.validationMethod == 'onblur' ||
      options.validationMethod == 'submit-only'
    ) {
      return;
    }

    let shouldValidate = options.validationMethod === 'oninput';

    if (!shouldValidate) {
      const errorContent = get(Errors);

      const errorNode = errorContent
        ? pathExists(errorContent, path, {
            modifier: (pathData) => {
              // Check if we have found a string in an error array.
              if (isInvalidPath(path, pathData)) {
                throw new SuperFormError(
                  'Errors can only be added to form fields, not to arrays or objects in the schema. Path: ' +
                    pathData.path.slice(0, -1)
                );
              }

              return pathData.value;
            }
          })
        : undefined;

      // Need a special check here, since if the error has never existed,
      // there won't be a key for the error. But if it existed and was cleared,
      // the key exists with the value undefined.
      const hasError = errorNode && errorNode.key in errorNode.parent;

      shouldValidate = !!hasError;
    }

    if (shouldValidate) {
      validateField(
        path,
        options.validators,
        options.defaultValidator,
        Form,
        Errors,
        Tainted,
        { taint }
      );
    }
  }

  function Tainted_update(
    newObj: unknown,
    compareAgainst: unknown,
    options: TaintOption
  ) {
    if (options === false) {
      return;
    } else if (options === 'untaint-all') {
      Tainted.set(undefined);
      return;
    }

    const paths = comparePaths(newObj, compareAgainst);

    if (options === true) {
      LastChanges.set(paths);
    }

    if (paths.length) {
      Tainted.update((tainted) => {
        //console.log('Update tainted:', paths, newObj, compareAgainst);
        if (!tainted) tainted = {};
        setPaths(tainted, paths, options === true ? true : undefined);
        return tainted;
      });

      for (const path of paths) {
        //console.log('🚀 ~ file: index.ts:681 ~ path:', path);
        Tainted__validate(path, options);
      }
    }
  }

  function Tainted_set(
    tainted: TaintedFields<UnwrapEffects<T>> | undefined,
    newData: z.TypeOf<UnwrapEffects<T>>
  ) {
    Tainted.set(tainted);
    Context_setTaintedFormState(newData);
  }

  // Timers
  const Submitting = writable(false);
  const Delayed = writable(false);
  const Timeout = writable(false);

  // Utilities
  const AllErrors = derived(Errors, ($errors) => {
    if (!$errors) return [];
    return findErrors($errors);
  });

  const FirstError = derived(AllErrors, ($all) => $all[0] ?? null);

  //////////////////////////////////////////////////////////////////////

  // Need to clear this and set it after use:enhance has run, to avoid showing the
  // tainted dialog when a form doesn't use it or the browser doesn't use JS.
  options.taintedMessage = undefined;

  onDestroy(() => {
    Unsubscriptions_unsubscribe();

    for (const events of Object.values(formEvents)) {
      events.length = 0;
    }
  });

  if (options.dataType !== 'json') {
    for (const [key, value] of Object.entries(form2.data)) {
      Form_checkForNestedData(key, value);
    }
  }

  function rebind(
    form: Validation<T, M>,
    untaint: TaintedFields<UnwrappedT> | boolean,
    message?: M
  ) {
    if (untaint) {
      Tainted_set(
        typeof untaint === 'boolean' ? undefined : untaint,
        form.data
      );
    }

    message = message ?? form.message;

    // eslint-disable-next-line dci-lint/private-role-access
    Form.set(form.data);
    Message.set(message);
    Empty.set(form.empty);
    Valid.set(form.valid);
    Errors.set(form.errors);
    FormId.set(form.id);

    if (options.flashMessage && shouldSyncFlash(options)) {
      const flash = options.flashMessage.module.getFlash(page);
      if (message && get(flash) === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        flash.set(message as any);
      }
    }
  }

  const formEvents: SuperFormEventList<UnwrappedT, M> = {
    onSubmit: options.onSubmit ? [options.onSubmit] : [],
    onResult: options.onResult ? [options.onResult] : [],
    onUpdate: options.onUpdate ? [options.onUpdate] : [],
    onUpdated: options.onUpdated ? [options.onUpdated] : [],
    onError: options.onError ? [options.onError] : []
  };

  ///// When use:enhance is enabled ///////////////////////////////////////////

  if (browser) {
    beforeNavigate((nav) => {
      if (options.taintedMessage && !get(Submitting)) {
        const taintStatus = Tainted_data();
        if (
          taintStatus &&
          Tainted_isTainted(taintStatus) &&
          !window.confirm(options.taintedMessage)
        ) {
          nav.cancel();
        }
      }
    });

    // Need to subscribe to catch page invalidation.
    Unsubscriptions_add(
      page.subscribe(async (pageUpdate) => {
        if (!options.applyAction) return;

        function error(type: string) {
          throw new SuperFormError(
            `No form data found in ${type}. Make sure you return { form } in form actions and load functions.`
          );
        }

        const untaint = pageUpdate.status >= 200 && pageUpdate.status < 300;

        if (pageUpdate.form && typeof pageUpdate.form === 'object') {
          const forms = Context_findValidationForms(pageUpdate.form);
          if (!forms.length) error('$page.form (ActionData)');

          for (const newForm of forms) {
            //console.log('🚀~ ActionData ~ newForm:', newForm.id);
            if (newForm.id !== _formId) continue;

            await Form_updateFromValidation(
              newForm as Validation<T, M>,
              untaint
            );
          }
        } else if (pageUpdate.data && typeof pageUpdate.data === 'object') {
          // It's a page reload, redirect or error/failure,
          // so don't trigger any events, just update the data.
          const forms = Context_findValidationForms(pageUpdate.data);
          for (const newForm of forms) {
            //console.log('🚀 ~ PageData ~ newForm:', newForm.id);
            if (newForm.id !== _formId) continue;

            rebind(newForm as Validation<T, M>, untaint);
          }
        }
      })
    );
  }

  const Fields = Object.fromEntries(
    Object.keys(initialForm.data).map((key) => {
      return [
        key,
        {
          name: key,
          value: fieldProxy(Form, key as string & StringPath<z.infer<T>>),
          errors: fieldProxy(Errors, key as never),
          constraints: fieldProxy(Constraints, key as never)
        }
      ];
    })
  ) as unknown as FormFields<UnwrappedT>;

  return {
    form: Form,
    formId: FormId,
    errors: Errors,
    message: Message,
    constraints: Constraints,

    fields: Fields,

    tainted: Tainted,
    valid: derived(Valid, ($s) => $s),
    empty: derived(Empty, ($e) => $e),

    submitting: derived(Submitting, ($s) => $s),
    delayed: derived(Delayed, ($d) => $d),
    timeout: derived(Timeout, ($t) => $t),

    options,

    capture: function () {
      return {
        valid: get(Valid),
        errors: get(Errors),
        data: get(Form),
        empty: get(Empty),
        constraints: get(Constraints),
        message: get(Message),
        id: _formId,
        tainted: get(Tainted)
      };
    },

    restore: function (snapshot: SuperFormSnapshot<UnwrappedT, M>) {
      return rebind(snapshot, snapshot.tainted ?? true);
    },

    validate: (path, opts) => {
      return validateField(
        splitPath(path) as string[],
        options.validators,
        options.defaultValidator,
        Form,
        Errors,
        Tainted,
        opts
      );
    },
    enhance: (
      el: HTMLFormElement,
      events?: SuperFormEvents<UnwrappedT, M>
    ) => {
      if (events) {
        if (events.onError) {
          if (options.onError === 'apply') {
            throw new SuperFormError(
              'options.onError is set to "apply", cannot add any onError events.'
            );
          } else if (events.onError === 'apply') {
            throw new SuperFormError(
              'Cannot add "apply" as onError event in use:enhance.'
            );
          }

          formEvents.onError.push(events.onError);
        }
        if (events.onResult) formEvents.onResult.push(events.onResult);
        if (events.onSubmit) formEvents.onSubmit.push(events.onSubmit);
        if (events.onUpdate) formEvents.onUpdate.push(events.onUpdate);
        if (events.onUpdated) formEvents.onUpdated.push(events.onUpdated);
      }

      return formEnhance(
        el,
        Submitting,
        Delayed,
        Timeout,
        Errors,
        Form_updateFromActionResult,
        options,
        Form,
        Message,
        Context_useEnhanceEnabled,
        formEvents,
        FormId,
        Constraints,
        Tainted,
        LastChanges,
        Context_findValidationForms
      );
    },

    firstError: FirstError,
    allErrors: AllErrors,
    reset: (options?) =>
      Form_reset(options?.keepMessage ? get(Message) : undefined)
  };
}
