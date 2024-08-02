import { RenderOptions, type Body } from "../body/Body";
import { _baseDelta, clamp, extend, nextId, type ConstraintBase } from "../core/Common";
import { type Vector, add, sub, magnitude, rotate, mult, div, dot, cross, rotateAbout } from "../geometry/Vector";
import { set as sleepingSet } from "../core/Sleeping";
import { translate as verticesTranslate, rotate as verticesRotate } from "../geometry/Vertices";
import { rotate as axesRotate } from "../geometry/Axes";
import { update as boundsUpdate } from "../geometry/Bounds";

const _warming = 0.4;
const _torqueDampen = 1;
const _minLength = 0.000001;

export interface ConstraintRenderOptions extends RenderOptions {
    /** A `Boolean` that defines if the constraint's anchor points should be rendered. */
    anchors?: boolean;
}

export interface Constraint extends ConstraintBase {
    /** The first possible `Body` that this constraint is attached to. */
    bodyA?: Body;
    /** The second possible `Body` that this constraint is attached to. */
    bodyB?: Body;
    /** A `Vector` that specifies the offset of the constraint from center of the `constraint.bodyA` if defined, otherwise a world-space position. */
    pointA?: Vector;
    /** A `Vector` that specifies the offset of the constraint from center of the `constraint.bodyB` if defined, otherwise a world-space position. */
    pointB?: Vector;
    /**
     * A `Number` that specifies the target resting length of the constraint. 
     * It is calculated automatically in `Constraint.create` from initial positions of the `constraint.bodyA` and `constraint.bodyB`.
     */
    length: number;
    /** An integer `Number` uniquely identifying number generated in `Composite.create` by `Common.nextId`. */
    id: number;
    /**
     * A `Number` that specifies the stiffness of the constraint, i.e. the rate at which it returns to its resting `constraint.length`.
     * A value of `1` means the constraint should be very stiff.
     * A value of `0.2` means the constraint acts like a soft spring.
     */
    stiffness: number;
    /**
     * A `Number` that specifies the damping of the constraint, 
     * i.e. the amount of resistance applied to each body based on their velocities to limit the amount of oscillation.
     * Damping will only be apparent when the constraint also has a very low `stiffness`.
     * A value of `0.1` means the constraint will apply heavy damping, resulting in little to no oscillation.
     * A value of `0` means the constraint will apply no damping.
     */
    damping: number;
    angularStiffness: number;
    angleA: number;
    angleB: number;
    /** An `Object` that defines the rendering properties to be consumed by the module `Matter.Render`. */
    render: ConstraintRenderOptions;
}

/**
 * Creates a new constraint.
 * All properties have default values, and many are pre-calculated automatically based on other properties.
 * To simulate a revolute constraint (or pin joint) set `length: 0` and a high `stiffness` value (e.g. `0.7` or above).
 * If the constraint is unstable, try lowering the `stiffness` value and / or increasing `engine.constraintIterations`.
 * For compound bodies, constraints must be applied to the parent body (not one of its parts).
 * See the properties section below for detailed information on what you can pass via the `options` object.
 */
export function create(options: Partial<Constraint>): Constraint {
    const constraint = { ...options };

    // if bodies defined but no points, use body centre
    if (constraint.bodyA && !constraint.pointA)
        constraint.pointA = { x: 0, y: 0 };
    if (constraint.bodyB && !constraint.pointB)
        constraint.pointB = { x: 0, y: 0 };

    constraint.pointA ??= { x: 0, y: 0 };
    constraint.pointB ??= { x: 0, y: 0 };

    // calculate static length using initial world space points
    let initialPointA = constraint.bodyA ? add(constraint.bodyA.position, constraint.pointA!) : constraint.pointA;
    let initialPointB = constraint.bodyB ? add(constraint.bodyB.position, constraint.pointB!) : constraint.pointB;
    let length = magnitude(sub(initialPointA, initialPointB));

    constraint.length ??= length;

    // option defaults
    constraint.id = constraint.id ?? nextId();
    constraint.label = constraint.label ?? 'Constraint';
    constraint.type = 'constraint';
    constraint.stiffness = constraint.stiffness ?? (constraint.length > 0 ? 1 : 0.7);
    constraint.damping = constraint.damping ?? 0;
    constraint.angularStiffness = constraint.angularStiffness ?? 0;
    constraint.angleA = constraint.bodyA ? constraint.bodyA.angle : constraint.angleA;
    constraint.angleB = constraint.bodyB ? constraint.bodyB.angle : constraint.angleB;

    // render
    var render: ConstraintRenderOptions = {
        visible: true,
        lineWidth: 2,
        strokeStyle: '#ffffff',
        type: 'line',
        anchors: true
    };

    if (constraint.length === 0 && constraint.stiffness > 0.1) {
        render.type = 'pin';
        render.anchors = false;
    } else if (constraint.stiffness < 0.9) {
        render.type = 'spring';
    }

    constraint.render = extend(render, constraint.render);

    return constraint as Constraint;
};

