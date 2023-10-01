### Pull Request Process

After you are done implementing the feature or fixing a bug, make sure your forked repository 
is up to date with the original repository. To complete this step, execute the following commands:

```sh
git remote add upstream git@github.com:FreezingMoon/AncientBeast.git
git checkout master
git pull upstream master
```

After you have pulled all the changes from the original remote repository, push your changes 
to your forked repository. Do NOT attempt to push to the original repository. 
To complete this step, execute the following commands:

```sh
git rebase master
git push --set-upstream origin master
```

The changes are now in your forked GitHub repository, and you are ready to open a pull request. If the purpose 
of your commit was to implement a fix for one of the currently open issues, please reference the name of 
the issue in the name of the pull request. Write a descriptive message for the changes you have implemented. 

*Please provide your EC20 wallet address*, especially if you are addressing an issue with a bounty.

Warning: make sure that you are providing a *wallet* address and not a deposit address to an exchange.

Read more about our token (XatteR) here: https://github.com/FreezingMoon/AncientBeast/wiki/Token

Feel free to drop by our Discord server if you have any questions https://discord.me/AncientBeast
