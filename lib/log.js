const chalk = require('chalk');

const getCommandColor = (msg) => {
    return chalk.bgBlack.yellowBright(msg);
};

const log = (msg) => {
    console.log(`${chalk.bgCyan.black.bold('log')}: ${chalk.bgBlack.cyan(msg)}`);
};

const command = (msg) => {
    console.log(chalk.bgBlack.yellowBright(`${chalk.bgYellowBright.black.bold('command')}: ${msg}`));
};

const data = (msg) => {
    process.stdout.write(msg);
};

const error = (msg) => {
    console.log(chalk.red(msg));
};

Object.assign(log, {
    command,
    data,
    error,
    getCommandColor
});

module.exports = log;
