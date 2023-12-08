export type NumericRange<START extends number, END extends number, ARR extends unknown[] = [], ACC extends number = never> = ARR['length'] extends END ? ACC | START | END : NumericRange<START, END, [...ARR, 1], ARR[START] extends undefined ? ACC : ACC | ARR['length']>;
export declare function clone<T>(data: T): T;
