import { Body, create as bodyCreate, translate as bodyTranslate, nextGroup as bodyNextGroup } from "../body/Body";
import { circle as bodiesCircle, rectangle as bodiesRectangle } from "./Bodies";
import { create as compositeCreate, addBody, Composite, addConstraint } from "../body/Composite";
import { Constraint, create as constraintCreate } from "../constraint/Constraint";
import { extend } from "../core/Common";

export type CreateBodyCallback = (x: number, y: number, column: number, row: number, lastBody: Body | undefined, i: number) => Body | undefined

/**
 * Create a new composite containing bodies created in the callback in a grid arrangement.
 * This function uses the body's bounds to prevent overlaps.
 */
export function stack(x: number, y: number, columns: number, rows: number, columnGap: number, rowGap: number, callback: CreateBodyCallback): Composite {
    let stack = compositeCreate({ label: 'Stack' });
    let currentX = x;
    let currentY = y;
    let lastBody;
    let i = 0;

    for (var row = 0; row < rows; row++) {
        var maxHeight = 0;

        for (var column = 0; column < columns; column++) {
            var body = callback(currentX, currentY, column, row, lastBody, i);

            if (body) {
                var bodyHeight = body.bounds.max.y - body.bounds.min.y,
                    bodyWidth = body.bounds.max.x - body.bounds.min.x;

                if (bodyHeight > maxHeight)
                    maxHeight = bodyHeight;

                bodyTranslate(body, { x: bodyWidth * 0.5, y: bodyHeight * 0.5 });

                currentX = body.bounds.max.x + columnGap;

                addBody(stack, body);

                lastBody = body;
                i += 1;
            } else {
                currentX += columnGap;
            }
        }

        currentY += maxHeight + rowGap;
        currentX = x;
    }

    return stack;
};

/**
 * Chains all bodies in the given composite together using constraints.
 */
export function chain(composite: Composite, xOffsetA: number, yOffsetA: number, xOffsetB: number, yOffsetB: number, options?: Partial<Constraint>) {
    var bodies = composite.bodies;

    for (var i = 1; i < bodies.length; i++) {
        var bodyA = bodies[i - 1],
            bodyB = bodies[i],
            bodyAHeight = bodyA.bounds.max.y - bodyA.bounds.min.y,
            bodyAWidth = bodyA.bounds.max.x - bodyA.bounds.min.x,
            bodyBHeight = bodyB.bounds.max.y - bodyB.bounds.min.y,
            bodyBWidth = bodyB.bounds.max.x - bodyB.bounds.min.x;

        var defaults: Partial<Constraint> = {
            bodyA: bodyA,
            pointA: { x: bodyAWidth * xOffsetA, y: bodyAHeight * yOffsetA },
            bodyB: bodyB,
            pointB: { x: bodyBWidth * xOffsetB, y: bodyBHeight * yOffsetB }
        };

        var constraint = extend(defaults, options);

        addConstraint(composite, constraintCreate(constraint));
    }

    composite.label += ' Chain';

    return composite;
};

/**
 * Connects bodies in the composite with constraints in a grid pattern, with optional cross braces.
 */
export function mesh(composite: Composite, columns: number, rows: number, crossBrace?: boolean, options?: Partial<Constraint>) {
    let bodies = composite.bodies;
    let row;
    let col;
    let bodyA;
    let bodyB;
    let bodyC;

    for (row = 0; row < rows; row++) {
        for (col = 1; col < columns; col++) {
            bodyA = bodies[(col - 1) + (row * columns)];
            bodyB = bodies[col + (row * columns)];
            addConstraint(composite, constraintCreate(extend({ bodyA: bodyA, bodyB: bodyB }, options)));
        }

        if (row > 0) {
            for (col = 0; col < columns; col++) {
                bodyA = bodies[col + ((row - 1) * columns)];
                bodyB = bodies[col + (row * columns)];
                addConstraint(composite, constraintCreate(extend({ bodyA: bodyA, bodyB: bodyB }, options)));

                if (crossBrace && col > 0) {
                    bodyC = bodies[(col - 1) + ((row - 1) * columns)];
                    addConstraint(composite, constraintCreate(extend({ bodyA: bodyC, bodyB: bodyB }, options)));
                }

                if (crossBrace && col < columns - 1) {
                    bodyC = bodies[(col + 1) + ((row - 1) * columns)];
                    addConstraint(composite, constraintCreate(extend({ bodyA: bodyC, bodyB: bodyB }, options)));
                }
            }
        }
    }

    composite.label += ' Mesh';

    return composite;
};

/**
 * Create a new composite containing bodies created in the callback in a pyramid arrangement.
 * This function uses the body's bounds to prevent overlaps.
 */
