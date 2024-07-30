import { nextId, choose, sign, _baseDelta, ObjectBase } from "../core/Common";
import { Vector, VectorAngle, add, create as cv, div, magnitude, mult, normalise, rotateAbout, rotate as rotateVector, sub } from "../geometry/Vector";
import { Vertex, rotate as rotateVertices, create as createVertices, area, centre, translate as translateVertices, inertia, clockwiseSort, hull, scale as scaleVertices } from "../geometry/Vertices";
import { Bounds, create as createBounds, update as updateBounds } from "../geometry/Bounds";
import { rotate as rotateAxes, fromVertices as AxesfromVertices } from '../geometry/Axes'
import { set as setSleeping } from "../core/Sleeping";

export interface CollisionFilter {
    category: number;
    mask: number;
    group: number;
}

export interface SpriteInformation {
    xScale: number;
    yScale: number;
    xOffset: number;
    yOffset: number;
}

export interface RenderOptions {
    visible: boolean;
    opacity: number;
    strokeStyle: unknown;
    fillStyle: unknown;
    lineWidth: unknown;
    sprite: SpriteInformation;
}

export interface BodyBase {
    restitution: number;
    friction: number;
    mass: number;
    inverseMass: number;
    inertia: number;
    inverseInertia: number;
    density: number;
}

export interface Body extends BodyBase, ObjectBase {
    /** The id for this body*/
    id: number;
    /** The type of thing this is */
    type: "body";
    /** The label for the type of thing this is */
    label: "Body";
    /** 
     * _Read only_. Use `Body.setParts` to set. 
     * 
     * See `Bodies.fromVertices` for a related utility.
     * 
     * An array of bodies (the 'parts') that make up this body (the 'parent'). The first body in this array must always be a self-reference to this `body`.  
     * 
     * The parts are fixed together and therefore perform as a single unified rigid body.
     * 
     * Parts in relation to each other are allowed to overlap, as well as form gaps or holes, so can be used to create complex concave bodies unlike when using a single part. 
     * 
     * Use properties and functions on the parent `body` rather than on parts.
     *   
     * Outside of their geometry, most properties on parts are not considered or updated.  
     * As such 'per-part' material properties among others are not currently considered.
     * 
     * Parts should be created specifically for their parent body.  
     * Parts should not be shared or reused between bodies, only one parent is supported.  
     * Parts should not have their own parts, they are not handled recursively.  
     * Parts should not be added to the world directly or any other composite.  
     * Parts own vertices must be convex and in clockwise order.   
     * 
     * A body with more than one part is sometimes referred to as a 'compound' body. 
     * 
     * Use `Body.setParts` when setting parts to ensure correct updates of all properties. 
     */
    parts: Array<Body>;
    /** A `Number` specifying the angle of the body, in radians. */
    angle: number;
    /** _Read only_. Use `Body.setVertices` or `Body.setParts` to set. See also `Bodies.fromVertices`.
     * 
     * An array of `Vector` objects that specify the convex hull of the rigid body.
     * These should be provided about the origin `(0, 0)`. E.g.
     *
     * `[{ x: 0, y: 0 }, { x: 25, y: 50 }, { x: 50, y: 0 }]`
     * 
     * Vertices must always be convex, in clockwise order and must not contain any duplicate points.
     * 
     * Concave vertices should be decomposed into convex `parts`, see `Bodies.fromVertices` and `Body.setParts`.
     *
     * When set the vertices are translated such that `body.position` is at the centre of mass.
     * Many other body properties are automatically calculated from these vertices when set including `density`, `area` and `inertia`.
     * 
     * The module `Matter.Vertices` contains useful methods for working with vertices. */
    vertices: Vector[];
    position: Vector;
    force: Vector;
    torque: number;
    positionImpulse: Vector;
    constraintImpulse: VectorAngle;
    totalContacts: number;
    speed: number;
    angularSpeed: number;
    velocity: Vector;
    angularVelocity: number;
    isSensor: boolean;
    isStatic: boolean;
    isSleeping: boolean;
    sleepCounter: number;
    motion: number;
    sleepThreshold: number;
    frictionStatic: number;
    frictionAir: number;
    collisionFilter: CollisionFilter;
    slop: number;
    timeScale: number;
    render: RenderOptions,
    events: unknown,
    bounds: Bounds,
    chamfer: unknown,
    circleRadius?: number,
    positionPrev: Vector,
    anglePrev: number,
    parent?: Body,
    axes: Vector[],
    area: number;
    deltaTime: number;
    _original?: BodyBase;
}

