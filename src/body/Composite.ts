import { Constraint } from '../constraint/Constraint';
import { ChildObject, CompositeBase, extend, nextId, warn } from '../core/Common'
import { trigger } from '../core/Events';
import { type Body } from '../body/Body';

interface CompositeCache {
    allBodies?: Array<unknown>;
    allConstraints?: Array<unknown>;
    allComposites?: Array<unknown>;
}

export interface Composite extends CompositeBase {
    id: number,
    type: 'composite',
    label: string,
    parent?: any,
    isModified: boolean,
    bodies: Array<Body>,
    constraints: Array<Constraint>,
    composites: Array<Composite>,
    cache: CompositeCache;
}

/**
 * Creates a new composite. The options parameter is an object that specifies any properties you wish to override the defaults.
 * See the properites section below for detailed information on what you can pass via the `options` object.
 */
export function create(options: Partial<Composite>): Composite {
    const composite: Composite = {
        id: nextId(),
        type: 'composite',
        parent: null,
        isModified: false,
        bodies: [],
        constraints: [],
        composites: [],
        label: 'Composite',
        cache: {
            allBodies: undefined,
            allConstraints: undefined,
            allComposites: undefined
        },
    };
    
    return extend(composite, options);
};

/**
 * Sets the composite's `isModified` flag. 
 * If `updateParents` is true, all parents will be set (default: false).
 * If `updateChildren` is true, all children will be set (default: false).
 */
export function setModified(composite: Composite, isModified: boolean, updateParents?: boolean, updateChildren?: boolean) {
    composite.isModified = isModified;

    if (isModified && composite.cache) {
        composite.cache.allBodies = undefined;
        composite.cache.allConstraints = undefined;
        composite.cache.allComposites = undefined;
    }

    if (updateParents && composite.parent) {
        setModified(composite.parent, isModified, updateParents, updateChildren);
    }

    if (updateChildren) {
        for (var i = 0; i < composite.composites.length; i++) {
            var childComposite = composite.composites[i];
            setModified(childComposite, isModified, updateParents, updateChildren);
        }
    }
};

/**
 * Generic single or multi-add function. Adds a single or an array of body(s), constraint(s) or composite(s) to the given composite.
 * Triggers `beforeAdd` and `afterAdd` events on the `composite`.
 */
export function add(composite: Composite, object: ChildObject | ChildObject[]) {
    const objects = object instanceof Array ? object : [object];

    trigger(composite, 'beforeAdd', { object: object });

    for (var i = 0; i < objects.length; i++) {
        var obj = objects[i];

        switch (obj.type) {

            case 'body':
                // skip adding compound parts
                if (obj.parent !== obj) {
                    warn('Composite.add: skipped adding a compound body part (you must add its parent instead)');
                    break;
                }

                addBody(composite, obj);
                break;
            case 'constraint':
                addConstraint(composite, obj);
                break;
            case 'composite':
                addComposite(composite, obj);
                break;
            case 'mouseConstraint':
                addConstraint(composite, obj.constraint);
                break;

        }
    }

    Events.trigger(composite, 'afterAdd', { object: object });

    return composite;
};

/**
 * Generic remove function. Removes one or many body(s), constraint(s) or a composite(s) to the given composite.
 * Optionally searching its children recursively.
 * Triggers `beforeRemove` and `afterRemove` events on the `composite`.
 * @method remove
 * @param {composite} composite
 * @param {object|array} object
 * @param {boolean} [deep=false]
 * @return {composite} The original composite with the objects removed
 */
export function remove(composite, object, deep) {
    var objects = [].concat(object);

    Events.trigger(composite, 'beforeRemove', { object: object });

    for (var i = 0; i < objects.length; i++) {
        var obj = objects[i];

        switch (obj.type) {

            case 'body':
                Composite.removeBody(composite, obj, deep);
                break;
            case 'constraint':
                Composite.removeConstraint(composite, obj, deep);
                break;
            case 'composite':
                Composite.removeComposite(composite, obj, deep);
                break;
            case 'mouseConstraint':
                Composite.removeConstraint(composite, obj.constraint);
                break;

        }
    }

    Events.trigger(composite, 'afterRemove', { object: object });

    return composite;
};

/**
 * Adds a composite to the given composite.
 * @private
 * @method addComposite
 * @param {composite} compositeA
 * @param {composite} compositeB
 * @return {composite} The original compositeA with the objects from compositeB added
 */
export function addComposite(compositeA, compositeB) {
    compositeA.composites.push(compositeB);
    compositeB.parent = compositeA;
    Composite.setModified(compositeA, true, true, false);
    return compositeA;
};

