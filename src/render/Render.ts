
// var Body = require('../body/Body');
// var Common = require('../core/Common');
// var Composite = require('../body/Composite');
// var Bounds = require('../geometry/Bounds');
// var Events = require('../core/Events');
// var Vector = require('../geometry/Vector');
// var Mouse = require('../core/Mouse');

import { Mouse, setOffset as mouseSetOffset, setScale as mouseSetScale } from "../core/Mouse";
import { Bounds, overlaps as boundsOverlaps, contains as boundsContains } from "../geometry/Bounds";
import { add, normalise, perp, sub, Vector } from "../geometry/Vector";
import { Engine } from "../core/Engine";
import { clamp, extend } from "../core/Common";
import { allBodies, allComposites, allConstraints } from "../body/Composite";
import { trigger } from "../core/Events";
import { Constraint } from "../constraint/Constraint";
import { Body, getVelocity as bodyGetVelocity } from "../body/Body";
import { Pair } from "../collision/Pair";
import { Vertex } from "../geometry/Vertices";

export interface Render {
    /** A reference to the `Matter.Engine` instance to be used. */
    engine: Engine,
    /** A reference to the element where the canvas is to be inserted (if `render.canvas` has not been specified) */
    element: HTMLElement,
    /** The canvas element to render to. If not specified, one will be created if `render.element` has been specified. */
    canvas: HTMLCanvasElement,
    /** The 2d rendering context from the `render.canvas` element. */
    context: CanvasRenderingContext2D,
    /**
     * A `Bounds` object that specifies the drawing view region.
     * Rendering will be automatically transformed and scaled to fit within the canvas size (`render.options.width` and `render.options.height`).
     * This allows for creating views that can pan or zoom around the scene.
     * You must also set `render.options.hasBounds` to `true` to enable bounded rendering.
     */
    bounds: Bounds,
    /** The mouse to render if `render.options.showMousePosition` is enabled. */
    mouse?: Mouse,
    frameRequestId: number,
    /** The sprite texture cache. */
    textures: Record<string, HTMLImageElement>,

    timing: RenderTiming;
    /** The configuration options of the renderer. */
    options: RenderOptions;
    currentBackground?: string;
}

export interface RenderTiming {
    historySize: number;
    delta: number;
    deltaHistory: Array<number>;
    lastTime: number;
    lastTimestamp: number;
    lastElapsed: number;
    timestampElapsed: number;
    timestampElapsedHistory: Array<number>;
    engineDeltaHistory: Array<number>;
    engineElapsedHistory: Array<number>;
    engineUpdatesHistory: Array<number>;
    elapsedHistory: Array<number>;
}

export interface RenderOptions {
    /**
     * The target width in pixels of the `render.canvas` to be created.
     * See also the `options.pixelRatio` property to change render quality.
     */
    width: number;

    /**
     * The target height in pixels of the `render.canvas` to be created.
     * See also the `options.pixelRatio` property to change render quality.
     */
    height: number;

    /** The [pixel ratio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio) to use when rendering. */
    pixelRatio: number;

    /**
     * A CSS background color string to use when `render.options.wireframes` is disabled.
     * This may be also set to `'transparent'` or equivalent.
     */
    background: string;
    /**
     * A CSS color string to use for background when `render.options.wireframes` is enabled.
     * This may be also set to `'transparent'` or equivalent.
     */
    wireframeBackground: string;
    /**
     * A CSS color string to use for stroke when `render.options.wireframes` is enabled.
     * This may be also set to `'transparent'` or equivalent.
     */
    wireframeStrokeStyle: string;
    /** A flag that specifies if `render.bounds` should be used when rendering. */
    hasBounds?: boolean;
    /** A flag to enable or disable rendering entirely. */
    enabled?: boolean;
    /** A flag to toggle wireframe rendering otherwise solid fill rendering is used. */
    wireframes?: boolean;
    /**  A flag to enable or disable sleeping bodies indicators. */
    showSleeping?: boolean;
    /**
     * A flag to enable or disable all debug information overlays together.  
     * This includes and has priority over the values of:
     *
     * - `render.options.showStats`
     * - `render.options.showPerformance`
     */
    showDebug?: boolean;
    /**
     * A flag to enable or disable the engine stats info overlay.  
     * From left to right, the values shown are:
     *
     * - body parts total
     * - body total
     * - constraints total
     * - composites total
     * - collision pairs total
     */
    showStats?: boolean;
    /**
     * A flag to enable or disable performance charts.  
     * From left to right, the values shown are:
     *
     * - average render frequency (e.g. 60 fps)
     * - exact engine delta time used for last update (e.g. 16.66ms)
     * - average updates per frame (e.g. 1)
     * - average engine execution duration (e.g. 5.00ms)
     * - average render execution duration (e.g. 0.40ms)
     * - average effective play speed (e.g. '1.00x' is 'real-time')
     *
     * Each value is recorded over a fixed sample of past frames (60 frames).
     *
     * A chart shown below each value indicates the variance from the average over the sample.
     * The more stable or fixed the value is the flatter the chart will appear.
     */
    showPerformance?: boolean;
    /** A flag to enable or disable the body bounds debug overlay. */
    showBounds?: boolean;
    /** A flag to enable or disable the body velocity debug overlay. */
    showVelocity?: boolean;
    /** A flag to enable or disable the body collisions debug overlay. */
    showCollisions?: boolean;
    /** A flag to enable or disable the collision resolver separations debug overlay. */
    showSeparations?: boolean;
    /** A flag to enable or disable the body axes debug overlay. */
    showAxes?: boolean;
    /** A flag to enable or disable the body positions debug overlay. */
    showPositions?: boolean;
    /**  A flag to enable or disable the body angle debug overlay. */
    showAngleIndicator?: boolean;
    /** A flag to enable or disable the body and part ids debug overlay. */
    showIds?: boolean;
    /** A flag to enable or disable the body vertex numbers debug overlay. */
    showVertexNumbers?: boolean;
    /** A flag to enable or disable the body convex hulls debug overlay. */
    showConvexHulls?: boolean;
    /** A flag to enable or disable the body internal edges debug overlay. */
    showInternalEdges?: boolean;
    /** A flag to enable or disable the mouse position debug overlay. */
    showMousePosition?: boolean;
}

