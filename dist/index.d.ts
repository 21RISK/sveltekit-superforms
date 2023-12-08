/// <reference types="svelte" />
import type { z, AnyZodObject, ZodArray, ZodObject, ZodEffects, ZodUnion, ZodUnionOptions } from 'zod';
import type { Entity, UnwrappedEntity } from './server/entity.js';
import type { Writable } from 'svelte/store';
export type MaybePromise<T> = T | Promise<T>;
export declare class SuperFormError extends Error {
    constructor(message?: string);
}
export type UnwrapEffects<T> = T extends ZodEffects<infer U> ? UnwrapEffects<U> : T extends AnyZodObject ? T : never;
export type ZodValidation<T extends AnyZodObject> = T | ZodEffects<T> | ZodEffects<ZodEffects<T>> | ZodEffects<ZodEffects<ZodEffects<T>>> | ZodEffects<ZodEffects<ZodEffects<ZodEffects<T>>>> | ZodEffects<ZodEffects<ZodEffects<ZodEffects<ZodEffects<T>>>>>;
export { type FormPath, type FormPathLeaves, type FormPathArrays } from './stringPath.js';
export type RawShape<T> = T extends ZodObject<infer U> ? U : never;
type UnwrappedRawShape<T extends AnyZodObject, P extends keyof RawShape<T>> = UnwrappedEntity<RawShape<T>[P]>;
type IntersectArray<T extends readonly unknown[]> = T extends [
    infer U,
    ...infer Rest
] ? Rest extends [] ? U : U & IntersectArray<Rest> : never;
type IntersectUnion<T extends ZodUnion<ZodUnionOptions>> = T extends ZodUnion<infer O> ? IntersectArray<O> : never;
type SuperStructArray<T extends AnyZodObject, Data, ArrayData = unknown> = {
    [Property in keyof RawShape<T>]?: T extends any ? UnwrappedEntity<T> extends ZodUnion<ZodUnionOptions> ? SuperStructArray<IntersectUnion<UnwrappedEntity<T>>, Data, ArrayData> : UnwrappedRawShape<T, Property> extends AnyZodObject ? SuperStructArray<UnwrappedRawShape<T, Property>, Data, ArrayData> : UnwrappedRawShape<T, Property> extends ZodArray<infer A, infer Cardinality> ? ArrayData & Record<number, UnwrappedEntity<A> extends AnyZodObject ? SuperStructArray<UnwrappedEntity<A>, Data, ArrayData> : UnwrappedEntity<A> extends ZodUnion<ZodUnionOptions> ? SuperStructArray<IntersectUnion<UnwrappedEntity<A>>, Data, ArrayData> : Data> : Data : never;
};
type SuperStruct<T extends AnyZodObject, Data> = Partial<{
    [Property in keyof RawShape<T>]: T extends any ? UnwrappedEntity<T> extends ZodUnion<ZodUnionOptions> ? SuperStruct<IntersectUnion<UnwrappedEntity<T>>, Data> : UnwrappedRawShape<T, Property> extends AnyZodObject ? SuperStruct<UnwrappedRawShape<T, Property>, Data> : UnwrappedRawShape<T, Property> extends ZodArray<infer A, infer Cardinality> ? UnwrappedEntity<A> extends ZodUnion<ZodUnionOptions> ? SuperStruct<IntersectUnion<UnwrappedEntity<A>>, Data> : UnwrappedEntity<A> extends AnyZodObject ? SuperStruct<UnwrappedEntity<A>, Data> : InputConstraint : InputConstraint : never;
}>;
export type Validator<V> = (value: V) => MaybePromise<string | string[] | null | undefined>;
export type Validators<T extends AnyZodObject> = Partial<{
    [Property in keyof RawShape<T>]: T extends any ? UnwrappedRawShape<T, Property> extends AnyZodObject ? Validators<UnwrappedRawShape<T, Property>> : UnwrappedRawShape<T, Property> extends ZodArray<infer A> ? UnwrappedEntity<A> extends AnyZodObject ? Validators<UnwrappedEntity<A>> : Validator<z.infer<T>[Property] extends Array<infer A2> ? A2 : z.infer<T>[Property]> : Validator<z.infer<T>[Property]> : never;
}>;
export type TaintedFields<T extends AnyZodObject> = SuperStructArray<T, boolean>;
export type ValidationErrors<T extends AnyZodObject> = {
    _errors?: string[];
} & SuperStructArray<T, string[], {
    _errors?: string[];
}>;
export type InputConstraint = Partial<{
    pattern: string;
    min: number | string;
    max: number | string;
    required: boolean;
    step: number | 'any';
    minlength: number;
    maxlength: number;
}>;
export type InputConstraints<T extends AnyZodObject> = SuperStruct<T, InputConstraint>;
export type SuperValidated<T extends ZodValidation<AnyZodObject>, M = App.Superforms.Message extends never ? any : App.Superforms.Message> = {
    valid: boolean;
    posted: boolean;
    errors: ValidationErrors<UnwrapEffects<T>>;
    data: z.infer<UnwrapEffects<T>>;
    constraints: Entity<UnwrapEffects<T>>['constraints'];
    message?: M;
    id?: string;
};
/**
 * @deprecated Use SuperValidated instead.
 */
export type Validation<T extends ZodValidation<AnyZodObject>, M = any> = SuperValidated<T, M>;
export type FormField<T extends AnyZodObject, Property extends keyof z.infer<T>> = {
    readonly name: string;
    value: Writable<z.infer<T>[Property]>;
    errors?: Writable<ValidationErrors<T>[Property]>;
    constraints?: Writable<InputConstraints<T>[Property]>;
};
export type FormFields<T extends AnyZodObject> = {
    [Property in keyof z.infer<T>]-?: FormField<T, Property>;
};
export type FieldPath<T extends object> = [keyof T, ...(string | number)[]];
