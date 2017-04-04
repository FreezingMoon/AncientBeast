module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-contrib-watch');
    //grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-open');
    grunt.loadNpmTasks('grunt-express-server');

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
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
        open: {
            dev: {
                path: 'http://localhost:8080/index.html'
            }
        }
    });

    grunt.registerTask('default', ['concat', 'copy', 'open', 'express', 'watch']);

};