export interface RenderConfigurationOptions extends Partial<Render> {
    bounds?: any;
}

const _goodFps = 30;
const _goodDelta = 1000 / 60;

/**
 * Creates a new renderer. The options parameter is an object that specifies any properties you wish to override the defaults.
 * All properties have default values, and many are pre-calculated automatically based on other properties.
 * See the properties section below for detailed information on what you can pass via the `options` object.
 * @method create
 * @param {object} [options]
 * @return {render} A new renderer
 */
export function create(options: RenderConfigurationOptions): Render {
    var defaults: Render = {
        engine: undefined!,
        element: undefined!,
        canvas: undefined!,
        context: undefined!,
        mouse: undefined,
        bounds: undefined!,
        textures: undefined!,
        frameRequestId: null!,
        timing: {
            historySize: 60,
            delta: 0,
            deltaHistory: [],
            lastTime: 0,
            lastTimestamp: 0,
            lastElapsed: 0,
            timestampElapsed: 0,
            timestampElapsedHistory: [],
            engineDeltaHistory: [],
            engineElapsedHistory: [],
            engineUpdatesHistory: [],
            elapsedHistory: []
        },
        options: {
            width: 800,
            height: 600,
            pixelRatio: 1,
            background: '#14151f',
            wireframeBackground: '#14151f',
            wireframeStrokeStyle: '#bbb',
            hasBounds: !!options.bounds,
            enabled: true,
            wireframes: true,
            showSleeping: true,
            showDebug: false,
            showStats: false,
            showPerformance: false,
            showBounds: false,
            showVelocity: false,
            showCollisions: false,
            showSeparations: false,
            showAxes: false,
            showPositions: false,
            showAngleIndicator: false,
            showIds: false,
            showVertexNumbers: false,
            showConvexHulls: false,
            showInternalEdges: false,
            showMousePosition: false
        }
    };

    const render = extend(defaults, options);

    if (render.canvas) {
        render.canvas.width = render.options.width || render.canvas.width;
        render.canvas.height = render.options.height || render.canvas.height;
    }

    if (!options.engine) {
        throw new Error("Engine not specified");
    }

    render.mouse = options.mouse;
    render.engine = options.engine;
    render.canvas = render.canvas || _createCanvas(render.options.width, render.options.height);
    const ctx = render.canvas.getContext('2d');
    if (!ctx) {
        throw new Error("Could not create rendering context");
    }
    render.context = ctx;

    render.bounds = render.bounds || {
        min: {
            x: 0,
            y: 0
        },
        max: {
            x: render.canvas.width,
            y: render.canvas.height
        }
    };

    if (render.options.pixelRatio !== 1) {
        setPixelRatio(render, render.options.pixelRatio);
    }

    if (render.element instanceof HTMLElement) {
        render.element.appendChild(render.canvas);
    }

    render.textures = {};
    return render;
};

/**
 * Continuously updates the render canvas on the `requestAnimationFrame` event.
 */
export function run(render: Render) {

    function loop(time: DOMHighResTimeStamp) {
        render.frameRequestId = requestAnimationFrame(loop);

        _updateTiming(render, time);

        world(render, time);

        render.context.setTransform(render.options.pixelRatio, 0, 0, render.options.pixelRatio, 0, 0);

        if (render.options.showStats || render.options.showDebug) {
            stats(render, render.context, time);
        }

        if (render.options.showPerformance || render.options.showDebug) {
            performance(render, render.context);
        }

        render.context.setTransform(1, 0, 0, 1, 0, 0);
    }

    render.frameRequestId = requestAnimationFrame(loop);
};

/**
 * Ends execution of `Render.run` on the given `render`, by canceling the animation frame request event loop.
 */
export function stop(render: Render) {
    cancelAnimationFrame(render.frameRequestId);
};

/**
 * Sets the pixel ratio of the renderer and updates the canvas.
 * To automatically detect the correct ratio, pass the string `'auto'` for `pixelRatio`.
 */
export function setPixelRatio(render: Render, pixelRatio: number | 'auto') {
    const options = render.options;
    const canvas = render.canvas;

    if (pixelRatio === 'auto') {
        pixelRatio = _getPixelRatio(canvas);
    }

    options.pixelRatio = pixelRatio;
    canvas.setAttribute('data-pixel-ratio', pixelRatio.toString());
    canvas.width = options.width * pixelRatio;
    canvas.height = options.height * pixelRatio;
    canvas.style.width = options.width + 'px';
    canvas.style.height = options.height + 'px';
};

/**
 * Sets the render `width` and `height`.
 * 
 * Updates the canvas accounting for `render.options.pixelRatio`.  
 * 
 * Updates the bottom right render bound `render.bounds.max` relative to the provided `width` and `height`.
 * The top left render bound `render.bounds.min` isn't changed.
 * 
 * Follow this call with `Render.lookAt` if you need to change the render bounds.
 * 
 * See also `Render.setPixelRatio`.
 * @method setSize
 */
