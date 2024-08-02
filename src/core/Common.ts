import { Body } from "../body/Body";
import { Composite } from "../body/Composite";
import { Constraint } from "../constraint/Constraint";

export let _baseDelta = 1000 / 60;
let _nextId = 0;
let _seed = 0;
let _nowStartTime = +(new Date());
let _warnedOnce = new Set<string>();

export type ObjectType = "body" | "constraint" | "composite" | "mouseConstraint";
export interface ObjectBase {
    type: ObjectType;
    label: string;
}

export interface BodyBase extends ObjectBase { type: "body" };
export interface ConstraintBase extends ObjectBase { type: "constraint" };
export interface CompositeBase extends ObjectBase { type: "composite" };
export interface MouseConstraintBase extends ObjectBase { type: "mouseConstraint" };
export type ChildObject = Body | Constraint | Composite | MouseConstraintBase;

/**
 * Extends the object in the first argument using the object in the second argument.
 */
export function extend<T, U extends Partial<T>>(obj: T, deep?: boolean, more?: U) : T & U;
export function extend<T, U extends Partial<T>>(obj: T, more?: U) : T & U;
export function extend<T>(obj: T, deep?: boolean, ...more: any[]): T {
    let argsStart, args, deepClone;
    const o = obj as any;

    if (typeof deep === 'boolean') {
        argsStart = 2;
        deepClone = deep;
    } else {
        argsStart = 1;
        deepClone = true;
    }

    for (var i = argsStart; i < arguments.length; i++) {
        var source = arguments[i];

        if (source) {
            for (var prop in source) {
                const sval = source[prop];

                if (typeof sval !== 'object' || sval.constructor !== Object || !deepClone) {
                    o[prop] = source[prop];
                    continue;
                }

                o[prop] ??= {};
                extend(o[prop], true, sval);
            }
        }
    }

    return obj;
};

/**
 * Creates a new clone of the object, if deep is true references will also be cloned.
 * @method clone
 * @param {} obj
 * @param {bool} deep
 * @return {} obj cloned
 */
export function clone(obj: any, deep?: boolean) {
    return extend({}, deep, obj);
};

/**
 * Returns the list of keys for the given object.
 * @method keys
 * @param {} obj
 * @return {string[]} keys
 */
export function keys(obj: Object) {
    return Object.keys(obj);
};

/**
 * Returns the list of values for the given object.
 * @method values
 * @param {} obj
 * @return {array} Array of the objects property values
 */
export function values(obj: Object) {
    return Object.values(obj);
};

/**
 * Gets a value from `base` relative to the `path` string.
 * @method get
 * @param {} obj The base object
 * @param {string} path The path relative to `base`, e.g. 'Foo.Bar.baz'
 * @param {number} [begin] Path slice begin
 * @param {number} [end] Path slice end
 * @return {} The object at the given path
 */
export function get(obj: Object, path: string, begin?: number, end?: number): any {
    const npath = path.split('.').slice(begin, end);

    for (var i = 0; i < npath.length; i += 1) {
        obj = (obj as Record<string, object>)[npath[i]];
    }

    return obj;
};

/**
 * Sets a value on `base` relative to the given `path` string.
 * @method set
 * @param {} obj The base object
 * @param {string} path The path relative to `base`, e.g. 'Foo.Bar.baz'
 * @param {} val The value to set
 * @param {number} [begin] Path slice begin
 * @param {number} [end] Path slice end
 * @return {} Pass through `val` for chaining
 */
export function set(obj: Object, path: string, val: any, begin?: number, end?: number) {
    var parts = path.split('.').slice(begin, end);
    get(obj, path, 0, -1)[parts[parts.length - 1]] = val;
    return val;
};

/**
 * Shuffles the given array in-place.
 * The function uses a seeded random generator.
 * @method shuffle
 * @param {array} array
 * @return {array} array shuffled randomly
 */
export function shuffle<T>(array: Array<T>) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
};

/**
 * Randomly chooses a value from a list with equal probability.
 * The function uses a seeded random generator.
 * @method choose
 * @param {array} choices
 * @return {object} A random choice object from the array
 */
export function choose<T>(choices: Array<T>): T {
    return choices[Math.floor(random() * choices.length)];
};

/**
 * Returns true if the object is a HTMLElement, otherwise false.
 * @method isElement
 * @param {object} obj
 * @return {boolean} True if the object is a HTMLElement, otherwise false
 */
export function isElement(obj: any): obj is HTMLElement {
    if (typeof HTMLElement !== 'undefined') {
        return obj instanceof HTMLElement;
    }

    return !!(obj && obj.nodeType && obj.nodeName);
};

/**
 * Returns true if the object is an array.
 * @method isArray
 * @param {object} obj
 * @return {boolean} True if the object is an array, otherwise false
 */
export function isArray(obj: any): obj is Array<unknown> {
    return Object.prototype.toString.call(obj) === '[object Array]';
};

