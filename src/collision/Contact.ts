import type { Vector } from "../geometry/Vector";
import type { Vertex } from "../geometry/Vertices";

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