export function setSize(render: Render, width: number, height: number) {
    render.options.width = width;
    render.options.height = height;
    render.bounds.max.x = render.bounds.min.x + width;
    render.bounds.max.y = render.bounds.min.y + height;

    if (render.options.pixelRatio !== 1) {
        setPixelRatio(render, render.options.pixelRatio);
    } else {
        render.canvas.width = width;
        render.canvas.height = height;
    }
};

declare type LookAtParm = { bounds: Bounds } | { position: Vector } | { min: number, max: number } | { x: number, y: number };
/**
 * Positions and sizes the viewport around the given object bounds.
 * Objects must have at least one of the following properties:
 * - `object.bounds`
 * - `object.position`
 * - `object.min` and `object.max`
 * - `object.x` and `object.y`
 */
export function lookAt(render: Render,
    objects: LookAtParm | LookAtParm[],
    padding?: Vector,
    center: boolean = true) {

    if (!(objects instanceof Array)) {
        objects = [objects];
    }

    padding = padding ?? { x: 0, y: 0 };

    // find bounds of all objects
    var bounds = {
        min: { x: Infinity, y: Infinity },
        max: { x: -Infinity, y: -Infinity }
    };

    for (let i = 0; i < objects.length; i += 1) {
        const object: any = objects[i];
        const min = object.bounds ? object.bounds.min : (object.min ?? object.position ?? object);
        const max = object.bounds ? object.bounds.max : (object.max ?? object.position ?? object);

        if (min && max) {
            if (min.x < bounds.min.x)
                bounds.min.x = min.x;

            if (max.x > bounds.max.x)
                bounds.max.x = max.x;

            if (min.y < bounds.min.y)
                bounds.min.y = min.y;

            if (max.y > bounds.max.y)
                bounds.max.y = max.y;
        }
    }

    // find ratios
    var width = (bounds.max.x - bounds.min.x) + 2 * padding.x,
        height = (bounds.max.y - bounds.min.y) + 2 * padding.y,
        viewHeight = render.canvas.height,
        viewWidth = render.canvas.width,
        outerRatio = viewWidth / viewHeight,
        innerRatio = width / height,
        scaleX = 1,
        scaleY = 1;

    // find scale factor
    if (innerRatio > outerRatio) {
        scaleY = innerRatio / outerRatio;
    } else {
        scaleX = outerRatio / innerRatio;
    }

    // enable bounds
    render.options.hasBounds = true;

    // position and size
    render.bounds.min.x = bounds.min.x;
    render.bounds.max.x = bounds.min.x + width * scaleX;
    render.bounds.min.y = bounds.min.y;
    render.bounds.max.y = bounds.min.y + height * scaleY;

    // center
    if (center) {
        render.bounds.min.x += width * 0.5 - (width * scaleX) * 0.5;
        render.bounds.max.x += width * 0.5 - (width * scaleX) * 0.5;
        render.bounds.min.y += height * 0.5 - (height * scaleY) * 0.5;
        render.bounds.max.y += height * 0.5 - (height * scaleY) * 0.5;
    }

    // padding
    render.bounds.min.x -= padding.x;
    render.bounds.max.x -= padding.x;
    render.bounds.min.y -= padding.y;
    render.bounds.max.y -= padding.y;

    // update mouse
    if (render.mouse) {
        mouseSetScale(render.mouse, {
            x: (render.bounds.max.x - render.bounds.min.x) / render.canvas.width,
            y: (render.bounds.max.y - render.bounds.min.y) / render.canvas.height
        });

        mouseSetOffset(render.mouse, render.bounds.min);
    }
};

/**
 * Applies viewport transforms based on `render.bounds` to a render context.
 */
export function startViewTransform(render: Render) {
    var boundsWidth = render.bounds.max.x - render.bounds.min.x,
        boundsHeight = render.bounds.max.y - render.bounds.min.y,
        boundsScaleX = boundsWidth / render.options.width,
        boundsScaleY = boundsHeight / render.options.height;

    render.context.setTransform(
        render.options.pixelRatio / boundsScaleX, 0, 0,
        render.options.pixelRatio / boundsScaleY, 0, 0
    );

    render.context.translate(-render.bounds.min.x, -render.bounds.min.y);
};

/**
 * Resets all transforms on the render context.
 */
export function endViewTransform(render: Render) {
    render.context.setTransform(render.options.pixelRatio, 0, 0, render.options.pixelRatio, 0, 0);
};

/**
 * Renders the given `engine`'s `Matter.World` object.
 * This is the entry point for all rendering and should be called every time the scene changes.
 * @method world
 * @param {render} render
 */
