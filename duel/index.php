<?php
/* Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
 * Copyright (C) 2007-2014  Valentin Anastase (a.k.a. Dread Knight)
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
 * https://www.AncientBeast.com
 * https://github.com/FreezingMoon/AncientBeast
 * DreadKnight@FreezingMoon.org
 */

$page_title = "Duel";
require_once("../header.php");
?>

<!-- TODO: explain how the duel / bet system works -->

<div class="div" style="text-align: justify;">
At some point in the future you and others who want to become professional players or simply make some pocket money will be able to battle for <a href="http://bitcoin.com" target="_blank"><b>Bitcoins</b></a> or bet on the outcome of upcoming matches for a small fee. The game is free and you can spend as much time as you like improving your skills before trying your luck at it. It was carefully designed to allow anyone equal chances while avoiding any randomness, relying only on skills. Below I've included a fictional example table, meanwhile feel free to <a href="./contribute"><b>contribute</b></a> to make things happen faster.
</div>

<div class="div">
<table width=100%>
<div class="center" style="font-size: 24px; font-weight: bold;">Upcoming Matches</div><br>
<tr><th>Start</th><th>Type</th><th>Left Side</th><th>Right Side</th><th>Stake</th><th>Ratio</th><th>Your Bet</th><th>Potential</th></tr>
<tr><td>12:00</td><td>1vs1</td><td>Dread Knight <span style="color: red;">●</span></td><td>Super Giani <span style="color: blue;">●</span></td><td>5 BTC</td><td>1 to 7</td><td>0.10 BTC</td><td>0.67 BTC</td></tr>
<tr><td>10:00</td><td>1vs1</td><td>Dread Knight <span style="color: red;">●</span></td><td>Super Giani <span style="color: blue;">●</span></td><td>5 BTC</td><td>1 to 5</td><td>0.05 BTC</td><td>0.24 BTC</td></tr>
</table>
</div>

<div class="div">
<table width=100%>
<div class="center" style="font-size: 24px; font-weight: bold;">Current Matches</div><br>
<tr><th>Time</th><th>Type</th><th>Left Side</th><th>Right Side</th><th>Stake</th><th>Ratio</th><th>Your Bet</th><th>Potential</th></tr>
<tr><td>10:40</td><td>1vs1</td><td>Dread Knight <span style="color: red;">●</span></td><td>Super Giani <span style="color: blue;">●</span></td><td>5 BTC</td><td>1 to 7</td><td>0.10 BTC</td><td>0.67 BTC</td></tr>
<tr><td>12:04</td><td>1vs1</td><td>Dread Knight <span style="color: red;">●</span></td><td>Super Giani <span style="color: blue;">●</span></td><td>5 BTC</td><td>1 to 5</td><td>0.05 BTC</td><td>0.24 BTC</td></tr>
</table>
</div>

<div class="div">
<table width=100%>
<div class="center" style="font-size: 24px; font-weight: bold;">Finished Matches</div><br>
<tr><th>Time Interval</th><th>Type</th><th>Left Side</th><th>Right Side</th><th>Stake</th><th>Sponsor</th><th>Ratio</th><th>Your Bet</th><th>Net Profit</th></tr>
<tr><td>12:00 - 12:52</td><td>1vs1</td><td><s>Dread Knight <span style="color: red;">●</s></span></td><td>Super Giani <span style="color: blue;">●</span></td><td>5 BTC</td><td>McDonalds</td><td>1 to 7</td><td>0.10 BTC</td><td>0 Bitcoins</td></tr>
<tr><td>10:00 - 10:48</td><td>1vs1</td><td>Dread Knight <span style="color: red;">●</span></td><td><s>Super Giani <span style="color: blue;">●</span></s></td><td>5 BTC</td><td>Coca-Cola</td><td>1 to 5</td><td>0.05 BTC</td><td>0.24 BTC</td></tr>
</table>
</div>

<?php
disqus();
include('../footer.php'); ?>
