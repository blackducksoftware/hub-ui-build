require('./ui-up');

const path = require('path');
const execute = require('./lib/execute');

const hubBuildPath = path.resolve(__dirname, 'commands/hub-start.command');

execute.newTerminal(hubBuildPath);
