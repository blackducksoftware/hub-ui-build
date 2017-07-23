const path = require('path');
const execute = require('./lib/execute');

const hubBuildPath = path.resolve(__dirname, 'commands/hub-start.command');
const uiBuildPath = path.resolve(__dirname, 'commands/ui-build.command');
const proxyPath = path.resolve(__dirname, 'commands/ui-proxy.command');

Promise.all([
    execute(`open ${hubBuildPath}`),
    execute(`open ${uiBuildPath}`),
    execute(`open ${proxyPath}`)
]);
