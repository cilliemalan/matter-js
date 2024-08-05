import {
    Composite,
    create as createComposite,
    allBodies as compositeAllBodies,
    allConstraints as compositeAllConstraints,
    setModified as compositeSetModified
} from "./Composite";
import { Detector, create as createDetector, setBodies as detectorSetBodies, collisions as detectorCollisions, clear as detectorClear } from "./Detector";
import { Pairs, create as createPairs, update as pairsUpdate, clear as pairsClear } from "./Pairs";
import { postSolvePosition, preSolvePosition, preSolveVelocity, solvePosition, solveVelocity } from "./Resolver";
import { postSolveAll, preSolveAll, solveAll } from "./Constraint";
import { Vector } from "./Vector";
import { _baseDelta, clamp, extend, nextId, warnOnce } from "./Common";
import { trigger } from "./Events";
import { update as sleepingUpdate, afterCollisions as sleepingAfterCollisions, set as sleepingSet } from './Sleeping';
import { Body, update as bodyUpdate, updateVelocities } from "./Body";
import { Render } from "./Render";

export interface Timing {
    /** A `Number` that specifies the current simulation-time in milliseconds starting from `0`. 
     * It is incremented on every `Engine.update` by the given `delta` argument.  
     */
    timestamp: number;
    /**
     * A `Number` that specifies the global scaling factor of time for all bodies.
     * A value of `0` freezes the simulation.
     * A value of `0.1` gives a slow-motion effect.
     * A value of `1.2` gives a speed-up effect.
     */
    timeScale: number;
    /** A `Number` that represents the `delta` value used in the last engine update. */
    lastDelta: number;
    /**
     * A `Number` that represents the total execution time elapsed during the last `Engine.update` in milliseconds.
     * It is updated by timing from the start of the last `Engine.update` call until it ends.
     *
     * This value will also include the total execution time of all event handlers directly or indirectly triggered by the engine update.
     */
    lastElapsed: number;
    lastUpdatesPerFrame: number;
}

export type GravityVector = Vector & { scale: number };

export interface Engine {
    /** An integer `Number` that specifies the number of position iterations to perform each update.
     * The higher the value, the higher quality the simulation will be at the expense of performance.
     */
    positionIterations: number;
    /**
     * An integer `Number` that specifies the number of velocity iterations to perform each update.
     * The higher the value, the higher quality the simulation will be at the expense of performance.
     */
    velocityIterations: number;
    /**
     * An integer `Number` that specifies the number of constraint iterations to perform each update.
     * The higher the value, the higher quality the simulation will be at the expense of performance.
     * The default value of `2` is usually very adequate.
     */
    constraintIterations: number;
    /**
     * A flag that specifies whether the engine should allow sleeping via the `Matter.Sleeping` module.
     * Sleeping can improve stability and performance, but often at the expense of accuracy.
     */
    enableSleeping: boolean;
    events: Array<unknown>;
    gravity: GravityVector;
    /** An `Object` containing properties regarding the timing systems of the engine.  */
    timing: Timing;

    /** The root `Matter.Composite` instance that will contain all bodies, constraints and other composites to be simulated by this engine. */
    world: Composite;
    pairs: Pairs;
    /** A `Matter.Detector` instance. */
    detector: Detector;
    render?: Render;
}

const _deltaMax = 1000 / 60;

/**
 * Creates a new engine. The options parameter is an object that specifies any properties you wish to override the defaults.
 * All properties have default values, and many are pre-calculated automatically based on other properties.
 * See the properties section below for detailed information on what you can pass via the `options` object.
 * @method create
 * @param {object} [options]
 * @return {engine} engine
 */
export function create(options?: Partial<Engine>): Engine {

    var engine = {
        positionIterations: 6,
        velocityIterations: 4,
        constraintIterations: 2,
        enableSleeping: false,
        events: [],
        gravity: {
            x: 0,
            y: 1,
            scale: 0.001
        },
        timing: {
            timestamp: 0,
            timeScale: 1,
            lastDelta: 0,
            lastElapsed: 0,
            lastUpdatesPerFrame: 0
        },

        ...options
    };

    engine.world ??= createComposite({ label: "World" });
    engine.pairs ??= createPairs();
    engine.detector ??= createDetector();
    engine.detector.pairs = engine.pairs;

    return engine as Engine;
};

