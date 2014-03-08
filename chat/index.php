<?php
/* Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
 * Copyright (C) 2007-2012  Valentin Anastase (a.k.a. Dread Knight)
 *
 * This file is part of Ancient Beast.
 *
 * Ancient Beast is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Ancient Beast is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * http://www.AncientBeast.com
 * https://github.com/FreezingMoon/AncientBeast
 * DreadKnight@FreezingMoon.org
 */

$page_title = "Ancient Beast - Chat";
require_once("../header.php");
?>

<div class="div center" style="display: block; font-weight:bold;">
If you prefer using your own <a href="https://docs.google.com/presentation/d/1VMQfNKV_6wPR0XN7RtskpQe4Mz1jhIg90Hio_CuGu4g/present" target="_blank"><u>IRC client</u></a> feel free to join <a href="irc://irc.freenode.org/#AncientBeast"><u>#AncientBeast</u></a> over at irc.freenode.net server.</div>
<div class="div center" id="IRC">
<iframe src="https://kiwiirc.com/client/irc.freenode.org/?nick=Sinner|?#AncientBeast" style="border:0; width:100%; height:500px;"></iframe>
</div>

<div class="div center" id="widgets">
<!-- Twitter Widget -->
<a class="twitter-timeline" width="285" height="350" href="https://twitter.com/AncientBeast" data-widget-id="362776555539292160">Tweets by @AncientBeast</a>
<script>!function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0],p=/^http:/.test(d.location)?'http':'https';if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src=p+"://platform.twitter.com/widgets.js";fjs.parentNode.insertBefore(js,fjs);}}(document,"script","twitter-wjs");</script>

<!-- G+ Widget -->
<div class="g-page" data-width="285" data-href="//plus.google.com/113034814032002995836" data-theme="dark" data-rel="publisher"></div>
<script type="text/javascript">
  (function() {
    var po = document.createElement('script'); po.type = 'text/javascript'; po.async = true;
    po.src = 'https://apis.google.com/js/plusone.js';
    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(po, s);
  })();
</script>

<!--Facebook Widget -->
<iframe src="//www.facebook.com/plugins/likebox.php?href=https%3A%2F%2Fwww.facebook.com%2FAncientBeast&amp;width=285&amp;height=350&amp;colorscheme=dark&amp;show_faces=true&amp;header=false&amp;stream=false&amp;show_border=false&amp;appId=354537111308544" scrolling="no" frameborder="0" style="border:none; overflow:hidden; width:285px; height:350px;" allowTransparency="true"></iframe>
</div>

<div class="div center" id="badges">
<a href="http://www.indiedb.com/games/ancient-beast" title="View Ancient Beast on Indie DB" target="_blank">
<img src="http://button.indiedb.com/popularity/medium/games/21552.png" alt="Ancient Beast"></a>
<a href="http://gamejolt.com/games/arcade/ancient-beast/15964/" target="_blank">
<img src="GJ.png" alt="Ancient Beast on GameJolt"></a>
<a href="http://www.lgdb.org/game/ancient_beast" target="_blank">
<img src="LGDB.png" alt="Ancient Beast on Linux Game Data Base"></a>
<a href="http://forum.freegamedev.net/viewforum.php?f=70&sid=c5b79793f699eb6af86a9d013bf3500f" target="_blank">
<img src="FGD.png" alt="FreeGameDev Ancient Beast SubForum"></a>
</div>

<?php
disqus();
include('../footer.php'); ?>
