import { log } from './Common'
import { Vector } from './Vector';

export class Mouse {

    constructor(element: HTMLElement) {
        this.element = element;
        setElement(this, element);
        this.pixelRatio = parseInt(element.getAttribute('data-pixel-ratio') ?? "1", 10) || 1;
    }

    element: HTMLElement;
    absolute = { x: 0, y: 0 };
    position = { x: 0, y: 0 };
    mousedownPosition = { x: 0, y: 0 };
    mouseupPosition = { x: 0, y: 0 };
    offset = { x: 0, y: 0 };
    scale = { x: 1, y: 1 };
    wheelDelta = 0;
    button = -1;
    pixelRatio: number;

    sourceEvents: {
        mousemove?: MouseEvent | TouchEvent;
        mousedown?: MouseEvent | TouchEvent;
        mouseup?: MouseEvent | TouchEvent;
        mousewheel?: WheelEvent;
    } = {};

    mousemove(event: MouseEvent | TouchEvent) {
        const position = _getRelativeMousePosition(event, this.element, this.pixelRatio);
        const touches = (event as unknown as TouchEvent).changedTouches;

        if (touches) {
            this.button = 0;
            event.preventDefault();
        }

        this.absolute.x = position.x;
        this.absolute.y = position.y;
        this.position.x = this.absolute.x * this.scale.x + this.offset.x;
        this.position.y = this.absolute.y * this.scale.y + this.offset.y;
        this.sourceEvents.mousemove = event;
    }

    mousedown(event: MouseEvent | TouchEvent) {
        const position = _getRelativeMousePosition(event, this.element, this.pixelRatio);
        const touches = (event as unknown as TouchEvent).changedTouches;

        if (touches) {
            this.button = 0;
            event.preventDefault();
        } else {
            this.button = (event as MouseEvent).button;
        }

        this.absolute.x = position.x;
        this.absolute.y = position.y;
        this.position.x = this.absolute.x * this.scale.x + this.offset.x;
        this.position.y = this.absolute.y * this.scale.y + this.offset.y;
        this.mousedownPosition.x = this.position.x;
        this.mousedownPosition.y = this.position.y;
        this.sourceEvents.mousedown = event;
    }

    mouseup(event: MouseEvent | TouchEvent) {
        const position = _getRelativeMousePosition(event, this.element, this.pixelRatio);
        const touches = (event as unknown as TouchEvent).changedTouches;

        if (touches) {
            event.preventDefault();
        }

        this.button = -1;
        this.absolute.x = position.x;
        this.absolute.y = position.y;
        this.position.x = this.absolute.x * this.scale.x + this.offset.x;
        this.position.y = this.absolute.y * this.scale.y + this.offset.y;
        this.mouseupPosition.x = this.position.x;
        this.mouseupPosition.y = this.position.y;
        this.sourceEvents.mouseup = event;
    }

    mousewheel(event: WheelEvent) {
        const wd = (event as any).wheelDelta ?? (event.deltaY * -1.2);
        this.wheelDelta = Math.max(-1, Math.min(1, wd || -event.detail));
        event.preventDefault();
        this.sourceEvents.mousewheel = event;
    }
}
/**
 * Creates a mouse input.
 */
export function create(element: HTMLElement) {

    if (!element) {
        log('Mouse.create: element was undefined, defaulting to document.body', 'warn');
    }

    return new Mouse(element ?? document.body);
};

/**
 * Sets the element the mouse is bound to (and relative to).
 * @method setElement
 * @param {Mouse} mouse
 * @param {HTMLElement} element
 */
export function setElement(mouse: Mouse, element: HTMLElement) {
    mouse.element = element;

    element.addEventListener('mousemove', mouse.mousemove, { passive: true });
    element.addEventListener('mousedown', mouse.mousedown, { passive: true });
    element.addEventListener('mouseup', mouse.mouseup, { passive: true });

    element.addEventListener('wheel', mouse.mousewheel, { passive: false });

    element.addEventListener('touchmove', mouse.mousemove, { passive: false });
    element.addEventListener('touchstart', mouse.mousedown, { passive: false });
    element.addEventListener('touchend', mouse.mouseup, { passive: false });
};

/**
 * Clears all captured source events.
 * @method clearSourceEvents
 * @param {Mouse} mouse
 */
export function clearSourceEvents(mouse: Mouse) {
    mouse.sourceEvents.mousemove = undefined;
    mouse.sourceEvents.mousedown = undefined;
    mouse.sourceEvents.mouseup = undefined;
    mouse.sourceEvents.mousewheel = undefined;
    mouse.wheelDelta = 0;
};

/**
 * Sets the mouse position offset.
 * @method setOffset
 * @param {Mouse} mouse
 * @param {Vector} offset
 */
export function setOffset(mouse: Mouse, offset: Vector) {
    mouse.offset.x = offset.x;
    mouse.offset.y = offset.y;
    mouse.position.x = mouse.absolute.x * mouse.scale.x + mouse.offset.x;
    mouse.position.y = mouse.absolute.y * mouse.scale.y + mouse.offset.y;
};

/**
 * Sets the mouse position scale.
 * @method setScale
 * @param {mouse} mouse
 * @param {Vector} scale
 */
export function setScale(mouse: Mouse, scale: Vector) {
    mouse.scale.x = scale.x;
    mouse.scale.y = scale.y;
    mouse.position.x = mouse.absolute.x * mouse.scale.x + mouse.offset.x;
    mouse.position.y = mouse.absolute.y * mouse.scale.y + mouse.offset.y;
};

/**
 * Gets the mouse position relative to an element given a screen pixel ratio.
 * @method _getRelativeMousePosition
 * @private
 * @param {} event
 * @param {HTMLElement} element
 * @param {number} pixelRatio
 */
function _getRelativeMousePosition(event: MouseEvent | TouchEvent, element: HTMLElement, pixelRatio: number) {
    const elementBounds = element.getBoundingClientRect();
    const rootNode = (document.documentElement || document.body.parentNode || document.body);
    const scrollX = (window.pageXOffset !== undefined) ? window.pageXOffset : rootNode.scrollLeft;
    const scrollY = (window.pageYOffset !== undefined) ? window.pageYOffset : rootNode.scrollTop;
    const touches = (event as TouchEvent).changedTouches;
    let x, y;

    if (touches) {
        x = touches[0].pageX - elementBounds.left - scrollX;
        y = touches[0].pageY - elementBounds.top - scrollY;
    } else {
        x = (event as MouseEvent).pageX - elementBounds.left - scrollX;
        y = (event as MouseEvent).pageY - elementBounds.top - scrollY;
    }

    return {
        x: x / (element.clientWidth / ((element as HTMLImageElement).width || element.clientWidth) * pixelRatio),
        y: y / (element.clientHeight / ((element as HTMLImageElement).height || element.clientHeight) * pixelRatio)
    };
};