export function world(render: Render, time: DOMHighResTimeStamp) {
    let startTime = globalThis.performance.now();
    let engine = render.engine;
    let world = engine.world;
    let canvas = render.canvas;
    let context = render.context;
    let options = render.options;
    let timing = render.timing;

    let _bodies = allBodies(world);
    let _constraints = allConstraints(world);
    let background = options.wireframes ? options.wireframeBackground : options.background;
    let bodies: Body[] = [];
    let constraints: Constraint[] = [];
    let i;

    var event = {
        timestamp: engine.timing.timestamp
    };

    trigger(render, 'beforeRender', event);

    // apply background if it has changed
    if (render.currentBackground !== background)
        _applyBackground(render, background);

    // clear the canvas with a transparent fill, to allow the canvas background to show
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = "transparent";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = 'source-over';

    // handle bounds
    if (options.hasBounds) {
        // filter out bodies that are not in view
        for (i = 0; i < allBodies.length; i++) {
            var body = _bodies[i];
            if (boundsOverlaps(body.bounds, render.bounds)) {
                bodies.push(body);
            }
        }

        // filter out constraints that are not in view
        for (i = 0; i < allConstraints.length; i++) {
            var constraint = _constraints[i],
                bodyA = constraint.bodyA,
                bodyB = constraint.bodyB,
                pointAWorld = constraint.pointA,
                pointBWorld = constraint.pointB;

            if (bodyA) pointAWorld = add(bodyA.position, constraint.pointA!);
            if (bodyB) pointBWorld = add(bodyB.position, constraint.pointB!);

            if (!pointAWorld || !pointBWorld)
                continue;

            if (boundsContains(render.bounds, pointAWorld) || boundsContains(render.bounds, pointBWorld)) {
                constraints.push(constraint);
            }
        }

        // transform the view
        startViewTransform(render);

        // update mouse
        if (render.mouse) {
            mouseSetScale(render.mouse, {
                x: (render.bounds.max.x - render.bounds.min.x) / render.options.width,
                y: (render.bounds.max.y - render.bounds.min.y) / render.options.height
            });

            mouseSetOffset(render.mouse, render.bounds.min);
        }
    } else {
        constraints = _constraints;
        bodies = _bodies;

        if (render.options.pixelRatio !== 1) {
            render.context.setTransform(render.options.pixelRatio, 0, 0, render.options.pixelRatio, 0, 0);
        }
    }

    if (!options.wireframes || (engine.enableSleeping && options.showSleeping)) {
        // fully featured rendering of bodies
        renderBodies(render, bodies, context);
    } else {
        if (options.showConvexHulls)
            bodyConvexHulls(render, bodies, context);

        // optimised method for wireframes only
        bodyWireframes(render, bodies, context);
    }

    if (options.showBounds)
        bodyBounds(render, bodies, context);

    if (options.showAxes || options.showAngleIndicator)
        bodyAxes(render, bodies, context);

    if (options.showPositions)
        bodyPositions(render, bodies, context);

    if (options.showVelocity)
        bodyVelocity(render, bodies, context);

    if (options.showIds)
        bodyIds(render, bodies, context);

    if (options.showSeparations)
        separations(render, engine.pairs.list, context);

    if (options.showCollisions)
        collisions(render, engine.pairs.list, context);

    if (options.showVertexNumbers)
        vertexNumbers(render, bodies, context);

    if (options.showMousePosition && render.mouse)
        mousePosition(render, render.mouse, context);

    renderConstraints(constraints, context);

    if (options.hasBounds) {
        // revert view transforms
        endViewTransform(render);
    }

    trigger(render, 'afterRender', event);

    // log the time elapsed computing this update
    timing.lastElapsed = globalThis.performance.now() - startTime;
};

/**
 * Renders statistics about the engine and world useful for debugging.
 */
export function stats(render: Render, context: CanvasRenderingContext2D, time: number) {
    let engine = render.engine;
    let world = engine.world;
    let bodies = allBodies(world);
    let parts = 0;
    let width = 55;
    let height = 44;
    let x = 0;
    let y = 0;

    // count parts
    for (var i = 0; i < bodies.length; i += 1) {
        parts += bodies[i].parts.length;
    }

    // sections
    var sections: Record<string, number> = {
        'Part': parts,
        'Body': bodies.length,
        'Cons': allConstraints(world).length,
        'Comp': allComposites(world).length,
        'Pair': engine.pairs.list.length
    };

    // background
    context.fillStyle = '#0e0f19';
    context.fillRect(x, y, width * 5.5, height);

    context.font = '12px Arial';
    context.textBaseline = 'top';
    context.textAlign = 'right';

    // sections
    for (var key in sections) {
        var section = sections[key].toString();

        // label
        context.fillStyle = '#aaa';
        context.fillText(key, x + width, y + 8);

        // value
        context.fillStyle = '#eee';
        context.fillText(section, x + width, y + 26);

        x += width;
    }
};

/**
 * Renders engine and render performance information.
 * @private
 * @method performance
 * @param {render} render
 * @param {RenderingContext} context
 */
export function performance(render: Render, context: CanvasRenderingContext2D) {
    let engine = render.engine;
    let timing = render.timing;
    let deltaHistory = timing.deltaHistory;
    let elapsedHistory = timing.elapsedHistory;
    let timestampElapsedHistory = timing.timestampElapsedHistory;
    let engineDeltaHistory = timing.engineDeltaHistory;
    let engineUpdatesHistory = timing.engineUpdatesHistory;
    let engineElapsedHistory = timing.engineElapsedHistory;
    let lastEngineUpdatesPerFrame = engine.timing.lastUpdatesPerFrame;
    let lastEngineDelta = engine.timing.lastDelta;

    let deltaMean = _mean(deltaHistory);
    let elapsedMean = _mean(elapsedHistory);
    let engineDeltaMean = _mean(engineDeltaHistory);
    let engineUpdatesMean = _mean(engineUpdatesHistory);
    let engineElapsedMean = _mean(engineElapsedHistory);
    let timestampElapsedMean = _mean(timestampElapsedHistory);
    let rateMean = (timestampElapsedMean / deltaMean) || 0;
    let neededUpdatesPerFrame = Math.round(deltaMean / lastEngineDelta);
    let fps = (1000 / deltaMean) || 0;

    var graphHeight = 4,
        gap = 12,
        width = 60,
        height = 34,
        x = 10,
        y = 69;

    // background
    context.fillStyle = '#0e0f19';
    context.fillRect(0, 50, gap * 5 + width * 6 + 22, height);

    // show FPS
    status(
        context, x, y, width, graphHeight, deltaHistory.length,
        Math.round(fps) + ' fps',
        fps / _goodFps,
        function (i) { return (deltaHistory[i] / deltaMean) - 1; }
    );

    // show engine delta
    status(
        context, x + gap + width, y, width, graphHeight, engineDeltaHistory.length,
        lastEngineDelta.toFixed(2) + ' dt',
        _goodDelta / lastEngineDelta,
        function (i) { return (engineDeltaHistory[i] / engineDeltaMean) - 1; }
    );

    // show engine updates per frame
    status(
        context, x + (gap + width) * 2, y, width, graphHeight, engineUpdatesHistory.length,
        lastEngineUpdatesPerFrame + ' upf',
        Math.pow(clamp((engineUpdatesMean / neededUpdatesPerFrame) || 1, 0, 1), 4),
        function (i) { return (engineUpdatesHistory[i] / engineUpdatesMean) - 1; }
    );

    // show engine update time
    status(
        context, x + (gap + width) * 3, y, width, graphHeight, engineElapsedHistory.length,
        engineElapsedMean.toFixed(2) + ' ut',
        1 - (lastEngineUpdatesPerFrame * engineElapsedMean / _goodFps),
        function (i) { return (engineElapsedHistory[i] / engineElapsedMean) - 1; }
    );

    // show render time
    status(
        context, x + (gap + width) * 4, y, width, graphHeight, elapsedHistory.length,
        elapsedMean.toFixed(2) + ' rt',
        1 - (elapsedMean / _goodFps),
        function (i) { return (elapsedHistory[i] / elapsedMean) - 1; }
    );

    // show effective speed
    status(
        context, x + (gap + width) * 5, y, width, graphHeight, timestampElapsedHistory.length,
        rateMean.toFixed(2) + ' x',
        rateMean * rateMean * rateMean,
        function (i) { return (((timestampElapsedHistory[i] / deltaHistory[i]) / rateMean) || 0) - 1; }
    );
};

