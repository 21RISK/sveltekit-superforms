import { type InputConstraints, type ZodValidation, type UnwrapEffects } from './index.js';
import type { z, ZodTypeAny, AnyZodObject, ZodDefault, ZodNullable, ZodOptional, ZodEffects } from 'zod';
import type { SuperValidateOptions } from './superValidate.js';
import type { ErrorShape } from './errors.js';
export type ZodTypeInfo = {
    zodType: ZodTypeAny;
    originalType: ZodTypeAny;
    isNullable: boolean;
    isOptional: boolean;
    hasDefault: boolean;
    effects: ZodEffects<ZodTypeAny> | undefined;
    defaultValue: unknown;
};
export type UnwrappedEntity<T> = T extends infer R ? R extends ZodOptional<infer U> ? UnwrappedEntity<U> : R extends ZodDefault<infer U> ? UnwrappedEntity<U> : R extends ZodNullable<infer U> ? UnwrappedEntity<U> : R extends ZodEffects<infer U> ? UnwrappedEntity<U> : R : never;
type EntityRecord<T extends AnyZodObject, K> = Record<keyof z.infer<T>, K>;
export type EntityMetaData<T extends AnyZodObject> = {
    types: EntityRecord<T, string>;
};
export type Entity<T extends AnyZodObject> = {
    typeInfo: EntityRecord<T, ZodTypeInfo>;
    defaultEntity: z.infer<T>;
    constraints: InputConstraints<T>;
    keys: string[];
    hash: string;
    errorShape: ErrorShape;
};
export declare function hasEffects(zodType: ZodTypeAny): boolean;
export declare function unwrapZodType(zodType: ZodTypeAny): ZodTypeInfo;
export declare function entityHash<T extends AnyZodObject>(schema: T): string;
export declare function _entityHash<T extends ZodTypeAny>(type: T): string;
export declare function entityData<T extends AnyZodObject>(schema: T, warnings?: SuperValidateOptions<T>['warnings']): Entity<T>;
export declare function valueOrDefault(value: unknown, strict: boolean, schemaInfo: ZodTypeInfo): unknown;
/**
 * Returns the default values for a zod validation schema.
 * The main gotcha is that undefined values are changed to null if the field is nullable.
 */
export declare function defaultValues<T extends ZodValidation<AnyZodObject>>(schema: T): z.infer<UnwrapEffects<T>>;
export {};
