<?php
	require_once('../functions.php');
	require_once("../../global.php");
	
	header("Content-Type: application/rss+xml; charset=ISO-8859-1");
 
	$rssfeed = '<?xml version="1.0" encoding="ISO-8859-1"?>'.PHP_EOL;
	$rssfeed .= '<rss version="2.0">'.PHP_EOL;
	$rssfeed .= '<channel>'.PHP_EOL;
	$rssfeed .= '<title>Ancient Beast - Blog</title>'.PHP_EOL;
	$rssfeed .= '<link>http://www.ancientbeast.com</link>'.PHP_EOL;
	$rssfeed .= '<description>Ancient Beast Blog RSS Feed</description>'.PHP_EOL;
	$rssfeed .= '<language>en-us</language>'.PHP_EOL;
	$rssfeed .= '<copyright>Copyright (C) '.date("Y").' ancientbeast.com</copyright>'.PHP_EOL.PHP_EOL;
	
	$blog_posts = array();
	if ($handle = opendir('../entries')) {
		while (false !== ($entry = readdir($handle))) {
			if ($entry != "." && $entry != ".." && $entry != ".DS_Store") {
				array_unshift($blog_posts, $entry);
			}
		}
		closedir($handle);
		array_multisort($blog_posts,SORT_DESC);
	}
	
	$published_posts = 0;
	foreach($blog_posts as $post){
		$post = get_post($post,'../entries/');
		$post_vars = $post["post_variables"];
		
		if(post_published($post)){
			$rssfeed .= '<item>'.PHP_EOL;
			$rssfeed .= '<title>' . htmlspecialchars($post_vars["title"]) . '</title>'.PHP_EOL;
			$rssfeed .= '<description>' . htmlspecialchars($post["post_content"]) . '</description>'.PHP_EOL;
			$rssfeed .= '<link>' . $site_url."blog/?off=". $published_posts . '</link>'.PHP_EOL;
			$rssfeed .= '<pubDate>' . $post_vars["post_date"] . '</pubDate>'.PHP_EOL;
			$rssfeed .= '</item>'.PHP_EOL.PHP_EOL;
			$published_posts ++;
		}
	}
 
	$rssfeed .= '</channel>'.PHP_EOL;
	$rssfeed .= '</rss>'.PHP_EOL;
 
	echo $rssfeed;
?>
