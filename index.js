const inquirer = require('inquirer');
const fs = require('./lib/fs-promise');
const path = require('path');
const os = require('os');

if (os.platform() === 'win32') {
    throw new Error('We don\'t support aliases for Windows');
}

const writeEnvConfig = () => {
    return inquirer.prompt([
        {
            message: 'What\'s the resolved or relative path to the rest-backend directory?',
            name: 'HUB_REPO_DIR',
            default: path.join(__dirname, '../rest-backend'),
            filter: (dir) => path.resolve(__dirname, dir)
        },
        {
            message: 'Same question, for the UI directory?',
            name: 'UI_REPO_DIR',
            default: path.join(__dirname, '../ui'),
            filter: (dir) => path.resolve(__dirname, dir)
        }
    ])
        .then((config) => {
            return fs.writeFile(
                path.resolve(__dirname, '.env'),
                Object.keys(config)
                    .map(param => `${param}=${config[param]}`)
                    .join('\n')
            );
        })
};

const loadEnvConfig = () => {
    try {
        require('dotenv-safe').load({
            path: path.resolve(__dirname, '.env'),
            sample: path.resolve(__dirname, '.env.example')
        });
    } catch (err) {
        console.error(err.toString() + '\n');
        return writeEnvConfig();
    }
};

fs.stat('./.env')
    .catch(writeEnvConfig)
    .then(loadEnvConfig)
    .then(() => require('./bash-aliases'));
