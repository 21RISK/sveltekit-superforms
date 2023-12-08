import { parse, stringify } from 'devalue';
export function clone(data) {
    if ('structuredClone' in globalThis) {
        return structuredClone(data);
    }
    return parse(stringify(data));
}
