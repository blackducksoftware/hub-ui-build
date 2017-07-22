const path = require('path');
const execute = require('./lib/execute');

const buildPath = path.resolve(__dirname, 'ui-build.command');
const proxyPath = path.resolve(__dirname, 'ui-proxy.command');

Promise.all([
        execute.setPermission(buildPath),
        execute.setPermission(proxyPath)
    ])
    .then(() => Promise.all([
        execute(`open ${buildPath}`),
        execute(`open ${proxyPath}`)
    ]));
