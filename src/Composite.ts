import { Constraint, ConstraintRenderOptions } from './Constraint';
import { ChildObject, CompositeBase, extend, indexOf, nextId, ObjectType, warn } from './Common'
import { trigger } from './Events';
import { type Body, translate as bodyTranslate, setPosition as bodySetPosition, rotate as bodyRotate, scale as bodyScale } from './Body';
import { MouseConstraint } from './MouseConstraint';
import { Vector } from './Vector';
import { Bounds, create as boundsCreate } from './Bounds';

interface CompositeCache {
    allBodies?: Array<Body>;
    allConstraints?: Array<Constraint>;
    allComposites?: Array<Composite>;
}

export interface Composite extends CompositeBase {
    /** An integer `Number` uniquely identifying number generated in `Composite.create` by `Common.nextId`. */
    id: number,
    /** A `String` denoting the type of object. */
    type: 'composite',
    /** An arbitrary `String` name to help the user identify and manage composites. */
    label: string,
    /** The `Composite` that is the parent of this composite. It is automatically managed by the `Matter.Composite` methods. */
    parent?: Composite,
    /**
     * A flag that specifies whether the composite has been modified during the current step.
     * This is automatically managed when bodies, constraints or composites are added or removed.
     */
    isModified: boolean,
    /**
     * An array of `Body` that are _direct_ children of this composite.
     * To add or remove bodies you should use `Composite.add` and `Composite.remove` methods rather than directly modifying this property.
     * If you wish to recursively find all descendants, you should use the `Composite.allBodies` method.
     */
    bodies: Array<Body>,
    /**
     * An array of `Constraint` that are _direct_ children of this composite.
     * To add or remove constraints you should use `Composite.add` and `Composite.remove` methods rather than directly modifying this property.
     * If you wish to recursively find all descendants, you should use the `Composite.allConstraints` method.
     */
    constraints: Array<Constraint>,
    /**
     * An array of `Composite` that are _direct_ children of this composite.
     * To add or remove composites you should use `Composite.add` and `Composite.remove` methods rather than directly modifying this property.
     * If you wish to recursively find all descendants, you should use the `Composite.allComposites` method.
     */
    composites: Array<Composite>,
    /**
     * An object used for storing cached results for performance reasons.
     * This is used internally only and is automatically managed.
     */
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
        parent: undefined,
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
                addConstraint(composite, (obj as MouseConstraint).constraint);
                break;

        }
    }

    trigger(composite, 'afterAdd', { object });

    return composite;
};

/**
 * Generic remove function. Removes one or many body(s), constraint(s) or a composite(s) to the given composite.
 * Optionally searching its children recursively.
 * Triggers `beforeRemove` and `afterRemove` events on the `composite`.
 */
export function remove(composite: Composite, object: ChildObject | ChildObject[], deep: boolean = false) {
    const objects = object instanceof Array ? object : [object];

    trigger(composite, 'beforeRemove', { object: object });

    for (var i = 0; i < objects.length; i++) {
        var obj = objects[i];

        switch (obj.type) {

            case 'body':
                removeBody(composite, obj as Body, deep);
                break;
            case 'constraint':
                removeConstraint(composite, obj as Constraint, deep);
                break;
            case 'composite':
                removeComposite(composite, obj as Composite, deep);
                break;
            case 'mouseConstraint':
                removeConstraint(composite, (obj as MouseConstraint).constraint);
                break;

        }
    }

    trigger(composite, 'afterRemove', { object: object });

    return composite;
};

/**
 * Adds a composite to the given composite.
 */
export function addComposite(compositeA: Composite, compositeB: Composite) {
    compositeA.composites.push(compositeB);
    compositeB.parent = compositeA;
    setModified(compositeA, true, true, false);
    return compositeA;
};

/**
 * Removes a composite from the given composite, and optionally searching its children recursively.
 */
export function removeComposite(compositeA: Composite, compositeB: Composite, deep: boolean = false) {
    var position = indexOf(compositeA.composites, compositeB);

    if (position !== -1) {
        var bodies = allBodies(compositeB);

        removeCompositeAt(compositeA, position);

        for (var i = 0; i < bodies.length; i++) {
            bodies[i].sleepCounter = 0;
        }
    }

    if (deep) {
        for (var i = 0; i < compositeA.composites.length; i++) {
            removeComposite(compositeA.composites[i], compositeB, true);
        }
    }

    return compositeA;
};

/**
 * Removes a composite from the given composite.
 */
export function removeCompositeAt(composite: Composite, position: number) {
    composite.composites.splice(position, 1);
    setModified(composite, true, true, false);
    return composite;
};

/**
 * Adds a body to the given composite.
 */
export function addBody(composite: Composite, body: Body) {
    composite.bodies.push(body);
    setModified(composite, true, true, false);
    return composite;
};

/**
 * Removes a body from the given composite, and optionally searching its children recursively.
 */
export function removeBody(composite: Composite, body: Body, deep = false) {
    var position = indexOf(composite.bodies, body);

    if (position !== -1) {
        removeBodyAt(composite, position);
        body.sleepCounter = 0;
    }

    if (deep) {
        for (var i = 0; i < composite.composites.length; i++) {
            removeBody(composite.composites[i], body, true);
        }
    }

    return composite;
};

/**
 * Removes a body from the given composite.
 */
export function removeBodyAt(composite: Composite, position: number) {
    composite.bodies.splice(position, 1);
    setModified(composite, true, true, false);
    return composite;
};

/**
 * Adds a constraint to the given composite.
 */