let _timeCorrection = true;
let _inertiaScale = 4;
let _nextCollidingGroupId = 1;
let _nextNonCollidingGroupId = -1;
let _nextCategory = 0x0001;

const defaults: Body = {
    id: nextId(),
    type: 'body',
    label: 'Body',
    parts: [],
    angle: 0,
    vertices: [cv(0, 0), cv(40, 0), cv(40, 40), cv(0, 40)],
    position: { x: 0, y: 0 },
    force: { x: 0, y: 0 },
    torque: 0,
    positionImpulse: { x: 0, y: 0 },
    constraintImpulse: { x: 0, y: 0, angle: 0 },
    totalContacts: 0,
    speed: 0,
    angularSpeed: 0,
    velocity: { x: 0, y: 0 },
    angularVelocity: 0,
    isSensor: false,
    isStatic: false,
    isSleeping: false,
    sleepCounter: 0,
    motion: 0,
    sleepThreshold: 60,
    density: 0.001,
    restitution: 0,
    friction: 0.1,
    frictionStatic: 0.5,
    frictionAir: 0.01,
    collisionFilter: {
        category: 0x0001,
        mask: 0xFFFFFFFF,
        group: 0
    },
    slop: 0.05,
    timeScale: 1,
    render: {
        visible: true,
        opacity: 1,
        strokeStyle: undefined,
        fillStyle: undefined,
        lineWidth: undefined,
        sprite: {
            xScale: 1,
            yScale: 1,
            xOffset: 0,
            yOffset: 0
        }
    },
    events: undefined,
    bounds: { min: { x: 0, y: 0 }, max: { x: 40, y: 40 } },
    chamfer: undefined,
    circleRadius: 0,
    positionPrev: { x: 0, y: 0 },
    anglePrev: 0,
    parent: undefined,
    axes: [],
    area: 0,
    mass: 0,
    inverseMass: 0,
    inertia: 0,
    inverseInertia: 0,
    deltaTime: 1000 / 60,
    _original: undefined,
};

/**
 * Creates a new rigid body model. The options parameter is an object that specifies any properties you wish to override the defaults.
 * All properties have default values, and many are pre-calculated automatically based on other properties.
 * Vertices must be specified in clockwise order.
 * See the properties section below for detailed information on what you can pass via the `options` object.
 * @method create
 * @param {} options
 * @return {body} body
 */

export function create(base?: Partial<Body>) {

    const body = { ...defaults, ...base };

    _initProperties(body, base);

    return body;
};

/**
 * Returns the next unique group index for which bodies will collide.
 * If `isNonColliding` is `true`, returns the next unique group index for which bodies will _not_ collide.
 * See `body.collisionFilter` for more information.
 */
export function nextGroup(isNonColliding: boolean) {
    if (isNonColliding)
        return _nextNonCollidingGroupId--;

    return _nextCollidingGroupId++;
};

/**
 * Returns the next unique category bitfield (starting after the initial default category `0x0001`).
 * There are 32 available. See `body.collisionFilter` for more information.
 */
export function nextCategory() {
    _nextCategory = _nextCategory << 1;
    return _nextCategory;
};

/**
 * Initialises body properties.
 * @method _initProperties
 */
function _initProperties(body: Body, options?: Partial<Body>) {
    options ??= {};

    // init required properties (order is important)
    set(body, {
        bounds: body.bounds ?? createBounds(body.vertices),
        positionPrev: body.positionPrev ?? { ...body.position },
        anglePrev: body.anglePrev ?? body.angle,
        vertices: body.vertices,
        parts: body.parts ?? [body],
        isStatic: body.isStatic,
        isSleeping: body.isSleeping,
        parent: body.parent ?? body
    });

    rotateVertices(body.vertices, body.angle, body.position);
    rotateAxes(body.axes, body.angle);
    updateBounds(body.bounds, body.vertices, body.velocity);

    // allow options to override the automatically calculated properties
    set(body, {
        axes: options.axes || body.axes,
        area: options.area || body.area,
        mass: options.mass || body.mass,
        inertia: options.inertia || body.inertia
    });

    // render properties
    var defaultFillStyle = (body.isStatic ? '#14151f' : choose(['#f19648', '#f5d259', '#f55a3c', '#063e7b', '#ececd1'])),
        defaultStrokeStyle = body.isStatic ? '#555' : '#ccc',
        defaultLineWidth = body.isStatic && body.render.fillStyle === null ? 1 : 0;
    body.render.fillStyle = body.render.fillStyle || defaultFillStyle;
    body.render.strokeStyle = body.render.strokeStyle || defaultStrokeStyle;
    body.render.lineWidth = body.render.lineWidth || defaultLineWidth;
    body.render.sprite.xOffset += -(body.bounds.min.x - body.position.x) / (body.bounds.max.x - body.bounds.min.x);
    body.render.sprite.yOffset += -(body.bounds.min.y - body.position.y) / (body.bounds.max.y - body.bounds.min.y);
};

