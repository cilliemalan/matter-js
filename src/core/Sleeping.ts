import { _baseDelta } from './Common'
import { trigger } from './Events'
import { Body, getSpeed, getAngularSpeed } from '../body/Body'
import { Pair } from '../collision/Pair';

export let _motionWakeThreshold = 0.18;
export let _motionSleepThreshold = 0.08;
export let _minBias = 0.9;

/**
 * Puts bodies to sleep or wakes them up depending on their motion.
 */
export function update(bodies: Body[], delta: number) {
    const timeScale = delta / _baseDelta;
    const motionSleepThreshold = _motionSleepThreshold;

    // update bodies sleeping status
    for (var i = 0; i < bodies.length; i++) {
        var body = bodies[i],
            speed = getSpeed(body),
            angularSpeed = getAngularSpeed(body),
            motion = speed * speed + angularSpeed * angularSpeed;

        // wake up bodies if they have a force applied
        if (body.force.x !== 0 || body.force.y !== 0) {
            set(body, false);
            continue;
        }

        var minMotion = Math.min(body.motion, motion),
            maxMotion = Math.max(body.motion, motion);

        // biased average motion estimation between frames
        body.motion = _minBias * minMotion + (1 - _minBias) * maxMotion;

        if (body.sleepThreshold > 0 && body.motion < motionSleepThreshold) {
            body.sleepCounter += 1;

            if (body.sleepCounter >= body.sleepThreshold / timeScale) {
                set(body, true);
            }
        } else if (body.sleepCounter > 0) {
            body.sleepCounter -= 1;
        }
    }
};

/**
 * Given a set of colliding pairs, wakes the sleeping bodies involved.
 */
export function afterCollisions(pairs: Pair[]) {
    var motionSleepThreshold = _motionSleepThreshold;

    // wake up bodies involved in collisions
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i];

        // don't wake inactive pairs
        if (!pair.isActive)
            continue;

        var collision = pair.collision,
            bodyA = collision.bodyA.parent,
            bodyB = collision.bodyB.parent;

        // don't wake if at least one body is static
        if ((bodyA.isSleeping && bodyB.isSleeping) || bodyA.isStatic || bodyB.isStatic)
            continue;

        if (bodyA.isSleeping || bodyB.isSleeping) {
            var sleepingBody = (bodyA.isSleeping && !bodyA.isStatic) ? bodyA : bodyB,
                movingBody = sleepingBody === bodyA ? bodyB : bodyA;

            if (!sleepingBody.isStatic && movingBody.motion > motionSleepThreshold) {
                set(sleepingBody, false);
            }
        }
    }
};

/**
 * Set a body as sleeping or awake.
 */
export function set(body: Body, isSleeping: boolean) {
    var wasSleeping = body.isSleeping;

    if (isSleeping) {
        body.isSleeping = true;
        body.sleepCounter = body.sleepThreshold;

        body.positionImpulse.x = 0;
        body.positionImpulse.y = 0;

        body.positionPrev.x = body.position.x;
        body.positionPrev.y = body.position.y;

        body.anglePrev = body.angle;
        body.speed = 0;
        body.angularSpeed = 0;
        body.motion = 0;

        if (!wasSleeping) {
            trigger(body, 'sleepStart');
        }
    } else {
        body.isSleeping = false;
        body.sleepCounter = 0;

        if (wasSleeping) {
            trigger(body, 'sleepEnd');
        }
    }
};

