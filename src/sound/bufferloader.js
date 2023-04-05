export class BufferLoader {
	constructor(context, urlList, callback) {
		this.context = context;
		this.urlList = urlList;
		this.onload = callback;
		this.bufferList = [];
		this.loadCount = 0;
	}

	loadBuffer(url, index) {
		// Load buffer asynchronously
		const request = new XMLHttpRequest();

		request.open('GET', url, true);
		request.responseType = 'arraybuffer';

		request.onload = () => {
			// Asynchronously decode the audio file data in request.response
			this.context.decodeAudioData(
				request.response,
				(buffer) => {
					if (!buffer) {
						alert('error decoding file data: ' + url);
						return;
					}

					this.bufferList[index] = buffer;
					if (++this.loadCount == this.urlList.length) {
						this.onload(this.bufferList);
					}
				},
				(error) => {
					console.error('decodeAudioData error', error);
				},
			);
		};

		request.onerror = () => {
			alert('BufferLoader: XHR error');
		};

		request.send();
	}

	load() {
		for (let i = 0, len = this.urlList.length; i < len; ++i) {
			this.loadBuffer(this.urlList[i], i);
		}
	}
}