/**
 * Given a property and a value (or map of), sets the property(s) on the body, using the appropriate setter functions if they exist.
 * Prefer to use the actual setter functions in performance critical situations.
 * @method set
 * @param {body} body
 * @param {} settings A property name (or map of properties and values) to set on the body.
 * @param {} value The value to set if `settings` is a single property name.
 */
export function set(body: Body, settings: Partial<Body>): void;
export function set(body: Body, setting: keyof Body, value: any): void;
export function set(body: Body, settings: keyof Body | Partial<Body>, value?: any): void {

    if (typeof settings === 'string') {
        settings = { [settings]: value };
    }

    let property: keyof Body;
    for (property in settings) {
        if (!Object.prototype.hasOwnProperty.call(settings, property)) {
            continue;
        }

        value = settings[property];
        switch (property) {

            // case 'isStatic':
            //     Body.setStatic(body, value);
            //     break;
            // case 'isSleeping':
            //     setSleeping(body, value);
            //     break;
            // case 'mass':
            //     Body.setMass(body, value);
            //     break;
            // case 'density':
            //     Body.setDensity(body, value);
            //     break;
            // case 'inertia':
            //     Body.setInertia(body, value);
            //     break;
            // case 'vertices':
            //     Body.setVertices(body, value);
            //     break;
            // case 'position':
            //     Body.setPosition(body, value);
            //     break;
            // case 'angle':
            //     Body.setAngle(body, value);
            //     break;
            // case 'velocity':
            //     Body.setVelocity(body, value);
            //     break;
            // case 'angularVelocity':
            //     Body.setAngularVelocity(body, value);
            //     break;
            // case 'speed':
            //     Body.setSpeed(body, value);
            //     break;
            // case 'angularSpeed':
            //     Body.setAngularSpeed(body, value);
            //     break;
            // case 'parts':
            //     Body.setParts(body, value);
            //     break;
            // case 'centre':
            //     Body.setCentre(body, value);
            //     break;
            default:
                (body[property] as any) = value;

        }
    }
};


/**
 * Sets the body as static, including isStatic flag and setting mass and inertia to Infinity.
 */
export function setStatic(body: Body, isStatic: boolean) {
    for (var i = 0; i < body.parts.length; i++) {
        var part = body.parts[i];

        if (isStatic) {
            if (!part.isStatic) {
                part._original = {
                    restitution: part.restitution,
                    friction: part.friction,
                    mass: part.mass,
                    inertia: part.inertia,
                    density: part.density,
                    inverseMass: part.inverseMass,
                    inverseInertia: part.inverseInertia
                };
            }

            part.restitution = 0;
            part.friction = 1;
            part.mass = part.inertia = part.density = Infinity;
            part.inverseMass = part.inverseInertia = 0;

            part.positionPrev.x = part.position.x;
            part.positionPrev.y = part.position.y;
            part.anglePrev = part.angle;
            part.angularVelocity = 0;
            part.speed = 0;
            part.angularSpeed = 0;
            part.motion = 0;
        } else if (part._original) {
            part.restitution = part._original.restitution;
            part.friction = part._original.friction;
            part.mass = part._original.mass;
            part.inertia = part._original.inertia;
            part.density = part._original.density;
            part.inverseMass = part._original.inverseMass;
            part.inverseInertia = part._original.inverseInertia;

            part._original = undefined;
        }

        part.isStatic = isStatic;
    }
};

/**
 * Sets the mass of the body. Inverse mass, density and inertia are automatically updated to reflect the change.
 */
