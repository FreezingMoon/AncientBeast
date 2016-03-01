## Development Setup
### Workflow Features

- **Gruntfile.js** compiles game scripts into one file that's automatically re-compiled.
- **Package.json**  initializes the required npm packages along with set dependencies.

### Package Requirements
First Install [NodeJS](http://nodejs.org). After that, proceed with installing [Grunt](http://gruntjs.com).

#### Installing Grunt

After you've installed [NodeJS](http://nodejs.org/), use the following command in a terminal:

```
npm install -g grunt-cli
```

#### Installing Dependencies

Navigate into the development directory and use this command for installing & updating dependencies:

```
npm install
```

This will read `package.json` and install all of the gameplay established npm package dependencies.

#### Betatest Game

To have the game properly set-up and opened in the default browser, simply run this terminal command:

```
grunt
```

Grunt will work in the background so that when you change any game scripts, the re-compile will occur.

---
