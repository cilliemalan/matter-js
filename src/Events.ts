import { clone } from './Common'

/**
 * Subscribes a callback function to the given object's `eventName`.
 * @method on
 * @param {} object
 * @param {string} eventNames
 * @param {function} callback
 */
export function on(object: any, eventNames: string, callback: Function) {
    let names = eventNames.split(' ');

    for (let i = 0; i < names.length; i++) {
        let name = names[i];
        object.events = object.events ?? {};
        object.events[name] = object.events[name] ?? [];
        object.events[name].push(callback);
    }

    return callback;
};

/**
 * Removes the given event callback. If no callback, clears all callbacks in `eventNames`. If no `eventNames`, clears all events.
 * @method off
 * @param {} object
 * @param {string} eventNames
 * @param {function} callback
 */
export function off(object: any, eventNames: string, callback: Function) {
    if (!eventNames) {
        object.events = {};
        return;
    }

    // handle Events.off(object, callback)
    if (typeof eventNames === 'function') {
        callback = eventNames;
        eventNames = object.keys(object.events).join(' ');
    }

    var names = eventNames.split(' ');

    for (var i = 0; i < names.length; i++) {
        var callbacks = object.events[names[i]],
            newCallbacks = [];

        if (callback && callbacks) {
            for (var j = 0; j < callbacks.length; j++) {
                if (callbacks[j] !== callback)
                    newCallbacks.push(callbacks[j]);
            }
        }

        object.events[names[i]] = newCallbacks;
    }
};

/**
 * Fires all the callbacks subscribed to the given object's `eventName`, in the order they subscribed, if any.
 * @method trigger
 * @param {} object
 * @param {string} eventNames
 * @param {} event
 */
export function trigger(object: any, eventNames: string, event?: any) {
    var names,
        name,
        callbacks,
        eventClone;

    var events = object.events;

    if (events && Object.keys(events).length > 0) {
        if (!event)
            event = {};

        names = eventNames.split(' ');

        for (var i = 0; i < names.length; i++) {
            name = names[i];
            callbacks = events[name];

            if (callbacks) {
                eventClone = clone(event, false);
                eventClone.name = name;
                eventClone.source = object;

                for (var j = 0; j < callbacks.length; j++) {
                    callbacks[j].apply(object, [eventClone]);
                }
            }
        }
    }
};
