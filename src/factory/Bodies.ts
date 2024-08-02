import { Body, create as bodyCreate, setPosition } from "../body/Body";
import { extend, warn, warnOnce } from "../core/Common";
import { magnitudeSquared, sub, Vector } from "../geometry/Vector";
import { fromPath, chamfer, Vertex, isConvex as verticesIsConvex, clockwiseSort, hull, area, centre } from "../geometry/Vertices";
import { decomp, DecompVector, makeCCW, quickDecomp, removeCollinearPoints, removeDuplicatePoints } from "../geometry/Decomp";
import { overlaps } from "../geometry/Bounds";

export interface ChamferOptions {
    radius?: number;
    quality?: number;
    qualityMin?: number;
    qualityMax?: number;
}

export interface ShapeOptions extends Partial<Body> {
    chamfer?: ChamferOptions;
}

function applyChamferOptions(verts: Vector[], options?: ShapeOptions): Vertex[] {
    if (options && options.chamfer) {
        const { radius, quality, qualityMin, qualityMax } = options.chamfer;
        delete options.chamfer;
        return chamfer(verts, radius, quality, qualityMin, qualityMax) as unknown as Vertex[];
    }

    return verts as unknown as Vertex[];
}

/**
 * Creates a new rigid body model with a rectangle hull. 
 * The options parameter is an object that specifies any properties you wish to override the defaults.
 * See the properties section of the `Matter.Body` module for detailed information on what you can pass via the `options` object.
 */
export function rectangle(x: number, y: number, width: number, height: number, options?: ShapeOptions): Body {

    const vertices = applyChamferOptions(
        fromPath('L 0 0 L ' + width + ' 0 L ' + width + ' ' + height + ' L 0 ' + height, undefined!),
        options);

    return bodyCreate({
        label: 'Rectangle Body',
        position: { x, y },
        vertices,
        ...options
    });
};

/**
 * Creates a new rigid body model with a trapezoid hull. 
 * The `slope` is parameterised as a fraction of `width` and must be < 1 to form a valid trapezoid. 
 * The options parameter is an object that specifies any properties you wish to override the defaults.
 * See the properties section of the `Matter.Body` module for detailed information on what you can pass via the `options` object.
 */
export function trapezoid(x: number, y: number, width: number, height: number, slope: number, options?: ShapeOptions): Body {

    if (slope >= 1) {
        warn('Bodies.trapezoid: slope parameter must be < 1.');
    }

    slope *= 0.5;
    var roof = (1 - (slope * 2)) * width;

    let x1 = width * slope;
    let x2 = x1 + roof;
    let x3 = x2 + x1;
    let verticesPath;

    if (slope < 0.5) {
        verticesPath = 'L 0 0 L ' + x1 + ' ' + (-height) + ' L ' + x2 + ' ' + (-height) + ' L ' + x3 + ' 0';
    } else {
        verticesPath = 'L 0 0 L ' + x2 + ' ' + (-height) + ' L ' + x3 + ' 0';
    }

    const vertices = applyChamferOptions(
        fromPath(verticesPath, undefined!),
        options);


    return bodyCreate({
        label: 'Trapezoid Body',
        position: { x, y },
        vertices,
        ...options
    });
}

/**
 * Creates a new rigid body model with a circle hull. 
 * The options parameter is an object that specifies any properties you wish to override the defaults.
 * See the properties section of the `Matter.Body` module for detailed information on what you can pass via the `options` object.
 */
export function circle(x: number, y: number, radius: number, options?: Partial<Body>, maxSides?: number): Body {

    if (options?.chamfer) {
        warn("A circle cannot have a chamfer");
    }

    // approximate circles with polygons until true circles implemented in SAT
    maxSides ??= 26;
    let sides = Math.ceil(Math.max(10, Math.min(maxSides, radius)));

    // optimisation: always use even number of sides (half the number of unique axes)
    if (sides % 2 === 1) {
        sides += 1;
    }

    return polygon(x, y, sides, radius, {
        label: 'Circle Body',
        circleRadius: radius,
        ...options,
        chamfer: undefined
    });
};

/**
 * Creates a new rigid body model with a regular polygon hull with the given number of sides. 
 * The options parameter is an object that specifies any properties you wish to override the defaults.
 * See the properties section of the `Matter.Body` module for detailed information on what you can pass via the `options` object.
 */
export function polygon(x: number, y: number, sides: number, radius: number, options?: ShapeOptions): Body {
    options = options || {};

    if (sides < 3) {
        return circle(x, y, radius, options);
    }

    let theta = 2 * Math.PI / sides;
    let path = '';
    let offset = theta * 0.5;

    for (var i = 0; i < sides; i += 1) {
        let angle = offset + (i * theta);
        let xx = Math.cos(angle) * radius;
        let yy = Math.sin(angle) * radius;

        path += 'L ' + xx.toFixed(3) + ' ' + yy.toFixed(3) + ' ';
    }

    const vertices = applyChamferOptions(fromPath(path, undefined!), options);

    return bodyCreate({
        label: 'Polygon Body',
        position: { x, y },
        vertices,
        ...options
    });
};

function toDecomp(v: Vector[]): DecompVector[] {
    const r = new Array<DecompVector>(v.length);
    for (let i = 0; i < v.length; i++) {
        r[i] = [v[i].x, v[i].y];
    }

    return r;
}

