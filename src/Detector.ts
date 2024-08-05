import { type Collision, collides } from './Collision'
import type { Body, CollisionFilter } from './Body'
import type { Pairs } from './Pairs';
import { extend } from './Common';


export interface Detector {
    /** The array of `Matter.Body` between which the detector finds collisions.
     * 
     * _Note:_ The order of bodies in this array _is not fixed_ and will be continually managed by the detector. */
    bodies: Body[];
    /** The array of `Matter.Collision` found in the last call to `Detector.collisions` on this detector. */
    collisions: Collision[];
    /** Optional. A `Matter.Pairs` object from which previous collision objects may be reused. Intended for internal `Matter.Engine` usage. */
    pairs?: Pairs;
}

/**
 * Creates a new collision detector.
 */
export function create(options?: Partial<Detector>): Detector {
    const defaults: Detector= {
        bodies: [],
        collisions: [],
    };

    return extend(defaults, options);
};

/**
 * Sets the list of bodies in the detector.
 */
export function setBodies(detector: Detector, bodies: Body[]) {
    detector.bodies = [...bodies];
};

/**
 * Clears the detector including its list of bodies.
 */
export function clear(detector: Detector) {
    detector.bodies = [];
    detector.collisions = [];
};

/**
 * Efficiently finds all collisions among all the bodies in `detector.bodies` using a broadphase algorithm.
 * 
 * _Note:_ The specific ordering of collisions returned is not guaranteed between releases and may change for performance reasons.
 * If a specific ordering is required then apply a sort to the resulting array.\
 */
export function collisions(detector: Detector) {
    let pairs = detector.pairs;
    let bodies = detector.bodies;
    let bodiesLength = bodies.length;
    let collisions = detector.collisions;
    let collisionIndex = 0;
    let i;
    let j;

    bodies.sort(_compareBoundsX);

    for (i = 0; i < bodiesLength; i++) {
        var bodyA = bodies[i],
            boundsA = bodyA.bounds,
            boundXMax = bodyA.bounds.max.x,
            boundYMax = bodyA.bounds.max.y,
            boundYMin = bodyA.bounds.min.y,
            bodyAStatic = bodyA.isStatic || bodyA.isSleeping,
            partsALength = bodyA.parts.length,
            partsASingle = partsALength === 1;

        for (j = i + 1; j < bodiesLength; j++) {
            var bodyB = bodies[j],
                boundsB = bodyB.bounds;

            if (boundsB.min.x > boundXMax) {
                break;
            }

            if (boundYMax < boundsB.min.y || boundYMin > boundsB.max.y) {
                continue;
            }

            if (bodyAStatic && (bodyB.isStatic || bodyB.isSleeping)) {
                continue;
            }

            if (!canCollide(bodyA.collisionFilter, bodyB.collisionFilter)) {
                continue;
            }

            var partsBLength = bodyB.parts.length;

            if (partsASingle && partsBLength === 1) {
                var collision = collides(bodyA, bodyB, pairs!);

                if (collision) {
                    collisions[collisionIndex++] = collision;
                }
            } else {
                var partsAStart = partsALength > 1 ? 1 : 0,
                    partsBStart = partsBLength > 1 ? 1 : 0;

                for (var k = partsAStart; k < partsALength; k++) {
                    var partA = bodyA.parts[k],
                        boundsA = partA.bounds;

                    for (var z = partsBStart; z < partsBLength; z++) {
                        var partB = bodyB.parts[z],
                            boundsB = partB.bounds;

                        if (boundsA.min.x > boundsB.max.x || boundsA.max.x < boundsB.min.x
                            || boundsA.max.y < boundsB.min.y || boundsA.min.y > boundsB.max.y) {
                            continue;
                        }

                        var collision = collides(partA, partB, pairs!);

                        if (collision) {
                            collisions[collisionIndex++] = collision;
                        }
                    }
                }
            }
        }
    }

    if (collisions.length !== collisionIndex) {
        collisions.length = collisionIndex;
    }

    return collisions;
};

/**
 * Returns `true` if both supplied collision filters will allow a collision to occur.
 * See `body.collisionFilter` for more information.
 */
export function canCollide(filterA: CollisionFilter, filterB: CollisionFilter) {
    if (filterA.group === filterB.group && filterA.group !== 0)
        return filterA.group > 0;

    return (filterA.mask & filterB.category) !== 0 && (filterB.mask & filterA.category) !== 0;
};

/**
 * The comparison function used in the broadphase algorithm.
 * Returns the signed delta of the bodies bounds on the x-axis.
 */
export function _compareBoundsX(bodyA: Body, bodyB: Body) {
    return bodyA.bounds.min.x - bodyB.bounds.min.x;
};
