'use strict';

var gulp = require('gulp');
var browserify = require('browserify');
var watchify = require('watchify');
var source = require('vinyl-source-stream');
var babelify = require('babelify');
var livereload = require('gulp-livereload');
var open = require('open');

gulp.task('browserify', function() {
    return watchify(browserify({
        cache: {},
        packageCache: {},
        fullPaths: true,
        entries: './src/main.js',
        debug: true
    }))
        .transform(babelify)
        .bundle()
        .pipe(source('bundle.js'))
        .pipe(gulp.dest('./public'))
        .pipe(livereload());
});

gulp.task('watch', ['browserify'], function () {
    livereload.listen();
    gulp.watch('./src/**/*.js', ['browserify']);
});

gulp.task('server', ['browserify'], function() {
    require('./app');
    open('http://localhost:3000');
});

gulp.task('default', ['browserify', 'watch', 'server']);
