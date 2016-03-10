<!-- TODO: Show unit dwelling, along with info, like unit cost, generated units per week, cost of dwelling, purchase button -->
<script>document.title = "Ancient Beast - Metrics";</script>
<div class="div center">Note: the table below is for preview purposes only. It will be populated with real data sometime after the online multiplayer feature will be implemented along with ladder mode. It will eventually be a subscriber only feature.</div>

<script type="text/javascript" src="jquery.tablesorter.min.js"></script>
<script>
// Allow sorting of tables
$(function() {
	$("#statsTable").tablesorter( {
		"paging": false,
		"search": false
	} );
} );
</script>

<div class="div center">
<!-- TODO: Offer advanced stats (metrics) to subscribers, showing percentage damage done / taken, rounds, movement, abilities, healing, meditation, materializations, deaths, drops picked, kills made-->
<table id="statsTable" class="tablesorter" width=100%>
	<thead>
		<tr style="background: none !important;">
			<th style="text-align: left;">Unit Name</th>
			<th class="center" title="How often was this unit materialized?">Summoned</th>
			<th class="center" title="How many rounds did this unit survived?">Rounds</th>
			<th class="center" title="How many abilities has this unit used?">Abilities</th>
			<th class="center" title="How much did this unit moved around?">Moved</th>
			<th class="center" title="How much did this unit managed to heal?">Healed</th>
			<th class="center" title="How much energy did this unit recovered?">Meditated</th>
			<th class="center" title="How many drops did this unit picked?">Drops</th>
			<th class="center" title="How much damage has this unit done?">Damage</th>
			<th class="center" title="How many kills did this unit done?">Kills</th>
			<th class="center" title="How much damage has this unit taken?">Harm</th>
			<th class="center" title="How many times did this unit died?">Deaths</th>
	</thead>
	<tbody>
		<tr>
			<td>Magma Spawn</td>
			<td class="center">32</td>
			<td class="center">24</td>
			<td class="center">26</td>
			<td class="center">42</td>
			<td class="center">23</td>
			<td class="center">42</td>
			<td class="center">13</td>
			<td class="center">20</td>
			<td class="center">12</td>
			<td class="center">21</td>
			<td class="center">22</td>
		</tr>
		<tr>
			<td>Uncle Fungus</td>
			<td class="center">18</td>
			<td class="center">37</td>
			<td class="center">29</td>
			<td class="center">49</td>
			<td class="center">71</td>
			<td class="center">37</td>
			<td class="center">34</td>
			<td class="center">11</td>
			<td class="center">28</td>
			<td class="center">7</td>
			<td class="center">42</td>
		</tr>
		<tr>
			<td>Abolished</td>
			<td class="center">60</td>
			<td class="center">45</td>
			<td class="center">44</td>
			<td class="center">9</td>
			<td class="center">6</td>
			<td class="center">21</td>
			<td class="center">53</td>
			<td class="center">69</td>
			<td class="center">70</td>
			<td class="center">72</td>
			<td class="center">36</td>
		</tr>
	</tbody>
</table>
</div>
<?php
disqus('Ancient Beast - Metrics');
