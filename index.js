'use strict';

const inquirer = require('inquirer');
const fs = require('./lib/fs-promise');
const path = require('path');
const os = require('os');

if (os.platform() !== 'darwin') {
    throw new Error('We only support aliases for MacOS');
}

const prompt = {
    filter: (dir) => path.resolve(__dirname, dir),
    validate: (dir) => {
        return fs.isDirectory(dir)
            .then(isDirectory => isDirectory || 'This isn\'t the directory you\'re looking forward. Try again')
    }
};

const writeEnvConfig = () => {
    return inquirer.prompt([
        Object.assign({
            message: 'What\'s the resolved or relative path to the hub-backend directory?',
            name: 'HUB_REPO_DIR',
            default: path.join(__dirname, '../hub-backend')
        }, prompt),
        Object.assign({
            message: 'Same question, for the hub-ui directory?',
            name: 'UI_REPO_DIR',
            default: path.join(__dirname, '../hub-ui'),
        }, prompt),
        {
            message: 'Which terminal config file should we source the aliases from?',
            name: 'TERMINAL_RC_PATH',
            default: '.bash_profile',
            filter: (rcPath) => path.resolve(os.homedir(), rcPath)
        }
    ])
        .then((config) => {
            process.stdout.write('\n');
            return fs.writeFile(
                path.resolve(__dirname, '.env'),
                Object.keys(config)
                    .map(param => `${param}=${config[param]}`)
                    .join('\n')
            );
        })
};

const loadEnvConfig = () => {
    const loadConfig = () => {
        require('dotenv-safe').load({
            path: path.resolve(__dirname, '.env'),
            sample: path.resolve(__dirname, '.env.example')
        });
    };

    return new Promise((resolve) => {
        try {
            loadConfig();
            resolve();
        } catch (err) {
            writeEnvConfig()
                .then(() => {
                    loadConfig();
                    resolve();
                });
        }
    })

};

loadEnvConfig()
    .then(() => require('./bash-aliases'))
    .catch((err) => console.error(err));
