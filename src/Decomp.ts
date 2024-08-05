/*

Adapted from https://github.com/schteppe/poly-decomp.js/blob/master/src/index.js
Copyright (c) 2013 Stefan Hedman


*/


export const decomp = polygonDecomp;
export const quickDecomp = polygonQuickDecomp;
export const isSimple = polygonIsSimple;
export const removeCollinearPoints = polygonRemoveCollinearPoints;
export const removeDuplicatePoints = polygonRemoveDuplicatePoints;
export const makeCCW = polygonMakeCCW;

export type DecompVector = [number, number];
export type DecompPolygon = DecompVector[];
export type DecompLine = [DecompVector, DecompVector];

/**
 * Compute the intersection between two lines.
 * @static
 * @method lineInt
 * @param  {DecompLine}  l1          Line vector 1
 * @param  {DecompLine}  l2          Line vector 2
 * @param  {Number} precision   Precision to use when checking if the lines are parallel
 * @return {DecompVector}              The intersection point.
 */
function lineInt(l1: DecompLine, l2: DecompLine, precision: number = 0): DecompVector {
    var i: DecompVector = [0, 0]; // point
    var a1, b1, c1, a2, b2, c2, det; // scalars
    a1 = l1[1][1] - l1[0][1];
    b1 = l1[0][0] - l1[1][0];
    c1 = a1 * l1[0][0] + b1 * l1[0][1];
    a2 = l2[1][1] - l2[0][1];
    b2 = l2[0][0] - l2[1][0];
    c2 = a2 * l2[0][0] + b2 * l2[0][1];
    det = a1 * b2 - a2 * b1;
    if (!scalar_eq(det, 0, precision)) { // lines are not parallel
        i[0] = (b2 * c1 - b1 * c2) / det;
        i[1] = (a1 * c2 - a2 * c1) / det;
    }
    return i;
}

/**
 * Checks if two line segments intersects.
 * @method segmentsIntersect
 * @param {DecompVector} p1 The start vertex of the first line segment.
 * @param {DecompVector} p2 The end vertex of the first line segment.
 * @param {DecompVector} q1 The start vertex of the second line segment.
 * @param {DecompVector} q2 The end vertex of the second line segment.
 * @return {Boolean} True if the two line segments intersect
 */
function lineSegmentsIntersect(p1: DecompVector, p2: DecompVector, q1: DecompVector, q2: DecompVector): boolean {
    var dx = p2[0] - p1[0];
    var dy = p2[1] - p1[1];
    var da = q2[0] - q1[0];
    var db = q2[1] - q1[1];

    // segments are parallel
    if ((da * dy - db * dx) === 0) {
        return false;
    }

    var s = (dx * (q1[1] - p1[1]) + dy * (p1[0] - q1[0])) / (da * dy - db * dx);
    var t = (da * (p1[1] - q1[1]) + db * (q1[0] - p1[0])) / (db * dx - da * dy);

    return (s >= 0 && s <= 1 && t >= 0 && t <= 1);
}

/**
 * Get the area of a triangle spanned by the three given points. Note that the area will be negative if the points are not given in counter-clockwise order.
 * @static
 * @method area
 * @param  {DecompVector} a
 * @param  {DecompVector} b
 * @param  {DecompVector} c
 * @return {Number}
 */
function triangleArea(a: DecompVector, b: DecompVector, c: DecompVector): number {
    return (((b[0] - a[0]) * (c[1] - a[1])) - ((c[0] - a[0]) * (b[1] - a[1])));
}

function isLeft(a: DecompVector, b: DecompVector, c: DecompVector): boolean {
    return triangleArea(a, b, c) > 0;
}

function isLeftOn(a: DecompVector, b: DecompVector, c: DecompVector): boolean {
    return triangleArea(a, b, c) >= 0;
}

function isRight(a: DecompVector, b: DecompVector, c: DecompVector): boolean {
    return triangleArea(a, b, c) < 0;
}

function isRightOn(a: DecompVector, b: DecompVector, c: DecompVector): boolean {
    return triangleArea(a, b, c) <= 0;
}

let tmpPoint1: DecompVector = [0, 0];
let tmpPoint2: DecompVector = [0, 0];

