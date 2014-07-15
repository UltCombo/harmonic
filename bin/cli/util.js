var localconfig = require('../config'),
    helpers = require('../helpers'),
    fs = require('fs'),
    path = require('path'),
    Promise = require('promise'),
    staticServer = require('node-static'),
    co = require('co'),
    prompt = require('co-prompt'),
    confirm = prompt.confirm,
    _ = require('underscore'),
    ncp = require('ncp').ncp;

module.exports = {

    init: function(p) {
        var sitePath = p,
            skeletonPath = path.normalize(localconfig.rootdir + '/bin/skeleton'),
            copySkeleton = function() {
                return new Promise(function(resolve, reject) {
                    ncp(skeletonPath, sitePath, function(err) {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve('Harmonic skeleton started at: ./' + sitePath);
                    });
                });
            },
            that = this,
            clc = helpers.cli_color();

        fs.exists(sitePath, function(exists) {
            if (!exists) {
                fs.mkdirSync(sitePath, 0766);
            }
            copySkeleton().then(function(msg) {
                console.log(clc.message(msg));
                that.config(sitePath);
            });
        });
    },

    config: function(p) {
        var clc = helpers.cli_color(),
            manifest = p ? p + '/harmonic.json' : './harmonic.json';

        co(function *() {
            console.log(clc.message('This guide will help you to create your Harmonic configuration file\nJust hit enter if you are ok with the default values.\n\n'));

            var config,
                templateObj = {
                    name: 'Awesome website',
                    title: 'My awesome static website',
                    domain: 'http://awesome.com',
                    subtitle: 'Powered by Harmonic',
                    author: 'Jaydson',
                    description: 'This is the description',
                    bio: 'Thats me',
                    template: 'default',
                    preprocessor: 'stylus',
                    posts_permalink: ':year/:month/:title',
                    pages_permalink: 'pages/:title',
                    header_tokens: ['<!--', '-->'],
                    index_posts: 10,
                    i18n: {
                        'default': 'en',
                        'languages': ['en', 'pt-br']
                    }
                };

            config = {
                name: (yield prompt(clc.message('Site name: (' + templateObj.name + ') '))) || templateObj.name,
                title: (yield prompt(clc.message('Title: (' + templateObj.title + ') '))) || templateObj.title,
                subtitle: (yield prompt(clc.message('Subtitle: (' + templateObj.subtitle + ') '))) || templateObj.subtitle,
                description: (yield prompt(clc.message('Description: (' + templateObj.description + ') '))) || templateObj.description,
                author: (yield prompt(clc.message('Author: (' + templateObj.author + ') '))) || templateObj.author,
                bio: (yield prompt(clc.message('Author bio: (' + templateObj.bio + ') '))) || templateObj.bio,
                template: (yield prompt(clc.message('Template: (' + templateObj.template + ') '))) || templateObj.template
            }

            /* create the configuration file */
            fs.writeFile(manifest, JSON.stringify(_.extend(templateObj, config), null, 4), function(err) {
                if (err) {
                    throw err;
                }
                console.log(clc.message('\nYour Harmonic website skeleton was successefuly created!\nNow, enter in the project dir and have fun.'));
            });

            process.stdin.pause();

        })();
    },

    new_post: function(title) {
        var clc = helpers.cli_color();
        return new Promise(function(resolve, reject) {
            var langs = helpers.getConfig().i18n.languages,
                template = '<!--\n' +
                    'layout: post\n' +
                    'title: ' + title + '\n' +
                    'date: ' + new Date().toJSON() + '\n' +
                    'comments: true\n' +
                    'published: true\n' +
                    'keywords:\n' +
                    'description:\n' +
                    'categories:\n' +
                    '-->\n' +
                    '# ' + title,
                str = title.replace(/[^a-z0-9]+/gi, '-').replace(/^-*|-*$/g, '').toLowerCase(),
                path = localconfig.postspath,
                filename = str + '.md';

            for (var i = 0; i < langs.length; i += 1) {
                /* create a new post */
                fs.writeFileSync(path + langs[i] + '/' + filename, template);
            }
            resolve(clc.info('Post "' + title + '" was successefuly created, check your /src/posts folder'));
        });
    },

    run: function(port) {
        var clc = helpers.cli_color(),
            file = new staticServer.Server('./public');
        console.log(clc.info('Harmonic site is running on http://localhost:' + port));
        require('http').createServer(function(request, response) {
                request.addListener('end', function() {
                        file.serve(request, response);
                    }).resume();
            }).listen(port);
    }
}
