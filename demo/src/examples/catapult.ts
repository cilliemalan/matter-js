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
import * as Vector from "matter/Vector";



export const catapult = function() {

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
            showAngleIndicator: true,
            showCollisions: true,
            showVelocity: true
        }
    });

    Render.run(render);

    // create runner
    var runner = Runner.create();
    Runner.run(runner, engine);

    // add bodies
    var group = Body.nextGroup(true);

    var stack = Composites.stack(250, 255, 1, 6, 0, 0, function(x, y) {
        return Bodies.rectangle(x, y, 30, 30);
    });

    var catapult = Bodies.rectangle(400, 520, 320, 20, { collisionFilter: { group: group } });

    Composite.add(world, [
        stack,
        catapult,
        Bodies.rectangle(400, 600, 800, 50.5, { isStatic: true, render: { fillStyle: '#060a19' } }),
        Bodies.rectangle(250, 555, 20, 50, { isStatic: true, render: { fillStyle: '#060a19' } }),
        Bodies.rectangle(400, 535, 20, 80, { isStatic: true, collisionFilter: { group: group }, render: { fillStyle: '#060a19' } }),
        Bodies.circle(560, 100, 50, { density: 0.005 }),
        Constraint.create({ 
            bodyA: catapult, 
            pointB: Vector.clone(catapult.position),
            stiffness: 1,
            length: 0
        })
    ]);

    // add mouse control
    var mouse = Mouse.create(render.canvas),
        mouseConstraint = MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.2,
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
        stop: function() {
            Render.stop(render);
            Runner.stop(runner);
        }
    };
};

catapult.title = 'Catapult';
catapult.for = '>=0.14.2';
