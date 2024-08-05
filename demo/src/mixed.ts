import { create as engineCreate } from '../../src/Engine'
import { create as renderCreate, RenderOptions, run as renderRun, lookAt as renderLookAt, LookAtParm, stop as renderStop } from '../../src/Render'
import { create as runnerCreate, run as runnerRun, stop as runnerStop } from '../../src/Runner'
import { stack as compositesStack } from '../../src/Composites'
import { add as compositeAdd } from '../../src/Composite';
import { random } from '../../src/Common';
import { polygon, rectangle } from '../../src/Bodies';
import { create as mouseCreate } from '../../src/Mouse'
import { create as mouseConstraintCreate } from '../../src/MouseConstraint'

export default function () {

    // create engine
    let engine = engineCreate();
    let world = engine.world;

    const renderOptions = {
        width: 800,
        height: 600,
        showAngleIndicator: true,
    } as unknown as RenderOptions;

    engine.timing.timeScale = 0.1;

    // create renderer
    let render = renderCreate({
        element: document.body,
        engine: engine,
        options: renderOptions
    });

    renderRun(render);

    // create runner
    var runner = runnerCreate();
    runnerRun(runner, engine);

    // add bodies
    var stack = compositesStack(20, 20, 10, 5, 0, 0, function (x, y) {
        var sides = Math.round(random(1, 8));

        // round the edges of some bodies
        var chamfer = undefined;
        if (sides > 2 && random() > 0.7) {
            chamfer = {
                radius: 10
            };
        }

        switch (Math.round(random(0, 1))) {
            case 0:
                if (random() < 0.8) {
                    return rectangle(x, y, random(25, 50), random(25, 50), { chamfer: chamfer });
                } else {
                    return rectangle(x, y, random(80, 120), random(25, 30), { chamfer: chamfer });
                }
            case 1:
                return polygon(x, y, sides, random(25, 50), { chamfer: chamfer });
        }
    });

    compositeAdd(world, [
        // walls
        rectangle(400, 0, 800, 50, { isStatic: true }),
        rectangle(400, 600, 800, 50, { isStatic: true }),
        rectangle(800, 300, 50, 600, { isStatic: true }),
        rectangle(0, 300, 50, 600, { isStatic: true })
    ]);

    compositeAdd(world, stack);

    // add mouse control
    var mouse = mouseCreate(render.canvas),
        mouseConstraint = mouseConstraintCreate(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.2,
                render: {
                    visible: false
                }
            } as unknown as any
        });

    compositeAdd(world, mouseConstraint);

    // keep the mouse in sync with rendering
    render.mouse = mouse;

    // fit the render viewport to the scene
    renderLookAt(render, <LookAtParm>{
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
            renderStop(render);
            runnerStop(runner);
        }
    };
}
