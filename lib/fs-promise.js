const fs = require('fs');
const readline = require('readline');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');

const stat = (dirPath) => {
    return new Promise((resolve, reject) => {
        fs.stat(dirPath, (err, stats) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(stats);
        });
    });
};

const isFile = (filePath) => {
    return stat(filePath)
        .then(stats => stats.isFile());
};

const isDirectory = (dirPath) => {
    return stat(dirPath)
        .then(stats => stats.isDirectory());
};

const removeDirectory = (dirPath) => {
    return new Promise((resolve, reject) => {
        rimraf(dirPath, (err) => {
            if (err) {
                reject(err);
            }
            resolve();
        });
    });
};

const makeDirectory = (dirPath) => {
    return new Promise((resolve, reject) => {
        mkdirp(dirPath, (err) => {
            if (err) {
                reject(err);
            }
            resolve();
        });
    });
};

const cleanDirectory = (dirPath) => {
    return removeDirectory(dirPath)
        .then(() => makeDirectory(dirPath));
};

const writeFile = (filePath, content) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, content, (err) => {
            if (err) {
                reject(err);
            }
            resolve();
        });
    });
};

const readFile = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            }
            resolve(data);
        });
    });
};

const readFileLines = (filePath, listener) => {
    const reader = readline.createInterface({
        input: fs.createReadStream(filePath)
    });

    reader.on('line', listener);

    return new Promise((resolve) => {
        reader.on('close', resolve);
    });
};

const filterFile = (filePath, evalFn) => {    
    let fileContent = '';

    return readFileLines(filePath, (line) => {
            if (evalFn(line)) {
                fileContent += `${line}\n`;
            }
        })
        .then(() => fileContent);
};

// This function is idempotent, it will only insert lines if they 
// aren't already in the file.
const concatUniqueLines = (filePath, lines) => {
    let newLines = lines.slice();
    let fileContent = '';

    return readFileLines(filePath, (line) => {
            const trimmedLine = line.trim();
            newLines = newLines
                .filter(newLine => newLine !== trimmedLine);
            fileContent += `${line}\n`;
        })
        .then(() => writeFile(filePath, `${fileContent}${newLines.join('\n')}`));
};

module.exports = {
    stat,
    isFile,
    isDirectory,
    removeDirectory,
    makeDirectory,
    cleanDirectory,
    writeFile,
    readFile,
    readFileLines,
    filterFile,
    concatUniqueLines
};