/**
 * Removes a composite from the given composite, and optionally searching its children recursively.
 * @private
 * @method removeComposite
 * @param {composite} compositeA
 * @param {composite} compositeB
 * @param {boolean} [deep=false]
 * @return {composite} The original compositeA with the composite removed
 */
export function removeComposite(compositeA, compositeB, deep) {
    var position = Common.indexOf(compositeA.composites, compositeB);

    if (position !== -1) {
        var bodies = Composite.allBodies(compositeB);

        Composite.removeCompositeAt(compositeA, position);

        for (var i = 0; i < bodies.length; i++) {
            bodies[i].sleepCounter = 0;
        }
    }

    if (deep) {
        for (var i = 0; i < compositeA.composites.length; i++) {
            Composite.removeComposite(compositeA.composites[i], compositeB, true);
        }
    }

    return compositeA;
};

/**
 * Removes a composite from the given composite.
 * @private
 * @method removeCompositeAt
 * @param {composite} composite
 * @param {number} position
 * @return {composite} The original composite with the composite removed
 */
export function removeCompositeAt(composite, position) {
    composite.composites.splice(position, 1);
    Composite.setModified(composite, true, true, false);
    return composite;
};

/**
 * Adds a body to the given composite.
 * @private
 * @method addBody
 * @param {composite} composite
 * @param {body} body
 * @return {composite} The original composite with the body added
 */
export function addBody(composite: Composite, body: Body) {
    composite.bodies.push(body);
    Composite.setModified(composite, true, true, false);
    return composite;
};

/**
 * Removes a body from the given composite, and optionally searching its children recursively.
 * @private
 * @method removeBody
 * @param {composite} composite
 * @param {body} body
 * @param {boolean} [deep=false]
 * @return {composite} The original composite with the body removed
 */
export function removeBody(composite, body, deep) {
    var position = Common.indexOf(composite.bodies, body);

    if (position !== -1) {
        Composite.removeBodyAt(composite, position);
        body.sleepCounter = 0;
    }

    if (deep) {
        for (var i = 0; i < composite.composites.length; i++) {
            Composite.removeBody(composite.composites[i], body, true);
        }
    }

    return composite;
};

/**
 * Removes a body from the given composite.
 * @private
 * @method removeBodyAt
 * @param {composite} composite
 * @param {number} position
 * @return {composite} The original composite with the body removed
 */
export function removeBodyAt(composite, position) {
    composite.bodies.splice(position, 1);
    Composite.setModified(composite, true, true, false);
    return composite;
};

/**
 * Adds a constraint to the given composite.
 * @private
 * @method addConstraint
 * @param {composite} composite
 * @param {constraint} constraint
 * @return {composite} The original composite with the constraint added
 */
export function addConstraint(composite, constraint) {
    composite.constraints.push(constraint);
    Composite.setModified(composite, true, true, false);
    return composite;
};

/**
 * Removes a constraint from the given composite, and optionally searching its children recursively.
 * @private
 * @method removeConstraint
 * @param {composite} composite
 * @param {constraint} constraint
 * @param {boolean} [deep=false]
 * @return {composite} The original composite with the constraint removed
 */
export function removeConstraint(composite, constraint, deep) {
    var position = Common.indexOf(composite.constraints, constraint);

    if (position !== -1) {
        Composite.removeConstraintAt(composite, position);
    }

    if (deep) {
        for (var i = 0; i < composite.composites.length; i++) {
            Composite.removeConstraint(composite.composites[i], constraint, true);
        }
    }

    return composite;
};

/**
 * Removes a body from the given composite.
 * @private
 * @method removeConstraintAt
 * @param {composite} composite
 * @param {number} position
 * @return {composite} The original composite with the constraint removed
 */
export function removeConstraintAt(composite, position) {
    composite.constraints.splice(position, 1);
    Composite.setModified(composite, true, true, false);
    return composite;
};

/**
 * Removes all bodies, constraints and composites from the given composite.
 * Optionally clearing its children recursively.
 * @method clear
 * @param {composite} composite
 * @param {boolean} keepStatic
 * @param {boolean} [deep=false]
 */
export function clear(composite, keepStatic, deep) {
    if (deep) {
        for (var i = 0; i < composite.composites.length; i++) {
            Composite.clear(composite.composites[i], keepStatic, true);
        }
    }

    if (keepStatic) {
        composite.bodies = composite.bodies.filter(function (body) { return body.isStatic; });
    } else {
        composite.bodies.length = 0;
    }

    composite.constraints.length = 0;
    composite.composites.length = 0;

    Composite.setModified(composite, true, true, false);

    return composite;
};

