import type { Engine } from "matter/Engine";
import type { Render } from "matter/Render";
import type { Runner } from "matter/Runner";

export interface ExampleContext {
    engine: Engine;
    runner: Runner;
    render: Render;
    canvas: HTMLCanvasElement;
    stop: () => void;
}

export type ExampleFunction = () => ExampleContext;

export interface Example extends ExampleFunction {
    title?: string;
    for?: string;
}
