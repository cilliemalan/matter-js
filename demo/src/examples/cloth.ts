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



export const cloth = function() {

    // create engine
    var engine = Engine.create(),
        world = engine.world;

    // create renderer
    var render = Render.create({
        element: document.body,
        engine: engine,
        options: {
            width: 800,
            height: 600
        }
    });

    Render.run(render);

    // create runner
    var runner = Runner.create();
    Runner.run(runner, engine);

    // see cloth function defined later in this file
    var cloth = createCloth(200, 200, 20, 12, 5, 5, false, 8);

    for (var i = 0; i < 20; i++) {
        cloth.bodies[i].isStatic = true;
    }

    Composite.add(world, [
        cloth,
        Bodies.circle(300, 500, 80, { isStatic: true, render: { fillStyle: '#060a19' }}),
        Bodies.rectangle(500, 480, 80, 80, { isStatic: true, render: { fillStyle: '#060a19' }}),
        Bodies.rectangle(400, 609, 800, 50, { isStatic: true })
    ]);

    // add mouse control
    var mouse = Mouse.create(render.canvas),
        mouseConstraint = MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.98,
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

cloth.title = 'Cloth';
cloth.for = '>=0.14.2';

/**
* Creates a simple cloth like object.
*/
const createCloth = function(xx: number, yy: number, columns: number, rows: number, columnGap: number, rowGap: number, crossBrace: boolean, particleRadius: number, particleOptions: any, constraintOptions: any) {

    var group = Body.nextGroup(true);
    particleOptions = Common.extend({ inertia: Infinity, friction: 0.00001, collisionFilter: { group: group }, render: { visible: false }}, particleOptions);
    constraintOptions = Common.extend({ stiffness: 0.06, render: { type: 'line', anchors: false } }, constraintOptions);

    var cloth = Composites.stack(xx, yy, columns, rows, columnGap, rowGap, function(x, y) {
        return Bodies.circle(x, y, particleRadius, particleOptions);
    });

    Composites.mesh(cloth, columns, rows, crossBrace, constraintOptions);

    cloth.label = 'Cloth Body';

    return cloth;
};
