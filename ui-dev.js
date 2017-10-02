require('./ui-up');

const path = require('path');
const execute = require('./lib/execute');

const hubBuildPath = path.join(__dirname, 'commands/hub-start.sh');

execute.newTerminal(hubBuildPath);