/**
 * Prepares for solving by constraint warming.
 */
export function preSolveAll(bodies: Body[]) {
    for (var i = 0; i < bodies.length; i += 1) {
        var body = bodies[i],
            impulse = body.constraintImpulse;

        if (body.isStatic || (impulse.x === 0 && impulse.y === 0 && impulse.angle === 0)) {
            continue;
        }

        body.position.x += impulse.x;
        body.position.y += impulse.y;
        body.angle += impulse.angle;
    }
};

/**
 * Solves all constraints in a list of collisions.
 */
export function solveAll(constraints: Constraint[], delta: number) {
    var timeScale = clamp(delta / _baseDelta, 0, 1);

    // Solve fixed constraints first.
    for (var i = 0; i < constraints.length; i += 1) {
        var constraint = constraints[i],
            fixedA = !constraint.bodyA || (constraint.bodyA && constraint.bodyA.isStatic),
            fixedB = !constraint.bodyB || (constraint.bodyB && constraint.bodyB.isStatic);

        if (fixedA || fixedB) {
            solve(constraints[i], timeScale);
        }
    }

    // Solve free constraints last.
    for (i = 0; i < constraints.length; i += 1) {
        constraint = constraints[i];
        fixedA = !constraint.bodyA || (constraint.bodyA && constraint.bodyA.isStatic);
        fixedB = !constraint.bodyB || (constraint.bodyB && constraint.bodyB.isStatic);

        if (!fixedA && !fixedB) {
            solve(constraints[i], timeScale);
        }
    }
};

/**
 * Solves a distance constraint with Gauss-Siedel method.
 */
export function solve(constraint: Constraint, timeScale: number) {
    var bodyA = constraint.bodyA,
        bodyB = constraint.bodyB,
        pointA = constraint.pointA,
        pointB = constraint.pointB;

    if (!bodyA && !bodyB)
        return;

    // update reference angle
    if (bodyA && pointA && !bodyA.isStatic) {
        rotate(pointA, bodyA.angle - constraint.angleA, pointA);
        constraint.angleA = bodyA.angle;
    }

    // update reference angle
    if (bodyB && pointB && !bodyB.isStatic) {
        rotate(pointB, bodyB.angle - constraint.angleB, pointB);
        constraint.angleB = bodyB.angle;
    }

    var pointAWorld = pointA,
        pointBWorld = pointB;

    if (bodyA && pointA) pointAWorld = add(bodyA.position, pointA);
    if (bodyB && pointB) pointBWorld = add(bodyB.position, pointB);

    if (!pointAWorld || !pointBWorld)
        return;

    var delta = sub(pointAWorld, pointBWorld),
        currentLength = magnitude(delta);

    // prevent singularity
    if (currentLength < _minLength) {
        currentLength = _minLength;
    }

    // solve distance constraint with Gauss-Siedel method
    let difference = (currentLength - constraint.length) / currentLength;
    let isRigid = constraint.stiffness >= 1 || constraint.length === 0;
    let stiffness = isRigid ? constraint.stiffness * timeScale : constraint.stiffness * timeScale * timeScale;
    let damping = constraint.damping * timeScale;
    let force = mult(delta, difference * stiffness);
    let massTotal = (bodyA ? bodyA.inverseMass : 0) + (bodyB ? bodyB.inverseMass : 0);
    let inertiaTotal = (bodyA ? bodyA.inverseInertia : 0) + (bodyB ? bodyB.inverseInertia : 0);
    let resistanceTotal = massTotal + inertiaTotal;
    let torque;
    let share;
    let normal: Vector = { x: 0, y: 0 };
    let normalVelocity = 0;
    let relativeVelocity;

    if (damping > 0) {
        var zero = { x: 0, y: 0 };
        normal = div(delta, currentLength);

        relativeVelocity = sub(
            bodyB && sub(bodyB.position, bodyB.positionPrev) || zero,
            bodyA && sub(bodyA.position, bodyA.positionPrev) || zero
        );

        normalVelocity = dot(normal, relativeVelocity);
    }

    if (bodyA && !bodyA.isStatic && pointA) {
        share = bodyA.inverseMass / massTotal;

        // keep track of applied impulses for post solving
        bodyA.constraintImpulse.x -= force.x * share;
        bodyA.constraintImpulse.y -= force.y * share;

        // apply forces
        bodyA.position.x -= force.x * share;
        bodyA.position.y -= force.y * share;

        // apply damping
        if (damping > 0) {
            bodyA.positionPrev.x -= damping * normal.x * normalVelocity * share;
            bodyA.positionPrev.y -= damping * normal.y * normalVelocity * share;
        }

        // apply torque
        torque = (cross(pointA, force) / resistanceTotal) * _torqueDampen * bodyA.inverseInertia * (1 - constraint.angularStiffness);
        bodyA.constraintImpulse.angle -= torque;
        bodyA.angle -= torque;
    }

    if (bodyB && !bodyB.isStatic && pointB) {
        share = bodyB.inverseMass / massTotal;

        // keep track of applied impulses for post solving
        bodyB.constraintImpulse.x += force.x * share;
        bodyB.constraintImpulse.y += force.y * share;

        // apply forces
        bodyB.position.x += force.x * share;
        bodyB.position.y += force.y * share;

        // apply damping
        if (damping > 0) {
            bodyB.positionPrev.x += damping * normal.x * normalVelocity * share;
            bodyB.positionPrev.y += damping * normal.y * normalVelocity * share;
        }

        // apply torque
        torque = (cross(pointB, force) / resistanceTotal) * _torqueDampen * bodyB.inverseInertia * (1 - constraint.angularStiffness);
        bodyB.constraintImpulse.angle += torque;
        bodyB.angle += torque;
    }

};

