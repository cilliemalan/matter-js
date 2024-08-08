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


export const avalanche = function() {
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
    var stack = Composites.stack(20, 20, 20, 5, 0, 0, function(x, y) {
        return Bodies.circle(x, y, Common.random(10, 20), { friction: 0.00001, restitution: 0.5, density: 0.001 });
    });

    Composite.add(world, stack);
    
    Composite.add(world, [
        Bodies.rectangle(200, 150, 700, 20, { isStatic: true, angle: Math.PI * 0.06, render: { fillStyle: '#060a19' } }),
        Bodies.rectangle(500, 350, 700, 20, { isStatic: true, angle: -Math.PI * 0.06, render: { fillStyle: '#060a19' } }),
        Bodies.rectangle(340, 580, 700, 20, { isStatic: true, angle: Math.PI * 0.04, render: { fillStyle: '#060a19' } })
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
    Render.lookAt(render, Composite.allBodies(world));

    // wrapping using matter-wrap plugin
    // for (var i = 0; i < stack.bodies.length; i += 1) {
    //     stack.bodies[i].plugin.wrap = {
    //         min: { x: render.bounds.min.x, y: render.bounds.min.y },
    //         max: { x: render.bounds.max.x, y: render.bounds.max.y }
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

avalanche.title = 'Avalanche';
avalanche.for = '>=0.14.2';
