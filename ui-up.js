const path = require('path');
const execute = require('./lib/execute');

const uiBuildPath = path.resolve(__dirname, 'commands/ui-build.command');
const proxyPath = path.resolve(__dirname, 'commands/ui-proxy.command');

Promise.all([
    execute.newTerminal(uiBuildPath),
    execute.newTerminal(proxyPath)
]);
