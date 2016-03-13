## Development Setup
It's very easy to set-up a local server in order to test and contribute to the development version of the game.

### Workflow Features

- **Gruntfile.js** compiles game scripts into one file that's automatically re-compiled.
- **Package.json**  initializes the required npm packages along with set dependencies.

### Recommended Tool
If you're not very keen on using git from the CLI, I recomment using [Git Cola](https://git-cola.github.io) for cloning the project and creating patches.

### Fork Project
You can create a clone of the project by using git from CLI or with the use of a tool, like the one recommended above.
```
https://github.com/FreezingMoon/AncientBeast.git
```

---

## Package Requirements
First Install [NodeJS](http://nodejs.org). Linux users: if you installed from repository, you might need to create a path link.

### Installing Dependencies

Navigate into the *development* directory and use this command for installing & updating dependencies:

```
npm install
```

This will read `package.json` and install all of the gameplay established npm package dependencies.

### Betatest Game

To have the game properly set-up and opened in the default browser, simply run this terminal command:

```
grunt
```

Grunt will work in the background so that when you change any game scripts, the re-compile will occur.

---

## Getting Involved
After you've playtested the development version of the game, there are 2 main ways you can contribute to the project.

For a more comprehensive guide on how to help out the project, you can check out the [Make Your Contribution](https://AncientBeast.com/contribute) guide.

### Report Issues
If you encounter any problems with the version, you can report them to our [GitHub Issue tracker](https://github.com/FreezingMoon/AncientBeast/issues), try to avoid duplicates.


### Patch Game
The main coding language used is Javascript, feel free to create patches and propose them by opening Pull Requests.
You should look around on GitHub Issue tracker for open issues, priority being the ones that are assigned to the next [milestone](https://github.com/FreezingMoon/AncientBeast/milestones) and are tagged "[Priority](https://github.com/FreezingMoon/AncientBeast/labels/Priority)", while also lacking the "[Brainstorm](https://github.com/FreezingMoon/AncientBeast/labels/Brainstorm)" tag. You can ping [DreadKnight](https://github.com/DreadKnight) in the [Gitter Chatroom](https://gitter.im/FreezingMoon/AncientBeast) in order to be assigned to something specific, otherwise you can comment on a specific issue in order to receive the green light for it, making sure there's nobody else currently working on the issue or that design hasn't changed and a patch is still required.