/**
 * Moves the simulation forward in time by `delta` milliseconds.
 * Triggers `beforeUpdate`, `beforeSolve` and `afterUpdate` events.
 * Triggers `collisionStart`, `collisionActive` and `collisionEnd` events.
 */
export function update(engine: Engine, delta: number) {
    var startTime = performance.now();

    let world = engine.world;
    let detector = engine.detector;
    let pairs = engine.pairs;
    let timing = engine.timing;
    let timestamp = timing.timestamp;

    // warn if high delta
    if (delta > _deltaMax) {
        warnOnce(
            'Matter.Engine.update: delta argument is recommended to be less than or equal to', _deltaMax.toFixed(3), 'ms.'
        );
    }

    delta = typeof delta !== 'undefined' ? delta : _baseDelta;
    delta *= timing.timeScale;

    // increment timestamp
    timing.timestamp += delta;
    timing.lastDelta = delta;

    // create an event object
    var event = {
        timestamp: timing.timestamp,
        delta: delta
    };

    trigger(engine, 'beforeUpdate', event);

    // get all bodies and all constraints in the world
    const allBodies = compositeAllBodies(world);
    const allConstraints = compositeAllConstraints(world);

    // if the world has changed
    if (world.isModified) {
        // update the detector bodies
        detectorSetBodies(detector, allBodies);

        // reset all composite modified flags
        compositeSetModified(world, false, false, true);
    }

    // update sleeping if enabled
    if (engine.enableSleeping)
        sleepingUpdate(allBodies, delta);

    // apply gravity to all bodies
    _bodiesApplyGravity(allBodies, engine.gravity);

    // update all body position and rotation by integration
    if (delta > 0) {
        _bodiesUpdate(allBodies, delta);
    }

    trigger(engine, 'beforeSolve', event);

    // update all constraints (first pass)
    preSolveAll(allBodies);
    for (let i = 0; i < engine.constraintIterations; i++) {
        solveAll(allConstraints, delta);
    }
    postSolveAll(allBodies);

    // find all collisions
    var collisions = detectorCollisions(detector);

    // update collision pairs
    pairsUpdate(pairs, collisions, timestamp);

    // wake up bodies involved in collisions
    if (engine.enableSleeping)
        sleepingAfterCollisions(pairs.list);

    // trigger collision events
    if (pairs.collisionStart.length > 0) {
        trigger(engine, 'collisionStart', {
            pairs: pairs.collisionStart,
            timestamp: timing.timestamp,
            delta: delta
        });
    }

    // iteratively resolve position between collisions
    var positionDamping = clamp(20 / engine.positionIterations, 0, 1);

    preSolvePosition(pairs.list);
    for (let i = 0; i < engine.positionIterations; i++) {
        solvePosition(pairs.list, delta, positionDamping);
    }
    postSolvePosition(allBodies);

    // update all constraints (second pass)
    preSolveAll(allBodies);
    for (let i = 0; i < engine.constraintIterations; i++) {
        solveAll(allConstraints, delta);
    }
    postSolveAll(allBodies);

    // iteratively resolve velocity between collisions
    preSolveVelocity(pairs.list);
    for (let i = 0; i < engine.velocityIterations; i++) {
        solveVelocity(pairs.list, delta);
    }

    // update body speed and velocity properties
    _bodiesUpdateVelocities(allBodies);

    // trigger collision events
    if (pairs.collisionActive.length > 0) {
        trigger(engine, 'collisionActive', {
            pairs: pairs.collisionActive,
            timestamp: timing.timestamp,
            delta: delta
        });
    }

    if (pairs.collisionEnd.length > 0) {
        trigger(engine, 'collisionEnd', {
            pairs: pairs.collisionEnd,
            timestamp: timing.timestamp,
            delta: delta
        });
    }

    // clear force buffers
    _bodiesClearForces(allBodies);

    trigger(engine, 'afterUpdate', event);

    // log the time elapsed computing this update
    engine.timing.lastElapsed = performance.now() - startTime;

    return engine;
};

/**
 * Merges two engines by keeping the configuration of `engineA` but replacing the world with the one from `engineB`.
 */
export function merge(engineA: Engine, engineB: Engine) {
    extend(engineA, engineB);

    if (engineB.world) {
        engineA.world = engineB.world;

        clear(engineA);

        var bodies = compositeAllBodies(engineA.world);

        for (var i = 0; i < bodies.length; i++) {
            var body = bodies[i];
            sleepingSet(body, false);
            body.id = nextId();
        }
    }
};

