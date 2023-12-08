import { enhance, applyAction } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';
import { browser } from '$app/environment';
import { SuperFormError } from '../index.js';
import { stringify } from 'devalue';
import { clientValidation, validateField } from './clientValidation.js';
import { Form } from './form.js';
import { onDestroy } from 'svelte';
import { traversePath } from '../traversal.js';
import { mergePath, splitPath } from '../stringPath.js';
export function cancelFlash(options) {
    if (!options.flashMessage || !browser)
        return;
    if (!shouldSyncFlash(options))
        return;
    document.cookie = `flash=; Max-Age=0; Path=${options.flashMessage.cookiePath ?? '/'};`;
}
export function shouldSyncFlash(options) {
    if (!options.flashMessage || !browser)
        return false;
    return options.syncFlashMessage;
}
///// Custom validity /////
const noCustomValidityDataAttribute = 'noCustomValidity';
function setCustomValidity(el, errors) {
    const message = errors && errors.length ? errors.join('\n') : '';
    el.setCustomValidity(message);
    if (message)
        el.reportValidity();
}
function setCustomValidityForm(formEl, errors) {
    for (const el of formEl.querySelectorAll('input,select,textarea,button')) {
        if (noCustomValidityDataAttribute in el.dataset) {
            continue;
        }
        const error = traversePath(errors, splitPath(el.name));
        setCustomValidity(el, error?.value);
        if (error?.value)
            return;
    }
}
//////////////////////////////////
/**
 * Custom use:enhance version. Flash message support, friendly error messages, for usage with initializeForm.
 * @param formEl Form element from the use:formEnhance default parameter.
 */
