const chalk = require('chalk');

module.exports = (msg) => {
    console.log(chalk.bgCyan.black(msg));
};

module.exports.command = (msg) => {
    console.log(chalk.bgYellowBright.black.bold(msg));
};

module.exports.data = (msg) => {
    process.stdout.write(msg);
};

module.exports.error = (msg) => {
    console.log(chalk.red(msg));
};
