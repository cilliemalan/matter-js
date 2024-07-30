export interface Vector {
    x: number;
    y: number;
}

export interface VectorAngle extends Vector {
    angle: number;
}

export function create(x: number, y: number) {
    return { x: x ?? 0, y: y ?? 0 };
};

/**
 * Returns a new vector with `x` and `y` copied from the given `vector`.
 * @method clone
 * @param {Vector} vector
 * @return {Vector} A new cloned vector
 */
export function clone(vector: Vector) {
    return { x: vector.x, y: vector.y };
};

/**
 * Returns the magnitude (length) of a vector.
 * @method magnitude
 * @param {Vector} vector
 * @return {number} The magnitude of the vector
 */
export function magnitude(vector: Vector) {
    return Math.sqrt((vector.x * vector.x) + (vector.y * vector.y));
};

/**
 * Returns the magnitude (length) of a vector (therefore saving a `sqrt` operation).
 * @method magnitudeSquared
 * @param {Vector} vector
 * @return {number} The squared magnitude of the vector
 */
export function magnitudeSquared(vector: Vector) {
    return (vector.x * vector.x) + (vector.y * vector.y);
};

/**
 * Rotates the vector about (0, 0) by specified angle.
 * @method rotate
 * @param {Vector} vector
 * @param {number} angle
 * @param {Vector} [output]
 * @return {Vector} The vector rotated about (0, 0)
 */
export function rotate(vector: Vector, angle: number, output?: Vector) {
    var cos = Math.cos(angle), sin = Math.sin(angle);
    if (!output) output = { x: 0, y: 0 };
    var x = vector.x * cos - vector.y * sin;
    output.y = vector.x * sin + vector.y * cos;
    output.x = x;
    return output;
};

/**
 * Rotates the vector about a specified point by specified angle.
 * @method rotateAbout
 * @param {Vector} vector
 * @param {number} angle
 * @param {Vector} point
 * @param {Vector} [output]
 * @return {Vector} A new vector rotated about the point
 */
export function rotateAbout(vector: Vector, angle: number, point: Vector, output?: Vector) {
    var cos = Math.cos(angle), sin = Math.sin(angle);
    if (!output) output = { x: 0, y: 0 };
    var x = point.x + ((vector.x - point.x) * cos - (vector.y - point.y) * sin);
    output.y = point.y + ((vector.x - point.x) * sin + (vector.y - point.y) * cos);
    output.x = x;
    return output;
};

/**
 * Normalises a vector (such that its magnitude is `1`).
 * @method normalise
 * @param {Vector} vector
 * @return {Vector} A new vector normalised
 */
export function normalise(vector: Vector) {
    const m = magnitude(vector);
    if (m === 0) {
        return { x: 0, y: 0 };
    }
    const oom = 1.0 / m;

    return { x: vector.x * oom, y: vector.y * oom };
};

/**
 * Returns the dot-product of two vectors.
 * @method dot
 * @param {Vector} vectorA
 * @param {Vector} vectorB
 * @return {number} The dot product of the two vectors
 */
export function dot(vectorA: Vector, vectorB: Vector) {
    return (vectorA.x * vectorB.x) + (vectorA.y * vectorB.y);
};

/**
 * Returns the cross-product of two vectors.
 * @method cross
 * @param {Vector} vectorA
 * @param {Vector} vectorB
 * @return {number} The cross product of the two vectors
 */
export function cross(vectorA: Vector, vectorB: Vector) {
    return (vectorA.x * vectorB.y) - (vectorA.y * vectorB.x);
};

/**
 * Returns the cross-product of three vectors.
 * @method cross3
 * @param {Vector} vectorA
 * @param {Vector} vectorB
 * @param {Vector} vectorC
 * @return {number} The cross product of the three vectors
 */
export function cross3(vectorA: Vector, vectorB: Vector, vectorC: Vector) {
    return (vectorB.x - vectorA.x) * (vectorC.y - vectorA.y) - (vectorB.y - vectorA.y) * (vectorC.x - vectorA.x);
};

/**
 * Adds the two vectors.
 * @method add
 * @param {Vector} vectorA
 * @param {Vector} vectorB
 * @param {Vector} [output]
 * @return {Vector} A new vector of vectorA and vectorB added
 */
export function add(vectorA: Vector, vectorB: Vector, output?: Vector) {
    if (!output) output = { x: 0, y: 0 };
    output.x = vectorA.x + vectorB.x;
    output.y = vectorA.y + vectorB.y;
    return output;
};

/**
 * Subtracts the two vectors.
 * @method sub
 * @param {Vector} vectorA
 * @param {Vector} vectorB
 * @param {Vector} [output]
 * @return {Vector} A new vector of vectorA and vectorB subtracted
 */
export function sub(vectorA: Vector, vectorB: Vector, output?: Vector) {
    if (!output) output = { x: 0, y: 0 };
    output.x = vectorA.x - vectorB.x;
    output.y = vectorA.y - vectorB.y;
    return output;
};

/**
 * Multiplies a vector and a scalar.
 * @method mult
 * @param {Vector} vector
 * @param {number} scalar
 * @return {Vector} A new vector multiplied by scalar
 */
export function mult(vector: Vector, scalar: number) {
    return { x: vector.x * scalar, y: vector.y * scalar };
};

/**
 * Divides a vector and a scalar.
 * @method div
 * @param {Vector} vector
 * @param {number} scalar
 * @return {Vector} A new vector divided by scalar
 */
export function div(vector: Vector, scalar: number) {
    return { x: vector.x / scalar, y: vector.y / scalar };
};

/**
 * Returns the perpendicular vector. Set `negate` to true for the perpendicular in the opposite direction.
 * @method perp
 * @param {Vector} vector
 * @param {bool} [negate=false]
 * @return {Vector} The perpendicular vector
 */
export function perp(vector: Vector, negate?: boolean) {
    if (negate) {
        return { x: vector.y, y: -vector.x };
    } else {
        return { x: -vector.y, y: vector.x };
    }
};

/**
 * Negates both components of a vector such that it points in the opposite direction.
 * @method neg
 * @param {Vector} vector
 * @return {Vector} The negated vector
 */
export function neg(vector: Vector) {
    return { x: -vector.x, y: -vector.y };
};

/**
 * Returns the angle between the vector `vectorB - vectorA` and the x-axis in radians.
 * @method angle
 * @param {Vector} vectorA
 * @param {Vector} vectorB
 * @return {number} The angle in radians
 */
export function angle(vectorA: Vector, vectorB: Vector) {
    return Math.atan2(vectorB.y - vectorA.y, vectorB.x - vectorA.x);
};