export function formEnhance(formEl, submitting, delayed, timeout, errs, Form_updateFromActionResult, options, data, message, enableTaintedForm, formEvents, formId, constraints, tainted, lastChanges, Context_findValidationForms, posted) {
    // Now we know that we are upgraded, so we can enable the tainted form option.
    enableTaintedForm();
    // Using this type in the function argument causes a type recursion error.
    const errors = errs;
    async function validateChange(change, event, validityEl) {
        if (options.validationMethod == 'submit-only')
            return;
        if (options.customValidity && validityEl) {
            // Always reset validity, in case it has been validated on the server.
            if ('setCustomValidity' in validityEl) {
                validityEl.setCustomValidity('');
            }
            if (event == 'input' && options.validationMethod == 'onblur')
                return;
            // If event is input but element shouldn't use custom validity,
            // return immediately since validateField don't have to be called
            // in this case, validation is happening elsewhere.
            if (noCustomValidityDataAttribute in validityEl.dataset)
                if (event == 'input')
                    return;
                else
                    validityEl = null;
        }
        const result = await validateField(change, options, data, errors, tainted);
        if (validityEl) {
            setCustomValidity(validityEl, result.errors);
        }
        // NOTE: Uncomment if Zod transformations should be immediately applied, not just when submitting.
        // Not enabled because it's not great UX, and it's rare to have transforms, which will just result in
        // redundant store updates.
        //if (result.data) data.set(result.data);
    }
    /**
     * Some input fields have timing issues with the stores, need to wait in that case.
     */
    function timingIssue(el) {
        return (el &&
            (el instanceof HTMLSelectElement ||
                (el instanceof HTMLInputElement &&
                    (el.type == 'radio' || el.type == 'checkbox'))));
    }
    // Add blur event, to check tainted
    async function checkBlur(e) {
        if (options.validationMethod == 'oninput' ||
            options.validationMethod == 'submit-only') {
            return;
        }
        if (timingIssue(e.target)) {
            await new Promise((r) => setTimeout(r, 0));
        }
        for (const change of get(lastChanges)) {
            let validityEl = null;
            if (options.customValidity) {
                const name = CSS.escape(mergePath(change));
                validityEl = formEl.querySelector(`[name="${name}"]`);
            }
            validateChange(change, 'blur', validityEl);
        }
        // Clear last changes after blur (not after input)
        lastChanges.set([]);
    }
    formEl.addEventListener('focusout', checkBlur);
    // Add input event, for custom validity
    async function checkCustomValidity(e) {
        if (options.validationMethod == 'onblur' ||
            options.validationMethod == 'submit-only') {
            return;
        }
        if (timingIssue(e.target)) {
            await new Promise((r) => setTimeout(r, 0));
        }
        for (const change of get(lastChanges)) {
            const name = CSS.escape(mergePath(change));
            const validityEl = formEl.querySelector(`[name="${name}"]`);
            if (!validityEl)
                continue;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hadErrors = traversePath(get(errors), change);
            if (hadErrors && hadErrors.key in hadErrors.parent) {
                // Problem - store hasn't updated here with new value yet.
                setTimeout(() => validateChange(change, 'input', validityEl), 0);
            }
        }
    }
    if (options.customValidity) {
        formEl.addEventListener('input', checkCustomValidity);
    }
    onDestroy(() => {
        formEl.removeEventListener('focusout', checkBlur);
        formEl.removeEventListener('input', checkCustomValidity);
    });
    const htmlForm = Form(formEl, { submitting, delayed, timeout }, options);
    let currentRequest;
    return enhance(formEl, async (submit) => {
        const _submitCancel = submit.cancel;
        let cancelled = false;
        function cancel(resetTimers = true) {
            cancelled = true;
            if (resetTimers && htmlForm.isSubmitting()) {
                htmlForm.completed(true);
            }
            return _submitCancel();
        }
        submit.cancel = cancel;
        if (htmlForm.isSubmitting() && options.multipleSubmits == 'prevent') {
            cancel(false);
        }
        else {
            if (htmlForm.isSubmitting() && options.multipleSubmits == 'abort') {
                if (currentRequest)
                    currentRequest.abort();
            }
            htmlForm.submitting();
            currentRequest = submit.controller;
            for (const event of formEvents.onSubmit) {
                await event(submit);
            }
        }
        if (cancelled) {
            if (options.flashMessage)
                cancelFlash(options);
        }
        else {
            // Client validation
            const validation = await clientValidation(formEl.noValidate ||
                ((submit.submitter instanceof HTMLButtonElement ||
                    submit.submitter instanceof HTMLInputElement) &&
                    submit.submitter.formNoValidate)
                ? undefined
                : options.validators, get(data), get(formId), get(constraints), get(posted));
            if (!validation.valid) {
                cancel(false);
                const result = {
                    type: 'failure',
                    status: (typeof options.SPA === 'boolean'
                        ? undefined
                        : options.SPA?.failStatus) ?? 400,
                    data: { form: validation }
                };
                setTimeout(() => validationResponse({ result }), 0);
            }
            if (!cancelled) {
                switch (options.clearOnSubmit) {
                    case 'errors-and-message':
                        errors.clear();
                        message.set(undefined);
                        break;
                    case 'errors':
                        errors.clear();
                        break;
                    case 'message':
                        message.set(undefined);
                        break;
                }
                if (options.flashMessage &&
                    (options.clearOnSubmit == 'errors-and-message' ||
                        options.clearOnSubmit == 'message') &&
                    shouldSyncFlash(options)) {
                    options.flashMessage.module.getFlash(page).set(undefined);
                }
                // Deprecation fix
                const submitData = 'formData' in submit
                    ? submit.formData
                    : submit.data;
                if (options.SPA) {
                    cancel(false);
                    const validationResult = { ...validation, posted: true };
                    const result = {
                        type: validationResult.valid ? 'success' : 'failure',
                        status: validationResult.valid
                            ? 200
                            : typeof options.SPA == 'object'
                                ? options.SPA?.failStatus
                                : 400 ?? 400,
                        data: { form: validationResult }
                    };
                    setTimeout(() => validationResponse({ result }), 0);
                }
                else if (options.dataType === 'json') {
                    const postData = validation.data;
                    const chunks = chunkSubstr(stringify(postData), options.jsonChunkSize ?? 500000);
                    for (const chunk of chunks) {
                        submitData.append('__superform_json', chunk);
                    }
                    // Clear post data to reduce transfer size,
                    // since $form should be serialized and sent as json.
                    Object.keys(postData).forEach((key) => {
                        // Files should be kept though, even if same key.
                        if (typeof submitData.get(key) === 'string') {
                            submitData.delete(key);
                        }
                    });
                }
                if (!options.SPA && !submitData.has('__superform_id')) {
                    // Add formId
                    const id = get(formId);
                    if (id !== undefined)
                        submitData.set('__superform_id', id);
                }
            }
        }
        // Thanks to https://stackoverflow.com/a/29202760/70894
        function chunkSubstr(str, size) {
            const numChunks = Math.ceil(str.length / size);
            const chunks = new Array(numChunks);
            for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
                chunks[i] = str.substring(o, o + size);
            }
            return chunks;
        }
        async function validationResponse(event) {
            const result = event.result;
            currentRequest = null;
            let cancelled = false;
            const data = {
                result,
                formEl,
                cancel: () => (cancelled = true)
            };
            for (const event of formEvents.onResult) {
                await event(data);
            }
            if (!cancelled) {
                if ((result.type === 'success' || result.type == 'failure') &&
                    result.data) {
                    const forms = Context_findValidationForms(result.data);
                    if (!forms.length) {
                        throw new SuperFormError('No form data returned from ActionResult. Make sure you return { form } in the form actions.');
                    }
                    for (const newForm of forms) {
                        if (newForm.id !== get(formId))
                            continue;
                        const data = {
                            form: newForm,
                            formEl,
                            cancel: () => (cancelled = true)
                        };
                        for (const event of formEvents.onUpdate) {
                            await event(data);
                        }
                        if (!cancelled && options.customValidity) {
                            setCustomValidityForm(formEl, data.form.errors);
                        }
                    }
                }
                if (!cancelled) {
                    if (result.type !== 'error') {
                        if (result.type === 'success' && options.invalidateAll) {
                            await invalidateAll();
                        }
                        if (options.applyAction) {
                            // This will trigger the page subscription in superForm,
                            // which will in turn call Data_update.
                            await applyAction(result);
                        }
                        else {
                            // Call Data_update directly to trigger events
                            await Form_updateFromActionResult(result);
                        }
                    }
                    else {
                        // Error result
                        if (options.applyAction) {
                            if (options.onError == 'apply') {
                                await applyAction(result);
                            }
                            else {
                                // Transform to failure, to avoid data loss
                                // Set the data to the error result, so it will be
                                // picked up in page.subscribe in superForm.
                                const failResult = {
                                    type: 'failure',
                                    status: Math.floor(result.status || 500),
                                    data: result
                                };
                                await applyAction(failResult);
                            }
                        }
                        // Check if the error message should be replaced
                        if (options.onError !== 'apply') {
                            const data = { result, message };
                            for (const event of formEvents.onError) {
                                if (event !== 'apply')
                                    await event(data);
                            }
                        }
                    }
                    // Trigger flash message event if there was an error
                    if (options.flashMessage) {
                        if (result.type == 'error' && options.flashMessage.onError) {
                            await options.flashMessage.onError({
                                result,
                                message: options.flashMessage.module.getFlash(page)
                            });
                        }
                    }
                }
            }
            if (cancelled && options.flashMessage) {
                cancelFlash(options);
            }
            // Redirect messages are handled in onDestroy and afterNavigate in client/form.ts.
            // Also fixing an edge case when timers weren't resetted when redirecting to the same route.
            if (cancelled || result.type != 'redirect') {
                htmlForm.completed(cancelled);
            }
            else if (result.type == 'redirect' &&
                new URL(result.location, /^https?:\/\//.test(result.location)
                    ? undefined
                    : document.location.origin).pathname == document.location.pathname) {
                // Checks if beforeNavigate have been called in client/form.ts.
                setTimeout(() => {
                    htmlForm.completed(true, true);
                }, 0);
            }
        }
        return validationResponse;
    });
}
