import { Body, CollisionFilter } from "./Body";
import { allBodies } from "./Composite";
import { canCollide } from "./Detector";
import { extend, ObjectBase, warn } from "./Common";
import { Engine } from "./Engine";
import { on, trigger } from "./Events";
import { clearSourceEvents, Mouse, create as mouseCreate } from "./Mouse";
import { contains as boundsContains } from "./Bounds";
import { Constraint, create as constraintCreate } from "./Constraint";
import { contains as verticesContains } from "./Vertices";
import { set as sleepingSet } from "./Sleeping";

export interface MouseConstraint extends ObjectBase {
    /** The `Mouse` instance in use. If not supplied in `MouseConstraint.create`, one will be created. */
    mouse: Mouse;
    /** The `Body` that is currently being moved by the user, or `null` if no body. */
    body?: Body;
    /** The `Constraint` object that is used to move the body during interaction. */
    constraint: Constraint;
    /**
     * An `Object` that specifies the collision filter properties.
     * The collision filter allows the user to define which types of body this mouse constraint can interact with.
     * See `body.collisionFilter` for more information.
     */
    collisionFilter: CollisionFilter;
}

export interface MouseOptions extends Partial<MouseConstraint> {
    /** The element to capture mouse input on. */
    element: HTMLElement;
}

export interface EngineWithMouse extends Engine {
    mouse?: Mouse
}

/**
 * Creates a new mouse constraint.
 * All properties have default values, and many are pre-calculated automatically based on other properties.
 * See the properties section below for detailed information on what you can pass via the `options` object.
 */
export function create(engine: EngineWithMouse, options: MouseOptions): MouseConstraint {
    var mouse = (engine ? engine.mouse : null) || (options ? options.mouse : null);

    if (!mouse) {
        if (engine && engine.render && engine.render.canvas) {
            mouse = mouseCreate(engine.render.canvas);
        } else if (options && options.element) {
            mouse = mouseCreate(options.element);
        } else {
            mouse = mouseCreate(undefined!);
            warn('MouseConstraint.create: options.mouse was undefined, options.element was undefined, may not function as expected');
        }
    }

    var constraint = constraintCreate({
        label: 'Mouse Constraint',
        pointA: mouse.position,
        pointB: { x: 0, y: 0 },
        length: 0.01,
        stiffness: 0.1,
        angularStiffness: 1,
        render: {
            strokeStyle: '#90EE90',
            lineWidth: 3,
        }
    });

    var defaults: MouseConstraint = {
        type: 'mouseConstraint',
        label: 'Mouse Constraint',
        mouse: mouse,
        body: undefined,
        constraint: constraint,
        collisionFilter: {
            category: 0x0001,
            mask: 0xFFFFFFFF,
            group: 0
        }
    };

    var mouseConstraint = extend(defaults, options);

    on(engine, 'beforeUpdate', function () {
        const bodies = allBodies(engine.world);
        update(mouseConstraint, bodies);
        _triggerEvents(mouseConstraint);
    });

    return mouseConstraint;
};

/**
 * Updates the given mouse constraint.
 */
export function update(mouseConstraint: MouseConstraint, bodies: Body[]) {
    var mouse = mouseConstraint.mouse,
        constraint = mouseConstraint.constraint,
        body = mouseConstraint.body;

    if (mouse.button === 0) {
        if (!constraint.bodyB) {
            for (var i = 0; i < bodies.length; i++) {
                body = bodies[i];
                if (boundsContains(body.bounds, mouse.position)
                    && canCollide(body.collisionFilter, mouseConstraint.collisionFilter)) {
                    for (var j = body.parts.length > 1 ? 1 : 0; j < body.parts.length; j++) {
                        var part = body.parts[j];
                        if (verticesContains(part.vertices, mouse.position)) {
                            constraint.pointA = mouse.position;
                            constraint.bodyB = mouseConstraint.body = body;
                            constraint.pointB = { x: mouse.position.x - body.position.x, y: mouse.position.y - body.position.y };
                            constraint.angleB = body.angle;

                            sleepingSet(body, false);
                            trigger(mouseConstraint, 'startdrag', { mouse: mouse, body: body });

                            break;
                        }
                    }
                }
            }
        } else {
            sleepingSet(constraint.bodyB, false);
            constraint.pointA = mouse.position;
        }
    } else {
        constraint.bodyB = mouseConstraint.body = undefined;
        constraint.pointB = undefined;

        if (body)
            trigger(mouseConstraint, 'enddrag', { mouse: mouse, body: body });
    }
};

/**
 * Triggers mouse constraint events.
 */
export function _triggerEvents(mouseConstraint: MouseConstraint) {
    var mouse = mouseConstraint.mouse,
        mouseEvents = mouse.sourceEvents;

    if (mouseEvents.mousemove)
        trigger(mouseConstraint, 'mousemove', { mouse: mouse });

    if (mouseEvents.mousedown)
        trigger(mouseConstraint, 'mousedown', { mouse: mouse });

    if (mouseEvents.mouseup)
        trigger(mouseConstraint, 'mouseup', { mouse: mouse });

    // reset the mouse state ready for the next step
    clearSourceEvents(mouse);
};

/*
*
*  Events Documentation
*
*/

/**
* Fired when the mouse has moved (or a touch moves) during the last step
*
* @event mousemove
* @param {} event An event object
* @param {mouse} event.mouse The engine's mouse instance
* @param {} event.source The source object of the event
* @param {} event.name The name of the event
*/

/**
* Fired when the mouse is down (or a touch has started) during the last step
*
* @event mousedown
* @param {} event An event object
* @param {mouse} event.mouse The engine's mouse instance
* @param {} event.source The source object of the event
* @param {} event.name The name of the event
*/

/**
* Fired when the mouse is up (or a touch has ended) during the last step
*
* @event mouseup
* @param {} event An event object
* @param {mouse} event.mouse The engine's mouse instance
* @param {} event.source The source object of the event
* @param {} event.name The name of the event
*/

/**
* Fired when the user starts dragging a body
*
* @event startdrag
* @param {} event An event object
* @param {mouse} event.mouse The engine's mouse instance
* @param {body} event.body The body being dragged
* @param {} event.source The source object of the event
* @param {} event.name The name of the event
*/

/**
* Fired when the user ends dragging a body
*
* @event enddrag
* @param {} event An event object
* @param {mouse} event.mouse The engine's mouse instance
* @param {body} event.body The body that has stopped being dragged
* @param {} event.source The source object of the event
* @param {} event.name The name of the event
*/

/*
*
*  Properties Documentation
*
*/

/**
 * A `String` denoting the type of object.
 *
 * @property type
 * @type string
 * @default "constraint"
 * @readOnly
 */

/**
 * The `Mouse` instance in use. If not supplied in `MouseConstraint.create`, one will be created.
 *
 * @property mouse
 * @type mouse
 * @default mouse
 */

/**
 * The `Body` that is currently being moved by the user, or `null` if no body.
 *
 * @property body
 * @type body
 * @default null
 */

/**
 * The `Constraint` object that is used to move the body during interaction.
 *
 * @property constraint
 * @type constraint
 */

/**
 * An `Object` that specifies the collision filter properties.
 * The collision filter allows the user to define which types of body this mouse constraint can interact with.
 * See `body.collisionFilter` for more information.
 *
 * @property collisionFilter
 * @type object
 */

