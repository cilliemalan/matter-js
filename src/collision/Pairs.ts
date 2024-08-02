import { type Pair, update as pairUpdate, create as pairCreate, setActive as pairSetActive } from './Pair'
import type { Collision } from './Collision';
import { extend } from '../core/Common';

export interface Pairs {
    table: Record<string, Pair>;
    list: Array<Pair>;
    collisionStart: Array<unknown>;
    collisionActive: Array<unknown>;
    collisionEnd: Array<unknown>;
}

/**
 * Creates a new pairs structure.
 */
export function create(options?: Partial<Pairs>): Pairs {
    const pairs: Pairs = {
        table: {},
        list: [],
        collisionStart: [],
        collisionActive: [],
        collisionEnd: [],
    };
    return extend(pairs, options);
};

/**
 * Updates pairs given a list of collisions.
 */
export function update(pairs: Pairs, collisions: Collision[], timestamp: number) {
    let pairsTable = pairs.table;
    let pairsList = pairs.list;
    let pairsListLength = pairsList.length;
    let pairsListIndex = pairsListLength;
    let collisionStart = pairs.collisionStart;
    let collisionEnd = pairs.collisionEnd;
    let collisionActive = pairs.collisionActive;
    let collisionsLength = collisions.length;
    let collisionStartIndex = 0;
    let collisionEndIndex = 0;
    let collisionActiveIndex = 0;
    let collision;
    let pair;

    for (let i = 0; i < collisionsLength; i++) {
        collision = collisions[i];
        pair = collision.pair;

        if (pair) {
            // pair already exists (but may or may not be active)
            if (pair.isActive) {
                // pair exists and is active
                collisionActive[collisionActiveIndex++] = pair;
            }

            // update the pair
            pairUpdate(pair, collision, timestamp);
        } else {
            // pair did not exist, create a new pair
            pair = pairCreate(collision, timestamp);
            pairsTable[pair.id] = pair;

            // add the new pair
            collisionStart[collisionStartIndex++] = pair;
            pairsList[pairsListIndex++] = pair;
        }
    }

    // find pairs that are no longer active
    pairsListIndex = 0;
    pairsListLength = pairsList.length;

    for (let i = 0; i < pairsListLength; i++) {
        pair = pairsList[i];

        // pair is active if updated this timestep
        if (pair.timeUpdated >= timestamp) {
            // keep active pairs
            pairsList[pairsListIndex++] = pair;
        } else {
            pairSetActive(pair, false, timestamp);

            // keep inactive pairs if both bodies may be sleeping
            if (pair.collision.bodyA.sleepCounter > 0 && pair.collision.bodyB.sleepCounter > 0) {
                pairsList[pairsListIndex++] = pair;
            } else {
                // remove inactive pairs if either body awake
                collisionEnd[collisionEndIndex++] = pair;
                delete pairsTable[pair.id];
            }
        }
    }

    // update array lengths if changed
    if (pairsList.length !== pairsListIndex) {
        pairsList.length = pairsListIndex;
    }

    if (collisionStart.length !== collisionStartIndex) {
        collisionStart.length = collisionStartIndex;
    }

    if (collisionEnd.length !== collisionEndIndex) {
        collisionEnd.length = collisionEndIndex;
    }

    if (collisionActive.length !== collisionActiveIndex) {
        collisionActive.length = collisionActiveIndex;
    }
};

/**
 * Clears the given pairs structure.
 */
export function clear(pairs: Pairs) {
    pairs.table = {};
    pairs.list.length = 0;
    pairs.collisionStart.length = 0;
    pairs.collisionActive.length = 0;
    pairs.collisionEnd.length = 0;
    return pairs;
};
