## Development Setup For Game

### Features

- **Gruntfile.js** compiles all your game scripts to one file, also with `watch` will automatically re-compile.
- **Package.json**  initializes your npm packages and set dependencies.

### Setting up This Project Template
First Install [NodeJS](http://nodejs.org). Next, install [Grunt](http://gruntjs.com).

#### Installing Grunt

Firstly, install [NodeJS](http://nodejs.org/) after that use that command from terminal.

```
npm install -g grunt-cli
```

#### Installing Dependencies

Please, navigate into the development directory and use this command for installing/updating dependencies.

```
npm install
```

This will read `package.json` and install dependencies.

#### Launch

Simply run command:

```
grunt
```

This will launch your browser automatically.

Grunt will work in background. When you change your script files, it will re-compile the scripts every time.

---