/**
 * Clears the engine pairs and detector.
 */
export function clear(engine: Engine) {
    pairsClear(engine.pairs);
    detectorClear(engine.detector);
};

/**
 * Zeroes the `body.force` and `body.torque` force buffers.
 */
export function _bodiesClearForces(bodies: Body[]) {
    var bodiesLength = bodies.length;

    for (var i = 0; i < bodiesLength; i++) {
        var body = bodies[i];

        // reset force buffers
        body.force.x = 0;
        body.force.y = 0;
        body.torque = 0;
    }
};

/**
 * Applies gravitational acceleration to all `bodies`.
 * This models a [uniform gravitational field](https://en.wikipedia.org/wiki/Gravity_of_Earth), similar to near the surface of a planet.
 */
export function _bodiesApplyGravity(bodies: Body[], gravity: GravityVector) {
    var gravityScale = typeof gravity.scale !== 'undefined' ? gravity.scale : 0.001,
        bodiesLength = bodies.length;

    if ((gravity.x === 0 && gravity.y === 0) || gravityScale === 0) {
        return;
    }

    for (var i = 0; i < bodiesLength; i++) {
        var body = bodies[i];

        if (body.isStatic || body.isSleeping)
            continue;

        // add the resultant force of gravity
        body.force.y += body.mass * gravity.y * gravityScale;
        body.force.x += body.mass * gravity.x * gravityScale;
    }
};

/**
 * Applies `Body.update` to all given `bodies`.
 */
export function _bodiesUpdate(bodies: Body[], delta: number) {
    var bodiesLength = bodies.length;

    for (var i = 0; i < bodiesLength; i++) {
        var body = bodies[i];

        if (body.isStatic || body.isSleeping)
            continue;

        bodyUpdate(body, delta);
    }
};

/**
 * Applies `Body.updateVelocities` to all given `bodies`.
 */
export function _bodiesUpdateVelocities(bodies: Body[]) {
    var bodiesLength = bodies.length;

    for (var i = 0; i < bodiesLength; i++) {
        updateVelocities(bodies[i]);
    }
};

/**
 * A deprecated alias for `Runner.run`, use `Matter.Runner.run(engine)` instead and see `Matter.Runner` for more information.
 * @deprecated use Matter.Runner.run(engine) instead
 * @method run
 * @param {engine} engine
 */

/**
* Fired just before an update
*
* @event beforeUpdate
* @param {object} event An event object
* @param {number} event.timestamp The engine.timing.timestamp of the event
* @param {number} event.delta The delta time in milliseconds value used in the update
* @param {engine} event.source The source object of the event
* @param {string} event.name The name of the event
*/

/**
* Fired after bodies updated based on their velocity and forces, but before any collision detection, constraints and resolving etc.
*
* @event beforeSolve
* @param {object} event An event object
* @param {number} event.timestamp The engine.timing.timestamp of the event
* @param {number} event.delta The delta time in milliseconds value used in the update
* @param {engine} event.source The source object of the event
* @param {string} event.name The name of the event
*/

/**
* Fired after engine update and all collision events
*
* @event afterUpdate
* @param {object} event An event object
* @param {number} event.timestamp The engine.timing.timestamp of the event
* @param {number} event.delta The delta time in milliseconds value used in the update
* @param {engine} event.source The source object of the event
* @param {string} event.name The name of the event
*/

/**
* Fired after engine update, provides a list of all pairs that have started to collide in the current tick (if any)
*
* @event collisionStart
* @param {object} event An event object
* @param {pair[]} event.pairs List of affected pairs
* @param {number} event.timestamp The engine.timing.timestamp of the event
* @param {number} event.delta The delta time in milliseconds value used in the update
* @param {engine} event.source The source object of the event
* @param {string} event.name The name of the event
*/

/**
* Fired after engine update, provides a list of all pairs that are colliding in the current tick (if any)
*
* @event collisionActive
* @param {object} event An event object
* @param {pair[]} event.pairs List of affected pairs
* @param {number} event.timestamp The engine.timing.timestamp of the event
* @param {number} event.delta The delta time in milliseconds value used in the update
* @param {engine} event.source The source object of the event
* @param {string} event.name The name of the event
*/

