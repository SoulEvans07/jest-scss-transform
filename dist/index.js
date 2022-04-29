"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const child_process_1 = require("child_process");
const postcss_1 = __importDefault(require("postcss"));
const parser_1 = __importDefault(require("./parser"));
const utils_parser_1 = require("./utils-parser");
const postcss_nested_1 = __importDefault(require("postcss-nested"));
const utils_1 = require("./utils");
const CONFIG_PATH = process.env.JEST_CSS_MODULES_TRANSFORM_CONFIG || 'jest-css-modules-transform-config.js';
const postcssNested = (0, postcss_1.default)([postcss_nested_1.default]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let postcssConfig;
let stylus;
let sass;
const moduleTemplate = `
    const data = %s;

    if (typeof module === 'object' && module) {
        Object.defineProperty(data, "__esModule", {
            value: true
        });
        module.exports = new Proxy(data, {
            get(target, attr) {
                if (attr === 'default') {
                    return target;
                };
                return target[attr];
            },

            getPrototypeOf() {
                return Object;
            }
        });
    } else {
        Object.defineProperty(exports, "__esModule", {
            value: true
        });
        exports.default = data;
    }
`
    .trim()
    .replace(/^\s{4}/g, '');
const injectCssTemplate = `
    const style = document.createElement('style');
    style.innerHTML = \`%s\`;
    document.head.appendChild(style);
`
    .trim()
    .replace(/^\s{4}/g, '');
let preProcessorsConfig;
let globalSassData;
const getGlobalSassData = (rootDir) => {
    try {
        return `${require((0, path_1.resolve)(rootDir, '.sassrc.js')).data}\n` || '';
    }
    catch (e) {
        return '';
    }
};
const getFileExtension = (path) => {
    const filename = path.slice(path.lastIndexOf(path_1.sep) + 1);
    return filename.slice(filename.lastIndexOf('.') + 1);
};
const reguireSassModule = () => {
    for (const moduleName of [preProcessorsConfig.sassModuleName, 'sass', 'node-sass']) {
        if (!moduleName) {
            continue;
        }
        try {
            const moduleSass = require(moduleName);
            if (moduleSass) {
                return moduleSass;
            }
        }
        catch (e) {
            // pass
        }
    }
    return null;
};
const getSassContent = (src, path, extention, rootDir) => {
    sass = sass || reguireSassModule();
    if (!sass) {
        throw Error('Can\'t find sass or node-sass module');
    }
    globalSassData = globalSassData === undefined ? getGlobalSassData(rootDir) : globalSassData;
    const sassConfig = Object.assign(preProcessorsConfig.sassConfig || {}, {
        data: globalSassData + src,
        file: path,
        indentedSyntax: extention === 'sass',
    });
    return String(sass.renderSync(sassConfig).css);
};
let parser;
let configPath = '';
let postcssConfigPath = '';
const lessPath = (0, path_1.resolve)(__dirname, 'less.js');
const postcssPath = (0, path_1.resolve)(__dirname, 'postcss.js');
const nodeExecOptions = {
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 1024,
};
let getFileData;
const fs = require('fs');
const crypto = require('crypto');
const THIS_FILE = fs.readFileSync(__filename);
const moduleTransform = {
    getCacheKey(sourceText, sourcePath, configString) {
        const key = crypto
            .createHash('md5')
            .update(THIS_FILE)
            .update('\0', 'utf8')
            .update(sourceText)
            .update('\0', 'utf8')
            .update(sourcePath)
            .update('\0', 'utf8')
            .update(JSON.stringify(configString))
            .update('\0', 'utf8')
            .update(JSON.stringify((0, utils_1.getPreProcessorsConfig)(configPath)))
            // TODO: load postcssrc (the config) sync and make it part of the cache
            // .update("\0", "utf8")
            // .update(JSON.stringify(getPostCssConfig(filename)))
            .update('\0', 'utf8')
            .digest('hex');
        return key;
    },
    process(src, path, transformConfig) {
        // Jest 27+ and Jesy 26 has different transformConfig
        const config = transformConfig.config || transformConfig;
        getFileData = getFileData || (0, utils_parser_1.createFileCache)(config.cwd);
        configPath = configPath || (0, path_1.resolve)(config.rootDir, CONFIG_PATH);
        preProcessorsConfig = preProcessorsConfig || (0, utils_1.getPreProcessorsConfig)(configPath);
        parser = parser || new parser_1.default(preProcessorsConfig.cssLoaderConfig);
        const extention = getFileExtension(path);
        let textCSS = '';
        let prependDataContent = '';
        let stylusConfig;
        if (preProcessorsConfig.prepend) {
            const urls = (0, utils_parser_1.extractUrls)(preProcessorsConfig.prepend, path);
            prependDataContent = urls.map(getFileData).join('\n\r');
        }
        switch (extention) {
            case 'styl':
                stylus = stylus || require('stylus');
                stylusConfig = Object.assign(preProcessorsConfig.stylusConfig || {}, {
                    filename: path,
                });
                stylus.render(prependDataContent ? `${prependDataContent}\n\r${src}` : src, stylusConfig, (err, css) => {
                    if (err) {
                        throw err;
                    }
                    textCSS = css;
                });
                break;
            case 'sass':
            case 'scss':
                textCSS = getSassContent(prependDataContent ? `${prependDataContent}\n\r${src}` : src, path, extention, config.rootDir);
                break;
            case 'less':
                textCSS = (0, child_process_1.execSync)(`node ${lessPath} ${path} ${configPath} ${prependDataContent ? 1 : 0}`, {
                    ...nodeExecOptions,
                    input: prependDataContent,
                });
                break;
            case 'css':
            case 'pcss':
            case 'postcss':
                postcssConfigPath = '' || (0, path_1.resolve)(config.rootDir, 'postcss.config.js');
                postcssConfig =
                    postcssConfig ||
                        preProcessorsConfig.postcssConfig ||
                        (0, utils_1.requirePostcssConfig)(postcssConfigPath);
                if (postcssConfig) {
                    textCSS = (0, child_process_1.execSync)(`node ${postcssPath} ${path} ${configPath} ${postcssConfigPath} ${prependDataContent ? 1 : 0}`, {
                        ...nodeExecOptions,
                        input: prependDataContent,
                    });
                }
                else {
                    textCSS = postcssNested.process(prependDataContent ? `${prependDataContent}\n\r${src}` : src);
                }
                break;
        }
        const moduleCode = moduleTemplate.replace('%s', JSON.stringify(parser.getCSSSelectors(textCSS)));
        if (preProcessorsConfig.injectIntoDOM) {
            const textCssString = typeof textCSS === 'string' ? textCSS : textCSS.toString();
            const textCssEscaped = textCssString
                .replace(/`/g, '\\`')
                .replace(/\\(\d)/g, '\\\\$1')
                .replace(/\$\{/g, '\\${');
            return [injectCssTemplate.replace('%s', textCssEscaped), moduleCode].join('\n');
        }
        return moduleCode;
    },
};
module.exports = moduleTransform;