/**
 * Check if three points are collinear
 * @method collinear
 * @param  {DecompVector} a
 * @param  {DecompVector} b
 * @param  {DecompVector} c
 * @param  {Number} [thresholdAngle=0] Threshold angle to use when comparing the vectors. The function will return true if the angle between the resulting vectors is less than this value. Use zero for max precision.
 * @return {Boolean}
 */
function collinear(a: DecompVector, b: DecompVector, c: DecompVector, thresholdAngle: number = 0): boolean {
    if (!thresholdAngle) {
        return triangleArea(a, b, c) === 0;
    } else {
        var ab = tmpPoint1,
            bc = tmpPoint2;

        ab[0] = b[0] - a[0];
        ab[1] = b[1] - a[1];
        bc[0] = c[0] - b[0];
        bc[1] = c[1] - b[1];

        var dot = ab[0] * bc[0] + ab[1] * bc[1],
            magA = Math.sqrt(ab[0] * ab[0] + ab[1] * ab[1]),
            magB = Math.sqrt(bc[0] * bc[0] + bc[1] * bc[1]),
            angle = Math.acos(dot / (magA * magB));
        return angle < thresholdAngle;
    }
}

function sqdist(a: DecompVector, b: DecompVector): number {
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    return dx * dx + dy * dy;
}

/**
 * Get a vertex at position i. It does not matter if i is out of bounds, this function will just cycle.
 * @method at
 * @param  {Number} i
 * @return {DecompVector}
 */
function polygonAt(polygon: DecompPolygon, i: number): DecompVector {
    var s = polygon.length;
    return polygon[i < 0 ? i % s + s : i % s];
}

/**
 * Clear the polygon data
 * @method clear
 * @return {DecompVector}
 */
function polygonClear(polygon: DecompPolygon): void {
    polygon.length = 0;
}

/**
 * Append points "from" to "to"-1 from an other polygon "poly" onto this one.
 * @method append
 * @param {DecompPolygon} poly The polygon to get points from.
 * @param {Number}  from The vertex index in "poly".
 * @param {Number}  to The end vertex index in "poly". Note that this vertex is NOT included when appending.
  */
function polygonAppend(polygon: DecompPolygon, poly: DecompPolygon, from: number, to: number): void {
    for (var i = from; i < to; i++) {
        polygon.push(poly[i]);
    }
}

/**
 * Make sure that the polygon vertices are ordered counter-clockwise.
 * @method makeCCW
 */
function polygonMakeCCW(polygon: DecompPolygon): boolean {
    var br = 0,
        v = polygon;

    // find bottom right point
    for (var i = 1; i < polygon.length; ++i) {
        if (v[i][1] < v[br][1] || (v[i][1] === v[br][1] && v[i][0] > v[br][0])) {
            br = i;
        }
    }

    // reverse poly if clockwise
    if (!isLeft(polygonAt(polygon, br - 1), polygonAt(polygon, br), polygonAt(polygon, br + 1))) {
        polygonReverse(polygon);
        return true;
    } else {
        return false;
    }
}

/**
 * Reverse the vertices in the polygon
 * @method reverse
 */
function polygonReverse(polygon: DecompPolygon) {
    var tmp: DecompPolygon = [];
    var N = polygon.length;
    for (var i = 0; i < N; i++) {
        tmp.push(polygon.pop()!);
    }
    for (var i = 0; i < N; i++) {
        polygon[i] = tmp[i];
    }
}

/**
 * Check if a point in the polygon is a reflex point
 * @method isReflex
 * @param  {Number}  i
 * @return {Boolean}
 */
function polygonIsReflex(polygon: DecompPolygon, i: number) {
    return isRight(polygonAt(polygon, i - 1), polygonAt(polygon, i), polygonAt(polygon, i + 1));
}

let tmpLine1: DecompLine = [[0, 0], [0, 0]];
let tmpLine2: DecompLine = [[0, 0], [0, 0]];

/**
 * Check if two vertices in the polygon can see each other
 * @method canSee
 * @param  {Number} a Vertex index 1
 * @param  {Number} b Vertex index 2
 * @return {Boolean}
 */
