const chalk = require('chalk');

module.exports = (msg) => {
    console.log(`${chalk.bgCyan.black.bold('log')}: ${chalk.bgBlack.cyan(msg)}`);
};

module.exports.command = (msg) => {
    console.log(chalk.bgBlack.yellowBright(`${chalk.bgYellowBright.black.bold('command')}: ${msg}`));
};

module.exports.data = (msg) => {
    process.stdout.write(msg);
};

module.exports.error = (msg) => {
    console.log(chalk.red(msg));
};