export function setMass(body: Body, mass: number) {
    var moment = body.inertia / (body.mass / 6);
    body.inertia = moment * (mass / 6);
    body.inverseInertia = 1 / body.inertia;
    body.mass = mass;
    body.inverseMass = 1 / body.mass;
    body.density = body.mass / body.area;
};

/**
 * Sets the density of the body. Mass and inertia are automatically updated to reflect the change.
 */
export function setDensity(body: Body, density: number) {
    setMass(body, density * body.area);
    body.density = density;
};

/**
 * Sets the moment of inertia of the body. This is the second moment of area in two dimensions.
 * Inverse inertia is automatically updated to reflect the change. Mass is not changed.
 */
export function setInertia(body: Body, inertia: number) {
    body.inertia = inertia;
    body.inverseInertia = 1 / body.inertia;
};

/**
 * Sets the body's vertices and updates body properties accordingly, including inertia, area and mass (with respect to `body.density`).
 * Vertices will be automatically transformed to be orientated around their centre of mass as the origin.
 * They are then automatically translated to world space based on `body.position`.
 *
 * The `vertices` argument should be passed as an array of `Matter.Vector` points (or a `Matter.Vertices` array).
 * Vertices must form a convex hull. Concave vertices must be decomposed into convex parts.
 */
export function setVertices(body: Body, vertices: Vector[]): void;
export function setVertices(body: Body, vertices: Vertex[]): void;
export function setVertices(body: Body, vertices: Vertex[] | Vector[]): void {
    // change vertices
    if ((vertices as Vertex[])[0].body === body) {
        body.vertices = vertices;
    } else {
        body.vertices = createVertices(vertices, body);
    }

    // update properties
    body.axes = AxesfromVertices(body.vertices);
    body.area = area(body.vertices);
    setMass(body, body.density * body.area);

    // orient vertices around the centre of mass at origin (0, 0)
    var c = centre(body.vertices);
    translateVertices(body.vertices, c, -1);

    // update inertia while vertices are at origin (0, 0)
    setInertia(body, _inertiaScale * inertia(body.vertices, body.mass));

    // update geometry
    translateVertices(body.vertices, body.position);
    updateBounds(body.bounds, body.vertices, body.velocity);
};

/**
 * Sets the parts of the `body`. 
 * 
 * See `body.parts` for details and requirements on how parts are used.
 * 
 * See Bodies.fromVertices for a related utility.
 * 
 * This function updates `body` mass, inertia and centroid based on the parts geometry.  
 * Sets each `part.parent` to be this `body`.  
 * 
 * The convex hull is computed and set on this `body` (unless `autoHull` is `false`).  
 * Automatically ensures that the first part in `body.parts` is the `body`.
 */
export function setParts(body: Body, parts: Body[], autoHull?: boolean) {
    autoHull ??= true;

    // add all the parts, ensuring that the first part is always the parent body
    parts = parts.slice(0);
    body.parts.length = 0;
    body.parts.push(body);
    body.parent = body;

    for (let i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (part !== body) {
            part.parent = body;
            body.parts.push(part);
        }
    }

    if (body.parts.length === 1)
        return;

    autoHull = typeof autoHull !== 'undefined' ? autoHull : true;

    // find the convex hull of all parts to set on the parent body
    if (autoHull) {
        var vertices = new Array<Vector>()
        for (let i = 0; i < parts.length; i++) {
            vertices = vertices.concat(parts[i].vertices);
        }

        clockwiseSort(vertices);

        const h = hull(vertices);
        const hullCentre = centre(h);

        setVertices(body, h);
        translateVertices(body.vertices, hullCentre);
    }

    // sum the properties of all compound parts of the parent body
    var total = _totalProperties(body);

    body.area = total.area;
    body.parent = body;
    body.position.x = total.centre.x;
    body.position.y = total.centre.y;
    body.positionPrev.x = total.centre.x;
    body.positionPrev.y = total.centre.y;

    setMass(body, total.mass);
    setInertia(body, total.inertia);
    setPosition(body, total.centre);
};

/**
 * Set the centre of mass of the body. 
 * The `centre` is a vector in world-space unless `relative` is set, in which case it is a translation.
 * The centre of mass is the point the body rotates about and can be used to simulate non-uniform density.
 * This is equal to moving `body.position` but not the `body.vertices`.
 * Invalid if the `centre` falls outside the body's convex hull.
 */