function polygonCanSee(polygon: DecompPolygon, a: number, b: number): boolean {
    var p, dist, l1 = tmpLine1, l2 = tmpLine2;

    if (isLeftOn(polygonAt(polygon, a + 1), polygonAt(polygon, a), polygonAt(polygon, b)) && isRightOn(polygonAt(polygon, a - 1), polygonAt(polygon, a), polygonAt(polygon, b))) {
        return false;
    }
    dist = sqdist(polygonAt(polygon, a), polygonAt(polygon, b));
    for (var i = 0; i !== polygon.length; ++i) { // for each edge
        if ((i + 1) % polygon.length === a || i === a) { // ignore incident edges
            continue;
        }
        if (isLeftOn(polygonAt(polygon, a), polygonAt(polygon, b), polygonAt(polygon, i + 1)) && isRightOn(polygonAt(polygon, a), polygonAt(polygon, b), polygonAt(polygon, i))) { // if diag intersects an edge
            l1[0] = polygonAt(polygon, a);
            l1[1] = polygonAt(polygon, b);
            l2[0] = polygonAt(polygon, i);
            l2[1] = polygonAt(polygon, i + 1);
            p = lineInt(l1, l2);
            if (sqdist(polygonAt(polygon, a), p) < dist) { // if edge is blocking visibility to b
                return false;
            }
        }
    }

    return true;
}

/**
 * Check if two vertices in the polygon can see each other
 * @method canSee2
 * @param  {Number} a Vertex index 1
 * @param  {Number} b Vertex index 2
 * @return {Boolean}
 */
function polygonCanSee2(polygon: DecompPolygon, a: number, b: number): boolean {
    // for each edge
    for (var i = 0; i !== polygon.length; ++i) {
        // ignore incident edges
        if (i === a || i === b || (i + 1) % polygon.length === a || (i + 1) % polygon.length === b) {
            continue;
        }
        if (lineSegmentsIntersect(polygonAt(polygon, a), polygonAt(polygon, b), polygonAt(polygon, i), polygonAt(polygon, i + 1))) {
            return false;
        }
    }
    return true;
}

/**
 * Copy the polygon from vertex i to vertex j.
 * @method copy
 * @param  {Number} i
 * @param  {Number} j
 * @param  {Polygon} [targetPoly]   Optional target polygon to save in.
 * @return {Polygon}                The resulting copy.
 */
function polygonCopy(polygon: DecompPolygon, i: number, j: number, targetPoly: DecompPolygon = []): DecompPolygon {
    const p = targetPoly;
    polygonClear(p);
    if (i < j) {
        // Insert all vertices from i to j
        for (var k = i; k <= j; k++) {
            p.push(polygon[k]);
        }

    } else {

        // Insert vertices 0 to j
        for (var k = 0; k <= j; k++) {
            p.push(polygon[k]);
        }

        // Insert vertices i to end
        for (var k = i; k < polygon.length; k++) {
            p.push(polygon[k]);
        }
    }

    return p;
}

/**
 * Decomposes the polygon into convex pieces. Returns a list of edges [[p1,p2],[p2,p3],...] that cuts the polygon.
 * Note that this algorithm has complexity O(N^4) and will be very slow for polygons with many vertices.
 * @method getCutEdges
 * @return {DecompLine[]}
 */
function polygonGetCutEdges(polygon: DecompPolygon): DecompLine[] {
    var min: DecompLine[] = [];
    var tmp1: DecompLine[] = [];
    var tmp2: DecompLine[] = [];
    var tmpPoly: DecompPolygon = [];
    var nDiags = Number.MAX_VALUE;

    for (var i = 0; i < polygon.length; ++i) {
        if (polygonIsReflex(polygon, i)) {
            for (var j = 0; j < polygon.length; ++j) {
                if (polygonCanSee(polygon, i, j)) {
                    tmp1 = polygonGetCutEdges(polygonCopy(polygon, i, j, tmpPoly));
                    tmp2 = polygonGetCutEdges(polygonCopy(polygon, j, i, tmpPoly));

                    for (var k = 0; k < tmp2.length; k++) {
                        tmp1.push(tmp2[k]);
                    }

                    if (tmp1.length < nDiags) {
                        min = tmp1;
                        nDiags = tmp1.length;
                        var p1 = polygonAt(polygon, i);
                        var p2 = polygonAt(polygon, j);
                        min.push([p1, p2]);
                    }
                }
            }
        }
    }

    return min;
}

/**
 * Decomposes the polygon into one or more convex sub-Polygons.
 * @method decomp
 * @return {DecompPolygon[]} An array or Polygon objects.
 */
