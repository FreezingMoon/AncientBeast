# assets/autoload/phaser

Images placed anywhere under assets/autoload/phaser will be loaded into Phaser when the game begins.

## autoloaded images: Phaser keys

Phaser requires a 'key' to access images, e.g.,

```
this.display.loadTexture("myKey");
```

When using an autoloaded image, the basename of the file will be used as the key in Phaser.

### Example

If /assets/autoload/phaser/apples/apple1.png is a valid path, it will be loaded **for you** into Phaser as follows:

```
// NOTE: This is done FOR YOU when using autoloading.
phaser.load.image('apple1', '/assets/autoload/phaser/apple/apple1.png');
```

The basename of the file - "apple1" - is the Phaser key, so you'll use the image like this:

```
this.display.loadTexture("apple1");
```

### Troubleshooting

Because the file basenames are used as Phaser keys, all basenames under assets/autoload/phaser must be unique.

For example, including these two images in the project will cause an error to be thrown, because they have the same basename.

```
/assets/autoload/phaser/monster/scary.png
/assets/autoload/phaser/head/hair/morning/scary.png
```
