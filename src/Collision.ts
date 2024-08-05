import { contains } from './Vertices';
import { id as pairId, type Pair } from './Pair';
import type { Vector } from './Vector';
import type { Body } from './Body';
import type { Pairs } from './Pairs';

const _supports = new Array<Vector>(2);

export interface Overlap {
    overlap: number;
    axis: Vector;
}

var _overlapAB: Overlap = {
    overlap: 0,
    axis: { x: 0, y: 0 }
};

var _overlapBA: Overlap = {
    overlap: 0,
    axis: { x: 0, y: 0 }
};

export interface Collision {
    /** A reference to the pair using this collision record, if there is one. */
    pair?: Pair;
    /** A flag that indicates if the bodies were colliding when the collision was last updated. */
    collided: boolean;
    /** The first body part represented by the collision (see also `collision.parentA`). */
    bodyA: Body;
    /** The second body part represented by the collision (see also `collision.parentB`). */
    bodyB: Body;
    /** The first body represented by the collision (i.e. `collision.bodyA.parent`). */
    parentA: Body;
    /** The second body represented by the collision (i.e. `collision.bodyB.parent`). */
    parentB: Body;
    /** A `Number` that represents the minimum separating distance between the bodies along the collision normal. */
    depth: number;
    /** A normalised `Vector` that represents the direction between the bodies that provides the minimum separating distance. */
    normal: Vector;
    /** A normalised `Vector` that is the tangent direction to the collision normal. */
    tangent: Vector;
    /** A `Vector` that represents the direction and depth of the collision. */
    penetration: Vector;
    /** An array of body vertices that represent the support points in the collision.
     * 
     * _Note:_ Only the first `collision.supportCount` items of `collision.supports` are active.
     * Therefore use `collision.supportCount` instead of `collision.supports.length` when iterating the active supports.
     * 
     * These are the deepest vertices (along the collision normal) of each body that are contained by the other body's vertices. */
    supports: [Vector | undefined, Vector | undefined];
    /** The number of active supports for this collision found in `collision.supports`.
     * 
     * _Note:_ Only the first `collision.supportCount` items of `collision.supports` are active.
     * Therefore use `collision.supportCount` instead of `collision.supports.length` when iterating the active supports.
     * */
    supportCount: number;
}

/**
 * Creates a new collision record.
 */
export function create(bodyA: Body, bodyB: Body): Collision {

    if (!bodyA.parent || !bodyB.parent) {
        console.error("collision bodies don't have parents");
        throw new Error("collision bodies don't have parents");
    }

    return {
        pair: undefined,
        collided: false,
        bodyA: bodyA,
        bodyB: bodyB,
        parentA: bodyA.parent,
        parentB: bodyB.parent,
        depth: 0,
        normal: { x: 0, y: 0 },
        tangent: { x: 0, y: 0 },
        penetration: { x: 0, y: 0 },
        supports: [undefined, undefined],
        supportCount: 0
    };
};

/**
 * Detect collision between two bodies.
 */
export function collides(bodyA: Body, bodyB: Body, pairs?: Pairs) {
    _overlapAxes(_overlapAB, bodyA.vertices, bodyB.vertices, bodyA.axes);

    if (_overlapAB.overlap <= 0) {
        return null;
    }

    _overlapAxes(_overlapBA, bodyB.vertices, bodyA.vertices, bodyB.axes);

    if (_overlapBA.overlap <= 0) {
        return null;
    }

    // reuse collision records for gc efficiency
    let pair = pairs && pairs.table[pairId(bodyA, bodyB)];
    let collision: Collision;

    if (!pair) {
        collision = create(bodyA, bodyB);
        collision.collided = true;
        collision.bodyA = bodyA.id < bodyB.id ? bodyA : bodyB;
        collision.bodyB = bodyA.id < bodyB.id ? bodyB : bodyA;
        collision.parentA = collision.bodyA.parent;
        collision.parentB = collision.bodyB.parent;
    } else {
        collision = pair.collision;
    }

    bodyA = collision.bodyA;
    bodyB = collision.bodyB;

    var minOverlap;

    if (_overlapAB.overlap < _overlapBA.overlap) {
        minOverlap = _overlapAB;
    } else {
        minOverlap = _overlapBA;
    }

    var normal = collision.normal,
        tangent = collision.tangent,
        penetration = collision.penetration,
        supports = collision.supports,
        depth = minOverlap.overlap,
        minAxis = minOverlap.axis,
        normalX = minAxis.x,
        normalY = minAxis.y,
        deltaX = bodyB.position.x - bodyA.position.x,
        deltaY = bodyB.position.y - bodyA.position.y;

    // ensure normal is facing away from bodyA
    if (normalX * deltaX + normalY * deltaY >= 0) {
        normalX = -normalX;
        normalY = -normalY;
    }

    normal.x = normalX;
    normal.y = normalY;

    tangent.x = -normalY;
    tangent.y = normalX;

    penetration.x = normalX * depth;
    penetration.y = normalY * depth;

    collision.depth = depth;

    // find support points, there is always either exactly one or two
    var supportsB = _findSupports(bodyA, bodyB, normal, 1),
        supportCount = 0;

    // find the supports from bodyB that are inside bodyA
    if (contains(bodyA.vertices, supportsB[0])) {
        supports[supportCount++] = supportsB[0];
    }

    if (contains(bodyA.vertices, supportsB[1])) {
        supports[supportCount++] = supportsB[1];
    }

    // find the supports from bodyA that are inside bodyB
    if (supportCount < 2) {
        var supportsA = _findSupports(bodyB, bodyA, normal, -1);

        if (contains(bodyB.vertices, supportsA[0])) {
            supports[supportCount++] = supportsA[0];
        }

        if (supportCount < 2 && contains(bodyB.vertices, supportsA[1])) {
            supports[supportCount++] = supportsA[1];
        }
    }

    // account for the edge case of overlapping but no vertex containment
    if (supportCount === 0) {
        supports[supportCount++] = supportsB[0];
    }

    // update support count
    collision.supportCount = supportCount;

    return collision;
};

