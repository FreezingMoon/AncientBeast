<!--
 * Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
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
-->

<?php $page_title = "Ancient Beast - Chat";
require_once("../header.php");
start_segment();
?>
<span style="text-align: center; display: block; font-weight:bold;">
<p><a href="mailto:DreadKnight@FreezingMoon.org" target="_blank">You might need to wait some time to get a response so consider sending us an <u>e-mail</u> instead.</p></a></span>
<?php
separate_segment();
echo "<center><iframe src='http://webchat.freenode.net?channels=AncientBeast' width='99%' height='450'></iframe></center>";
separate_segment();
echo "<center><iframe src='https://docs.google.com/present/embed?id=dfbbjc3c_24fb4cz7d8&size=l' frameborder='0' width='700' height='559'></iframe></center>";
separate_segment();
include("../utils/disqus.php");
end_segment();
end_page();
?>