function polygonDecomp(polygon: DecompPolygon): DecompPolygon[] {
    var edges = polygonGetCutEdges(polygon);
    if (edges.length > 0) {
        return polygonSlice(polygon, edges);
    } else {
        return [polygon];
    }
}

function isMultipleLines(cutEdges: DecompLine | DecompLine[]): cutEdges is DecompLine[] {
    return cutEdges instanceof Array &&
        cutEdges[0] instanceof Array &&
        cutEdges[0][0] instanceof Array &&
        cutEdges[0][1] instanceof Array &&
        cutEdges[0].length === 2;
}

/**
 * Slices the polygon given one or more cut edges. If given one, this function will return two polygons (false on failure). If many, an array of polygons.
 * @method slice
 * @param {DecompLine | DecompLine[]} cutEdges A list of edges, as returned by .getCutEdges()
 * @return {DecompPolygon[]}
 */
function polygonSlice(polygon: DecompPolygon, cutEdges: DecompLine | DecompLine[]): DecompPolygon[] {
    if (cutEdges.length === 0) {
        return [polygon];
    }

    if (isMultipleLines(cutEdges)) {

        var polys = [polygon];

        for (var i = 0; i < cutEdges.length; i++) {
            var cutEdge: DecompLine = cutEdges[i];
            // Cut all polys
            for (var j = 0; j < polys.length; j++) {
                var poly = polys[j];
                var result = polygonSlice(poly, cutEdge);
                if (result) {
                    // Found poly! Cut and quit
                    polys.splice(j, 1);
                    polys.push(result[0], result[1]);
                    break;
                }
            }
        }

        return polys;
    } else {

        // Was given one edge
        var cutEdge = cutEdges;
        var i = polygon.indexOf(cutEdge[0]);
        var j = polygon.indexOf(cutEdge[1]);

        if (i !== -1 && j !== -1) {
            return [polygonCopy(polygon, i, j),
            polygonCopy(polygon, j, i)];
        } else {
            return [];
        }
    }
}

/**
 * Checks that the line segments of this polygon do not intersect each other.
 * @method isSimple
 * @param  {DecompVector} path An array of vertices e.g. [[0,0],[0,1],...]
 * @return {Boolean}
 * @todo Should it check all segments with all others?
 */
function polygonIsSimple(polygon: DecompPolygon): boolean {
    var path = polygon, i;
    // Check
    for (i = 0; i < path.length - 1; i++) {
        for (var j = 0; j < i - 1; j++) {
            if (lineSegmentsIntersect(path[i], path[i + 1], path[j], path[j + 1])) {
                return false;
            }
        }
    }

    // Check the segment between the last and the first point to all others
    for (i = 1; i < path.length - 2; i++) {
        if (lineSegmentsIntersect(path[0], path[path.length - 1], path[i], path[i + 1])) {
            return false;
        }
    }

    return true;
}

function getIntersectionPoint(p1: DecompVector, p2: DecompVector, q1: DecompVector, q2: DecompVector, delta: number = 0): DecompVector {
    var a1 = p2[1] - p1[1];
    var b1 = p1[0] - p2[0];
    var c1 = (a1 * p1[0]) + (b1 * p1[1]);
    var a2 = q2[1] - q1[1];
    var b2 = q1[0] - q2[0];
    var c2 = (a2 * q1[0]) + (b2 * q1[1]);
    var det = (a1 * b2) - (a2 * b1);

    if (!scalar_eq(det, 0, delta)) {
        return [((b2 * c1) - (b1 * c2)) / det, ((a1 * c2) - (a2 * c1)) / det];
    } else {
        return [0, 0];
    }
}

/**
 * Quickly decompose the Polygon into convex sub-polygons.
 * @method quickDecomp
 * @param  {DecompPolygon[]} result
 * @param  {DecompPolygon} [reflexVertices]
 * @param  {DecompPolygon} [steinerPoints]
 * @param  {Number} [delta]
 * @param  {Number} [maxlevel]
 * @param  {Number} [level]
 * @return {DecompPolygon[]}
 */
