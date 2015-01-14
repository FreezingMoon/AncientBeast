"use strict";
/**
 * Dependencies
 */
var gulp = require("gulp");
var nodemon = require("gulp-nodemon");
var browserify = require("browserify");
var source = require("vinyl-source-stream");
var to5ify = require("6to5ify");
var livereload = require('gulp-livereload');
var nodemon_instance;

gulp.task("browserify", function() {
  return browserify({
    entries: './public/code/Init.js',
    debug: true
  })
      .transform(to5ify)
      .bundle()
      .pipe(source("bundle.js"))
      .pipe(gulp.dest('./public'))
      .pipe(livereload());
});

gulp.task("watch", function () {
  livereload.listen();
  gulp.watch('./public/**/*.js', ["browserify"]);
});

gulp.task("nodemon", function () {
  if(!nodemon_instance)
    nodemon_instance = nodemon({ script:"app.js", nodeArgs: ["--harmony", "--debug"],
      env: { "NODE_ENV": "development" }, watch: "__manual_watch__",  ext: "__manual_watch__"  });
  else {
    nodemon_instance.emit("restart");
  }
});

gulp.task("default", ["browserify", "watch", "nodemon"]);