export function setCentre(body: Body, centre: Vector, relative?: boolean) {
    if (relative) {
        body.positionPrev.x += centre.x;
        body.positionPrev.y += centre.y;
        body.position.x += centre.x;
        body.position.y += centre.y;
    } else {
        body.positionPrev.x = centre.x - (body.position.x - body.positionPrev.x);
        body.positionPrev.y = centre.y - (body.position.y - body.positionPrev.y);
        body.position.x = centre.x;
        body.position.y = centre.y;
    }
};

/**
 * Sets the position of the body. By default velocity is unchanged.
 * If `updateVelocity` is `true` then velocity is inferred from the change in position.
 */
export function setPosition(body: Body, position: Vector, updateVelocity?: boolean) {
    var delta = sub(position, body.position);

    if (updateVelocity) {
        body.positionPrev.x = body.position.x;
        body.positionPrev.y = body.position.y;
        body.velocity.x = delta.x;
        body.velocity.y = delta.y;
        body.speed = magnitude(delta);
    } else {
        body.positionPrev.x += delta.x;
        body.positionPrev.y += delta.y;
    }

    for (var i = 0; i < body.parts.length; i++) {
        var part = body.parts[i];
        part.position.x += delta.x;
        part.position.y += delta.y;
        translateVertices(part.vertices, delta);
        updateBounds(part.bounds, part.vertices, body.velocity);
    }
};

/**
 * Sets the angle of the body. By default angular velocity is unchanged.
 * If `updateVelocity` is `true` then angular velocity is inferred from the change in angle.
 */
export function setAngle(body: Body, angle: number, updateVelocity?: boolean) {
    var delta = angle - body.angle;

    if (updateVelocity) {
        body.anglePrev = body.angle;
        body.angularVelocity = delta;
        body.angularSpeed = Math.abs(delta);
    } else {
        body.anglePrev += delta;
    }

    for (var i = 0; i < body.parts.length; i++) {
        var part = body.parts[i];
        part.angle += delta;
        rotateVertices(part.vertices, delta, body.position);
        rotateAxes(part.axes, delta);
        updateBounds(part.bounds, part.vertices, body.velocity);
        if (i > 0) {
            rotateAbout(part.position, delta, body.position, part.position);
        }
    }
};

/**
 * Sets the current linear velocity of the body.  
 * Affects body speed.
 */
export function setVelocity(body: Body, velocity: Vector) {
    var timeScale = body.deltaTime / _baseDelta;
    body.positionPrev.x = body.position.x - velocity.x * timeScale;
    body.positionPrev.y = body.position.y - velocity.y * timeScale;
    body.velocity.x = (body.position.x - body.positionPrev.x) / timeScale;
    body.velocity.y = (body.position.y - body.positionPrev.y) / timeScale;
    body.speed = magnitude(body.velocity);
};

/**
 * Gets the current linear velocity of the body.
 */
export function getVelocity(body: Body) {
    var timeScale = _baseDelta / body.deltaTime;

    return {
        x: (body.position.x - body.positionPrev.x) * timeScale,
        y: (body.position.y - body.positionPrev.y) * timeScale
    };
};

/**
 * Gets the current linear speed of the body.  
 * Equivalent to the magnitude of its velocity.
 */
export function getSpeed(body: Body) {
    return magnitude(getVelocity(body));
};

/**
 * Sets the current linear speed of the body.  
 * Direction is maintained. Affects body velocity.
 */
export function setSpeed(body: Body, speed: number) {
    setVelocity(body, mult(normalise(getVelocity(body)), speed));
};

/**
 * Sets the current rotational velocity of the body.  
 * Affects body angular speed.
 */
export function setAngularVelocity(body: Body, velocity: number) {
    var timeScale = body.deltaTime / _baseDelta;
    body.anglePrev = body.angle - velocity * timeScale;
    body.angularVelocity = (body.angle - body.anglePrev) / timeScale;
    body.angularSpeed = Math.abs(body.angularVelocity);
};

/**
 * Gets the current rotational velocity of the body.
 */
export function getAngularVelocity(body: Body) {
    return (body.angle - body.anglePrev) * _baseDelta / body.deltaTime;
};

/**
 * Gets the current rotational speed of the body.  
 * Equivalent to the magnitude of its angular velocity.
 */
export function getAngularSpeed(body: Body) {
    return Math.abs(getAngularVelocity(body));
};

/**
 * Sets the current rotational speed of the body.  
 * Direction is maintained. Affects body angular velocity.
 */
