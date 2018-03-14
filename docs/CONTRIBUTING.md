## Github Marketing
You can help out the project by just ★ starring this repository from the upper right corner and also by pinning it to your profile.

## Getting Started
It's very easy to set-up a local server in order to test and contribute to the development version of the game.<br>
It uses web languages like HTML, CSS, Javascript and Node.js. The game engine used is free open source, named [Phaser](http://phaser.io).

### Recommended Tool
If you're not very keen on using git from the CLI, I highly recommend using [Visual Studio Code](https://code.visualstudio.com/download),  for cloning the project and creating patches. [VSC](https://code.visualstudio.com/download) is free open source and cross platform, integrates nicely with git and has useful extensions.

### Fork Project
You can create a clone of the project by using git from CLI or with the use of a tool, like the one recommended above.
```
https://github.com/FreezingMoon/AncientBeast.git
```
In [VSC](https://code.visualstudio.com/download) you can press `Ctrl + Shift + P` hotkey and search for `Git: Clone`, you will get a field where you can simply input the link above.

---

### Package Requirements
First install (or make sure you have) the latest LTS version of  [Node.js](http://nodejs.org). Linux users: if you installed from repository, you *might* need to create a path link.

### Yarn Setup
After you've successfully installed the Node.js package, proceed with installing the latest version of [Yarn](https://yarnpkg.com/en/docs/install), which is our tool of choice for package dependency management.

### Installing Dependencies
In the terminal (`Ctrl + ~` in [VCS](https://code.visualstudio.com/download)), use the following command in order to easily install all the project dependencies:

```
yarn build:dev
```

This will read `package.json` and install all of the gameplay established yarn package dependencies.<br>
The *yarn build:dev* command will also update any required dependencies if `package.json` file changes. If you have not worked on the project in a while, make sure you update your fork and also run that command again.<br>

If you're using Windows operating system and getting errors, have your desired tool `Run as administrator` or to disable your anti-virus.

### Betatest Game

To have the game properly set-up and opened in the default browser, simply run this terminal command:

```
yarn start
```
You should only use <a href="https://www.google.com/chrome/"><b>Google Chrome</b></a> or <a href="https://www.chromium.org"><b>Chromium</b></a>, as other browsers don't quite cut it. White testing you can right click the game tab and mute it.

---

## Getting Involved
After you've playtested the development version of the game, there are 2 main ways you can contribute to the project.<br>
For a more comprehensive guide on how to help out the project, you can check out the [Make Your Contribution](https://AncientBeast.com/contribute) guide.

### Report Issues
If you encounter any problems with the version, you can report them to our [GitHub Issue tracker](https://github.com/FreezingMoon/AncientBeast/issues), try to avoid duplicates.<br>
Very often, it will be very helpful for debugging purposes to fetch game logs when encountering issues.<br>
You can use this function from the browser console window in order to fetch the log `G.gamelog.get()`.<br>
To replay a match, you can start a new game and paste the log between brackets of `G.gamelog.play()`.<br>
In order to open up Google Chrome browser's console, you can simply press `Ctrl + Shift + j` hotkeys.

### Patch Game
The main coding language used is Javascript, feel free to create patches and propose them by making a Pull Request.
You should look around on GitHub Issue tracker for open issues, priority being the ones that are assigned to the next [milestone](https://github.com/FreezingMoon/AncientBeast/milestones) and are tagged "[Priority](https://github.com/FreezingMoon/AncientBeast/labels/Priority)", while also lacking the "[Brainstorm](https://github.com/FreezingMoon/AncientBeast/labels/Brainstorm)" tag. You can ping [DreadKnight](https://github.com/DreadKnight) in the [Discord server](https://discord.gg/x78rKen) in order to be assigned to something specific, otherwise you can comment on a specific issue in order to receive the green light for it, making sure there's nobody else currently working on the issue or that design hasn't changed and a patch is still required.

### Next Step

You are free to browse [existing issues](https://github.com/FreezingMoon/AncientBeast/issues) and comment on the ones that you want to take a swing at in order to make sure the issue is still relevant and that nobody else is working on it. You can also drop by the project's [Discord server](https://discord.gg/x78rKen) and mention your skills and that you're interested in helping out; you'll be assigned to a specific issue. When you're done, simply create a **Pull Request**, note that you might need to pull in from master repository before doing so. Your patches will get reviewed and tested, if there are issues with them you'll receive feedback in order to make corrections, otherwise your pull request will get approved and merged into the master branch and you'll getting you credited for your work.

---
## More Ways

Coding is not the only thing required in order to make this project as awesome as possible, see the [How to Contribute](http://ancientbeast.com/contribute) guide.