function polygonQuickDecomp(polygon: DecompPolygon,
    result: DecompPolygon[] = [],
    reflexVertices: DecompPolygon = [],
    steinerPoints: DecompPolygon = [],
    delta: number = 24,
    maxlevel: number = 100,
    level: number = 0): DecompPolygon[] {

    let upperInt: DecompVector = [0, 0];
    let lowerInt: DecompVector = [0, 0];
    let p: DecompVector = [0, 0]; // Points
    let upperDist = 0, lowerDist = 0, d = 0, closestDist = 0; // scalars
    let upperIndex = 0, lowerIndex = 0, closestIndex = 0; // Integers
    let lowerPoly: DecompPolygon = []
    let upperPoly: DecompPolygon = [];
    let poly = polygon;
    let v = polygon;

    if (v.length < 3) {
        return result;
    }

    level++;
    if (level > maxlevel) {
        console.warn("quickDecomp: max level (" + maxlevel + ") reached.");
        return result;
    }

    for (var i = 0; i < polygon.length; ++i) {
        if (polygonIsReflex(poly, i)) {
            reflexVertices.push(poly[i]);
            upperDist = lowerDist = Number.MAX_VALUE;


            for (var j = 0; j < polygon.length; ++j) {
                if (isLeft(polygonAt(poly, i - 1), polygonAt(poly, i), polygonAt(poly, j)) && isRightOn(polygonAt(poly, i - 1), polygonAt(poly, i), polygonAt(poly, j - 1))) { // if line intersects with an edge
                    p = getIntersectionPoint(polygonAt(poly, i - 1), polygonAt(poly, i), polygonAt(poly, j), polygonAt(poly, j - 1)); // find the point of intersection
                    if (isRight(polygonAt(poly, i + 1), polygonAt(poly, i), p)) { // make sure it's inside the poly
                        d = sqdist(poly[i], p);
                        if (d < lowerDist) { // keep only the closest intersection
                            lowerDist = d;
                            lowerInt = p;
                            lowerIndex = j;
                        }
                    }
                }
                if (isLeft(polygonAt(poly, i + 1), polygonAt(poly, i), polygonAt(poly, j + 1)) && isRightOn(polygonAt(poly, i + 1), polygonAt(poly, i), polygonAt(poly, j))) {
                    p = getIntersectionPoint(polygonAt(poly, i + 1), polygonAt(poly, i), polygonAt(poly, j), polygonAt(poly, j + 1));
                    if (isLeft(polygonAt(poly, i - 1), polygonAt(poly, i), p)) {
                        d = sqdist(poly[i], p);
                        if (d < upperDist) {
                            upperDist = d;
                            upperInt = p;
                            upperIndex = j;
                        }
                    }
                }
            }

            // if there are no vertices to connect to, choose a point in the middle
            if (lowerIndex === (upperIndex + 1) % polygon.length) {
                //console.log("Case 1: Vertex("+i+"), lowerIndex("+lowerIndex+"), upperIndex("+upperIndex+"), poly.size("+polygon.length+")");
                p[0] = (lowerInt[0] + upperInt[0]) / 2;
                p[1] = (lowerInt[1] + upperInt[1]) / 2;
                steinerPoints.push(p);

                if (i < upperIndex) {
                    //lowerPoly.insert(lowerPoly.end(), poly.begin() + i, poly.begin() + upperIndex + 1);
                    polygonAppend(lowerPoly, poly, i, upperIndex + 1);
                    lowerPoly.push(p);
                    upperPoly.push(p);
                    if (lowerIndex !== 0) {
                        //upperPoly.insert(upperPoly.end(), poly.begin() + lowerIndex, poly.end());
                        polygonAppend(upperPoly, poly, lowerIndex, poly.length);
                    }
                    //upperPoly.insert(upperPoly.end(), poly.begin(), poly.begin() + i + 1);
                    polygonAppend(upperPoly, poly, 0, i + 1);
                } else {
                    if (i !== 0) {
                        //lowerPoly.insert(lowerPoly.end(), poly.begin() + i, poly.end());
                        polygonAppend(lowerPoly, poly, i, poly.length);
                    }
                    //lowerPoly.insert(lowerPoly.end(), poly.begin(), poly.begin() + upperIndex + 1);
                    polygonAppend(lowerPoly, poly, 0, upperIndex + 1);
                    lowerPoly.push(p);
                    upperPoly.push(p);
                    //upperPoly.insert(upperPoly.end(), poly.begin() + lowerIndex, poly.begin() + i + 1);
                    polygonAppend(upperPoly, poly, lowerIndex, i + 1);
                }
            } else {
                // connect to the closest point within the triangle
                //console.log("Case 2: Vertex("+i+"), closestIndex("+closestIndex+"), poly.size("+polygon.length+")\n");

                if (lowerIndex > upperIndex) {
                    upperIndex += polygon.length;
                }
                closestDist = Number.MAX_VALUE;

                if (upperIndex < lowerIndex) {
                    return result;
                }

                for (var j = lowerIndex; j <= upperIndex; ++j) {
                    if (
                        isLeftOn(polygonAt(poly, i - 1), polygonAt(poly, i), polygonAt(poly, j)) &&
                        isRightOn(polygonAt(poly, i + 1), polygonAt(poly, i), polygonAt(poly, j))
                    ) {
                        d = sqdist(polygonAt(poly, i), polygonAt(poly, j));
                        if (d < closestDist && polygonCanSee2(poly, i, j)) {
                            closestDist = d;
                            closestIndex = j % polygon.length;
                        }
                    }
                }

                if (i < closestIndex) {
                    polygonAppend(lowerPoly, poly, i, closestIndex + 1);
                    if (closestIndex !== 0) {
                        polygonAppend(upperPoly, poly, closestIndex, v.length);
                    }
                    polygonAppend(upperPoly, poly, 0, i + 1);
                } else {
                    if (i !== 0) {
                        polygonAppend(lowerPoly, poly, i, v.length);
                    }
                    polygonAppend(lowerPoly, poly, 0, closestIndex + 1);
                    polygonAppend(upperPoly, poly, closestIndex, i + 1);
                }
            }

            // solve smallest poly first
            if (lowerPoly.length < upperPoly.length) {
                polygonQuickDecomp(lowerPoly, result, reflexVertices, steinerPoints, delta, maxlevel, level);
                polygonQuickDecomp(upperPoly, result, reflexVertices, steinerPoints, delta, maxlevel, level);
            } else {
                polygonQuickDecomp(upperPoly, result, reflexVertices, steinerPoints, delta, maxlevel, level);
                polygonQuickDecomp(lowerPoly, result, reflexVertices, steinerPoints, delta, maxlevel, level);
            }

            return result;
        }
    }
    result.push(polygon);

    return result;
}

