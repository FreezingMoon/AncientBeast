/* eslint-disable */
let id;
if (window.location.host === 'play.ancientbeast.com') {
	id = 'UA-2840181-9';
} else if (window.location.host === 'beta.ancientbeast.com') {
	id = 'UA-2840181-8';
}

function analytics() {
	let x = `<script async src='https://www.googletagmanager.com/gtag/js?id=${id}'></script><script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${id}');</script>`;
	return x;
}

analytics();
