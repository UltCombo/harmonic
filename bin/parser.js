var fs = require('fs');
var marked = require('marked');
var path = './src/posts/';
var nodePath = require('path');
var markextra = require('markdown-extra');
var _ = require('underscore');
var nunjucks = require('nunjucks');
var co = require('co');
var Promise = require('promise');
var ncp = require('ncp').ncp;
var permalinks = require('permalinks');
var nodefs = require('node-fs');

var Parser = function() {

	this.start = function() {
		return new Promise(function (resolve, reject) {
			resolve('starting the parser');
		});
	};

	this.createPublicFolder = function (argument) {
		fs.exists('./public', function(exists) {
			if(!exists){
				fs.mkdirSync("public", 0766, function(err){
			       	if (err) throw err;
			    });
				console.log('Successefuly generate public folder');
			}
		});
	};

	this.generateTagsPages = function (postsMetadata) {
		var postsByTag = {};
		var curTemplate = GLOBAL.config.template;
		var nunjucksEnv = GLOBAL.config.nunjucksEnv;
		var tagTemplate = fs.readFileSync('./src/templates/' + curTemplate + '/tag_archives.html');
		var tagTemplateNJ = nunjucks.compile(tagTemplate.toString(), nunjucksEnv);
		var indexContent = '';

		return new Promise(function(resolve, reject) {
			for (var i = 0; i < postsMetadata.length; i += 1) {
				var tags = postsMetadata[i].categories;
				for (var y = 0; y < tags.length; y += 1) {
					var tag = tags[y]
							.toLowerCase()
							.trim()
							.split(' ')
							.join('-');

					if (Array.isArray(postsByTag[tag])) {
						postsByTag[tag].push(postsMetadata[i]);
					} else {
						postsByTag[tag] = [postsMetadata[i]];
					}
				}
			}
			
			for (var i in postsByTag) {
				tagContent = tagTemplateNJ.render({ posts : postsByTag[i], config : GLOBAL.config });

				nodefs.mkdirSync('./public/categories/' + i, 0777, true);
				/* write tag arcive html file */
				(function (y) {
					fs.writeFile('./public/categories/' + y + '/index.html', tagContent, function (err) {
						if (err) throw err;
						console.log('Successefuly generate tag[' + y + '] archive html file');
					});
				}(i));
			}
			resolve(postsMetadata);
		});
	};

	this.generateIndex = function (postsMetadata) {
		return new Promise(function(resolve, reject) {
			var curTemplate = GLOBAL.config.template;
			var nunjucksEnv = GLOBAL.config.nunjucksEnv;
			var indexTemplate = fs.readFileSync('./src/templates/' + curTemplate + '/index.html');
			var indexTemplateNJ = nunjucks.compile(indexTemplate.toString(), nunjucksEnv);
			var indexContent = '';
			indexContent = indexTemplateNJ.render({ posts : postsMetadata, config : GLOBAL.config });

			/* write index html file */
			fs.writeFile('./public/index.html', indexContent, function (err) {
				if (err) throw err;
				console.log('Successefuly generate index html file');
				resolve(postsMetadata);
			});
		});
	};

	this.copyResources = function() {
		return new Promise(function (resolve, reject) {
			var curTemplate = './src/templates/' + GLOBAL.config.template;
			ncp(curTemplate + '/resources', './public', function (err) {
				if (err) {
					reject(err);
					return;
				}
				resolve('Resources copied');
			});
		});
	};

	this.generatePosts = function(postsMetadata) {
		return new Promise(function(resolve, reject) {
			var config = GLOBAL.config;
			var curTemplate = config.template;
			postsMetadata.forEach(function (metadata, i) {
				fs.readFile(metadata.file, function (err, data) {
					var postsTemplate = fs.readFileSync('./src/templates/' + curTemplate + '/post.html');
					var nunjucksEnv = config.nunjucksEnv;
					var postsTemplateNJ = nunjucks.compile(postsTemplate.toString(), nunjucksEnv);
					var markfile = data.toString();
					var postPath = permalinks(config.permalink, { title : metadata.filename });
					var filename = 'index.html';
					var categories = metadata.categories.split(',');
					metadata.link = postPath;
					metadata.categories = categories;

					var _post = {
						content : marked(markfile),
						metadata : metadata
					}

					var postHTMLFile = postsTemplateNJ.render({ post : _post, config : GLOBAL.config });

					/* Removing header metadata */
					postHTMLFile = postHTMLFile.replace(/<!--[\s\S]*?-->/g, '');

					nodefs.mkdir('./public/' + postPath, 0777, true, function (err) {
						if (err) {
							console.log(err);
						} else {
							/* write post html file */
							fs.writeFile('./public/' + postPath + '/' + filename, postHTMLFile, function (err) {
								if (err) throw err;
								console.log('Successefuly generate post html file ' + filename);
								resolve(postsMetadata);
							});	
						}
					});
				});
			});
		});
	};

	this.getFiles = function() {
		return new Promise(function (resolve, reject) {

			/* Reading posts dir */
			fs.readdir(path, function (err, files) {
				if (err) {
					throw err;
				}

				resolve(files);
			});
		});
	};

	this.getConfig = function() {
		return new Promise(function (resolve, reject) {
			var config = JSON.parse(fs.readFileSync( "./config.json").toString());
			GLOBAL.config = config;
			GLOBAL.config.nunjucksEnv = new nunjucks.Environment(new nunjucks.FileSystemLoader('./src/templates/' + config.template));
			resolve(config);
		});
	};

	this.getMarkdownMetadata = function(data) {
		var posts = [];
		return new Promise(function (resolve, reject) {
			var curTemplate = GLOBAL.config.template;

			data.forEach(function (file, i) {
				var post = fs.readFileSync( path + "/" + file).toString();
				var postsTemplate = fs.readFileSync('./src/templates/' + curTemplate + '/post.html');
				var nunjucksEnv = GLOBAL.config.nunjucksEnv;
				var postsTemplateNJ = nunjucks.compile(postsTemplate.toString(), nunjucksEnv);
				var markfile = post.toString();
				var filename = file.split('.md')[0];

				/* Markdown extra */
				var metadata = markextra.metadata(markfile, function (md) {
					var retObj = {};
					md.split('\n').forEach(function(line) {
						var data = line.split(':');
						retObj[data[0].trim()] = data[1].trim();
					});
					return retObj;
				});

				var _post = {
					content : marked(markfile),
					metadata : metadata
				}

				var postContent = nunjucks.compile(marked(post.split('<!--more-->')[0]), nunjucksEnv);
				var postHTMLFile = postContent.render({ post : _post, config : GLOBAL.config });
				/* Removing header metadata */
				postHTMLFile = postHTMLFile.replace(/<!--[\s\S]*?-->/g, '');

				metadata['content'] = postHTMLFile;
				metadata['file'] = path + file;
				metadata['filename'] = filename;
				metadata['link'] = '/' + filename + '.html';
				posts.push(metadata);

				if (i === data.length - 1) {
					resolve(posts);
				}
			});
		});
	};
}

module.exports = Parser;
