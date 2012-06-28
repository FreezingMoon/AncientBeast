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

<?php $page_title = "Ancient Beast - Game";
require_once("../header.php");
require_once("../global.php");
start_segment(); ?>
<center>Under HEAVY development!</center><?php
separate_segment(); ?>
casual mode (fixed lvl 50, full stack of creatures from a sin, low exp and gold, no items)<?php
separate_segment(); ?>
equiped items widget (6 items, clicking gets you to the items page, focusing on that item)<?php
separate_segment(); ?>
ladder (rankings, normal exp and gold)<?php
separate_segment(); ?>
hardcore (one life, bonus exp and gold; if defeated, must purchase new life)<?php
separate_segment(); ?>
tournament (entry fee, estimated prize and status)<?php
//TODO: tutorial? self played demo? replays? (if not signed in)
//owned creatures/items? (profile, including stats); show purchase suggestions near price range
end_segment();	
end_page();
?>