/**
 * Performs body updates required after solving constraints.
 */
export function postSolveAll(bodies: Body[]) {
    for (var i = 0; i < bodies.length; i++) {
        var body = bodies[i],
            impulse = body.constraintImpulse;

        if (body.isStatic || (impulse.x === 0 && impulse.y === 0 && impulse.angle === 0)) {
            continue;
        }

        sleepingSet(body, false);

        // update geometry and reset
        for (var j = 0; j < body.parts.length; j++) {
            var part = body.parts[j];

            verticesTranslate(part.vertices, impulse);

            if (j > 0) {
                part.position.x += impulse.x;
                part.position.y += impulse.y;
            }

            if (impulse.angle !== 0) {
                verticesRotate(part.vertices, impulse.angle, body.position);
                axesRotate(part.axes, impulse.angle);
                if (j > 0) {
                    rotateAbout(part.position, impulse.angle, body.position, part.position);
                }
            }

            boundsUpdate(part.bounds, part.vertices, body.velocity);
        }

        // dampen the cached impulse for warming next step
        impulse.angle *= _warming;
        impulse.x *= _warming;
        impulse.y *= _warming;
    }
};

/**
 * Returns the world-space position of `constraint.pointA`, accounting for `constraint.bodyA`.
 */
export function pointAWorld(constraint: Constraint) {
    return {
        x: (constraint.bodyA ? constraint.bodyA.position.x : 0)
            + (constraint.pointA ? constraint.pointA.x : 0),
        y: (constraint.bodyA ? constraint.bodyA.position.y : 0)
            + (constraint.pointA ? constraint.pointA.y : 0)
    };
};

/**
 * Returns the world-space position of `constraint.pointB`, accounting for `constraint.bodyB`.
 * @method pointBWorld
 * @param {constraint} constraint
 * @returns {Vector} the world-space position
 */
export function pointBWorld(constraint: Constraint) {
    return {
        x: (constraint.bodyB ? constraint.bodyB.position.x : 0)
            + (constraint.pointB ? constraint.pointB.x : 0),
        y: (constraint.bodyB ? constraint.bodyB.position.y : 0)
            + (constraint.pointB ? constraint.pointB.y : 0)
    };
};

/**
 * Returns the current length of the constraint. 
 * This is the distance between both of the constraint's end points.
 * See `constraint.length` for the target rest length.
 * @method currentLength
 * @param {constraint} constraint
 * @returns {number} the current length
 */
export function currentLength(constraint: Constraint) {
    var pointAX = (constraint.bodyA ? constraint.bodyA.position.x : 0)
        + (constraint.pointA ? constraint.pointA.x : 0);

    var pointAY = (constraint.bodyA ? constraint.bodyA.position.y : 0)
        + (constraint.pointA ? constraint.pointA.y : 0);

    var pointBX = (constraint.bodyB ? constraint.bodyB.position.x : 0)
        + (constraint.pointB ? constraint.pointB.x : 0);

    var pointBY = (constraint.bodyB ? constraint.bodyB.position.y : 0)
        + (constraint.pointB ? constraint.pointB.y : 0);

    var deltaX = pointAX - pointBX;
    var deltaY = pointAY - pointBY;

    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
};
