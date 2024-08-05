// var Events = require('./Events');
// var Engine = require('./Engine');
// var Common = require('./Common');

import { clamp, extend, warnOnce } from "./Common";
import { Engine, update } from "./Engine";
import { trigger } from "./Events";


const _maxFrameDelta = 1000 / 15;
const _frameDeltaFallback = 1000 / 60;
const _timeBufferMargin = 1.5;
const _elapsedNextEstimate = 1;
const _smoothingLowerBound = 0.1;
const _smoothingUpperBound = 0.9;

export interface Runner {

    /**
     * The fixed timestep size used for `Engine.update` calls in milliseconds, known as `delta`.
     * 
     * This value is recommended to be `1000 / 60` ms or smaller (i.e. equivalent to at least 60hz).
     * 
     * Smaller `delta` values provide higher quality results at the cost of performance.
     * 
     * You should usually avoid changing `delta` during running, otherwise quality may be affected. 
     * 
     * For smoother frame pacing choose a `delta` that is an even multiple of each display FPS you target, i.e. `1000 / (n * fps)` as this helps distribute an equal number of updates over each display frame.
     * 
     * For example with a 60 Hz `delta` i.e. `1000 / 60` the runner will on average perform one update per frame on displays running 60 FPS and one update every two frames on displays running 120 FPS, etc.
     * 
     * Where as e.g. using a 240 Hz `delta` i.e. `1000 / 240` the runner will on average perform four updates per frame on displays running 60 FPS and two updates per frame on displays running 120 FPS, etc.
     * 
     * Therefore `Runner.run` will call multiple engine updates (or none) as needed to simulate the time elapsed between browser frames. 
     * 
     * In practice the number of updates in any particular frame may be restricted to respect the runner's performance budgets. These are specified by `runner.maxFrameTime` and `runner.maxUpdates`, see those properties for details.
     */
    delta: number;
    /**
     * The measured time elapsed between the last two browser frames measured in milliseconds.
     * This is useful e.g. to estimate the current browser FPS using `1000 / runner.frameDelta`.
     */
    frameDelta?: number;
    /** Enables averaging to smooth frame rate measurements and therefore stabilise play rate. */
    frameDeltaSmoothing: boolean;
    /**
     * Rounds measured browser frame delta to the nearest 1 Hz.
     * This option can help smooth frame rate measurements and simplify handling hardware timing differences e.g. 59.94Hz and 60Hz displays.
     * For best results you should also round your `runner.delta` equivalent to the nearest 1 Hz.
     */
    frameDeltaSnapping: boolean;
    frameDeltaHistory: number[];
    frameDeltaHistorySize: number;
    /** The id of the last call to `Runner._onNextFrame`. */
    frameRequestId?: number;

    /**
     * The accumulated time elapsed that has yet to be simulated in milliseconds.
     * This value is clamped within certain limits (see `Runner.tick` code).
     */
    timeBuffer: number;
    /** The timestamp of the last call to `Runner.tick` used to measure `frameDelta`. */
    timeLastTick?: number;
    /**
     * An optional limit for maximum engine update count allowed per frame tick in addition to `runner.maxFrameTime`.
     * 
     * Unless you set a value it is automatically chosen based on `runner.delta` and `runner.maxFrameTime`.
     * 
     * See also `runner.maxFrameTime`.
     */
    maxUpdates?: number;
    /**
     * A performance budget that limits execution time allowed for this runner per browser frame in milliseconds.
     * 
     * To calculate the effective browser FPS at which this throttle is applied use `1000 / runner.maxFrameTime`.
     * 
     * This performance budget is intended to help maintain browser interactivity and help improve framerate recovery during temporary high CPU usage.
     * 
     * This budget only covers the measured time elapsed executing the functions called in the scope of the runner tick, including `Engine.update` and its related user event callbacks.
     * 
     * You may also reduce this budget to allow for any significant additional processing you perform on the same thread outside the scope of this runner tick, e.g. rendering time.
     * 
     * See also `runner.maxUpdates`.
     */
    maxFrameTime: number;
    lastUpdatesDeferred: number;
    /** A flag that can be toggled to enable or disable tick calls on this runner, therefore pausing engine updates and events while the runner loop remains running. */
    enabled: boolean;
    fps: 0;
}

/**
 * Creates a new Runner. 
 * See the properties section below for detailed information on what you can pass via the `options` object.
 */
export function create(options?: Partial<Runner>): Runner {
    var defaults: Runner = {
        delta: 1000 / 60,
        frameDeltaSmoothing: true,
        frameDeltaSnapping: true,
        frameDeltaHistory: [],
        frameDeltaHistorySize: 100,
        timeBuffer: 0,
        maxFrameTime: 1000 / 30,
        lastUpdatesDeferred: 0,
        enabled: true,
        fps: 0,
    };

    var runner = extend(defaults, options);

    // for temporary back compatibility only
    runner.fps = 0;

    return runner;
};

/**
 * Runs a `Matter.Engine` whilst synchronising engine updates with the browser frame rate. 
 * See module and properties descriptions for more information on this runner.
 * Alternatively see `Engine.update` to step the engine directly inside your own game loop implementation.
 */
export function run(runner: Runner, engine: Engine) {
    // initial time buffer for the first frame
    runner.timeBuffer = _frameDeltaFallback;

    function onFrame(time: number) {
        runner.frameRequestId = _onNextFrame(runner, onFrame);

        if (time && runner.enabled) {
            tick(runner, engine, time);
        }
    };

    onFrame(0)

    return runner;
};

