module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-open');

    grunt.registerTask('server', 'Start the web server.', function() {
      grunt.log.writeln('Starting web server on port 80.');
      require('./server.js');
    });
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        /**connect: {
            server: {
                options: {
                    port: 8080,
                    base: './deploy'
                }
            }
        }, */
        concat: {
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
        watch: {
            files: 'src/**/*.js',
            tasks: ['concat']
        },
		// Copies the customized build of Phaser into the game
		// http://phaser.io/tutorials/creating-custom-phaser-builds
		copy: {
			main: {
				files: [{
					expand: true,
					src: ['node_modules/phaser/build/phaser*.js'],
					dest: 'deploy/scripts/libs/',
					filter: 'isFile',
					flatten: true
				}]
			},
        },
        open: {
            dev: {
                path: 'http://localhost:8080/index.html'
            }
        }
    });

    grunt.registerTask('default', ['concat', 'server', 'copy', 'open', 'watch']);

};
