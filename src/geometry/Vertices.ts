/**
* The `Matter.Vertices` module contains methods for creating and manipulating sets of vertices.
* A set of vertices is an array of `Matter.Vector` with additional indexing properties inserted by `Vertices.create`.
* A `Matter.Body` maintains a set of vertices to represent the shape of the object (its convex hull).
*
* See the included usage [examples](https://github.com/liabru/matter-js/tree/master/examples).
*
* @class Vertices
*/

import { Body } from '../body/Body'
import { Vector, cross, mult, add, div, dot, sub, normalise, cross3, angle, rotate as rotatev } from './Vector'
import { clamp, clone } from '../core/Common'

export interface Vertex extends Vector {
    index: number;
    body: Body;
    isInternal: boolean;
}

/**
 * Creates a new set of `Matter.Body` compatible vertices.
 * The `points` argument accepts an array of `Matter.Vector` points orientated around the origin `(0, 0)`, for example:
 *
 *     [{ x: 0, y: 0 }, { x: 25, y: 50 }, { x: 50, y: 0 }]
 *
 * The `Vertices.create` method returns a new array of vertices, which are similar to Matter.Vector objects,
 * but with some additional references required for efficient collision detection routines.
 *
 * Vertices must be specified in clockwise order.
 *
 * Note that the `body` argument is not optional, a `Matter.Body` reference must be provided.
 *
 */
export function create(points: Vector[], body: Body): Vertex[] {
    var vertices = [];

    for (var i = 0; i < points.length; i++) {
        var point = points[i],
            vertex = {
                x: point.x,
                y: point.y,
                index: i,
                body: body,
                isInternal: false
            };

        vertices.push(vertex);
    }

    return vertices;
};

/**
 * Parses a string containing ordered x y pairs separated by spaces (and optionally commas), 
 * into a `Matter.Vertices` object for the given `Matter.Body`.
 * For parsing SVG paths, see `Svg.pathToVertices`.
 */
export function fromPath(path: string, body: Body) {
    const pathPattern = /L?\s*([-\d.e]+)[\s,]*([-\d.e]+)*/ig;
    const points = new Array<Vector>;

    if (!path || typeof path !== "string") {
        return [];
    }

    for (const m of path.matchAll(pathPattern)) {
        points.push({
            x: parseFloat(m[1]),
            y: parseFloat(m[2]),
        })
    }

    return create(points, body);
};

/**
 * Returns the centre (centroid) of the set of vertices.
 */
export function centre(vertices: Vector[]) {
    const a = area(vertices, true);
    let centre = { x: 0, y: 0 };

    for (var i = 0; i < vertices.length; i++) {
        const j = (i + 1) % vertices.length;
        const c = cross(vertices[i], vertices[j]);
        const temp = mult(add(vertices[i], vertices[j]), c);
        centre = add(centre, temp);
    }

    return div(centre, 6 * a);
};

/**
 * Returns the average (mean) of the set of vertices.
 */
export function mean(vertices: Vector[]) {
    const average = { x: 0, y: 0 };

    for (var i = 0; i < vertices.length; i++) {
        average.x += vertices[i].x;
        average.y += vertices[i].y;
    }

    return div(average, vertices.length);
};

/**
 * Returns the area of the set of vertices.
 */
export function area(vertices: Vector[], signed?: boolean) {
    var area = 0,
        j = vertices.length - 1;

    for (var i = 0; i < vertices.length; i++) {
        area += (vertices[j].x - vertices[i].x) * (vertices[j].y + vertices[i].y);
        j = i;
    }

    area *= 0.5;

    if (!signed && area < 0) {
        area = -area;
    }

    return area;
};

/**
 * Returns the moment of inertia (second moment of area) of the set of vertices given the total mass.
 */
export function inertia(vertices: Vector[], mass: number) {
    var numerator = 0,
        denominator = 0,
        v = vertices;

    // find the polygon's moment of inertia, using second moment of area
    // from equations at http://www.physicsforums.com/showthread.php?t=25293
    for (var n = 0; n < v.length; n++) {
        let j = (n + 1) % v.length;
        let c = Math.abs(cross(v[j], v[n]));
        numerator += c * (dot(v[j], v[j]) + dot(v[j], v[n]) + dot(v[n], v[n]));
        denominator += c;
    }

    return (mass / 6) * (numerator / denominator);
};

export function translate(vertices: Vector[], vector: Vector, scalar?: number) {
    scalar ??= 1;

    var verticesLength = vertices.length,
        translateX = vector.x * scalar,
        translateY = vector.y * scalar,
        i;

    for (i = 0; i < verticesLength; i++) {
        vertices[i].x += translateX;
        vertices[i].y += translateY;
    }

    return vertices;
};

/**
 * Rotates the set of vertices in-place.
 * @method rotate
 * @param {vertices} vertices
 * @param {number} angle
 * @param {Vector} point
 */
export function rotate(vertices: Vector[], angle: number, point: Vector) {
    if (angle === 0)
        return;

    let cos = Math.cos(angle);
    let sin = Math.sin(angle);
    let pointX = point.x;
    let pointY = point.y;

    for (let i = 0; i < vertices.length; i++) {
        const vertex = vertices[i];
        const dx = vertex.x - pointX;
        const dy = vertex.y - pointY;
        vertex.x = pointX + (dx * cos - dy * sin);
        vertex.y = pointY + (dx * sin + dy * cos);
    }

    return vertices;
};

/**
 * Returns `true` if the `point` is inside the set of `vertices`.
 */
