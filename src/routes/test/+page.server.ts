import { setError, superValidate } from '$lib/server';
import { z } from 'zod';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from '../$types';
import { parse } from 'devalue';

export const _dataTypeForm = z.object({
  string: z.string().min(2).default('Shigeru'),
  email: z.string().email(),
  bool: z.boolean(),
  number: z.number(),
  proxyNumber: z.number().min(10).default(0),
  nullableString: z.string().nullable(),
  nullishString: z.string().nullish(),
  optionalString: z.string().optional(),
  proxyString: z.string(),
  trimmedString: z.string().trim(),
  numberArray: z.number().int().array().min(3),
  date: z.date().default(new Date()),
  coercedNumber: z.coerce.number().default(0),
  coercedDate: z.coerce.date().default(new Date())
});

export const load = (async (event) => {
  const form = await superValidate(event, _dataTypeForm);
  console.log('🚀 ~ LOAD', form);

  return { form };
}) satisfies PageServerLoad;

export const actions = {
  form: async (event) => {
    const formData = await event.request.formData();
    console.log(
      '🚀 ~ file: +page.server.ts:32 ~ form: ~ formData:',
      formData
    );
    const form = await superValidate(formData, _dataTypeForm);
    console.log('🚀 ~ POST', form);

    if (!form.valid) return fail(400, { form });

    try {
      const dataSchema = z.number().array();
      const data = dataSchema.parse(parse(form.data.proxyString));
      // Data is ok, do something with it
    } catch {
      return setError(form, 'proxyString', 'Invalid data.');
    }

    await new Promise((resolve) => setTimeout(resolve, form.data.number));

    form.message = 'Form posted!';
    return { form };
  }
} satisfies Actions;
