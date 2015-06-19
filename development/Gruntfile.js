module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-open');
    grunt.loadNpmTasks('grunt-contrib-concat');
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
                    "src/util/**/*.js",
                    "src/abilities/**/*.js",
                    "src/network/**/*.js"
                ],
                dest: 'deploy/js/<%= pkg.name %>.js'
            }
        },
        watch: {
            files: 'src/**/*.js',
            tasks: ['concat']
        },
        open: {
            dev: {
                path: 'http://localhost:8080/index.html'
            }
        }
    });

    grunt.registerTask('default', ['concat', 'server', 'open', 'watch']);

};
