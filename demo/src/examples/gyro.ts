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
var Example = Example || {};

Example.gyro = function() {
    var Engine = Matter.Engine,
        Render = Matter.Render,
        Runner = Matter.Runner,
        Composites = Matter.Composites,
        Common = Matter.Common,
        MouseConstraint = Matter.MouseConstraint,
        Mouse = Matter.Mouse,
        Composite = Matter.Composite,
        Bodies = Matter.Bodies;

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
    var stack = Composites.stack(20, 20, 10, 5, 0, 0, function(x, y) {
        var sides = Math.round(Common.random(1, 8));

        // round the edges of some bodies
        var chamfer = null;
        if (sides > 2 && Common.random() > 0.7) {
            chamfer = {
                radius: 10
            };
        }

        switch (Math.round(Common.random(0, 1))) {
        case 0:
            if (Common.random() < 0.8) {
                return Bodies.rectangle(x, y, Common.random(25, 50), Common.random(25, 50), { chamfer: chamfer });
            } else {
                return Bodies.rectangle(x, y, Common.random(80, 120), Common.random(25, 30), { chamfer: chamfer });
            }
        case 1:
            return Bodies.polygon(x, y, sides, Common.random(25, 50), { chamfer: chamfer });
        }
    });

    Composite.add(world, [
        stack,
        Bodies.rectangle(400, 0, 800, 50, { isStatic: true }),
        Bodies.rectangle(400, 600, 800, 50, { isStatic: true }),
        Bodies.rectangle(800, 300, 50, 600, { isStatic: true }),
        Bodies.rectangle(0, 300, 50, 600, { isStatic: true })
    ]);

    // add gyro control
    if (typeof window !== 'undefined') {
        var updateGravity = function(event) {
            var orientation = typeof window.orientation !== 'undefined' ? window.orientation : 0,
                gravity = engine.gravity;

            if (orientation === 0) {
                gravity.x = Common.clamp(event.gamma, -90, 90) / 90;
                gravity.y = Common.clamp(event.beta, -90, 90) / 90;
            } else if (orientation === 180) {
                gravity.x = Common.clamp(event.gamma, -90, 90) / 90;
                gravity.y = Common.clamp(-event.beta, -90, 90) / 90;
            } else if (orientation === 90) {
                gravity.x = Common.clamp(event.beta, -90, 90) / 90;
                gravity.y = Common.clamp(-event.gamma, -90, 90) / 90;
            } else if (orientation === -90) {
                gravity.x = Common.clamp(-event.beta, -90, 90) / 90;
                gravity.y = Common.clamp(event.gamma, -90, 90) / 90;
            }
        };

        window.addEventListener('deviceorientation', updateGravity);
    }

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
            Matter.Render.stop(render);
            Matter.Runner.stop(runner);
            if (typeof window !== 'undefined') {
                window.removeEventListener('deviceorientation', updateGravity);
            }
        }
    };
};

Example.gyro.title = 'Gyroscope';
Example.gyro.for = '>=0.14.2';

if (typeof module !== 'undefined') {
    module.exports = Example.gyro;
}