/**
* Fired after engine update, provides a list of all pairs that have ended collision in the current tick (if any)
*
* @event collisionEnd
* @param {object} event An event object
* @param {pair[]} event.pairs List of affected pairs
* @param {number} event.timestamp The engine.timing.timestamp of the event
* @param {number} event.delta The delta time in milliseconds value used in the update
* @param {engine} event.source The source object of the event
* @param {string} event.name The name of the event
*/

/*
*
*  Properties Documentation
*
*/

/**
 * An integer `Number` that specifies the number of position iterations to perform each update.
 * The higher the value, the higher quality the simulation will be at the expense of performance.
 *
 * @property positionIterations
 * @type number
 * @default 6
 */

/**
 * An integer `Number` that specifies the number of velocity iterations to perform each update.
 * The higher the value, the higher quality the simulation will be at the expense of performance.
 *
 * @property velocityIterations
 * @type number
 * @default 4
 */

/**
 * An integer `Number` that specifies the number of constraint iterations to perform each update.
 * The higher the value, the higher quality the simulation will be at the expense of performance.
 * The default value of `2` is usually very adequate.
 *
 * @property constraintIterations
 * @type number
 * @default 2
 */

/**
 * A flag that specifies whether the engine should allow sleeping via the `Matter.Sleeping` module.
 * Sleeping can improve stability and performance, but often at the expense of accuracy.
 *
 * @property enableSleeping
 * @type boolean
 * @default false
 */

/**
 * An `Object` containing properties regarding the timing systems of the engine. 
 *
 * @property timing
 * @type object
 */

/**
 * A `Number` that specifies the global scaling factor of time for all bodies.
 * A value of `0` freezes the simulation.
 * A value of `0.1` gives a slow-motion effect.
 * A value of `1.2` gives a speed-up effect.
 *
 * @property timing.timeScale
 * @type number
 * @default 1
 */

/**
 * A `Number` that specifies the current simulation-time in milliseconds starting from `0`. 
 * It is incremented on every `Engine.update` by the given `delta` argument. 
 * 
 * @property timing.timestamp
 * @type number
 * @default 0
 */

/**
 * A `Number` that represents the total execution time elapsed during the last `Engine.update` in milliseconds.
 * It is updated by timing from the start of the last `Engine.update` call until it ends.
 *
 * This value will also include the total execution time of all event handlers directly or indirectly triggered by the engine update.
 * 
 * @property timing.lastElapsed
 * @type number
 * @default 0
 */

/**
 * A `Number` that represents the `delta` value used in the last engine update.
 * 
 * @property timing.lastDelta
 * @type number
 * @default 0
 */

/**
 * A `Matter.Detector` instance.
 *
 * @property detector
 * @type detector
 * @default a Matter.Detector instance
 */

/**
 * A `Matter.Grid` instance.
 *
 * @deprecated replaced by `engine.detector`
 * @property grid
 * @type grid
 * @default a Matter.Grid instance
 */

/**
 * Replaced by and now alias for `engine.grid`.
 *
 * @deprecated replaced by `engine.detector`
 * @property broadphase
 * @type grid
 * @default a Matter.Grid instance
 */

/**
 * The root `Matter.Composite` instance that will contain all bodies, constraints and other composites to be simulated by this engine.
 *
 * @property world
 * @type composite
 * @default a Matter.Composite instance
 */

/**
 * An object reserved for storing plugin-specific properties.
 *
 * @property plugin
 * @type {}
 */

/**
 * An optional gravitational acceleration applied to all bodies in `engine.world` on every update.
 * 
 * This models a [uniform gravitational field](https://en.wikipedia.org/wiki/Gravity_of_Earth), similar to near the surface of a planet. For gravity in other contexts, disable this and apply forces as needed.
 * 
 * To disable set the `scale` component to `0`.
 * 
 * This is split into three components for ease of use:  
 * a normalised direction (`x` and `y`) and magnitude (`scale`).
 *
 * @property gravity
 * @type object
 */

/**
 * The gravitational direction normal `x` component, to be multiplied by `gravity.scale`.
 * 
 * @property gravity.x
 * @type object
 * @default 0
 */

/**
 * The gravitational direction normal `y` component, to be multiplied by `gravity.scale`.
 *
 * @property gravity.y
 * @type object
 * @default 1
 */

/**
 * The magnitude of the gravitational acceleration.
 * 
 * @property gravity.scale
 * @type object
 * @default 0.001
 */