/**
 * Renders a label, indicator and a chart.
 */
export function status(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, count: number, label: string, indicator: number, plotY: (i: number) => number) {
    // background
    context.strokeStyle = '#888';
    context.fillStyle = '#444';
    context.lineWidth = 1;
    context.fillRect(x, y + 7, width, 1);

    // chart
    context.beginPath();
    context.moveTo(x, y + 7 - height * clamp(0.4 * plotY(0), -2, 2));
    for (var i = 0; i < width; i += 1) {
        context.lineTo(x + i, y + 7 - (i < count ? height * clamp(0.4 * plotY(i), -2, 2) : 0));
    }
    context.stroke();

    // indicator
    context.fillStyle = 'hsl(' + clamp(25 + 95 * indicator, 0, 120) + ',100%,60%)';
    context.fillRect(x, y - 7, 4, 4);

    // label
    context.font = '12px Arial';
    context.textBaseline = 'middle';
    context.textAlign = 'right';
    context.fillStyle = '#eee';
    context.fillText(label, x + width, y - 5);
};

function renderConstraints(constraints: Constraint[], context: CanvasRenderingContext2D) {
    var c = context;

    for (var i = 0; i < constraints.length; i++) {
        var constraint = constraints[i];

        if (!constraint.render.visible || !constraint.pointA || !constraint.pointB)
            continue;

        let bodyA = constraint.bodyA;
        let bodyB = constraint.bodyB;
        let start: Vector;
        let end: Vector;

        if (bodyA) {
            start = add(bodyA.position, constraint.pointA);
        } else {
            start = constraint.pointA;
        }

        if (constraint.render.type === 'pin') {
            c.beginPath();
            c.arc(start.x, start.y, 3, 0, 2 * Math.PI);
            c.closePath();
        } else {
            if (bodyB) {
                end = add(bodyB.position, constraint.pointB);
            } else {
                end = constraint.pointB;
            }

            c.beginPath();
            c.moveTo(start.x, start.y);

            if (constraint.render.type === 'spring') {
                var delta = sub(end, start),
                    normal = perp(normalise(delta)),
                    coils = Math.ceil(clamp(constraint.length / 5, 12, 20)),
                    offset;

                for (var j = 1; j < coils; j += 1) {
                    offset = j % 2 === 0 ? 1 : -1;

                    c.lineTo(
                        start.x + delta.x * (j / coils) + normal.x * offset * 4,
                        start.y + delta.y * (j / coils) + normal.y * offset * 4
                    );
                }
            }

            c.lineTo(end.x, end.y);
        }

        if (constraint.render.lineWidth && constraint.render.strokeStyle) {
            c.lineWidth = constraint.render.lineWidth;
            c.strokeStyle = constraint.render.strokeStyle;
            c.stroke();
        }

        if (constraint.render.anchors && constraint.render.strokeStyle) {
            c.fillStyle = constraint.render.strokeStyle;
            c.beginPath();
            c.arc(start.x, start.y, 3, 0, 2 * Math.PI);
            c.arc(end!.x, end!.y, 3, 0, 2 * Math.PI);
            c.closePath();
            c.fill();
        }
    }
};