/**
 * Utility to create a compound body based on set(s) of vertices.
 * 
 * _Note:_ To optionally enable automatic concave vertices decomposition the [poly-decomp](https://github.com/schteppe/poly-decomp.js) 
 * package must be first installed and provided see `Common.setDecomp`, otherwise the convex hull of each vertex set will be used.
 * 
 * The resulting vertices are reorientated about their centre of mass,
 * and offset such that `body.position` corresponds to this point.
 * 
 * The resulting offset may be found if needed by subtracting `body.bounds` from the original input bounds.
 * To later move the centre of mass see `Body.setCentre`.
 * 
 * Note that automatic conconcave decomposition results are not always optimal. 
 * For best results, simplify the input vertices as much as possible first.
 * By default this function applies some addtional simplification to help.
 * 
 * Some outputs may also require further manual processing afterwards to be robust.
 * In particular some parts may need to be overlapped to avoid collision gaps.
 * Thin parts and sharp points should be avoided or removed where possible.
 *
 * The options parameter object specifies any `Matter.Body` properties you wish to override the defaults.
 * 
 * See the properties section of the `Matter.Body` module for detailed information on what you can pass via the `options` object.
 * @method fromVertices
 * @param {number} x
 * @param {number} y
 * @param {array} vertexSets One or more arrays of vertex points e.g. `[[{ x: 0, y: 0 }...], ...]`.
 * @param {object} [options] The body options.
 * @param {bool} [flagInternal=false] Optionally marks internal edges with `isInternal`.
 * @param {number} [removeCollinear=0.01] Threshold when simplifying vertices along the same edge.
 * @param {number} [minimumArea=10] Threshold when removing small parts.
 * @param {number} [removeDuplicatePoints=0.01] Threshold when simplifying nearby vertices.
 * @return {body}
 */
export function fromVertices(x: number, y: number,
    vertexSets: Vector[][] | Vector[],
    options?: ShapeOptions,
    flagInternal = false,
    removeCollinear = 0.01,
    minimumArea = 10,
    removeDuplicates = 0.01) {

    let canDecomp;
    let body;
    let parts;
    let isConvex;
    let isConcave;
    let vertices: Vector[];
    let i;
    let j;
    let k;
    let v;
    let z;

    options = options || {};
    parts = [];

    // ensure vertexSets is an array of arrays
    let vxsets: Vector[][];

    if (!(vertexSets[0] instanceof Array)) {
        vxsets = [vertexSets as Vector[]];
    } else {
        vxsets = vertexSets as Vector[][];
    }

    for (v = 0; v < vxsets.length; v += 1) {
        vertices = vxsets[v];
        isConvex = verticesIsConvex(vertices);
        isConcave = !isConvex;

        if (isConcave && !canDecomp) {
            warnOnce(
                'Bodies.fromVertices: Install the \'poly-decomp\' library and use Common.setDecomp or provide \'decomp\' as a global to decompose concave vertices.'
            );
        }

        if (isConvex || !canDecomp) {
            if (isConvex) {
                vertices = clockwiseSort(vertices);
            } else {
                // fallback to convex hull when decomposition is not possible
                vertices = hull(vertices);
            }

            parts.push({
                position: { x: x, y: y },
                vertices: vertices
            });
        } else {
            // initialise a decomposition
            var concave = toDecomp(vertices);

            // vertices are concave and simple, we can decompose into parts
            makeCCW(concave);

            if (removeCollinear) {
                removeCollinearPoints(concave, removeCollinear);
            }

            if (removeDuplicates) {
                removeDuplicatePoints(concave, removeDuplicates);
            }

            // use the quick decomposition algorithm (Bayazit)
            var decomposed = quickDecomp(concave);

            // for each decomposed chunk
            for (i = 0; i < decomposed.length; i++) {
                var chunk = decomposed[i];

                // convert vertices into the correct structure
                var chunkVertices = chunk.map(function (vertices) {
                    return {
                        x: vertices[0],
                        y: vertices[1]
                    };
                });

                // skip small chunks
                if (minimumArea > 0 && area(chunkVertices) < minimumArea)
                    continue;

                // create a compound part
                parts.push({
                    position: centre(chunkVertices),
                    vertices: chunkVertices
                });
            }
        }
    }

    // create body parts
    const bodies = new Array<Body>(parts.length);
    for (i = 0; i < parts.length; i++) {
        bodies[i] = bodyCreate(extend(parts[i], options));
    }

    // flag internal edges (coincident part edges)
    if (flagInternal) {
        var coincident_max_dist = 5;

        for (i = 0; i < bodies.length; i++) {
            var partA = bodies[i];

            for (j = i + 1; j < bodies.length; j++) {
                var partB = bodies[j];

                if (overlaps(partA.bounds, partB.bounds)) {
                    var pav = partA.vertices,
                        pbv = partB.vertices;

                    // iterate vertices of both bodies
                    for (k = 0; k < partA.vertices.length; k++) {
                        for (z = 0; z < partB.vertices.length; z++) {
                            // find distances between the vertices
                            var da = magnitudeSquared(sub(pav[(k + 1) % pav.length], pbv[z])),
                                db = magnitudeSquared(sub(pav[k], pbv[(z + 1) % pbv.length]));

                            // if both vertices are very close, consider the edge concident (internal)
                            if (da < coincident_max_dist && db < coincident_max_dist) {
                                pav[k].isInternal = true;
                                pbv[z].isInternal = true;
                            }
                        }
                    }

                }
            }
        }
    }

    if (bodies.length > 1) {
        // create the parent body to be returned, that contains generated compound parts
        body = bodyCreate(extend({ parts: bodies.slice(0) }, options));

        // offset such that body.position is at the centre off mass
        setPosition(body, { x: x, y: y });

        return body;
    } else {
        return bodies[0];
    }
};

