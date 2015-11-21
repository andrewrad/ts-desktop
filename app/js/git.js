// git module

'use strict';

var path = require('path'),
	fs = require('fs'),
	exec = require('child_process').exec;

function Git() {

	return {

		// Initialize folder as git repository if it's not one already
		init: function(dir) {
			fs.readdir(dir, function(err, files) {
				if (files.indexOf('.git') < 0) {
					var cmd = 'cd ' + dir + ' && git init';
					exec(cmd, function(err, stdout, stderr) {
						console.log("Git is initialized:", stdout);
					});
				}
			});
		},

		// Add and commit all changed files with the given message
		stage: function(dir) {
			var msg = new Date();
			var cmd = 'cd ' + dir + ' && git add --all && git commit -am "' + msg + '"';
			exec(cmd, function(err, stdout, stderr) {
				console.log("Files are staged:", stdout);
			});
		},

		// Push staged files to remote repo
		push: function(remote, branch) {
			var cmd = 'git push ' + remote + ' ' + branch;
			exec(cmd, function(err, stdout, stderr) {
				console.log("Files are being pushed:", stdout);
			});
		}
	}
}

module.exports.Git = Git;