function renderBodies(render: Render, bodies: Body[], context: CanvasRenderingContext2D) {
    let c = context;
    let engine = render.engine;
    let options = render.options;
    let showInternalEdges = options.showInternalEdges || !options.wireframes;
    let body;
    let part;
    let i;
    let k;

    for (i = 0; i < bodies.length; i++) {
        body = bodies[i];

        if (!body.render.visible)
            continue;

        // handle compound parts
        for (k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
            part = body.parts[k];

            if (!part.render.visible)
                continue;

            part.render.opacity ??= 1.0;
            if (options.showSleeping && body.isSleeping) {
                c.globalAlpha = 0.5 * part.render.opacity;
            } else if (part.render.opacity !== 1) {
                c.globalAlpha = part.render.opacity;
            }

            if (part.render.sprite && part.render.sprite.texture && !options.wireframes) {
                // part sprite
                let sprite = part.render.sprite;
                let texture = _getTexture(render, part.render.sprite.texture);

                c.translate(part.position.x, part.position.y);
                c.rotate(part.angle);

                c.drawImage(
                    texture,
                    texture.width * -sprite.xOffset * sprite.xScale,
                    texture.height * -sprite.yOffset * sprite.yScale,
                    texture.width * sprite.xScale,
                    texture.height * sprite.yScale
                );

                // revert translation, hopefully faster than save / restore
                c.rotate(-part.angle);
                c.translate(-part.position.x, -part.position.y);
            } else {
                // part polygon
                if (part.circleRadius) {
                    c.beginPath();
                    c.arc(part.position.x, part.position.y, part.circleRadius, 0, 2 * Math.PI);
                } else {
                    c.beginPath();
                    c.moveTo(part.vertices[0].x, part.vertices[0].y);

                    for (var j = 1; j < part.vertices.length; j++) {
                        if (!part.vertices[j - 1].isInternal || showInternalEdges) {
                            c.lineTo(part.vertices[j].x, part.vertices[j].y);
                        } else {
                            c.moveTo(part.vertices[j].x, part.vertices[j].y);
                        }

                        if (part.vertices[j].isInternal && !showInternalEdges) {
                            c.moveTo(part.vertices[(j + 1) % part.vertices.length].x, part.vertices[(j + 1) % part.vertices.length].y);
                        }
                    }

                    c.lineTo(part.vertices[0].x, part.vertices[0].y);
                    c.closePath();
                }

                if (!options.wireframes && part.render.fillStyle) {
                    c.fillStyle = part.render.fillStyle;

                    if (part.render.lineWidth && part.render.strokeStyle) {
                        c.lineWidth = part.render.lineWidth;
                        c.strokeStyle = part.render.strokeStyle;
                        c.stroke();
                    }

                    c.fill();
                } else {
                    c.lineWidth = 1;
                    c.strokeStyle = render.options.wireframeStrokeStyle;
                    c.stroke();
                }
            }

            c.globalAlpha = 1;
        }
    }
};

/**
 * Optimised method for drawing body wireframes in one pass
 */
function bodyWireframes(render: Render, bodies: Body[], context: CanvasRenderingContext2D) {
    let c = context;
    let showInternalEdges = render.options.showInternalEdges;
    let body;
    let part;
    let i;
    let j;
    let k;

    c.beginPath();

    // render all bodies
    for (i = 0; i < bodies.length; i++) {
        body = bodies[i];

        if (!body.render.visible)
            continue;

        // handle compound parts
        for (k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
            part = body.parts[k];

            c.moveTo(part.vertices[0].x, part.vertices[0].y);

            for (j = 1; j < part.vertices.length; j++) {
                if (!part.vertices[j - 1].isInternal || showInternalEdges) {
                    c.lineTo(part.vertices[j].x, part.vertices[j].y);
                } else {
                    c.moveTo(part.vertices[j].x, part.vertices[j].y);
                }

                if (part.vertices[j].isInternal && !showInternalEdges) {
                    c.moveTo(part.vertices[(j + 1) % part.vertices.length].x, part.vertices[(j + 1) % part.vertices.length].y);
                }
            }

            c.lineTo(part.vertices[0].x, part.vertices[0].y);
        }
    }

    c.lineWidth = 1;
    c.strokeStyle = render.options.wireframeStrokeStyle;
    c.stroke();
};

/**
 * Optimised method for drawing body convex hull wireframes in one pass
 */
function bodyConvexHulls(render: Render, bodies: Body[], context: CanvasRenderingContext2D) {
    var c = context,
        body,
        part,
        i,
        j,
        k;

    c.beginPath();

    // render convex hulls
    for (i = 0; i < bodies.length; i++) {
        body = bodies[i];

        if (!body.render.visible || body.parts.length === 1)
            continue;

        c.moveTo(body.vertices[0].x, body.vertices[0].y);

        for (j = 1; j < body.vertices.length; j++) {
            c.lineTo(body.vertices[j].x, body.vertices[j].y);
        }

        c.lineTo(body.vertices[0].x, body.vertices[0].y);
    }

    c.lineWidth = 1;
    c.strokeStyle = 'rgba(255,255,255,0.2)';
    c.stroke();
};

/**
 * Renders body vertex numbers.
 */
function vertexNumbers(render: Render, bodies: Body[], context: CanvasRenderingContext2D) {
    var c = context,
        i,
        j,
        k;

    for (i = 0; i < bodies.length; i++) {
        var parts = bodies[i].parts;
        for (k = parts.length > 1 ? 1 : 0; k < parts.length; k++) {
            var part = parts[k];
            for (j = 0; j < part.vertices.length; j++) {
                c.fillStyle = 'rgba(255,255,255,0.2)';
                c.fillText(i + '_' + j, part.position.x + (part.vertices[j].x - part.position.x) * 0.8, part.position.y + (part.vertices[j].y - part.position.y) * 0.8);
            }
        }
    }
};

/**
 * Renders mouse position.
 */
function mousePosition(render: Render, mouse: Mouse, context: CanvasRenderingContext2D) {
    var c = context;
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fillText(mouse.position.x + '  ' + mouse.position.y, mouse.position.x + 5, mouse.position.y - 5);
};

/**
 * Draws body bounds
 */
