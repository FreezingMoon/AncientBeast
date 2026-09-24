## Github Marketing

You can help out the project by just ★ starring this repository from the upper right corner and also pinning it to your profile.

## Getting Started

It's very easy to set-up a local server in order to test and contribute to the development version of this game project.  
It uses web languages like HTML and CSS, with TypeScript tooling powered by [Bun](https://bun.sh). The game engine used is free open source, [Phaser](https://phaser.io).
Nowadays you can skip setting up a local server and just start developing on the project right away: [![Open in Gitpod](https://img.shields.io/badge/setup-automated-blue?logo=gitpod)](https://gitpod.io/#https://github.com/FreezingMoon/AncientBeast)

### Recommended Tool

If you're not very keen on using a browser based IDE, I highly recommend using [Visual Studio Code](https://code.visualstudio.com/download), for cloning the project and creating patches. [VSC](https://code.visualstudio.com/download) is free, open source, cross platform, and has nice git integration and useful extensions.

### Fork Project

You can create a clone of the project by using git from the CLI or with the use of a tool like the one recommended above.

```sh
git clone https://github.com/FreezingMoon/AncientBeast.git
```

#### VS Code
In [VSC](https://code.visualstudio.com/download) you can press `Ctrl + Shift + P`, search for `Git: Clone` and then input just the link in the given field:

```sh
https://github.com/FreezingMoon/AncientBeast.git
```

---

### Package Requirements

Install [Bun](https://bun.sh/docs/installation), which provides the JavaScript runtime and package manager used by this project. The repository pins the expected Bun version in `package.json`.

```sh
bun --version
```

The project may still produce Node-targeted bundles for Devvit, but local development commands should be run through Bun.

### Installing Dependencies

In the terminal (`Ctrl + ~` in [VCS](https://code.visualstudio.com/download)), use the following command in order to easily install all the project dependencies:

```sh
bun install
```

This reads `package.json` and installs the project dependencies from `bun.lock`. If `package.json` changes, run `bun install` again. If you have not worked on the project in a while, update your fork and run it again before building.

### Setup environment variables

If you want to customize your local setup, duplicate existing `.env.example` file as `.env`, adjust it as you want and that file will become default.

```sh
cp .env.example .env
```

### Compile Project

In order to build the development version of the game, run the following command:

```sh
bun run build:dev
```

### Docker Setup

As an alternative way of running the project, make sure you have Docker installed, then build the image using the following command:

```
docker build -t yourusername/ancient-beast .
```

To run the image, use this command:

```
docker run -p80 yourusername/ancient-beast
```

If there's something already running on port 80 or it's being blocked, try the next port.

### Beta Testing

To have the game up and running on your local machine, simply run this command in the terminal:

```sh
bun run start
```

Then access it using [Chromium](https://chromium.org) or [Google Chrome](https://google.com/chrome), as support for other browsers is not guaranteed:

```
localhost:8080
```

You can usually test our latest (and greatest) master branch without any hassle from our auto-deployed [beta app](https://beta.ancientbeast.com).

A handy tip while testing: you can right click the game tab and mute it by simply clicking the `Mute site` option.

---

## Getting Involved

After you've play-tested the development version of the game, there are 2 main ways you can contribute to the project.
For a more comprehensive guide on how to help out the project, you can check out the [Make Your Contribution](https://AncientBeast.com/contribute) guide.

### Report Issues

If you encounter any problems with this version, you can report them to our [GitHub Issue tracker](https://github.com/FreezingMoon/AncientBeast/issues).
Very often, it will be very helpful for debugging purposes to fetch game logs when encountering issues. You can use the `AB.getLog()` function from the browser console window in order to fetch the current match log.
In order to open up Google Chrome browser's console, you can press `Ctrl + Shift + J`. To replay a match, you'll have to be in the pre-match screen, paste its log in the console and then press the `Return` key.

### Meta Powers

The Meta Powers screen can also be useful for achieving the correct game state to test features and reproduce bugs.

To access the Meta Powers screen:

- Run the local development server.
- Start a hotseat (single player) game.
- When the game starts, press the Meta + Alt + P key combination.
- Hovering each power shows a tooltip description.

### Patch Game

The main coding language used is Javascript, feel free to create patches and propose them by making a Pull Request.
You should look around on the GitHub Issue tracker for open issues, priority being the ones that are assigned to the next [milestone](https://github.com/FreezingMoon/AncientBeast/milestones) and are tagged "[Priority](https://github.com/FreezingMoon/AncientBeast/labels/Priority)", while also lacking the "[Brainstorm](https://github.com/FreezingMoon/AncientBeast/labels/Brainstorm)" tag. You can ping [DreadKnight](https://github.com/DreadKnight) in the [Discord server](https://discord.gg/x78rKen) in order to be assigned to something specific, otherwise you can comment on a specific issue in order to receive the green light for it, making sure there's nobody else currently working on the issue or that design hasn't changed and a patch is still required. The game engine we're using is the [community edition](https://github.com/photonstorm/phaser-ce) of [Phaser](https://github.com/photonstorm/phaser), which is free and open source, and has nice [documentation](https://photonstorm.github.io/phaser-ce).

In order to patch the game and constantly test it, run it using this command, which will keep track of any file changes:

```sh
bun run start:dev
```

Then access it using [Chromium](https://chromium.org) or [Google Chrome](https://google.com/chrome), as support for other browsers is not guaranteed:

```
localhost:8080
```

Keep in mind that you'll have to refresh the webpage after making changes. Make sure to disable browser caching by using `Ctrl + Shift + J`, then going to the **Network** tab and checking **Disable cache**.

### Unit Tests

Each unit ability should have an unit test using our framework of choice, Jest, which can be written following the examples from [official documentation](https://jestjs.io/docs/getting-started).
Our project's installed linter and the checks run on GitHub require that the Jest module values be imported explicitly:

```
import { expect, describe, test } from '@jest/globals';
```

See `/src/__tests__/utility/string.js` for an example.

#### Running Tests

The test runner is included in the existing `bun run test` command.

In addition, the following commands were added to `package.json`:

- `bun run jest` – Run tests
- `bun run start:jest` – Watch test files and rerun when modified

### Next Step

You are free to browse [existing issues](https://github.com/FreezingMoon/AncientBeast/issues) (for beginner coders there are issues labeled as [easy](https://github.com/FreezingMoon/AncientBeast/issues?q=is%3Aopen+is%3Aissue+label%3Aeasy)) and comment on the ones that you want to take a swing at in order to make sure the issue is still relevant and that nobody else is working on it. You can also drop by the project's [Discord server](https://discord.gg/x78rKen) and mention your skills and that you're interested in helping out; you'll be assigned to a specific issue. When you're done, simply create a **Pull Request**. Note that you might need to pull in from master repository before doing so. Your patches will get reviewed and tested, if there are issues with them, you'll receive feedback in order to make corrections. Otherwise, your pull request will get approved and merged into the master branch and you'll get credited for it.

#### Token Bounties

Many of the issues and open tasks have bounties specified in the title, for example: `[bounty: 5 XTR]`, indicating the amount of [XatteR](https://github.com/FreezingMoon/AncientBeast/wiki/XatteR) that will be given to the person that solves the issue(s). You can read more about our utility token in our detailed wiki article [over here](https://github.com/FreezingMoon/AncientBeast/wiki/XatteR).

---

## More Ways

Coding is not the only thing required in order to make this project as awesome as possible, see [How to Contribute](https://ancientbeast.com/contribute) guide.