/**
 * Performs a single runner tick as used inside `Runner.run`.
 * See module and properties descriptions for more information on this runner.
 * Alternatively see `Engine.update` to step the engine directly inside your own game loop implementation.
 */
export function tick(runner: Runner, engine: Engine, time: number) {
    let tickStartTime = performance.now();
    let engineDelta = runner.delta;
    let updateCount = 0;

    // find frame delta time since last call
    var frameDelta = runner.timeLastTick === undefined
        ? _maxFrameDelta
        : time - runner.timeLastTick;

    // fallback for unusable frame delta values (e.g. 0, NaN, on first frame or long pauses)
    if (!frameDelta || !runner.timeLastTick || frameDelta > Math.max(_maxFrameDelta, runner.maxFrameTime)) {
        // reuse last accepted frame delta else fallback
        frameDelta = runner.frameDelta ?? _frameDeltaFallback;
    }

    if (runner.frameDeltaSmoothing) {
        // record frame delta over a number of frames
        runner.frameDeltaHistory.push(frameDelta);
        runner.frameDeltaHistory = runner.frameDeltaHistory.slice(-runner.frameDeltaHistorySize);

        // sort frame delta history
        var deltaHistorySorted = runner.frameDeltaHistory.slice(0).sort();

        // sample a central window to limit outliers
        var deltaHistoryWindow = runner.frameDeltaHistory.slice(
            deltaHistorySorted.length * _smoothingLowerBound,
            deltaHistorySorted.length * _smoothingUpperBound
        );

        // take the mean of the central window
        var frameDeltaSmoothed = _mean(deltaHistoryWindow);
        frameDelta = frameDeltaSmoothed || frameDelta;
    }

    if (runner.frameDeltaSnapping) {
        // snap frame delta to the nearest 1 Hz
        frameDelta = 1000 / Math.round(1000 / frameDelta);
    }

    // update runner values for next call
    runner.frameDelta = frameDelta;
    runner.timeLastTick = time;

    // accumulate elapsed time
    runner.timeBuffer += runner.frameDelta;

    // limit time buffer size to a single frame of updates
    runner.timeBuffer = clamp(
        runner.timeBuffer, 0, runner.frameDelta + engineDelta * _timeBufferMargin
    );

    // reset count of over budget updates
    runner.lastUpdatesDeferred = 0;

    // get max updates per frame
    var maxUpdates = runner.maxUpdates || Math.ceil(runner.maxFrameTime / engineDelta);

    // create event object
    var event = {
        timestamp: engine.timing.timestamp
    };

    // tick events before update
    trigger(runner, 'beforeTick', event);
    trigger(runner, 'tick', event);

    var updateStartTime = performance.now();

    // simulate time elapsed between calls
    while (engineDelta > 0 && runner.timeBuffer >= engineDelta * _timeBufferMargin) {
        // update the engine
        trigger(runner, 'beforeUpdate', event);
        update(engine, engineDelta);
        trigger(runner, 'afterUpdate', event);

        // consume time simulated from buffer
        runner.timeBuffer -= engineDelta;
        updateCount += 1;

        // find elapsed time during this tick
        var elapsedTimeTotal = performance.now() - tickStartTime,
            elapsedTimeUpdates = performance.now() - updateStartTime,
            elapsedNextEstimate = elapsedTimeTotal + _elapsedNextEstimate * elapsedTimeUpdates / updateCount;

        // defer updates if over performance budgets for this frame
        if (updateCount >= maxUpdates || elapsedNextEstimate > runner.maxFrameTime) {
            runner.lastUpdatesDeferred = Math.round(Math.max(0, (runner.timeBuffer / engineDelta) - _timeBufferMargin));
            break;
        }
    }

    // track timing metrics
    engine.timing.lastUpdatesPerFrame = updateCount;

    // tick events after update
    trigger(runner, 'afterTick', event);

    // show useful warnings if needed
    if (runner.frameDeltaHistory.length >= 100) {
        if (runner.lastUpdatesDeferred && Math.round(runner.frameDelta / engineDelta) > maxUpdates) {
            warnOnce('Matter.Runner: runner reached runner.maxUpdates, see docs.');
        } else if (runner.lastUpdatesDeferred) {
            warnOnce('Matter.Runner: runner reached runner.maxFrameTime, see docs.');
        }

        if (runner.fps !== 0) {
            warnOnce('Matter.Runner: runner.fps was replaced by runner.delta, see docs.');
        }
    }
};

/**
 * Ends execution of `Runner.run` on the given `runner` by canceling the frame loop.
 * Alternatively to temporarily pause the runner, see `runner.enabled`.
 */
export function stop(runner: Runner) {
    _cancelNextFrame(runner);
};

/**
 * Schedules the `callback` on this `runner` for the next animation frame.
 */
function _onNextFrame(runner: Runner, callback: FrameRequestCallback) {

    requestAnimationFrame(callback)

    return runner.frameRequestId;
};

/**
 * Cancels the last callback scheduled by `Runner._onNextFrame` on this `runner`.
 * @private
 * @method _cancelNextFrame
 * @param {runner} runner
 */
export function _cancelNextFrame(runner: Runner) {
    if (runner.frameRequestId !== undefined) {
        cancelAnimationFrame(runner.frameRequestId);
    }
};

/**
 * Returns the mean of the given numbers.
 */
var _mean = function (values: number[]) {
    var result = 0,
        valuesLength = values.length;

    for (var i = 0; i < valuesLength; i += 1) {
        result += values[i];
    }

    return (result / valuesLength) || 0;
};