export function addConstraint(composite: Composite, constraint: Constraint) {
    composite.constraints.push(constraint);
    setModified(composite, true, true, false);
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
export function removeConstraint(composite: Composite, constraint: Constraint, deep = false) {
    var position = indexOf(composite.constraints, constraint);

    if (position !== -1) {
        removeConstraintAt(composite, position);
    }

    if (deep) {
        for (var i = 0; i < composite.composites.length; i++) {
            removeConstraint(composite.composites[i], constraint, true);
        }
    }

    return composite;
};

/**
 * Removes a body from the given composite.
 */
export function removeConstraintAt(composite: Composite, position: number) {
    composite.constraints.splice(position, 1);
    setModified(composite, true, true, false);
    return composite;
};

/**
 * Removes all bodies, constraints and composites from the given composite.
 * Optionally clearing its children recursively.
 */
export function clear(composite: Composite, keepStatic: boolean, deep = false) {
    if (deep) {
        for (var i = 0; i < composite.composites.length; i++) {
            clear(composite.composites[i], keepStatic, true);
        }
    }

    if (keepStatic) {
        composite.bodies = composite.bodies.filter(function (body) { return body.isStatic; });
    } else {
        composite.bodies.length = 0;
    }

    composite.constraints.length = 0;
    composite.composites.length = 0;

    setModified(composite, true, true, false);

    return composite;
};

/**
 * Returns all bodies in the given composite, including all bodies in its children, recursively.
 */
export function allBodies(composite: Composite): Body[] {
    if (composite.cache && composite.cache.allBodies) {
        return composite.cache.allBodies;
    }

    var bodies = [...composite.bodies];

    for (var i = 0; i < composite.composites.length; i++) {
        bodies = [...allBodies(composite.composites[i])]
    }

    if (composite.cache) {
        composite.cache.allBodies = bodies;
    }

    return bodies;
};

/**
 * Returns all constraints in the given composite, including all constraints in its children, recursively.
 */
export function allConstraints(composite: Composite) {
    if (composite.cache && composite.cache.allConstraints) {
        return composite.cache.allConstraints;
    }

    var constraints = [...composite.constraints];

    for (var i = 0; i < composite.composites.length; i++)
        constraints = constraints.concat(allConstraints(composite.composites[i]));

    if (composite.cache) {
        composite.cache.allConstraints = constraints;
    }

    return constraints;
};

/**
 * Returns all composites in the given composite, including all composites in its children, recursively.
 */
export function allComposites(composite: Composite): Composite[] {
    if (composite.cache && composite.cache.allComposites) {
        return composite.cache.allComposites;
    }

    var composites = [...composite.composites];

    for (var i = 0; i < composite.composites.length; i++)
        composites = composites.concat(allComposites(composite.composites[i]));

    if (composite.cache) {
        composite.cache.allComposites = composites;
    }

    return composites;
};

/**
 * Searches the composite recursively for an object matching the type and id supplied, null if not found.
 */
export function get(composite: Composite, id: number, type: ObjectType) {
    var objects,
        object;

    switch (type) {
        case 'body':
            objects = allBodies(composite);
            break;
        case 'constraint':
            objects = allConstraints(composite);
            break;
        case 'composite':
            objects = allComposites(composite).concat(composite);
            break;
    }

    if (!objects || !objects.length) {
        return undefined;
    }

    for (let i = 0; i < objects.length; i++) {
        if (objects[i].id === id) {
            return objects[i];
        }
    }

    return undefined;
};

/**
 * Moves the given object(s) from compositeA to compositeB (equal to a remove followed by an add).
 */
export function move(compositeA: Composite, objects: ChildObject[], compositeB: Composite) {
    remove(compositeA, objects);
    add(compositeB, objects);
    return compositeA;
};

/**
 * Assigns new ids for all objects in the composite, recursively.
 */
export function rebase(composite: Composite) {
    var objects = [...allBodies(composite),
    ...allConstraints(composite),
    ...allComposites(composite)];

    for (var i = 0; i < objects.length; i++) {
        objects[i].id = nextId();
    }

    return composite;
};

/**
 * Translates all children in the composite by a given vector relative to their current positions, 
 * without imparting any velocity.
 */
export function translate(composite: Composite, translation: Vector, recursive = true) {
    var bodies = recursive ? allBodies(composite) : composite.bodies;

    for (var i = 0; i < bodies.length; i++) {
        bodyTranslate(bodies[i], translation);
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
export function rotate(composite: Composite, rotation: number, point: Vector, recursive = true) {
    let cos = Math.cos(rotation);
    let sin = Math.sin(rotation);
    let bodies = recursive ? allBodies(composite) : composite.bodies;

    for (var i = 0; i < bodies.length; i++) {
        var body = bodies[i],
            dx = body.position.x - point.x,
            dy = body.position.y - point.y;

        bodySetPosition(body, {
            x: point.x + (dx * cos - dy * sin),
            y: point.y + (dx * sin + dy * cos)
        });

        bodyRotate(body, rotation);
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
export function scale(composite: Composite, scaleX: number, scaleY: number, point: Vector, recursive = true) {
    var bodies = recursive ? allBodies(composite) : composite.bodies;

    for (var i = 0; i < bodies.length; i++) {
        var body = bodies[i],
            dx = body.position.x - point.x,
            dy = body.position.y - point.y;

        bodySetPosition(body, {
            x: point.x + dx * scaleX,
            y: point.y + dy * scaleY
        });

        bodyScale(body, scaleX, scaleY);
    }

    return composite;
};

/**
 * Returns the union of the bounds of all of the composite's bodies.
 */
export function bounds(composite: Composite): Bounds {
    var bodies = allBodies(composite),
        vertices = [];

    for (var i = 0; i < bodies.length; i += 1) {
        var body = bodies[i];
        vertices.push(body.bounds.min, body.bounds.max);
    }

    return boundsCreate(vertices);
};
