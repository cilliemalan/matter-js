import './style.css'
import type { Example } from './examples/_common';

const container = document.getElementById("app")!;
const examples = import.meta.glob('./examples/*.ts');

function delay(time: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, time)
    })
}

async function runExamples() {
    for (; ;) {
        for (const key in examples) {
            const example: any = await examples[key]();
            for (const key in example) {
                const possibleExample = example[key] as Example;
                if (typeof possibleExample === 'function' &&
                    possibleExample.title) {

                    console.log(`loading example "${possibleExample.title}"`);
                    const { canvas, stop } = possibleExample();

                    while (container.firstChild) {
                        container.removeChild(container.firstChild);
                    }
                    container.appendChild(canvas);

                    await delay(5000);

                    stop();
                }
            }
        }
    }
};

runExamples().catch(console.error);
