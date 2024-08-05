import type { Vector } from "./Vector";
import type { Vertex } from "./Vertices";

export interface Contact {
    vertex: Vector;
    normalImpulse: number;
    tangentImpulse: number;
}

/**
 * Creates a new contact.
 */
export function create(vertex: Vector): Contact {
    return {
        vertex: vertex,
        normalImpulse: 0,
        tangentImpulse: 0
    }
}
