import * as Engine from "matter/Engine";
import * as Render from "matter/Render";
import * as Runner from "matter/Runner";
import * as Composites from 'matter/Composites';
import * as Common from 'matter/Common';
import * as MouseConstraint from 'matter/MouseConstraint';
import * as Mouse from 'matter/Mouse';
import * as Composite from 'matter/Composite';
import * as Bodies from 'matter/Bodies';
import { Example } from './_common'



export const ballPool = function() {
    // TODO: matter-wrap

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
    Composite.add(world, [
        Bodies.rectangle(400, 600, 1200, 50.5, { isStatic: true, render: { fillStyle: '#060a19' } })
    ]);

    var stack = Composites.stack(100, 0, 10, 8, 10, 10, function(x, y) {
        return Bodies.circle(x, y, Common.random(15, 30), { restitution: 0.6, friction: 0.1 });
    });
    
    Composite.add(world, [
        stack,
        Bodies.polygon(200, 460, 3, 60),
        Bodies.polygon(400, 460, 5, 60),
        Bodies.rectangle(600, 460, 80, 80)
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

    // wrapping using matter-wrap plugin
    var allBodies = Composite.allBodies(world);

    // for (var i = 0; i < allBodies.length; i += 1) {
    //     allBodies[i].plugin.wrap = {
    //         min: { x: render.bounds.min.x - 100, y: render.bounds.min.y },
    //         max: { x: render.bounds.max.x + 100, y: render.bounds.max.y }
    //     };
    // }

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

ballPool.title = 'Ball Pool';
ballPool.for = '>=0.14.2';
