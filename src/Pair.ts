import type { Body } from './Body';
import type { Contact } from './Contact';
import type { Collision } from './Collision';

export interface Pair {
    id: string;
    bodyA: Body;
    bodyB: Body;
    collision: Collision;
    contacts: [Contact, Contact];
    contactCount: number;
    separation: number;
    isActive: boolean;
    isSensor: boolean;
    timeCreated: number;
    timeUpdated: number;
    inverseMass: number;
    friction: number;
    frictionStatic: number;
    restitution: number;
    slop: number;
}

/**
 * Creates a pair.
 */
export function create(collision: Collision, timestamp: number) {
    var bodyA = collision.bodyA,
        bodyB = collision.bodyB;

    var pair: Pair = {
        id: id(bodyA, bodyB),
        bodyA: bodyA,
        bodyB: bodyB,
        collision: collision,
        contacts: [{ normalImpulse: 0, tangentImpulse: 0 }, { normalImpulse: 0, tangentImpulse: 0 }] as [Contact, Contact],
        contactCount: 0,
        separation: 0,
        isActive: true,
        isSensor: bodyA.isSensor || bodyB.isSensor,
        timeCreated: timestamp,
        timeUpdated: timestamp,
        inverseMass: 0,
        friction: 0,
        frictionStatic: 0,
        restitution: 0,
        slop: 0
    };

    update(pair, collision, timestamp);

    return pair;
};

/**
 * Updates a pair given a collision.
 */
export function update(pair: Pair, collision: Collision, timestamp: number) {
    let supports = collision.supports;
    let supportCount = collision.supportCount;
    let contacts = pair.contacts;
    let parentA = collision.parentA;
    let parentB = collision.parentB;

    pair.isActive = true;
    pair.timeUpdated = timestamp;
    pair.collision = collision;
    pair.separation = collision.depth;
    pair.inverseMass = parentA.inverseMass + parentB.inverseMass;
    pair.friction = parentA.friction < parentB.friction ? parentA.friction : parentB.friction;
    pair.frictionStatic = parentA.frictionStatic > parentB.frictionStatic ? parentA.frictionStatic : parentB.frictionStatic;
    pair.restitution = parentA.restitution > parentB.restitution ? parentA.restitution : parentB.restitution;
    pair.slop = parentA.slop > parentB.slop ? parentA.slop : parentB.slop;

    pair.contactCount = supportCount;
    collision.pair = pair;

    let supportA = supports[0]!;
    let contactA = contacts[0];
    let supportB = supports[1]!;
    let contactB = contacts[1];

    // match contacts to supports
    if (contactB.vertex === supportA || contactA.vertex === supportB) {
        contacts[1] = contactA;
        contacts[0] = contactA = contactB;
        contactB = contacts[1];
    }

    // update contacts
    contactA.vertex = supportA;
    contactB.vertex = supportB;
};

/**
 * Set a pair as active or inactive.
 */
export function setActive(pair: Pair, isActive: boolean, timestamp: number) {
    if (isActive) {
        pair.isActive = true;
        pair.timeUpdated = timestamp;
    } else {
        pair.isActive = false;
        pair.contactCount = 0;
    }
};

/**
 * Get the id for the given pair.
 */
export function id(bodyA: Body, bodyB: Body) {
    if (bodyA.id < bodyB.id) {
        return `${bodyA.id.toString(36)}:${bodyB.id.toString(36)}`;
    }
    else {
        return `${bodyB.id.toString(36)}:${bodyA.id.toString(36)}`;
    }
};
