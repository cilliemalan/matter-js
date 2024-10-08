import * as Bodies from 'matter/Bodies';
import * as Body from 'matter/Body';
import * as Common from 'matter/Common';
import * as Composite from 'matter/Composite';
import * as Composites from 'matter/Composites';
import * as Constraint from 'matter/Constraint';
import * as Engine from "matter/Engine";
import * as Mouse from 'matter/Mouse';
import * as MouseConstraint from 'matter/MouseConstraint';
import * as Render from "matter/Render";
import * as Runner from "matter/Runner";



export const bridge = function () {

    // create engine
    var engine = Engine.create(),
        world = engine.world;

    // create renderer
    var render = Render.create({
        element: document.body,
        engine: engine,
        options: {
            width: 800,
            height: 600,
            showAngleIndicator: true
        }
    });

    Render.run(render);

    // create runner
    var runner = Runner.create();
    Runner.run(runner, engine);

    // add bodies
    var group = Body.nextGroup(true);

    var bridge = Composites.stack(160, 290, 15, 1, 0, 0, function (x, y) {
        return Bodies.rectangle(x - 20, y, 53, 20, {
            collisionFilter: { group: group },
            chamfer: 5,
            density: 0.005,
            frictionAir: 0.05,
            render: {
                fillStyle: '#060a19'
            }
        });
    });

    Composites.chain(bridge, 0.3, 0, -0.3, 0, {
        stiffness: 0.99,
        length: 0.0001,
        render: {
            visible: false
        }
    });

    var stack = Composites.stack(250, 50, 6, 3, 0, 0, function (x, y) {
        return Bodies.rectangle(x, y, 50, 50);
    });

    Composite.add(world, [
        bridge,
        stack,
        Bodies.rectangle(30, 490, 220, 380, {
            isStatic: true,
            chamfer: { radius: 20 }
        }),
        Bodies.rectangle(770, 490, 220, 380, {
            isStatic: true,
            chamfer: { radius: 20 }
        }),
        Constraint.create({
            pointA: { x: 140, y: 300 },
            bodyB: bridge.bodies[0],
            pointB: { x: -25, y: 0 },
            length: 2,
            stiffness: 0.9
        }),
        Constraint.create({
            pointA: { x: 660, y: 300 },
            bodyB: bridge.bodies[bridge.bodies.length - 1],
            pointB: { x: 25, y: 0 },
            length: 2,
            stiffness: 0.9
        })
    ]);

    // add mouse control
    var mouse = Mouse.create(render.canvas),
        mouseConstraint = MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.1,
                render: {
                    visible: false
                }
            }
        });

    Composite.add(world, mouseConstraint);

    // keep the mouse in sync with rendering
    render.mouse = mouse;

    // fit the render viewport to the scene
    Render.lookAt(render, {
        min: { x: 0, y: 0 },
        max: { x: 800, y: 600 }
    });

    // context for MatterTools.Demo
    return {
        engine: engine,
        runner: runner,
        render: render,
        canvas: render.canvas,
        stop: function () {
            Render.stop(render);
            Runner.stop(runner);
        }
    };
};

bridge.title = 'Bridge';
bridge.for = '>=0.14.2';