function bodyBounds(render: Render, bodies: Body[], context: CanvasRenderingContext2D) {
    var c = context,
        engine = render.engine,
        options = render.options;

    c.beginPath();

    for (var i = 0; i < bodies.length; i++) {
        var body = bodies[i];

        if (body.render.visible) {
            var parts = bodies[i].parts;
            for (var j = parts.length > 1 ? 1 : 0; j < parts.length; j++) {
                var part = parts[j];
                c.rect(part.bounds.min.x, part.bounds.min.y, part.bounds.max.x - part.bounds.min.x, part.bounds.max.y - part.bounds.min.y);
            }
        }
    }

    if (options.wireframes) {
        c.strokeStyle = 'rgba(255,255,255,0.08)';
    } else {
        c.strokeStyle = 'rgba(0,0,0,0.1)';
    }

    c.lineWidth = 1;
    c.stroke();
};

/**
 * Draws body angle indicators and axes
 */
function bodyAxes(render: Render, bodies: Body[], context: CanvasRenderingContext2D) {
    var c = context,
        engine = render.engine,
        options = render.options,
        part,
        i,
        j,
        k;

    c.beginPath();

    for (i = 0; i < bodies.length; i++) {
        var body = bodies[i],
            parts = body.parts;

        if (!body.render.visible)
            continue;

        if (options.showAxes) {
            // render all axes
            for (j = parts.length > 1 ? 1 : 0; j < parts.length; j++) {
                part = parts[j];
                for (k = 0; k < part.axes.length; k++) {
                    var axis = part.axes[k];
                    c.moveTo(part.position.x, part.position.y);
                    c.lineTo(part.position.x + axis.x * 20, part.position.y + axis.y * 20);
                }
            }
        } else {
            for (j = parts.length > 1 ? 1 : 0; j < parts.length; j++) {
                part = parts[j];
                for (k = 0; k < part.axes.length; k++) {
                    // render a single axis indicator
                    c.moveTo(part.position.x, part.position.y);
                    c.lineTo((part.vertices[0].x + part.vertices[part.vertices.length - 1].x) / 2,
                        (part.vertices[0].y + part.vertices[part.vertices.length - 1].y) / 2);
                }
            }
        }
    }

    if (options.wireframes) {
        c.strokeStyle = 'indianred';
        c.lineWidth = 1;
    } else {
        c.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        c.globalCompositeOperation = 'overlay';
        c.lineWidth = 2;
    }

    c.stroke();
    c.globalCompositeOperation = 'source-over';
};

/**
 * Draws body positions
 */
function bodyPositions(render: Render, bodies: Body[], context: CanvasRenderingContext2D) {
    var c = context,
        engine = render.engine,
        options = render.options,
        body,
        part,
        i,
        k;

    c.beginPath();

    // render current positions
    for (i = 0; i < bodies.length; i++) {
        body = bodies[i];

        if (!body.render.visible)
            continue;

        // handle compound parts
        for (k = 0; k < body.parts.length; k++) {
            part = body.parts[k];
            c.arc(part.position.x, part.position.y, 3, 0, 2 * Math.PI, false);
            c.closePath();
        }
    }

    if (options.wireframes) {
        c.fillStyle = 'indianred';
    } else {
        c.fillStyle = 'rgba(0,0,0,0.5)';
    }
    c.fill();

    c.beginPath();

    // render previous positions
    for (i = 0; i < bodies.length; i++) {
        body = bodies[i];
        if (body.render.visible) {
            c.arc(body.positionPrev.x, body.positionPrev.y, 2, 0, 2 * Math.PI, false);
            c.closePath();
        }
    }

    c.fillStyle = 'rgba(255,165,0,0.8)';
    c.fill();
};

/**
 * Draws body velocity
 */
function bodyVelocity(render: Render, bodies: Body[], context: CanvasRenderingContext2D) {
    var c = context;

    c.beginPath();

    for (var i = 0; i < bodies.length; i++) {
        var body = bodies[i];

        if (!body.render.visible)
            continue;

        var velocity = bodyGetVelocity(body);

        c.moveTo(body.position.x, body.position.y);
        c.lineTo(body.position.x + velocity.x, body.position.y + velocity.y);
    }

    c.lineWidth = 3;
    c.strokeStyle = 'cornflowerblue';
    c.stroke();
};

/**
 * Draws body ids
 */
function bodyIds(render: Render, bodies: Body[], context: CanvasRenderingContext2D) {
    let c = context;
    let i;
    let j;

    for (i = 0; i < bodies.length; i++) {
        if (!bodies[i].render.visible)
            continue;

        var parts = bodies[i].parts;
        for (j = parts.length > 1 ? 1 : 0; j < parts.length; j++) {
            var part = parts[j];
            c.font = "12px Arial";
            c.fillStyle = 'rgba(255,255,255,0.5)';
            c.fillText(part.id.toString(), part.position.x + 10, part.position.y - 10);
        }
    }
};

