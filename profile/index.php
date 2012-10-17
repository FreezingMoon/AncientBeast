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

$page_title = "Ancient Beast - Profile";
require_once("../header.php");
require_once("../global.php");
start_segment();
echo "<center>UNDER HEAVY DEVELOPMENT</center>";
//if not logged in
separate_segment();
echo "<center>login options</center>";
separate_segment();
echo "<img src='../images/We_Want_YOU.jpg' alt='We Want YOU' title='Sign Up TODAY!'>";
//if logged in
separate_segment();
echo "<center>player stats and awards</center>";
separate_segment();
echo "<center>Godlet customization</center>";
separate_segment();
echo "<center>buddies</center>";
separate_segment();
echo "<center>match history</center>";
separate_segment();
include("../utils/disqus.php");
end_segment();
end_page(); ?>
