const fs = require('fs-extra');
const readline = require('readline');

const isFile = (filePath) => {
    return fs.stat(filePath)
        .then(stats => stats.isFile())
        .catch(() => false);
};

const isDirectory = (dirPath) => {
    return fs.stat(dirPath)
        .then(stats => stats.isDirectory())
        .catch(() => false);
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

const modifyFile = (filePath, modifyFn) => {
    let fileContent = '';

    return readFileLines(filePath, (line) => {
        fileContent += `${modifyFn(line)}\n`;
    })
        .then(() => fs.writeFile(filePath, fileContent));
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

// This function will only insert lines if they
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
        .then(() => fs.writeFile(filePath, `${fileContent}${newLines.join('\n')}`));
};

module.exports = Object.assign(fs, {
    isFile,
    isDirectory,
    readFileLines,
    filterFile,
    modifyFile,
    concatUniqueLines
});