function collisions(render: Render, pairs: Pair[], context: CanvasRenderingContext2D) {
    var c = context,
        options = render.options,
        pair,
        collision,
        corrected,
        bodyA,
        bodyB,
        i,
        j;

    c.beginPath();

    // render collision positions
    for (i = 0; i < pairs.length; i++) {
        pair = pairs[i];

        if (!pair.isActive)
            continue;

        collision = pair.collision;
        for (j = 0; j < pair.contactCount; j++) {
            var contact = pair.contacts[j],
                vertex = contact.vertex;
            c.rect(vertex.x - 1.5, vertex.y - 1.5, 3.5, 3.5);
        }
    }

    if (options.wireframes) {
        c.fillStyle = 'rgba(255,255,255,0.7)';
    } else {
        c.fillStyle = 'orange';
    }
    c.fill();

    c.beginPath();

    // render collision normals
    for (i = 0; i < pairs.length; i++) {
        pair = pairs[i];

        if (!pair.isActive)
            continue;

        collision = pair.collision;

        if (pair.contactCount > 0) {
            var normalPosX = pair.contacts[0].vertex.x,
                normalPosY = pair.contacts[0].vertex.y;

            if (pair.contactCount === 2) {
                normalPosX = (pair.contacts[0].vertex.x + pair.contacts[1].vertex.x) / 2;
                normalPosY = (pair.contacts[0].vertex.y + pair.contacts[1].vertex.y) / 2;
            }

            if (collision.bodyB === (collision as any).supports[0].body || collision.bodyA.isStatic === true) {
                c.moveTo(normalPosX - collision.normal.x * 8, normalPosY - collision.normal.y * 8);
            } else {
                c.moveTo(normalPosX + collision.normal.x * 8, normalPosY + collision.normal.y * 8);
            }

            c.lineTo(normalPosX, normalPosY);
        }
    }

    if (options.wireframes) {
        c.strokeStyle = 'rgba(255,165,0,0.7)';
    } else {
        c.strokeStyle = 'orange';
    }

    c.lineWidth = 1;
    c.stroke();
};

function separations(render: Render, pairs: Pair[], context: CanvasRenderingContext2D) {
    var c = context,
        options = render.options,
        pair,
        collision,
        corrected,
        bodyA,
        bodyB,
        i,
        j;

    c.beginPath();

    // render separations
    for (i = 0; i < pairs.length; i++) {
        pair = pairs[i];

        if (!pair.isActive)
            continue;

        collision = pair.collision;
        bodyA = collision.bodyA;
        bodyB = collision.bodyB;

        var k = 1;

        if (!bodyB.isStatic && !bodyA.isStatic) k = 0.5;
        if (bodyB.isStatic) k = 0;

        c.moveTo(bodyB.position.x, bodyB.position.y);
        c.lineTo(bodyB.position.x - collision.penetration.x * k, bodyB.position.y - collision.penetration.y * k);

        k = 1;

        if (!bodyB.isStatic && !bodyA.isStatic) k = 0.5;
        if (bodyA.isStatic) k = 0;

        c.moveTo(bodyA.position.x, bodyA.position.y);
        c.lineTo(bodyA.position.x + collision.penetration.x * k, bodyA.position.y + collision.penetration.y * k);
    }

    if (options.wireframes) {
        c.strokeStyle = 'rgba(255,165,0,0.5)';
    } else {
        c.strokeStyle = 'orange';
    }
    c.stroke();
};

/**
 * Updates render timing.
 * @method _updateTiming
 * @private
 * @param {render} render
 * @param {number} time
 */
var _updateTiming = function (render: Render, time: number) {
    var engine = render.engine,
        timing = render.timing,
        historySize = timing.historySize,
        timestamp = engine.timing.timestamp;

    timing.delta = time - timing.lastTime || _goodDelta;
    timing.lastTime = time;

    timing.timestampElapsed = timestamp - timing.lastTimestamp || 0;
    timing.lastTimestamp = timestamp;

    timing.deltaHistory.unshift(timing.delta);
    timing.deltaHistory.length = Math.min(timing.deltaHistory.length, historySize);

    timing.engineDeltaHistory.unshift(engine.timing.lastDelta);
    timing.engineDeltaHistory.length = Math.min(timing.engineDeltaHistory.length, historySize);

    timing.timestampElapsedHistory.unshift(timing.timestampElapsed);
    timing.timestampElapsedHistory.length = Math.min(timing.timestampElapsedHistory.length, historySize);

    timing.engineUpdatesHistory.unshift(engine.timing.lastUpdatesPerFrame);
    timing.engineUpdatesHistory.length = Math.min(timing.engineUpdatesHistory.length, historySize);

    timing.engineElapsedHistory.unshift(engine.timing.lastElapsed);
    timing.engineElapsedHistory.length = Math.min(timing.engineElapsedHistory.length, historySize);

    timing.elapsedHistory.unshift(timing.lastElapsed);
    timing.elapsedHistory.length = Math.min(timing.elapsedHistory.length, historySize);
};

/**
 * Returns the mean value of the given numbers.
 */
var _mean = function (values: number[]) {
    var result = 0;
    for (var i = 0; i < values.length; i += 1) {
        result += values[i];
    }
    return (result / values.length) || 0;
};

var _createCanvas = function (width: number, height: number) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.oncontextmenu = function () { return false; };
    canvas.onselectstart = function () { return false; };
    return canvas;
};

/**
 * Gets the pixel ratio of the canvas.
 */
var _getPixelRatio = function (canvas: HTMLCanvasElement) {
    let context = canvas.getContext('2d') as any;
    let devicePixelRatio = window.devicePixelRatio ?? 1;
    let backingStorePixelRatio = context.webkitBackingStorePixelRatio ?? context.mozBackingStorePixelRatio
        ?? context.msBackingStorePixelRatio ?? context.oBackingStorePixelRatio
        ?? context.backingStorePixelRatio ?? 1;

    return devicePixelRatio / backingStorePixelRatio;
};

/**
 * Gets the requested texture (an Image) via its path
 */
var _getTexture = function (render: Render, imagePath: string) {
    var image = render.textures[imagePath];

    if (image)
        return image;

    image = render.textures[imagePath] = new Image();
    image.src = imagePath;

    return image;
};

/**
 * Applies the background to the canvas using CSS.
 */
var _applyBackground = function (render: Render, background: string) {
    var cssBackground = background;

    if (/(jpg|gif|png)$/.test(background))
        cssBackground = 'url(' + background + ')';

    render.canvas.style.background = cssBackground;
    render.canvas.style.backgroundSize = "contain";
    render.currentBackground = background;
};