export function contains(vertices: Vector[], point: Vector) {
    var pointX = point.x,
        pointY = point.y,
        verticesLength = vertices.length,
        vertex = vertices[verticesLength - 1],
        nextVertex;

    for (var i = 0; i < verticesLength; i++) {
        nextVertex = vertices[i];

        if ((pointX - vertex.x) * (nextVertex.y - vertex.y)
            + (pointY - vertex.y) * (vertex.x - nextVertex.x) > 0) {
            return false;
        }

        vertex = nextVertex;
    }

    return true;
};

/**
 * Scales the vertices from a point (default is centre) in-place.
 * @method scale
 * @param {vertices} vertices
 * @param {number} scaleX
 * @param {number} scaleY
 * @param {Vector} point
 */
export function scale(vertices: Vector[], scaleX: number, scaleY: number, point: Vector) {
    if (scaleX === 1 && scaleY === 1)
        return vertices;

    point = point ?? centre(vertices);

    var vertex,
        delta;

    for (var i = 0; i < vertices.length; i++) {
        vertex = vertices[i];
        delta = sub(vertex, point);
        vertices[i].x = point.x + delta.x * scaleX;
        vertices[i].y = point.y + delta.y * scaleY;
    }

    return vertices;
};

/**
 * Chamfers a set of vertices by giving them rounded corners, returns a new set of vertices.
 * The radius parameter is a single number or an array to specify the radius for each vertex.
 */
export function chamfer(vertices: Vector[], radius?: number[] | number, quality?: number, qualityMin?: number, qualityMax?: number) {
    if (typeof radius === 'number') {
        radius = [radius];
    } else {
        radius ??= [8];
    }

    // quality defaults to -1, which is auto
    quality ??= -1;
    qualityMin ??= 2;
    qualityMax ??= 14;

    var newVertices = new Array<Vector>();

    for (var i = 0; i < vertices.length; i++) {
        var prevVertex = vertices[i - 1 >= 0 ? i - 1 : vertices.length - 1],
            vertex = vertices[i],
            nextVertex = vertices[(i + 1) % vertices.length],
            currentRadius = radius[i < radius.length ? i : radius.length - 1];

        if (currentRadius === 0) {
            newVertices.push(vertex);
            continue;
        }

        var prevNormal = normalise({
            x: vertex.y - prevVertex.y,
            y: prevVertex.x - vertex.x
        });

        var nextNormal = normalise({
            x: nextVertex.y - vertex.y,
            y: vertex.x - nextVertex.x
        });

        const diagonalRadius = Math.sqrt(2 * Math.pow(currentRadius, 2));
        const radiusVector = mult(clone(prevNormal), currentRadius);
        const midNormal = normalise(mult(add(prevNormal, nextNormal), 0.5));
        const scaledVertex = sub(vertex, mult(midNormal, diagonalRadius));

        var precision = quality;

        if (quality === -1) {
            // automatically decide precision
            precision = Math.pow(currentRadius, 0.32) * 1.75;
        }

        precision = clamp(precision, qualityMin, qualityMax);

        // use an even value for precision, more likely to reduce axes by using symmetry
        if (precision % 2 === 1)
            precision += 1;

        const alpha = Math.acos(dot(prevNormal, nextNormal));
        const theta = alpha / precision;

        for (var j = 0; j < precision; j++) {
            newVertices.push(add(rotatev(radiusVector, theta * j), scaledVertex));
        }
    }

    return newVertices;
};

/**
 * Sorts the input vertices into clockwise order in place.
 */
export function clockwiseSort(vertices: Vector[]) {
    var centre = mean(vertices);

    vertices.sort(function (vertexA, vertexB) {
        return angle(centre, vertexA) - angle(centre, vertexB);
    });

    return vertices;
};

/**
 * Returns true if the vertices form a convex shape (vertices must be in clockwise order).
 */
export function isConvex(vertices: Vector[]) {
    // http://paulbourke.net/geometry/polygonmesh/
    // Copyright (c) Paul Bourke (use permitted)

    var flag = 0,
        n = vertices.length,
        i,
        j,
        k,
        z;

    if (n < 3)
        return null;

    for (i = 0; i < n; i++) {
        j = (i + 1) % n;
        k = (i + 2) % n;
        z = (vertices[j].x - vertices[i].x) * (vertices[k].y - vertices[j].y);
        z -= (vertices[j].y - vertices[i].y) * (vertices[k].x - vertices[j].x);

        if (z < 0) {
            flag |= 1;
        } else if (z > 0) {
            flag |= 2;
        }

        if (flag === 3) {
            return false;
        }
    }

    if (flag !== 0) {
        return true;
    } else {
        return null;
    }
};

/**
 * Returns the convex hull of the input vertices as a new array of points.
 */
export function hull(vertices: Vector[]) {
    // http://geomalgorithms.com/a10-_hull-1.html

    const upper = new Array<Vector>();
    const lower = new Array<Vector>();

    // sort vertices on x-axis (y-axis for ties)
    vertices = vertices.slice(0);
    vertices.sort(function (vertexA, vertexB) {
        var dx = vertexA.x - vertexB.x;
        return dx !== 0 ? dx : vertexA.y - vertexB.y;
    });

    // build lower hull
    for (let i = 0; i < vertices.length; i += 1) {
        const vertex = vertices[i];

        while (lower.length >= 2
            && cross3(lower[lower.length - 2], lower[lower.length - 1], vertex) <= 0) {
            lower.pop();
        }

        lower.push(vertex);
    }

    // build upper hull
    for (let i = vertices.length - 1; i >= 0; i -= 1) {
        const vertex = vertices[i];

        while (upper.length >= 2
            && cross3(upper[upper.length - 2], upper[upper.length - 1], vertex) <= 0) {
            upper.pop();
        }

        upper.push(vertex);
    }

    // concatenation of the lower and upper hulls gives the convex hull
    // omit last points because they are repeated at the beginning of the other list
    upper.pop();
    lower.pop();

    return upper.concat(lower);
};
