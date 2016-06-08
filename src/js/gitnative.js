'use strict';

var path = require('path'),
    fs = require('fs'),
    exec = require('child_process').exec,
    utils = require('../js/lib/utils');

function createTagName(datetime) {
    return 'R2P/' +
        datetime.getFullYear().toString() + '-' +
        utils.padZero(datetime.getMonth()+1) + '-' +
        utils.padZero(datetime.getDate()) + '/' +
        utils.padZero(datetime.getHours()) + '.' +
        utils.padZero(datetime.getMinutes()) + '.' +
        utils.padZero(datetime.getSeconds());
}

function GitManager() {

    var logr = utils.logr;
    var toJSON = _.partialRight(JSON.stringify, null, '\t');

    function cmd(s) {
        var str = s || '';

        return {
            cd: function (dir) {
                return cmd(str + 'cd "' + dir + '"');
            },

            get and () {
                return cmd(str + ' && ');
            },

            get then () {
                var c = process.platform === 'win32' ? '& ' : '; ';

                return cmd(str + c);
            },

            get or () {
                return cmd(str + ' || ');
            },

            set: function (name, val) {
                var c = process.platform === 'win32' ?
                            `set ${name}=${val} & ` :
                            `${name}='${val}' `;

                return cmd(str + c);
            },

            do: function (c) {
                return cmd(str + c);
            },

            run: function () {
                return new Promise(function (resolve, reject) {
                    exec(str, function (err, stdout, stderr) {
                        var ret = {
                            stdout: stdout,
                            stderr: stderr,
                            error: err
                        };

                        (err && reject(ret)) || resolve(ret);
                    });
                });
            },

            toString: function () {
                return str;
            }
        };
    }

    return {

        getHash: function (dir) {
            return cmd().cd(dir).and.do('git rev-parse HEAD').run();
        },

        init: function (dir) {
            return utils.fs.readdir(dir).then(function (files) {
                var init = cmd().cd(dir).and.do('git init');
                var hasGitFolder = (files.indexOf('.git') >= 0);

                return !hasGitFolder && init.run();
            }).then(logr('Git is initialized'));
        },

        commitAll: function (user, dir) {
            var msg = new Date();
            var username = user.username || 'tsDesktop';
            var email = user.email || 'you@example.com';
            var stage = cmd().cd(dir)
                    .and.do(`git config user.name "${username}"`)
                    .and.do(`git config user.email "${email}"`)
                    .and.do('git config core.autocrlf input')
                    .and.do('git add --all')
                    .and.do(`git commit -am "${msg}"`);

            return stage.run()
                .catch(function (err) {
                    if (!err.stdout.includes('nothing to commit')) {
                        throw err;
                    }
                    return true;
                })
                .then(logr('Files are committed'));
        },

        merge: function (user, localPath, remotePath) {
            var mythis = this;
            var localManifestPath = path.join(localPath, 'manifest.json');
            var remoteManifestPath = path.join(remotePath, 'manifest.json');
            var mergedManifest = {};
            var hasConflicts = false;

            // NOTE: should switch to using a fetch/merge instead of pull, so we don't depend on Perl
            var pull = cmd().cd(localPath).and.do(`git pull ${remotePath} master`);

            return Promise.all([utils.fs.readFile(localManifestPath), utils.fs.readFile(remoteManifestPath)])
                .then(function (fileData) {
                    var localManifest = JSON.parse(fileData[0]);
                    var remoteManifest = JSON.parse(fileData[1]);
                    mergedManifest = localManifest;
                    mergedManifest.translators = _.union(localManifest.translators, remoteManifest.translators);
                    mergedManifest.finished_chunks = _.union(localManifest.finished_chunks, remoteManifest.finished_chunks);
                })
                .then(function () {
                    return pull.run()
                        .catch(function (err) {                            
                            if (err.stdout.includes('fix conflicts')) {                                
                                hasConflicts = true;
                                return true;
                            }                            
                            throw err;
                        })
                })
                .then(function () {                    
                    return utils.fs.outputFile(localManifestPath, toJSON(mergedManifest));
                })
                .then(function () {
                    return mythis.commitAll(user, localPath);
                })
                .catch(function (err) {
                    throw "Error while merging projects: " + err.stdout;
                })
                .then(utils.logr("Finished merging"))
                .then(function () {
                    return hasConflicts;
                });

        },

        push: function (user, dir, repo, opts) {
            // TODO: check opts.requestToPublish and create the appropriate publish tag if needed

            var ssh = `ssh -i "${user.reg.paths.privateKeyPath}" -o "StrictHostKeyChecking no"`;
            var pushUrl = user.reg ? repo.ssh_url : repo.html_url;
            var gitSshPush = `git push -u ${pushUrl} master`;
            var push = cmd().cd(dir).and.set('GIT_SSH_COMMAND', ssh).do(gitSshPush);

            console.log('Starting push to server...\n' + push);

            return push.run().then(logr('Files are pushed'));
        },

        clone: function (repoUrl, localPath) {
            var repoName = repoUrl.replace(/\.git/, '').split('/').pop();
            var savePath = localPath.includes(repoName) ? localPath : path.join(localPath, repoName);
            var clone = cmd().do(`git clone ${repoUrl} ${savePath}`);

            return clone.run()
                .catch(function (err) {
                    if (err.error) {
                        throw err;
                    }
                    return err;
                })
                .then(logr('Project cloned'));
        }
    };
}

module.exports.GitManager = GitManager;
