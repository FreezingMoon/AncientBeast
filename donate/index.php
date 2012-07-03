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

$page_title = "Ancient Beast - Donate";
$style = "
.title {
	font-size: 24px;
	font-family: Charlemagnestd;
}";
require_once("../header.php");

$cancel = $_GET["cancel"];
$success = $_GET["success"];

if (isset($cancel)) {
start_segment();
echo '<center><b>It\'s a sad day. You have canceled...</b></center>';
end_segment();
}

if (isset($success)) {
start_segment();
echo '<center><b>You are AWESOME! :)</b></center>';
end_segment();
}

start_segment(); ?>
<a id="now"></a>
<table width=100%><tr><td style="text-align:center;" width=25%>

<form action="https://www.paypal.com/cgi-bin/webscr" method="post">
<input type="hidden" name="cmd" value="_s-xclick">
<input type="hidden" name="hosted_button_id" value="XXXPC6NDXBNTW">
<input type="image" src="/donate/dollar.png" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!">
<img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1">
</form>

<form action="https://www.paypal.com/cgi-bin/webscr" method="post">
<input type="hidden" name="cmd" value="_s-xclick">
<input type="hidden" name="hosted_button_id" value="XXXPC6NDXBNTW">
<input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donate_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!">
<img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1">
</form>

</td><td style="margin-left:auto; margin-right:auto; text-align:center;" width=25%>

<form action="https://www.paypal.com/cgi-bin/webscr" method="post">
<input type="hidden" name="cmd" value="_s-xclick">
<input type="hidden" name="hosted_button_id" value="YDCXZ5QA5XH62">
<table>
<tr><td><input type="hidden" name="on0" value=""></td></tr><tr><td><select name="os0">
	<option value="Avarice">Avarice: $2.00 USD - monthly</option>
	<option value="Envy">Envy: $5.00 USD - monthly</option>
	<option value="Gluttony">Gluttony: $10.00 USD - monthly</option>
	<option value="Lust">Lust: $20.00 USD - monthly</option>
	<option value="Pride">Pride: $50.00 USD - monthly</option>
	<option value="Sloth">Sloth: $80.00 USD - monthly</option>
	<option value="Wrath">Wrath: $100.00 USD - monthly</option>
</select> </td></tr>
<tr><td><input type="hidden" name="on1" value="Want to be credited?">Want to be credited?</td></tr><tr><td><select name="os1">
	<option value="Yes, please!">Yes, please!</option>
	<option value="Anonymous!">Anonymous!</option>
</select> </td></tr>
<tr><td><input type="hidden" name="on2" value="What's your website?">What's your website?</td></tr><tr><td><input type="text" name="os2" maxlength="200"></td></tr>
</table>
<input type="hidden" name="currency_code" value="USD">
<input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_subscribe_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!">
<img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1">
</form>

</td><td style="margin-left:auto; margin-right:auto; text-align:center;" width=25%>

<form action="https://www.paypal.com/cgi-bin/webscr" method="post">
<input type="hidden" name="cmd" value="_s-xclick">
<input type="hidden" name="hosted_button_id" value="N3D2HD7HUGX38">
<input type="image" src="/donate/euro.png" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!">
<img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1">
</form>

<form action="https://www.paypal.com/cgi-bin/webscr" method="post">
<input type="hidden" name="cmd" value="_s-xclick">
<input type="hidden" name="hosted_button_id" value="N3D2HD7HUGX38">
<input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donate_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!">
<img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1">
</form>

</td><td style="margin-left:auto; margin-right:auto; text-align:center;" width=25%>