/**
 * Returns all bodies in the given composite, including all bodies in its children, recursively.
 * @method allBodies
 * @param {composite} composite
 * @return {body[]} All the bodies
 */
export function allBodies(composite) {
    if (composite.cache && composite.cache.allBodies) {
        return composite.cache.allBodies;
    }

    var bodies = [].concat(composite.bodies);

    for (var i = 0; i < composite.composites.length; i++)
        bodies = bodies.concat(Composite.allBodies(composite.composites[i]));

    if (composite.cache) {
        composite.cache.allBodies = bodies;
    }

    return bodies;
};

/**
 * Returns all constraints in the given composite, including all constraints in its children, recursively.
 * @method allConstraints
 * @param {composite} composite
 * @return {constraint[]} All the constraints
 */
export function allConstraints(composite) {
    if (composite.cache && composite.cache.allConstraints) {
        return composite.cache.allConstraints;
    }

    var constraints = [].concat(composite.constraints);

    for (var i = 0; i < composite.composites.length; i++)
        constraints = constraints.concat(Composite.allConstraints(composite.composites[i]));

    if (composite.cache) {
        composite.cache.allConstraints = constraints;
    }

    return constraints;
};

/**
 * Returns all composites in the given composite, including all composites in its children, recursively.
 * @method allComposites
 * @param {composite} composite
 * @return {composite[]} All the composites
 */
export function allComposites(composite) {
    if (composite.cache && composite.cache.allComposites) {
        return composite.cache.allComposites;
    }

    var composites = [].concat(composite.composites);

    for (var i = 0; i < composite.composites.length; i++)
        composites = composites.concat(Composite.allComposites(composite.composites[i]));

    if (composite.cache) {
        composite.cache.allComposites = composites;
    }

    return composites;
};

/**
 * Searches the composite recursively for an object matching the type and id supplied, null if not found.
 * @method get
 * @param {composite} composite
 * @param {number} id
 * @param {string} type
 * @return {object} The requested object, if found
 */
export function get(composite, id, type) {
    var objects,
        object;

    switch (type) {
        case 'body':
            objects = Composite.allBodies(composite);
            break;
        case 'constraint':
            objects = Composite.allConstraints(composite);
            break;
        case 'composite':
            objects = Composite.allComposites(composite).concat(composite);
            break;
    }

    if (!objects)
        return null;

    object = objects.filter(function (object) {
        return object.id.toString() === id.toString();
    });

    return object.length === 0 ? null : object[0];
};

/**
 * Moves the given object(s) from compositeA to compositeB (equal to a remove followed by an add).
 * @method move
 * @param {compositeA} compositeA
 * @param {object[]} objects
 * @param {compositeB} compositeB
 * @return {composite} Returns compositeA
 */
export function move(compositeA, objects, compositeB) {
    Composite.remove(compositeA, objects);
    Composite.add(compositeB, objects);
    return compositeA;
};

/**
 * Assigns new ids for all objects in the composite, recursively.
 * @method rebase
 * @param {composite} composite
 * @return {composite} Returns composite
 */
export function rebase(composite) {
    var objects = Composite.allBodies(composite)
        .concat(Composite.allConstraints(composite))
        .concat(Composite.allComposites(composite));

    for (var i = 0; i < objects.length; i++) {
        objects[i].id = Common.nextId();
    }

    return composite;
};

/**
 * Translates all children in the composite by a given vector relative to their current positions, 
 * without imparting any velocity.
 * @method translate
 * @param {composite} composite
 * @param {Vector} translation
 * @param {bool} [recursive=true]
 */
export function translate(composite, translation, recursive) {
    var bodies = recursive ? Composite.allBodies(composite) : composite.bodies;

    for (var i = 0; i < bodies.length; i++) {
        Body.translate(bodies[i], translation);
    }

    return composite;
};

/**
 * Rotates all children in the composite by a given angle about the given point, without imparting any angular velocity.
 * @method rotate
 * @param {composite} composite
 * @param {number} rotation
 * @param {Vector} point
 * @param {bool} [recursive=true]
 */
export function rotate(composite, rotation, point, recursive) {
    var cos = Math.cos(rotation),
        sin = Math.sin(rotation),
        bodies = recursive ? Composite.allBodies(composite) : composite.bodies;

    for (var i = 0; i < bodies.length; i++) {
        var body = bodies[i],
            dx = body.position.x - point.x,
            dy = body.position.y - point.y;

        Body.setPosition(body, {
            x: point.x + (dx * cos - dy * sin),
            y: point.y + (dx * sin + dy * cos)
        });

        Body.rotate(body, rotation);
    }

    return composite;
};

