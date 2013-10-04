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
if($_SESSION['id'] == 0) {
echo 'You need to login to view this page!';
die();
}

start_segment();
echo "<div class='center'><a href='https://github.com/FreezingMoon/AncientBeast' target='_blank'><b>Under HEAVY development!</b></a></div>";
separate_segment();
echo "<div class='center'><a href='../profile/cpass.php'>Change Password</a></div>";
separate_segment();
echo "<img src='../images/We_Want_YOU.jpg' alt='We Want YOU' title='Sign Up TODAY!'>";
separate_segment();
echo "<div class='center'>Godlet customization<br>Fine tune your gauntlet in order for your materialized creatures to benefit from stat bonuses in certain areas. Show Godlet along with spider-web configuration graph.</div>";
separate_segment();
echo "<div class='center'>Top 5 creatures<br>Most materialized creatures in various game modes. Show number of creatures owned and they're estimated value, as well as number of creatures sent as gift and their estimated value.</div>";
separate_segment();
echo "<div class='center'>Player stats and awards<br>Show number of won/draw/lost/surrendered games and the number of firt kills/denies/bloods/humiliations/annihilation/immortals/etc.</div>";
separate_segment();
echo "<div class='center'>Buddy list<br>Show all buddies along with possible indicators: starred, online/offline fb/twitter/google.</div>";
separate_segment();
echo "<div class='center'>Match history<br>Show latest matches along with some info, such as mode, outcome, date. Should allow replay/share.</div>";
separate_segment();
include("../utils/disqus.php");
end_segment();
end_page(); ?>