/**
 * Returns true if the object is a function.
 * @method isFunction
 * @param {object} obj
 * @return {boolean} True if the object is a function, otherwise false
 */
export function isFunction(obj: any): obj is Function {
    return typeof obj === "function";
};

/**
 * Returns true if the object is a plain object.
 * @method isPlainObject
 * @param {object} obj
 * @return {boolean} True if the object is a plain object, otherwise false
 */
export function isPlainObject(obj: any): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj.constructor === Object;
};

/**
 * Returns true if the object is a string.
 * @method isString
 * @param {object} obj
 * @return {boolean} True if the object is a string, otherwise false
 */
export function isString(obj: any): obj is String {
    return typeof obj === 'string';
};

/**
 * Returns the given value clamped between a minimum and maximum value.
 * @method clamp
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @return {number} The value clamped between min and max inclusive
 */
export function clamp(value: number, min: number, max: number) {
    if (value < min)
        return min;
    if (value > max)
        return max;
    return value;
};

/**
 * Returns the sign of the given value.
 * @method sign
 * @param {number} value
 * @return {number} -1 if negative, +1 if 0 or positive
 */
export function sign(value: number) {
    return value < 0 ? -1 : 1;
};

/**
 * Returns the current timestamp since the time origin (e.g. from page load).
 * The result is in milliseconds and will use high-resolution timing if available.
 * @method now
 * @return {number} the current timestamp in milliseconds
 */
export function now(): number {
    return performance.now();
};

/**
 * Returns a random value between a minimum and a maximum value inclusive.
 * The function uses a seeded random generator.
 * @method random
 * @param {number} min
 * @param {number} max
 * @return {number} A random number between min and max inclusive
 */
export function random(min?: number, max?: number) {
    min = (typeof min !== "undefined") ? min : 0;
    max = (typeof max !== "undefined") ? max : 1;
    return min + _seededRandom() * (max - min);
};

function _seededRandom() {
    // https://en.wikipedia.org/wiki/Linear_congruential_generator
    _seed = (_seed * 9301 + 49297) % 233280;
    return _seed / 233280;
};

/**
 * Converts a CSS hex colour string into an integer.
 * @method colorToNumber
 * @param {string} colorString
 * @return {number} An integer representing the CSS hex string
 */
export function colorToNumber(colorString: string): number {
    colorString = colorString.replace('#', '');

    if (colorString.length == 3) {
        colorString = colorString.charAt(0) + colorString.charAt(0)
            + colorString.charAt(1) + colorString.charAt(1)
            + colorString.charAt(2) + colorString.charAt(2);
    }

    return parseInt(colorString, 16);
};

/**
 * The console logging level to use, where each level includes all levels above and excludes the levels below.
 * The default level is 'debug' which shows all console messages.  
 *
 * Possible level values are:
 * - 0 = None
 * - 1 = Debug
 * - 2 = Info
 * - 3 = Warn
 * - 4 = Error
 * @static
 * @property logLevel
 * @type {Number}
 * @default 1
 */
let logLevel = 1;

/**
 * Shows a `console.log` message only if the current `logLevel` allows it.
 * The message will be prefixed with 'matter-js' to make it easily identifiable.
 * @method log
 * @param ...objs {} The objects to log.
 */
export function log(...args: any[]) {
    if (console && logLevel > 0 && logLevel <= 3) {
        console.log.apply(console, ['matter-js:'].concat(Array.prototype.slice.call(arguments)));
    }
};

/**
 * Shows a `console.info` message only if the current `logLevel` allows it.
 * The message will be prefixed with 'matter-js' to make it easily identifiable.
 * @method info
 * @param ...objs {} The objects to log.
 */
export function info(...args: any[]) {
    if (console && logLevel > 0 && logLevel <= 2) {
        console.info.apply(console, ['matter-js:'].concat(Array.prototype.slice.call(arguments)));
    }
};

/**
 * Shows a `console.warn` message only if the current `logLevel` allows it.
 * The message will be prefixed with 'matter-js' to make it easily identifiable.
 * @method warn
 * @param ...objs {} The objects to log.
 */
export function warn(...args: any[]) {
    if (console && logLevel > 0 && logLevel <= 3) {
        console.warn.apply(console, ['matter-js:'].concat(Array.prototype.slice.call(arguments)));
    }
};

/**
 * Uses `warn` to log the given message one time only.
 * @method warnOnce
 * @param ...objs {} The objects to log.
 */
export function warnOnce(...args: any[]) {
    var message = Array.prototype.slice.call(arguments).join(' ');

    if (!_warnedOnce.has(message)) {
        warn(message);
        _warnedOnce.add(message);
    }
};

/**
 * Shows a deprecated console warning when the function on the given object is called.
 * The target function will be replaced with a new function that first shows the warning
 * and then calls the original function.
 * @method deprecated
 * @param {object} obj The object or module
 * @param {string} prop The property name of the function on obj
 * @param {string} warning The one-time message to show if the function is called
 */
