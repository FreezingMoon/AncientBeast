## How to contribute to the game
It's very easy to set-up a local server in order to test and contribute to the development version of the game.<br>
It uses web languages like HTML, CSS, Javascript and Node.js. The game engine used is free open source, named [Phaser](http://phaser.io).

### Recommended Tool
If you're not very keen on using git from the CLI, I recomment using [Git Cola](https://git-cola.github.io) for cloning the project and creating patches.

### Fork Project
You can create a clone of the project by using git from CLI or with the use of a tool, like the one recommended above.
```
https://github.com/FreezingMoon/AncientBeast.git
```

---

### Package Requirements
First Install [NodeJS](http://nodejs.org). Linux users: if you installed from repository, you might need to create a path link.

### Grunt Setup
After you've successfully installed the Node.js package, open up a terminal and use the next command:

```
npm install -g grunt-cli
```

### Installing Dependencies
Still in the terminal, you'll have to navigate to the *development* directory and install project dependencies:

```
cd development
npm install
```

This will read `package.json` and install all of the gameplay established npm package dependencies.<br>
The *npm install* command will also update any required dependencies if `package.json` file changes.

### Betatest Game

To have the game properly set-up and opened in the default browser, simply run this terminal command:

```
grunt
```

Grunt will work in the background so that when you change any game scripts, the re-compile will occur.

---

## Getting Involved
After you've playtested the development version of the game, there are 2 main ways you can contribute to the project.<br>
For a more comprehensive guide on how to help out the project, you can check out the [Make Your Contribution](https://AncientBeast.com/contribute) guide.

### Report Issues
If you encounter any problems with the version, you can report them to our [GitHub Issue tracker](https://github.com/FreezingMoon/AncientBeast/issues), try to avoid duplicates.<br>
Very often, it will be very helpful for debugging purposes to fetch game logs when encountering issues.<br>
You can use this function from the browser console window in order to fetch the log `G.gamelog.get()`.<br>
To replay a match, you can start a new game and paste the log between brackets of `G.gamelog.play()`.


### Patch Game
The main coding language used is Javascript, feel free to create patches and propose them by making a Pull Request.
You should look around on GitHub Issue tracker for open issues, priority being the ones that are assigned to the next [milestone](https://github.com/FreezingMoon/AncientBeast/milestones) and are tagged "[Priority](https://github.com/FreezingMoon/AncientBeast/labels/Priority)", while also lacking the "[Brainstorm](https://github.com/FreezingMoon/AncientBeast/labels/Brainstorm)" tag. You can ping [DreadKnight](https://github.com/DreadKnight) in the [Gitter Chatroom](https://gitter.im/FreezingMoon/AncientBeast) in order to be assigned to something specific, otherwise you can comment on a specific issue in order to receive the green light for it, making sure there's nobody else currently working on the issue or that design hasn't changed and a patch is still required.

---
## How to contribute to the website

The website is pretty much wrapped around the game itself, meaning it reuses a lot of its assets. To keep things simple, the stable and development versions of the game are also included in this repository, but they'll each require a Node.js server.<br>
Website itself is built using HTML, CSS, Javascript, PHP and MySQL. It needs to run on a server, a local one will do just fine.

### Installing Dependencies

You'll have to install an Apache HTTP Server, like [AMPPS](http://www.ampps.com/downloads) or operating system specific ones, like [WAMP](http://wampserver.com), [MAMP](https://www.mamp.info) or [LAMP](https://turnkeylinux.org/lampstack).

### Recommended Tool

If you're not very keen on using git from the CLI, I recomment using [Git Cola](https://git-cola.github.io) for cloning the project and creating patches.

### Fork Project

You can create a clone of the project by using git from CLI or with the use of a tool, like the one recommended above.<br>
Create a folder called **AncientBeast** inside the root of your development server and browse it, the naming is important.
```
https://github.com/FreezingMoon/AncientBeast.git
```

### Create Database

Access your **phpMyAdmin**, create a database for the project and import **database.sql** file located in the project's root.

### Change Config

You'll have to configure **config.php.in** file from project root directory, update the database info and save it as **config.php**.
That file will not be tracked so it will be completely ignored from your commits, making things easier for you.
In case you're using a different path and/or name for the project's root, make sure you update **$site_root** to reflect that, or you'll end up not seeing any images on your local website.

### Next Step

You are free to browse [existing issues](https://github.com/FreezingMoon/AncientBeast/issues) and comment on the ones that you want to take a swing at in order to make sure the issue is still relevant and that nobody else is working on it. You can also drop by the project's [Gitter Chatroom](https://gitter.im/FreezingMoon/AncientBeast) (which requires GitHub or Twitter login) and mention your skills and that you're interested in helping out; you'll be assigned to a specific issue. When you're done, simply create a **Pull Request**, note that you might need to pull in from master repository before doing so. Your patches will get reviewed and tested, if there are issues with them you'll receive feedback in order to make corrections, otherwise your pull request will get approved and merged into the master branch and you'll getting you credited for your work.

---
## Other ways of contributing

Coding is not the only thing required in order to make this project as awesome as possible, see the [How to Contribute](http://ancientbeast.com/contribute) guide.