export function setAngularSpeed(body: Body, speed: number) {
    setAngularVelocity(body, sign(getAngularVelocity(body)) * speed);
};

/**
 * Moves a body by a given vector relative to its current position. By default velocity is unchanged.
 * If `updateVelocity` is `true` then velocity is inferred from the change in position.
 */
export function translate(body: Body, translation: Vector, updateVelocity?: boolean) {
    setPosition(body, add(body.position, translation), updateVelocity);
};

/**
 * Rotates a body by a given angle relative to its current angle. By default angular velocity is unchanged.
 * If `updateVelocity` is `true` then angular velocity is inferred from the change in angle.
 * @method rotate
 * @param {body} body
 * @param {number} rotation
 * @param {Vector} [point]
 * @param {boolean} [updateVelocity=false]
 */
export function rotate(body: Body, rotation: number, point?: Vector, updateVelocity?: boolean) {
    if (!point) {
        setAngle(body, body.angle + rotation, updateVelocity);
    } else {
        var cos = Math.cos(rotation),
            sin = Math.sin(rotation),
            dx = body.position.x - point.x,
            dy = body.position.y - point.y;

        setPosition(body, {
            x: point.x + (dx * cos - dy * sin),
            y: point.y + (dx * sin + dy * cos)
        }, updateVelocity);

        setAngle(body, body.angle + rotation, updateVelocity);
    }
};

/**
 * Scales the body, including updating physical properties (mass, area, axes, inertia), from a world-space point (default is body centre).
 * @method scale
 * @param {body} body
 * @param {number} scaleX
 * @param {number} scaleY
 * @param {Vector} [point]
 */
export function scale(body: Body, scaleX: number, scaleY: number, point?: Vector) {
    var totalArea = 0,
        totalInertia = 0;

    point ??= body.position;

    for (var i = 0; i < body.parts.length; i++) {
        var part = body.parts[i];

        // scale vertices
        scaleVertices(part.vertices, scaleX, scaleY, point);

        // update properties
        part.axes = AxesfromVertices(part.vertices);
        part.area = area(part.vertices);
        setMass(part, body.density * part.area);

        // update inertia (requires vertices to be at origin)
        translateVertices(part.vertices, { x: -part.position.x, y: -part.position.y });
        setInertia(part, _inertiaScale * inertia(part.vertices, part.mass));
        translateVertices(part.vertices, { x: part.position.x, y: part.position.y });

        if (i > 0) {
            totalArea += part.area;
            totalInertia += part.inertia;
        }

        // scale position
        part.position.x = point.x + (part.position.x - point.x) * scaleX;
        part.position.y = point.y + (part.position.y - point.y) * scaleY;

        // update bounds
        updateBounds(part.bounds, part.vertices, body.velocity);
    }

    // handle parent body
    if (body.parts.length > 1) {
        body.area = totalArea;

        if (!body.isStatic) {
            setMass(body, body.density * totalArea);
            setInertia(body, totalInertia);
        }
    }

    // handle circles
    if (body.circleRadius) {
        if (scaleX === scaleY) {
            body.circleRadius *= scaleX;
        } else {
            // body is no longer a circle
            body.circleRadius = undefined;
        }
    }
};

/**
 * Performs an update by integrating the equations of motion on the `body`.
 * This is applied every update by `Matter.Engine` automatically.
 * @method update
 * @param {body} body
 * @param {number} [deltaTime=16.666]
 */
