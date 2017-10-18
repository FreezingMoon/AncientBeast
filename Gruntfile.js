module.exports = function(grunt) {
	grunt.loadNpmTasks('grunt-contrib-watch');
	//grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-open');
	grunt.loadNpmTasks('grunt-express-server');
	grunt.loadNpmTasks('main-bower-files');
	// grunt.loadNpmTasks('grunt-uncss');

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		concat: {
			options: {
				banner: 'var $j = jQuery.noConflict();\n\n',
			},
			dist: {
				src: [
					"src/sound/**/*.js",
					"src/ui/**/*.js",
					"src/utility/**/*.js",
					"src/network/**/*.js",
					"src/*.js",
					"src/abilities/**/*.js"
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
		bower: {
			flat: { /* flat folder/file structure */
				dest: 'deploy/scripts/libs',
				options: {
					env: process.env.NODE_ENV || "development"
				}
			}
		},
		copy: {
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

	grunt.registerTask('default', ['concat', 'less', 'copy', 'bower', /* 'uncss', */ 'express', 'open', 'watch']);
};
