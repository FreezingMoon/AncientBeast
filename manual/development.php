<?php echo $separator; ?>
<a name="development">VI. <b><u>Development</u></b></a>
<br>
<br>
<b>Pipeline</b>
<p>
The project is developed with the use of free open source cross platform applications and freeware services.
<a href="http://wuala.com" target="_blank"><b>Wuala</b></a> comes in very handy when working with files collaboratively. You can find our group over <a href="http://wuala.com/AncientBeast" target="_blank"><b>here</b></a> which contains all the project's files.
<a href="http://blender.org" target="_blank"><b>Blender</b></a> is being used for creating most of the assets, such as structures and creatures and their animations, which are prerendered into sprites and sprite-sheets as well as for other tasks.
<a href="http://mypaint.intilinux.com" target="_blank"><b>My Paint</b></a> along with <a href="http://gimp.org" target="_blank"><b>Gimp</b></a> are being used for icons, concept art, texturing and the creation of some of the battle grounds.
<a href="http://al.chemy.org" target="_blank"><b>Alchemy</b></a> can be a very useful tool for finding inspiration when creating creature artwork.
</p>
<table style="margin-left:auto; margin-right:auto; text-align:center; width:600px;"><tr>
	<td><a href="http://wuala.com" target="_blank"><img src="wuala.png"><br><b>Wuala</b></a></td>
	<td><a href="http://blender.org" target="_blank"><img src="blender.png"><br><b>Blender</b></a></td>
	<td><a href="http://gimp.org" target="_blank"><img src="gimp.png"><br><b>Gimp</b></a></td>
	<td><a href="http://mypaint.intilinux.com" target="_blank"><img src="mypaint.png"><br><b>My Paint</b></a></td>
	<td><a href="http://al.chemy.org" target="_blank"><img src="alchemy.png"><br><b>Alchemy</b></a></td>
</tr></table>
<br>
<b>Sprite sheets</b>
<br>
<p>
For putting together sprite sheets, you can use <a href="http://www.ImageMagick.org" target="_blank"><b>ImageMagick</b></a>, a CLI tool that allows for various operations. If you're not familiar with command line interfaces, no worries, bellow you can see how easy it is by following an example. There are also several GUI's for ImageMagick, but they won't be covered in this documentation.<br>
On the official website you can find binaries for most popular operating systems, except Ubuntu linux distro. Chances are that if you're using Ubuntu, ImageMagick is already installed, if not, you can easly download and install the tool from the Software Center or from Terminal, using the following command:
</p>
<code>sudo apt-get install imagemagick</code>
<br>
<p>
The operation for putting together sprite sheets using ImageMagick is called "Montage". If we are to render an animation in blender, the PNG format is needed for the output, with the ARGB option enabled. Blender will output a series of images, having the filenames from <i>0001.png</i>, up to the last frame number, which is calculated by: frame range * fps.
</p>
<code>montage * -tile x8 -geometry 256x256+0+0 -background None -quality 100 output.png</code>
<br>
<p>
The game is best played at a HD resolution of 1920x1080, in case your screen uses a lower resolution, the game should accomodate by rescaling. Battlegrounds and other screens that are not made out of tiles will be created at the same HD resolution.
</p>
<p>
//transparent background or unique color; write about resolution for sprites and levels
</p>