/**
 * Find the overlap between two sets of vertices.
 */
export function _overlapAxes(result: Overlap, verticesA: Vector[], verticesB: Vector[], axes: Vector[]) {
    var verticesALength = verticesA.length,
        verticesBLength = verticesB.length,
        verticesAX = verticesA[0].x,
        verticesAY = verticesA[0].y,
        verticesBX = verticesB[0].x,
        verticesBY = verticesB[0].y,
        axesLength = axes.length,
        overlapMin = Number.MAX_VALUE,
        overlapAxisNumber = 0,
        overlap,
        overlapAB,
        overlapBA,
        dot,
        i,
        j;

    for (i = 0; i < axesLength; i++) {
        var axis = axes[i],
            axisX = axis.x,
            axisY = axis.y,
            minA = verticesAX * axisX + verticesAY * axisY,
            minB = verticesBX * axisX + verticesBY * axisY,
            maxA = minA,
            maxB = minB;

        for (j = 1; j < verticesALength; j += 1) {
            dot = verticesA[j].x * axisX + verticesA[j].y * axisY;

            if (dot > maxA) {
                maxA = dot;
            } else if (dot < minA) {
                minA = dot;
            }
        }

        for (j = 1; j < verticesBLength; j += 1) {
            dot = verticesB[j].x * axisX + verticesB[j].y * axisY;

            if (dot > maxB) {
                maxB = dot;
            } else if (dot < minB) {
                minB = dot;
            }
        }

        overlapAB = maxA - minB;
        overlapBA = maxB - minA;
        overlap = overlapAB < overlapBA ? overlapAB : overlapBA;

        if (overlap < overlapMin) {
            overlapMin = overlap;
            overlapAxisNumber = i;

            if (overlap <= 0) {
                // can not be intersecting
                break;
            }
        }
    }

    result.axis = axes[overlapAxisNumber];
    result.overlap = overlapMin;
};

/**
 * Finds supporting vertices given two bodies along a given direction using hill-climbing.
 */
export function _findSupports(bodyA: Body, bodyB: Body, normal: Vector, direction: number) {
    var vertices = bodyB.vertices,
        verticesLength = vertices.length,
        bodyAPositionX = bodyA.position.x,
        bodyAPositionY = bodyA.position.y,
        normalX = normal.x * direction,
        normalY = normal.y * direction,
        vertexA = vertices[0],
        vertexB = vertexA,
        nearestDistance = normalX * (bodyAPositionX - vertexB.x) + normalY * (bodyAPositionY - vertexB.y),
        vertexC,
        distance,
        j;

    // find deepest vertex relative to the axis
    for (j = 1; j < verticesLength; j += 1) {
        vertexB = vertices[j];
        distance = normalX * (bodyAPositionX - vertexB.x) + normalY * (bodyAPositionY - vertexB.y);

        // convex hill-climbing
        if (distance < nearestDistance) {
            nearestDistance = distance;
            vertexA = vertexB;
        }
    }

    // measure next vertex
    vertexC = vertices[(verticesLength + vertexA.index - 1) % verticesLength];
    nearestDistance = normalX * (bodyAPositionX - vertexC.x) + normalY * (bodyAPositionY - vertexC.y);

    // compare with previous vertex
    vertexB = vertices[(vertexA.index + 1) % verticesLength];
    if (normalX * (bodyAPositionX - vertexB.x) + normalY * (bodyAPositionY - vertexB.y) < nearestDistance) {
        _supports[0] = vertexA;
        _supports[1] = vertexB;

        return _supports;
    }

    _supports[0] = vertexA;
    _supports[1] = vertexC;

    return _supports;
};
