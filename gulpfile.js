"use strict";
/**
 * Dependencies
 */
var gulp = require("gulp");
var http = require('http');
var browserify = require("browserify");
var watchify = require("watchify");
var source = require("vinyl-source-stream");
var envify = require("envify");
var babelify = require("babelify");
var livereload = require('gulp-livereload');

gulp.task("browserify", function() {
    return watchify(browserify({
        cache: {},
        packageCache: {},
        fullPaths: true,
        entries: './src/main.js',
        debug: true
    }))
        .transform(envify)
        .transform(babelify)
        .bundle()
        .pipe(source("game.js"))
        .pipe(gulp.dest('./public'))
        .pipe(livereload());
});

gulp.task("watch", function () {
    livereload.listen();
    gulp.watch('./src/**/*.js', ["browserify"]);
});

gulp.task('server', function() {

    require('./app');
});

gulp.task("default", ["browserify", "watch", "server"]);
