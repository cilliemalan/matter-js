import { normalise, Vector } from "./Vector";

/**
 * Creates a new set of axes from the given vertices.
 */
export function fromVertices(vertices: Vector[]) {
    var axes = new Map<number, Vector>();

    // find the unique axes, using edge normal gradients
    for (var i = 0; i < vertices.length; i++) {
        const j = (i + 1) % vertices.length;
        const normal = normalise({
            x: vertices[j].y - vertices[i].y,
            y: vertices[i].x - vertices[j].x
        });
        const gradient = (normal.y === 0) ? Infinity : (normal.x / normal.y);

        // limit precision
        const ngradient = Math.trunc(gradient * 1000)
        axes.set(ngradient, normal);
    }

    return [...axes.values()];
};

/**
 * Rotates a set of axes by the given angle.
 */
export function rotate(axes: Vector[], angle: number) {
    if (angle === 0)
        return;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    for (var i = 0; i < axes.length; i++) {
        const axis = axes[i];
        const xx = axis.x * cos - axis.y * sin;
        axis.y = axis.x * sin + axis.y * cos;
        axis.x = xx;
    }
};

