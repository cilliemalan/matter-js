import { Vector } from "./Vector";

export interface Bounds {
    min: Vector;
    max: Vector;
}

/**
 * Creates a new axis-aligned bounding box (AABB) for the given vertices.
 * @method create
 * @param {vertices} vertices
 * @return {bounds} A new bounds object
 */
export function create(vertices: Vector[]): Bounds {
    var bounds = {
        min: { x: 0, y: 0 },
        max: { x: 0, y: 0 }
    };

    if (vertices)
        update(bounds, vertices);

    return bounds;
};

/**
 * Updates bounds using the given vertices and extends the bounds given a velocity.
 * @method update
 * @param {bounds} bounds
 * @param {vertices} vertices
 * @param {Vector} velocity
 */
export function update(bounds: Bounds, vertices: Vector[], velocity?: Vector) {
    bounds.min.x = Infinity;
    bounds.max.x = -Infinity;
    bounds.min.y = Infinity;
    bounds.max.y = -Infinity;

    for (var i = 0; i < vertices.length; i++) {
        var vertex = vertices[i];
        if (vertex.x > bounds.max.x) bounds.max.x = vertex.x;
        if (vertex.x < bounds.min.x) bounds.min.x = vertex.x;
        if (vertex.y > bounds.max.y) bounds.max.y = vertex.y;
        if (vertex.y < bounds.min.y) bounds.min.y = vertex.y;
    }

    if (velocity) {
        if (velocity.x > 0) {
            bounds.max.x += velocity.x;
        } else {
            bounds.min.x += velocity.x;
        }

        if (velocity.y > 0) {
            bounds.max.y += velocity.y;
        } else {
            bounds.min.y += velocity.y;
        }
    }
};

/**
 * Returns true if the bounds contains the given point.
 * @method contains
 * @param {bounds} bounds
 * @param {Vector} point
 * @return {boolean} True if the bounds contain the point, otherwise false
 */
export function contains(bounds: Bounds, point: Vector) {
    return point.x >= bounds.min.x && point.x <= bounds.max.x
        && point.y >= bounds.min.y && point.y <= bounds.max.y;
};

/**
 * Returns true if the two bounds intersect.
 * @method overlaps
 * @param {bounds} boundsA
 * @param {bounds} boundsB
 * @return {boolean} True if the bounds overlap, otherwise false
 */
export function overlaps(boundsA: Bounds, boundsB: Bounds) {
    return (boundsA.min.x <= boundsB.max.x && boundsA.max.x >= boundsB.min.x
        && boundsA.max.y >= boundsB.min.y && boundsA.min.y <= boundsB.max.y);
};

/**
 * Translates the bounds by the given vector.
 * @method translate
 * @param {bounds} bounds
 * @param {Vector} vector
 */
export function translate(bounds: Bounds, vector: Vector) {
    bounds.min.x += vector.x;
    bounds.max.x += vector.x;
    bounds.min.y += vector.y;
    bounds.max.y += vector.y;
};

/**
 * Shifts the bounds to the given position.
 * @method shift
 * @param {bounds} bounds
 * @param {Vector} position
 */
export function shift(bounds: Bounds, position: Vector) {
    var deltaX = bounds.max.x - bounds.min.x,
        deltaY = bounds.max.y - bounds.min.y;

    bounds.min.x = position.x;
    bounds.max.x = position.x + deltaX;
    bounds.min.y = position.y;
    bounds.max.y = position.y + deltaY;
};
