const gonzales = require('gonzales-pe');
const esprima = require('esprima');

function createSelector(parseTree, name) {
    "use strict";

    parseTree.content.push(gonzales.createNode({
        "type": "space",
        "content": "\n\n"
    }));

    let node = gonzales.createNode({
        "type": "ruleset",
        "content": [
            {
                "type": "selector",
                "content": [
                    {
                        "type": "class",
                        "content": [
                            {
                                "type": "ident",
                                "content": name
                            }
                        ]
                    }
                ]
            },
            {
                "type": "space",
                "content": " "
            },
            {
                "type": "block",
                "content": [
                    {
                        "type": "space",
                        "content": "\n  "
                    },
                    {
                        "type": "multilineComment",
                        "content": "style"
                    },
                    {
                        "type": "space",
                        "content": "\n"
                    }
                ]
            }
        ]
    });
    parseTree.content.push(node);
}

function parseStyle(syntax, css) {
    "use strict";
    let parseTree = gonzales.parse(css, {syntax});

    const classes = {};
    const list = [];
    const json = parseTree;
    if (json.type == 'stylesheet' && json.content) {
        for (let i = 0; i < json.content.length; i++) {
            const ruleset = json.content[i];
            let isEmpty = false;
            const rulesetIdents = [];
            if (ruleset.type == 'ruleset' && ruleset.content) {
                for (let j = 0; j < ruleset.content.length; j++) {
                    const selector = ruleset.content[j];
                    if (selector.type == 'selector' && selector.content) {
                        for (let k = 0; k < selector.content.length; k++) {
                            const cls = selector.content[k];
                            if (cls.type == 'class' && cls.content) {
                                for (let l = 0; l < cls.content.length; l++) {
                                    const ident = cls.content[l];
                                    if (ident.type == 'ident') {
                                        const name = ident.content;
                                        rulesetIdents.push(name);
                                        const item = {index: i, name, empty: false};
                                        classes[name] = item;
                                        list.push(item);
                                    }
                                }
                            }
                        }
                    }

                    if (selector.type == 'block' && selector.content) {
                        decl: for (let k = 0; k < selector.content.length; k++) {
                            const decl = selector.content[k];
                            if (decl.type == 'multilineComment' && decl.content == 'style') {
                                isEmpty = true;
                            }
                            if (decl.type == 'declaration') {
                                isEmpty = false;
                                break decl;
                            }

                        }
                    }

                }
                if (isEmpty) {
                    if (rulesetIdents.length == 1) {
                        classes[rulesetIdents[0]].empty = true;
                    }
                }
            }
        }
    }
    return {
        parseTree,
        list,
        classes
    };
}


function diffStyle(syntax, css, names, excludes) {
    const res = parseStyle(syntax, css);
    if (excludes && excludes.constructor !== Array) {
        excludes = null;
    }
    main: for (let i = 0; i < names.length; i++) {
        const name = names[i];
        if (excludes) {
            for (let j = 0; j < excludes.length; j++) {
                const excl = excludes[j];
                if (excl.test(name)) {
                    continue main;
                }
            }
        }

        if (res.classes[name]) {
            res.classes[name].empty = false;
        } else {
            console.log("Create style rule ." + name);
            createSelector(res.parseTree, name);
        }
    }

    let shift = 0;
    for (let i = 0; i < res.list.length; i++) {
        const item = res.list[i];
        if (item.empty) {
            console.log("Remove style rule ." + item.name);
            res.parseTree.removeChild(item.index + shift);
        }
    }
    return res.parseTree.toString();
}

// const names = ['body', 'artur', 'hello-world', 'wtf', 'w2', 'yeah', 'good', 'fui', 'foo'];
// console.log(diffStyle(names));

function parseJSXClassNames(program) {
    const tokens = esprima.tokenize(program);
    const classNames = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.type == 'Identifier' && token.value == 'className') {
            const nextToken = tokens[i + 1];
            const nextNextToken = tokens[i + 2];
            if (nextToken && nextToken.value == ':' && nextNextToken && nextNextToken.type == 'String') {
                const cls = nextNextToken.value.substr(1, nextNextToken.value.length - 2).split(' ');
                for (let j = 0; j < cls.length; j++) {
                    const name = cls[j];
                    if (name) {
                        classNames.push(name);
                    }
                }
            }
        }
    }
    return classNames;
}

// Loader adding a header
// const path = require("path");
const fs = require('fs');
const path = require('path');
const configKey = 'autoCssLoader';
module.exports = function (source, sourcemap) {
    this.cacheable();
    // const callback = this.async();
    // const headerPath = path.resolve("header.js");
    // this.addDependency(headerPath);

    const config = {
        excludes: null,
        syntax: 'css'
    };

    const options = this.options[configKey];
    if (options) {
        config.excludes = options.excluded;
        config.syntax = options.syntax;
    }

    const cssFile = path.dirname(this.resource) + '/' + path.basename(this.resource).replace(/\..*?$/, '.' + config.syntax);
    try {
        const classNames = parseJSXClassNames(source);
        if (classNames.length) {
            // console.log(classNames);
            // console.log(cssFile);
            let content = '';
            try {
                content = fs.readFileSync(cssFile, 'utf-8');
            } catch(e) {
                return this.callback(null, source, sourcemap);
            }
            const newStyle = diffStyle(config.syntax, content, classNames, config.excludes);
            fs.writeFileSync(cssFile, newStyle);
        }

    } catch (e) {
        console.error(e);
    }

    this.callback(null, source, sourcemap);

    /*
     fs.readFile(headerPath, "utf-8", function (err, header) {
     if (err) return callback(err);
     callback(null, header + "\n" + source);
     });
     */
};