export function deprecated(obj: Record<string, Function>, prop: string, warning: string) {
    obj[prop] = chain(function () {
        warnOnce('🔅 deprecated 🔅', warning);
    }, obj[prop]);
};

/**
 * Returns the next unique sequential ID.
 * @method nextId
 * @return {Number} Unique sequential ID
 */
export function nextId() {
    return ++_nextId;
};

/**
 * A cross browser compatible indexOf implementation.
 * @method indexOf
 * @param {array} haystack
 * @param {object} needle
 * @return {number} The position of needle in haystack, otherwise -1.
 */
export function indexOf<T>(haystack: Array<T>, needle: T): number {
    if (haystack.indexOf)
        return haystack.indexOf(needle);

    for (var i = 0; i < haystack.length; i++) {
        if (haystack[i] === needle)
            return i;
    }

    return -1;
};

/**
 * A cross browser compatible array map implementation.
 * @method map
 * @param {array} list
 * @param {function} func
 * @return {array} Values from list transformed by func.
 */
export function map<T, U>(list: Array<T>, func: (value: T, index: number, array: T[]) => U): U[] {
    return list.map(func);
};

/**
 * Takes a directed graph and returns the partially ordered set of vertices in topological order.
 * Circular dependencies are allowed.
 * @method topologicalSort
 * @param {object} graph
 * @return {array} Partially ordered set of vertices in topological order.
 */
export function topologicalSort<T>(graph: any): any {
    // https://github.com/mgechev/javascript-algorithms
    // Copyright (c) Minko Gechev (MIT license)
    // Modifications: tidy formatting and naming
    const result = new Array<T>();
    const visited: Record<string, any> = {};
    const temp: Record<string, any> = {};

    for (var node in graph) {
        if (!visited[node] && !temp[node]) {
            _topologicalSort(node, visited, temp, graph, result);
        }
    }

    return result;
};

export function _topologicalSort(node: any, visited: any, temp: any, graph: any, result: any) {
    var neighbors = graph[node] || [];
    temp[node] = true;

    for (var i = 0; i < neighbors.length; i += 1) {
        var neighbor = neighbors[i];

        if (temp[neighbor]) {
            // skip circular dependencies
            continue;
        }

        if (!visited[neighbor]) {
            _topologicalSort(neighbor, visited, temp, graph, result);
        }
    }

    temp[node] = false;
    visited[node] = true;

    result.push(node);
};

/**
 * Takes _n_ functions as arguments and returns a new function that calls them in order.
 * The arguments applied when calling the new function will also be applied to every function passed.
 * The value of `this` refers to the last value returned in the chain that was not `undefined`.
 * Therefore if a passed function does not return a value, the previously returned value is maintained.
 * After all passed functions have been called the new function returns the last returned value (if any).
 * If any of the passed functions are a chain, then the chain will be flattened.
 * @method chain
 * @param ...funcs {function} The functions to chain.
 * @return {function} A new function that calls the passed functions in order.
 */
export function chain(...args: Function[]) {
    var funcs: Function[] = [];

    for (var i = 0; i < arguments.length; i += 1) {
        var func = arguments[i];

        if (func._chained) {
            // flatten already chained functions
            funcs.push.apply(funcs, func._chained);
        } else {
            funcs.push(func);
        }
    }

    var chain = function () {
        // https://github.com/GoogleChrome/devtools-docs/issues/53#issuecomment-51941358
        var lastResult,
            args = new Array(arguments.length);

        for (var i = 0, l = arguments.length; i < l; i++) {
            args[i] = arguments[i];
        }

        for (i = 0; i < funcs.length; i += 1) {
            var result = funcs[i].apply(lastResult, args);

            if (typeof result !== 'undefined') {
                lastResult = result;
            }
        }

        return lastResult;
    };

    (chain as any)._chained = funcs;

    return chain;
};

/**
 * Chains a function to excute before the original function on the given `path` relative to `base`.
 * See also docs for `chain`.
 * @method chainPathBefore
 * @param {} base The base object
 * @param {string} path The path relative to `base`
 * @param {function} func The function to chain before the original
 * @return {function} The chained function that replaced the original
 */
export function chainPathBefore(base: object, path: string, func: Function): Function {
    return set(base, path, chain(
        func,
        get(base, path)
    ));
};

/**
 * Chains a function to excute after the original function on the given `path` relative to `base`.
 * See also docs for `chain`.
 * @method chainPathAfter
 * @param {} base The base object
 * @param {string} path The path relative to `base`
 * @param {function} func The function to chain after the original
 * @return {function} The chained function that replaced the original
 */
export function chainPathAfter(base: object, path: string, func: Function) {
    return set(base, path, chain(
        get(base, path),
        func
    ));
};
