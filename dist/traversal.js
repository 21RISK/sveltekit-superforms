function setPath(parent, key, value) {
    parent[key] = value;
    return 'skip';
}
export function isInvalidPath(originalPath, pathData) {
    return (pathData.value !== undefined &&
        typeof pathData.value !== 'object' &&
        pathData.path.length < originalPath.length);
}
export function pathExists(obj, path, options = {}) {
    if (!options.modifier) {
        options.modifier = (pathData) => isInvalidPath(path, pathData) ? undefined : pathData.value;
    }
    const exists = traversePath(obj, path, options.modifier);
    if (!exists)
        return undefined;
    if (options.value === undefined)
        return exists;
    return options.value(exists.value) ? exists : undefined;
}
export async function traversePathAsync(obj, realPath, modifier) {
    if (!realPath.length)
        return undefined;
    const path = [realPath[0]];
    let parent = obj;
    while (path.length < realPath.length) {
        const key = path[path.length - 1];
        const value = modifier
            ? await modifier({
                parent,
                key: String(key),
                value: parent[key],
                path: path.map((p) => String(p)),
                isLeaf: false,
                set: (v) => setPath(parent, key, v)
            })
            : parent[key];
        if (value === undefined)
            return undefined;
        else
            parent = value; // TODO: Handle non-object values
        path.push(realPath[path.length]);
    }
    const key = realPath[realPath.length - 1];
    return {
        parent,
        key: String(key),
        value: parent[key],
        path: realPath.map((p) => String(p)),
        isLeaf: true,
        set: (v) => setPath(parent, key, v)
    };
}
export function traversePath(obj, realPath, modifier) {
    if (!realPath.length)
        return undefined;
    const path = [realPath[0]];
    let parent = obj;
    while (path.length < realPath.length) {
        const key = path[path.length - 1];
        const value = modifier
            ? modifier({
                parent,
                key: String(key),
                value: parent[key],
                path: path.map((p) => String(p)),
                isLeaf: false,
                set: (v) => setPath(parent, key, v)
            })
            : parent[key];
        if (value === undefined)
            return undefined;
        else
            parent = value; // TODO: Handle non-object values
        path.push(realPath[path.length]);
    }
    const key = realPath[realPath.length - 1];
    return {
        parent,
        key: String(key),
        value: parent[key],
        path: realPath.map((p) => String(p)),
        isLeaf: true,
        set: (v) => setPath(parent, key, v)
    };
}
export function traversePaths(parent, modifier, path = []) {
    for (const key in parent) {
        const value = parent[key];
        const isLeaf = value === null || typeof value !== 'object';
        const pathData = {
            parent,
            key,
            value,
            path: path.map(String).concat([key]),
            isLeaf,
            set: (v) => setPath(parent, key, v)
        };
        const status = modifier(pathData);
        if (status === 'abort')
            return status;
        else if (status === 'skip')
            continue;
        else if (!isLeaf) {
            const status = traversePaths(value, modifier, pathData.path);
            if (status === 'abort')
                return status;
        }
    }
}
export async function traversePathsAsync(parent, modifier, path = []) {
    for (const key in parent) {
        const value = parent[key];
        const isLeaf = value === null || typeof value !== 'object';
        const pathData = {
            parent,
            key,
            value,
            path: path.map(String).concat([key]),
            isLeaf,
            set: (v) => setPath(parent, key, v)
        };
        const status = await modifier(pathData);
        if (status === 'abort')
            return status;
        else if (status === 'skip')
            break;
        else if (!isLeaf) {
            const status = traversePaths(value, modifier, pathData.path);
            if (status === 'abort')
                return status;
        }
    }
}
// Thanks to https://stackoverflow.com/a/31129384/70894
function eqSet(xs, ys) {
    return (xs === ys || (xs.size === ys.size && [...xs].every((x) => ys.has(x))));
}
/**
 * Compare two objects and return the differences as paths.
 */
export function comparePaths(newObj, oldObj) {
    const diffPaths = new Map();
    function checkPath(data, compareTo) {
        const exists = traversePath(compareTo, data.path);
        function addDiff() {
            diffPaths.set(data.path.join(' '), data.path);
        }
        if (data.isLeaf) {
            if (!exists) {
                addDiff();
            }
            else if (data.value !== exists.value) {
                addDiff();
            }
        }
        else if (exists) {
            if (data.value instanceof Date &&
                exists.value instanceof Date &&
                data.value.getTime() != exists.value.getTime()) {
                addDiff();
            }
            else if (data.value instanceof Set &&
                exists.value instanceof Set &&
                !eqSet(data.value, exists.value)) {
                addDiff();
            }
        }
    }
    traversePaths(newObj, (data) => checkPath(data, oldObj));
    traversePaths(oldObj, (data) => checkPath(data, newObj));
    return Array.from(diffPaths.values());
}
export function setPaths(obj, paths, value) {
    for (const path of paths) {
        const leaf = traversePath(obj, path, ({ parent, key, value }) => {
            if (value === undefined || typeof value !== 'object') {
                // If a previous check tainted the node, but the search goes deeper,
                // so it needs to be replaced with a (parent) node
                parent[key] = {};
            }
            return parent[key];
        });
        if (leaf)
            leaf.parent[leaf.key] = value;
    }
}
