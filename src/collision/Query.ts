import type { Body } from '../body/Body'
import { Bounds, overlaps, contains as boundsContains } from '../geometry/Bounds';
import { angle, magnitude, sub, Vector } from '../geometry/Vector';
import { contains as verticesContains } from '../geometry/Vertices';
import { type Collision, collides as collisionCollides } from './Collision';


/**
 * Returns a list of collisions between `body` and `bodies`.
 */
export function collides(body: Body, bodies: Body[]): Collision[] {
    let collisions = [];
    let bodiesLength = bodies.length;
    let bounds = body.bounds;

    for (var i = 0; i < bodiesLength; i++) {
        var bodyA = bodies[i],
            partsALength = bodyA.parts.length,
            partsAStart = partsALength === 1 ? 0 : 1;

        if (overlaps(bodyA.bounds, bounds)) {
            for (var j = partsAStart; j < partsALength; j++) {
                var part = bodyA.parts[j];

                if (overlaps(part.bounds, bounds)) {
                    var collision = collisionCollides(part, body);

                    if (collision) {
                        collisions.push(collision);
                        break;
                    }
                }
            }
        }
    }

    return collisions;
};

/**
 * Casts a ray segment against a set of bodies and returns all collisions, ray width is optional. Intersection points are not provided.
 */
export function ray(bodies: Body[], startPoint: Vector, endPoint: Vector, rayWidth: number): Collision[] {
    rayWidth = rayWidth || 1e-100;

    var rayAngle = angle(startPoint, endPoint),
        rayLength = magnitude(sub(startPoint, endPoint)),
        rayX = (endPoint.x + startPoint.x) * 0.5,
        rayY = (endPoint.y + startPoint.y) * 0.5,
        ray = Bodies.rectangle(rayX, rayY, rayLength, rayWidth, { angle: rayAngle }),
        collisions = collides(ray, bodies);

    for (var i = 0; i < collisions.length; i += 1) {
        var collision = collisions[i];
        (collision as any).body = collision.bodyB = collision.bodyA;
    }

    return collisions;
};

/**
 * Returns all bodies whose bounds are inside (or outside if set) the given set of bounds, from the given set of bodies.
 */
export function region(bodies: Body[], bounds: Bounds, outside?: boolean): Body[] {
    var result = [];

    for (var i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        const o = overlaps(body.bounds, bounds);
        if ((o && !outside) || (!o && outside)) {
            result.push(body);
        }
    }

    return result;
};

/**
 * Returns all bodies whose vertices contain the given point, from the given set of bodies.
 * @method point
 * @param {body[]} bodies
 * @param {Vector} point
 * @return {body[]} The bodies matching the query
 */
export function point(bodies: Body[], point: Vector): Body[] {
    var result = [];

    for (var i = 0; i < bodies.length; i++) {
        var body = bodies[i];

        if (boundsContains(body.bounds, point)) {
            for (var j = body.parts.length === 1 ? 0 : 1; j < body.parts.length; j++) {
                var part = body.parts[j];

                if (boundsContains(part.bounds, point)
                    && verticesContains(part.vertices, point)) {
                    result.push(body);
                    break;
                }
            }
        }
    }

    return result;
};
