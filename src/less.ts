import less from 'less';
import {
    readFileSync,
} from 'fs';
import {
    getPreProcessorsConfig,
} from './utils';
const [,, filePath, configPath] = process.argv;

// eslint-disable-next-line no-console
const originalConsoleLog = console.log;
// eslint-disable-next-line no-console
console.log = (): void => {};
// eslint-disable-next-line no-console
console.warn = (): void => {};
// eslint-disable-next-line no-console
console.info = (): void => {};

less.render(
    readFileSync(filePath, {encoding: 'utf-8'}),
    Object.assign(
        getPreProcessorsConfig(configPath).lessConfig || {},
        {filename: filePath}
    ) as Less.Options,
).then(
    ({css}) => {
        originalConsoleLog.call(console, css);
    },
    (error) => {
        // eslint-disable-next-line no-console
        console.error(error);
    }
);