/**
 * Scales all children in the composite, including updating physical properties (mass, area, axes, inertia), from a world-space point.
 * @method scale
 * @param {composite} composite
 * @param {number} scaleX
 * @param {number} scaleY
 * @param {Vector} point
 * @param {bool} [recursive=true]
 */
export function scale(composite, scaleX, scaleY, point, recursive) {
    var bodies = recursive ? Composite.allBodies(composite) : composite.bodies;

    for (var i = 0; i < bodies.length; i++) {
        var body = bodies[i],
            dx = body.position.x - point.x,
            dy = body.position.y - point.y;

        Body.setPosition(body, {
            x: point.x + dx * scaleX,
            y: point.y + dy * scaleY
        });

        Body.scale(body, scaleX, scaleY);
    }

    return composite;
};

/**
 * Returns the union of the bounds of all of the composite's bodies.
 * @method bounds
 * @param {composite} composite The composite.
 * @returns {bounds} The composite bounds.
 */
export function bounds(composite) {
    var bodies = Composite.allBodies(composite),
        vertices = [];

    for (var i = 0; i < bodies.length; i += 1) {
        var body = bodies[i];
        vertices.push(body.bounds.min, body.bounds.max);
    }

    return Bounds.create(vertices);
};

    /*
    *
    *  Events Documentation
    *
    */

    /**
    * Fired when a call to `Composite.add` is made, before objects have been added.
    *
    * @event beforeAdd
    * @param {} event An event object
    * @param {} event.object The object(s) to be added (may be a single body, constraint, composite or a mixed array of these)
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired when a call to `Composite.add` is made, after objects have been added.
    *
    * @event afterAdd
    * @param {} event An event object
    * @param {} event.object The object(s) that have been added (may be a single body, constraint, composite or a mixed array of these)
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired when a call to `Composite.remove` is made, before objects have been removed.
    *
    * @event beforeRemove
    * @param {} event An event object
    * @param {} event.object The object(s) to be removed (may be a single body, constraint, composite or a mixed array of these)
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired when a call to `Composite.remove` is made, after objects have been removed.
    *
    * @event afterRemove
    * @param {} event An event object
    * @param {} event.object The object(s) that have been removed (may be a single body, constraint, composite or a mixed array of these)
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /*
    *
    *  Properties Documentation
    *
    */

    /**
     * An integer `Number` uniquely identifying number generated in `Composite.create` by `Common.nextId`.
     *
     * @property id
     * @type number
     */

    /**
     * A `String` denoting the type of object.
     *
     * @property type
     * @type string
     * @default "composite"
     * @readOnly
     */

    /**
     * An arbitrary `String` name to help the user identify and manage composites.
     *
     * @property label
     * @type string
     * @default "Composite"
     */

    /**
     * A flag that specifies whether the composite has been modified during the current step.
     * This is automatically managed when bodies, constraints or composites are added or removed.
     *
     * @property isModified
     * @type boolean
     * @default false
     */

    /**
     * The `Composite` that is the parent of this composite. It is automatically managed by the `Matter.Composite` methods.
     *
     * @property parent
     * @type composite
     * @default null
     */

    /**
     * An array of `Body` that are _direct_ children of this composite.
     * To add or remove bodies you should use `Composite.add` and `Composite.remove` methods rather than directly modifying this property.
     * If you wish to recursively find all descendants, you should use the `Composite.allBodies` method.
     *
     * @property bodies
     * @type body[]
     * @default []
     */

    /**
     * An array of `Constraint` that are _direct_ children of this composite.
     * To add or remove constraints you should use `Composite.add` and `Composite.remove` methods rather than directly modifying this property.
     * If you wish to recursively find all descendants, you should use the `Composite.allConstraints` method.
     *
     * @property constraints
     * @type constraint[]
     * @default []
     */

    /**
     * An array of `Composite` that are _direct_ children of this composite.
     * To add or remove composites you should use `Composite.add` and `Composite.remove` methods rather than directly modifying this property.
     * If you wish to recursively find all descendants, you should use the `Composite.allComposites` method.
     *
     * @property composites
     * @type composite[]
     * @default []
     */

    /**
     * An object reserved for storing plugin-specific properties.
     *
     * @property plugin
     * @type {}
     */

    /**
     * An object used for storing cached results for performance reasons.
     * This is used internally only and is automatically managed.
     *
     * @private
     * @property cache
     * @type {}
     */

}) ();
