module.exports = function(grunt) {
	grunt.loadNpmTasks('grunt-contrib-watch');
	//grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-open');
	grunt.loadNpmTasks('grunt-express-server');
	// grunt.loadNpmTasks('grunt-uncss');

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		concat: {
			options: {
				banner: 'var $j = jQuery.noConflict();\n\n',
			},
			dist: {
				src: [
					"src/*.js",
					"src/utility/**/*.js",
					"src/abilities/**/*.js",
					"src/network/**/*.js"
				],
				dest: 'deploy/scripts/<%= pkg.name %>.js'
			}
		},
		express: {
			options: {
				port: 8080,
			},
			server: {
				options: {
					script: 'server.js'
				}
			}
		},
		watch: {
			js: {
				files: ['src/**/*.js'],
				tasks: ['concat'],
			},
			css: {
				files: ['src/less/**/*.less'], // which files to watch
				tasks: ['less'],
				options: {
					nospawn: true
				}
			}

		},
		copy: {
			// Copies the customized build of Phaser into the game
			// http://phaser.io/tutorials/creating-custom-phaser-builds
			phaser: {
				files: [{
					expand: true,
					src: ['bower_components/phaser/build/phaser*.js'],
					dest: 'deploy/scripts/libs/',
					filter: 'isFile',
					flatten: true
				}]
			},
			// Copy jquery to the libs folder
			jquery: {
				files: [{
					expand: true,
					src: ['bower_components/jquery/jquery*.js'],
					dest: 'deploy/scripts/libs/',
					filter: 'isFile',
					flatten: true
				}]
			},
			// Copy jquery-ui to the libs folder
			jquery_ui: {
				files: [{
					expand: true,
					src: ['bower_components/jquery-ui/jquery-ui*.js'],
					dest: 'deploy/scripts/libs/',
					filter: 'isFile',
					flatten: true
				}]
			},
			// Copy jquery-mousewheel to the libs folder
			jquery_mousewheel: {
				files: [{
					expand: true,
					src: ['bower_components/jquery-mousewheel/jquery*.js'],
					dest: 'deploy/scripts/libs/',
					filter: 'isFile',
					flatten: true
				}]
			},
			// Copy jquery kinetic to the libs folder
			jquery_kinectic: {
				files: [{
					expand: true,
					src: ['bower_components/jquery.kinetic/jquery*.js'],
					dest: 'deploy/scripts/libs/',
					filter: 'isFile',
					flatten: true
				}]
			},
			// Copy jquery transit to the libs folder
			jquery_transit: {
				files: [{
					expand: true,
					src: ['bower_components/jquery.transit/jquery*.js'],
					dest: 'deploy/scripts/libs/',
					filter: 'isFile',
					flatten: true
				}]
			},
			// Copy Prototype  to the libs folder
			prototypejs: {
				files: [{
					expand: true,
					src: ['bower_components/prototypejs/dist/prototype*.js'],
					dest: 'deploy/scripts/libs/',
					filter: 'isFile',
					flatten: true
				}]
			},
			// Copy socket-io to the libs folder
			socket_io: {
				files: [{
					expand: true,
					src: ['bower_components/socket.io-client/socket*.js'],
					dest: 'deploy/scripts/libs/',
					filter: 'isFile',
					flatten: true
				}]
			},
			// Copies CSS files into deploy/css, these were previously in deploy/css
			// but were moved to enabled gitignore to work more cleanly on that path.
			css: {
				files: [{
					expand: true,
					cwd: 'src/css',
					src: ['**'],
					dest: 'deploy/css',
				}]
			}
		},
		open: {
			dev: {
				path: 'http://localhost:8080/index.html'
			}
		},
		// Compile less files into deploy/css path.
		less: {
			production: {
				options: {
					compress: true,
					paths: ['src/less'],
					plugins: [
						// new(require('less-plugin-autoprefix'))({
						// 	browsers: ["last 2 versions"]
						// }),
						new(require('less-plugin-clean-css'))({
							inline: ['local', 'remote']
						})
					],
				},
				files: {
					'deploy/css/main.css': 'src/less/main.less'
				}
			}
		},
		// This needs a bit of tweaking to work right but potentially huge savingsin CSS size -- ktiedt
		// uncss: {
		// 	dist: {
		// 		files: {
		// 			'deploy/css/main.css': ['deploy/index.html']
		// 		},
		// 		options: {
		// 			report: 'min' // optional: include to report savings
		// 		}
		// 	}
		// }
	});

	grunt.registerTask('default', ['concat', 'less', 'copy', /* 'uncss', */ 'express', 'open', 'watch']);
};