export function update(body: Body, deltaTime: number) {
    deltaTime = (typeof deltaTime !== 'undefined' ? deltaTime : (1000 / 60)) * body.timeScale;

    var deltaTimeSquared = deltaTime * deltaTime,
        correction = _timeCorrection ? deltaTime / (body.deltaTime || deltaTime) : 1;

    // from the previous step
    var frictionAir = 1 - body.frictionAir * (deltaTime / _baseDelta),
        velocityPrevX = (body.position.x - body.positionPrev.x) * correction,
        velocityPrevY = (body.position.y - body.positionPrev.y) * correction;

    // update velocity with Verlet integration
    body.velocity.x = (velocityPrevX * frictionAir) + (body.force.x / body.mass) * deltaTimeSquared;
    body.velocity.y = (velocityPrevY * frictionAir) + (body.force.y / body.mass) * deltaTimeSquared;

    body.positionPrev.x = body.position.x;
    body.positionPrev.y = body.position.y;
    body.position.x += body.velocity.x;
    body.position.y += body.velocity.y;
    body.deltaTime = deltaTime;

    // update angular velocity with Verlet integration
    body.angularVelocity = ((body.angle - body.anglePrev) * frictionAir * correction) + (body.torque / body.inertia) * deltaTimeSquared;
    body.anglePrev = body.angle;
    body.angle += body.angularVelocity;

    // transform the body geometry
    for (var i = 0; i < body.parts.length; i++) {
        var part = body.parts[i];

        translateVertices(part.vertices, body.velocity);

        if (i > 0) {
            part.position.x += body.velocity.x;
            part.position.y += body.velocity.y;
        }

        if (body.angularVelocity !== 0) {
            rotateVertices(part.vertices, body.angularVelocity, body.position);
            rotateAxes(part.axes, body.angularVelocity);
            if (i > 0) {
                rotateAbout(part.position, body.angularVelocity, body.position, part.position);
            }
        }

        updateBounds(part.bounds, part.vertices, body.velocity);
    }
};

/**
 * Updates properties `body.velocity`, `body.speed`, `body.angularVelocity` and `body.angularSpeed` which are normalised in relation to `Body._baseDelta`.
 * @method updateVelocities
 * @param {body} body
 */
export function updateVelocities(body: Body) {
    var timeScale = _baseDelta / body.deltaTime,
        bodyVelocity = body.velocity;

    bodyVelocity.x = (body.position.x - body.positionPrev.x) * timeScale;
    bodyVelocity.y = (body.position.y - body.positionPrev.y) * timeScale;
    body.speed = Math.sqrt((bodyVelocity.x * bodyVelocity.x) + (bodyVelocity.y * bodyVelocity.y));

    body.angularVelocity = (body.angle - body.anglePrev) * timeScale;
    body.angularSpeed = Math.abs(body.angularVelocity);
};

/**
 * Applies the `force` to the `body` from the force origin `position` in world-space, over a single timestep, including applying any resulting angular torque.
 * 
 * Forces are useful for effects like gravity, wind or rocket thrust, but can be difficult in practice when precise control is needed. In these cases see `Body.setVelocity` and `Body.setPosition` as an alternative.
 * 
 * The force from this function is only applied once for the duration of a single timestep, in other words the duration depends directly on the current engine update `delta` and the rate of calls to this function.
 * 
 * Therefore to account for time, you should apply the force constantly over as many engine updates as equivalent to the intended duration.
 * 
 * If all or part of the force duration is some fraction of a timestep, first multiply the force by `duration / timestep`.
 * 
 * The force origin `position` in world-space must also be specified. Passing `body.position` will result in zero angular effect as the force origin would be at the centre of mass.
 * 
 * The `body` will take time to accelerate under a force, the resulting effect depends on duration of the force, the body mass and other forces on the body including friction combined.
 * @method applyForce
 * @param {body} body
 * @param {Vector} position The force origin in world-space. Pass `body.position` to avoid angular torque.
 * @param {Vector} force
 */
export function applyForce(body: Body, position: Vector, force: Vector) {
    var offset = { x: position.x - body.position.x, y: position.y - body.position.y };
    body.force.x += force.x;
    body.force.y += force.y;
    body.torque += offset.x * force.y - offset.y * force.x;
};

/**
 * Returns the sums of the properties of all compound parts of the parent body.
 * @method _totalProperties
 * @private
 * @param {body} body
 * @return {}
 */
export function _totalProperties(body: Body) {
    // from equations at:
    // https://ecourses.ou.edu/cgi-bin/ebook.cgi?doc=&topic=st&chap_sec=07.2&page=theory
    // http://output.to/sideway/default.asp?qno=121100087

    var properties = {
        mass: 0,
        area: 0,
        inertia: 0,
        centre: { x: 0, y: 0 }
    };

    // sum the properties of all compound parts of the parent body
    for (var i = body.parts.length === 1 ? 0 : 1; i < body.parts.length; i++) {
        var part = body.parts[i],
            mass = part.mass !== Infinity ? part.mass : 1;

        properties.mass += mass;
        properties.area += part.area;
        properties.inertia += part.inertia;
        properties.centre = add(properties.centre, mult(part.position, mass));
    }

    properties.centre = div(properties.centre, properties.mass);

    return properties;
};