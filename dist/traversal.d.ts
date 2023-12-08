import type { MaybePromise, FieldPath } from './index.js';
type PathData = {
    parent: any;
    key: string;
    value: any;
    path: string[];
    isLeaf: boolean;
    set: (value: any) => 'skip';
};
export declare function isInvalidPath(originalPath: string[], pathData: PathData): boolean;
export declare function pathExists<T extends object>(obj: T, path: string[], options?: {
    value?: (value: unknown) => boolean;
    modifier?: (data: PathData) => undefined | unknown | void;
}): PathData | undefined;
export declare function traversePathAsync<T extends object>(obj: T, realPath: FieldPath<T>, modifier?: (data: PathData) => MaybePromise<undefined | unknown | void>): Promise<PathData | undefined>;
export declare function traversePath<T extends object>(obj: T, realPath: FieldPath<T>, modifier?: (data: PathData) => undefined | unknown | void): PathData | undefined;
type TraverseStatus = 'abort' | 'skip' | unknown | void;
export declare function traversePaths<T extends object, Path extends FieldPath<T>>(parent: T, modifier: (data: PathData) => TraverseStatus, path?: Path | []): TraverseStatus;
export declare function traversePathsAsync<T extends object, Path extends FieldPath<T>>(parent: T, modifier: (data: PathData) => MaybePromise<TraverseStatus>, path?: Path | []): Promise<TraverseStatus>;
/**
 * Compare two objects and return the differences as paths.
 */
export declare function comparePaths(newObj: unknown, oldObj: unknown): string[][];
export declare function setPaths(obj: Record<string, unknown>, paths: string[][], value: unknown): void;
export {};