export function pyramid(x: number, y: number, columns: number, rows: number, columnGap: number, rowGap: number, callback: CreateBodyCallback) {
    return stack(x, y, columns, rows, columnGap, rowGap, function (stackX, stackY, column, row, lastBody, i) {
        let actualRows = Math.min(rows, Math.ceil(columns / 2));
        let lastBodyWidth = lastBody ? lastBody.bounds.max.x - lastBody.bounds.min.x : 0;

        if (row > actualRows) {
            return;
        }

        // reverse row order
        row = actualRows - row;

        var start = row,
            end = columns - 1 - row;

        if (column < start || column > end) {
            return;
        }

        // retroactively fix the first body's position, since width was unknown
        if (i === 1) {
            bodyTranslate(lastBody!, { x: (column + (columns % 2 === 1 ? 1 : -1)) * lastBodyWidth, y: 0 });
        }

        var xOffset = lastBody ? column * lastBodyWidth : 0;

        return callback(x + xOffset + column * columnGap, stackY, column, row, lastBody, i);
    });
};

/**
 * This has now moved to the [newtonsCradle example](https://github.com/liabru/matter-js/blob/master/examples/newtonsCradle.js), follow that instead as this function is deprecated here.
 */
export function newtonsCradle(x: number, y: number, number: number, size: number, length: number) {
    var newtonsCradle = compositeCreate({ label: 'Newtons Cradle' });

    for (var i = 0; i < number; i++) {
        var separation = 1.9,
            circle = bodiesCircle(x + i * (size * separation), y + length, size,
                { inertia: Infinity, restitution: 1, friction: 0, frictionAir: 0.0001, slop: 1 }),
            constraint = constraintCreate({ pointA: { x: x + i * (size * separation), y: y }, bodyB: circle });

        addBody(newtonsCradle, circle);
        addConstraint(newtonsCradle, constraint);
    }

    return newtonsCradle;
};

/**
 * This has now moved to the [car example](https://github.com/liabru/matter-js/blob/master/examples/car.js), follow that instead as this function is deprecated here.
 */
export function car(x: number, y: number, width: number, height: number, wheelSize: number) {
    let group = bodyNextGroup(true);
    let wheelBase = 20;
    let wheelAOffset = -width * 0.5 + wheelBase;
    let wheelBOffset = width * 0.5 - wheelBase;
    let wheelYOffset = 0;

    var car = compositeCreate({ label: 'Car' }),
        body = bodiesRectangle(x, y, width, height, {
            collisionFilter: {
                group: group,
                mask: 0,
                category: 0,
            },
            chamfer: {
                radius: height * 0.5
            },
            density: 0.0002
        });

    var wheelA = bodiesCircle(x + wheelAOffset, y + wheelYOffset, wheelSize, {
        collisionFilter: {
            group: group,
            mask: 0,
            category: 0,
        },
        friction: 0.8
    });

    var wheelB = bodiesCircle(x + wheelBOffset, y + wheelYOffset, wheelSize, {
        collisionFilter: {
            group: group,
            mask: 0,
            category: 0,
        },
        friction: 0.8
    });

    var axelA = constraintCreate({
        bodyB: body,
        pointB: { x: wheelAOffset, y: wheelYOffset },
        bodyA: wheelA,
        stiffness: 1,
        length: 0
    });

    var axelB = constraintCreate({
        bodyB: body,
        pointB: { x: wheelBOffset, y: wheelYOffset },
        bodyA: wheelB,
        stiffness: 1,
        length: 0
    });

    addBody(car, body);
    addBody(car, wheelA);
    addBody(car, wheelB);
    addConstraint(car, axelA);
    addConstraint(car, axelB);

    return car;
};

/**
 * This has now moved to the [softBody example](https://github.com/liabru/matter-js/blob/master/examples/softBody.js)
 * and the [cloth example](https://github.com/liabru/matter-js/blob/master/examples/cloth.js), follow those instead as this function is deprecated here.
 */
export function softBody(x: number, y: number, columns: number, rows: number,
    columnGap: number, rowGap: number, crossBrace: boolean, particleRadius: number,
    particleOptions: Partial<Body>, constraintOptions: Partial<Constraint>) {

    particleOptions = { inertia: Infinity, ...particleOptions };
    constraintOptions = {
        stiffness: 0.2,
        render: { type: 'line', anchors: false },
        ...constraintOptions
    }

    var softBody = stack(x, y, columns, rows, columnGap, rowGap, function (stackX, stackY) {
        return bodiesCircle(stackX, stackY, particleRadius, particleOptions);
    });

    mesh(softBody, columns, rows, crossBrace, constraintOptions);

    softBody.label = 'Soft Body';

    return softBody;
};
