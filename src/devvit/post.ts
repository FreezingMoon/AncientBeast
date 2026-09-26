import { reddit } from '@devvit/reddit';

export async function createPost() {
	return await reddit.submitCustomPost({
		title: `Ancient Beast 🐺 You're about to get Hooked! 🪝`,
	});
}