/**
 * Remove collinear points in the polygon.
 * @method removeCollinearPoints
 * @param  {Number} [precision] The threshold angle to use when determining whether two edges are collinear. Use zero for finest precision.
 * @return {Number}           The number of points removed
 */
function polygonRemoveCollinearPoints(polygon: DecompPolygon, precision: number): number {
    var num = 0;
    for (var i = polygon.length - 1; polygon.length > 3 && i >= 0; --i) {
        if (collinear(polygonAt(polygon, i - 1), polygonAt(polygon, i), polygonAt(polygon, i + 1), precision)) {
            // Remove the middle point
            polygon.splice(i % polygon.length, 1);
            num++;
        }
    }
    return num;
}

/**
 * Remove duplicate points in the polygon.
 * @method removeDuplicatePoints
 * @param  {Number} [precision] The threshold to use when determining whether two points are the same. Use zero for best precision.
 */
function polygonRemoveDuplicatePoints(polygon: DecompPolygon, precision: number): void {
    for (var i = polygon.length - 1; i >= 1; --i) {
        var pi = polygon[i];
        for (var j = i - 1; j >= 0; --j) {
            if (points_eq(pi, polygon[j], precision)) {
                polygon.splice(i, 1);
                continue;
            }
        }
    }
}

/**
 * Check if two scalars are equal
 * @static
 * @method eq
 * @param  {Number} a
 * @param  {Number} b
 * @param  {Number} [precision]
 * @return {Boolean}
 */
function scalar_eq(a: number, b: number, precision: number = 0): boolean {
    if (a < b) {
        return b - a <= precision;
    } else {
        return a - b <= precision;
    }
}

/**
 * Check if two points are equal
 * @static
 * @method points_eq
 * @param  {DecompVector} a
 * @param  {DecompVector} b
 * @param  {Number} [precision]
 * @return {Boolean}
 */
function points_eq(a: DecompVector, b: DecompVector, precision: number = 0): boolean {
    return scalar_eq(a[0], b[0], precision) && scalar_eq(a[1], b[1], precision);
}