<form action="https://www.paypal.com/cgi-bin/webscr" method="post">
<input type="hidden" name="cmd" value="_s-xclick">
<input type="hidden" name="hosted_button_id" value="9X7URD3Y7DTLC">
<table>
<tr><td><input type="hidden" name="on0" value=""></td></tr><tr><td><select name="os0">
	<option value="Avarice">Avarice: €2.00 EUR - monthly</option>
	<option value="Envy">Envy: €5.00 EUR - monthly</option>
	<option value="Gluttony">Gluttony: €10.00 EUR - monthly</option>
	<option value="Lust">Lust: €20.00 EUR - monthly</option>
	<option value="Pride">Pride: €50.00 EUR - monthly</option>
	<option value="Sloth">Sloth: €80.00 EUR - monthly</option>
	<option value="Wrath">Wrath: €100.00 EUR - monthly</option>
</select> </td></tr>
<tr><td><input type="hidden" name="on1" value="Want to be credited?">Want to be credited?</td></tr><tr><td><select name="os1">
	<option value="Yes, please!">Yes, please!</option>
	<option value="Anonymous!">Anonymous!</option>
</select> </td></tr>
<tr><td><input type="hidden" name="on2" value="What's your website?">What's your website?</td></tr><tr><td><input type="text" name="os2" maxlength="200"></td></tr>
</table>
<input type="hidden" name="currency_code" value="EUR">
<input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_subscribe_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!">
<img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1">
</form>

</td></tr></table>
<? separate_segment();
$dollars_month = db_query('SELECT COALESCE(SUM(amount),0) AS amount FROM ab_donors WHERE type="$" AND MONTH(date) = MONTH(NOW()) AND YEAR(date) = YEAR(NOW())');
$dollars_total = db_query('SELECT COALESCE(SUM(amount),0) AS amount FROM ab_donors WHERE type="$"');
$euros_month = db_query('SELECT COALESCE(SUM(amount),0) AS amount FROM ab_donors WHERE type="€" AND MONTH(date) = MONTH(NOW()) AND YEAR(date) = YEAR(NOW())');
$euros_total = db_query('SELECT COALESCE(SUM(amount),0) AS amount FROM ab_donors WHERE type="€"');
echo '<center><table width=100%><tr>
<td style="text-align:center; width:25%"><u>' . date('F') . '</u><br><b>$' . $dollars_month[0]['amount'] . ' USD</b></td>
<td style="text-align:center; width:25%"><u>Total</u><br><b>$' . $dollars_total[0]['amount'] . ' USD</b></td>
<td style="text-align:center; width:25%"><u>' . date('F') . '</u><br><b>€' . $euros_month[0]['amount'] . ' EUR</b></td>
<td style="text-align:center; width:25%"><u>Total</u><br><b>€' . $euros_total[0]['amount'] . ' EUR</b></td></tr></table></center>';
separate_segment();

$donors = 'SELECT * FROM ab_donors WHERE anonymous IS NULL ORDER BY amount DESC';
$rows = db_query($donors);

echo '<center>';
foreach ($rows as $r) echo '<a href="' . $r['website'] . '" target="_blank">' . $r['name'] . ' (' . $r['type'] . $r['amount'] . ')</a>, ';
echo '<a href="#now">Your name here!</a></center>';

separate_segment();?>
<p class="center">Feel free to send your <a href="http://www.bitcoin.org" style="font-weight: bold;" target="_blank"><img src="bitcoin.ico"> bitcoin</a> donation over at:</p>
<p class="center" style="font-weight: bold;"><a href="bitcoin://1Gpa3NKn8nR9ipXPZbwkjYxqZX3cmz7q97">1Gpa3NKn8nR9ipXPZbwkjYxqZX3cmz7q97</a></p>
<p class="center"><a href="http://blockexplorer.com/address/1Gpa3NKn8nR9ipXPZbwkjYxqZX3cmz7q97" target="_blank">Any little bit you donate is greatly appreciated and helps further the development of Ancient Beast.</a></p><br>
<p class="center"><iframe width="560" height="315" src="http://www.youtube.com/embed/Um63OQz3bjo" frameborder="0" allowfullscreen></iframe></p>
<?php
end_segment();
end_page();
?>
