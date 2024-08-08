import * as Bodies from 'matter/Bodies';
import * as Body from 'matter/Body';
import * as Common from 'matter/Common';
import * as Composite from 'matter/Composite';
import * as Composites from 'matter/Composites';
import * as Constraint from 'matter/Constraint';
import * as Engine from "matter/Engine";
import * as Mouse from 'matter/Mouse';
import * as MouseConstraint from 'matter/MouseConstraint';
import * as Render from "matter/Render";
import * as Runner from "matter/Runner";
import * as Vector from "matter/Vector";
module.exports = {
    airFriction: require('./airFriction.js'),
    avalanche: require('./avalanche.js'),
    ballPool: require('./ballPool.js'),
    bridge: require('./bridge.js'),
    car: require('./car.js'),
    catapult: require('./catapult.js'),
    chains: require('./chains.js'),
    circleStack: require('./circleStack.js'),
    cloth: require('./cloth.js'),
    collisionFiltering: require('./collisionFiltering.js'),
    compositeManipulation: require('./compositeManipulation.js'),
    compound: require('./compound.js'),
    compoundStack: require('./compoundStack.js'),
    concave: require('./concave.js'),
    constraints: require('./constraints.js'),
    doublePendulum: require('./doublePendulum.js'),
    events: require('./events.js'),
    friction: require('./friction.js'),
    gravity: require('./gravity.js'),
    gyro: require('./gyro.js'),
    manipulation: require('./manipulation.js'),
    mixed: require('./mixed.js'),
    newtonsCradle: require('./newtonsCradle.js'),
    ragdoll: require('./ragdoll.js'),
    pyramid: require('./pyramid.js'),
    raycasting: require('./raycasting.js'),
    restitution: require('./restitution.js'),
    rounded: require('./rounded.js'),
    remove: require('./remove.js'),
    renderResize: require('./renderResize.js'),
    sensors: require('./sensors.js'),
    sleeping: require('./sleeping.js'),
    slingshot: require('./slingshot.js'),
    softBody: require('./softBody.js'),
    sprites: require('./sprites.js'),
    stack: require('./stack.js'),
    staticFriction: require('./staticFriction.js'),
    stats: require('./stats.js'),
    stress: require('./stress.js'),
    stress2: require('./stress2.js'),
    stress3: require('./stress3.js'),
    stress4: require('./stress4.js'),
    substep: require('./substep.js'),
    svg: require('./svg.js'),
    terrain: require('./terrain.js'),
    timescale: require('./timescale.js'),
    views: require('./views.js'),
    wreckingBall: require('./wreckingBall.js')
};