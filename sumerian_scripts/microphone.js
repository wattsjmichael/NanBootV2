/**
 * This script is the controller for the microphone.
 * It handles recording for Amazon Lex.
 *
 * This script depends on Speech.js.
 * Make sure that the previous script is loaded before this script MicrophoneInput.js.

 References
 https://docs.sumerian.amazonaws.com/articles/concierge-experience/
 https://docs.sumerian.amazonaws.com/articles/webaudio-1/
 https://docs.sumerian.amazonaws.com/articles/webaudio-2/
 */

function setup(args, ctx) {
	// Check whether dependent files exist.
	if (!ctx.entityData.Speech) {
		ctx.worldData.Utils.printScriptDependencyError("MicrophoneInput", "Speech");
	}

	ctx.mic = new Microphone();

	ctx.audioElement = document.getElementById("downsampledAudio");


	/**
	 * Cleans up the audio URL.
	 */
	ctx.releaseAudioURL = (audioElement) => {
		if (audioElement && audioElement.src) {
			window.URL.revokeObjectURL(audioElement.src);
		}
	}

	/**
	 * Handles microphone recording.
	 * Release the microphone if the recording is longer than 15 seconds (the Amazon Lex limit).
	 */
	ctx.maxRecordingLengthForLex = 14999;

	ctx.startRecordingWithButton = () => {
		if (!ctx.entityData.Speech.isSpeaking) {
			ctx.mic.startRecording();

			ctx.releaseAudioURL(ctx.audioElement);

			ctx.timeoutForLex = setTimeout(() => {
				if (ctx.mic.recorder.state === "recording") {
					ctx.stopRecordingWithButton();
				}
			}, ctx.maxRecordingLengthForLex);
		}
	}

	/**
	 * Stops microphone recording and handles UI changes.
	 */
	ctx.stopRecordingWithButton = () => {
		ctx.mic.stopRecording();

		clearTimeout(ctx.timeoutForLex);
	}


	// Handle hot key events emitted from the "Toggle Mic Button Behavior" in the State Machine.
	sumerian.SystemBus.addListener("scene.micHotKeyDownEvent", ctx.startRecordingWithButton);
	sumerian.SystemBus.addListener("scene.micHotKeyUpEvent", ctx.stopRecordingWithButton);
};

function cleanup(args, ctx) {
	ctx.mic.cleanup();

	ctx.releaseAudioURL(ctx.audioElement);

	sumerian.SystemBus.removeListener("scene.micHotKeyDownEvent", ctx.startRecordingWithButton);
	sumerian.SystemBus.removeListener("scene.micHotKeyUpEvent", ctx.stopRecordingWithButton);
};

/**
 * The microphone class uses the MediaRecorder to record the audio from the microphone.
 * It handles the MediaRecorder states and audio buffer encoding needed for Amazon Lex.
 */
class Microphone {
	constructor(fileType = "audio/x-l16") {
		// Supported audio formats: https://developer.mozilla.org/en-US/docs/Web/HTML/Supported_media_formats
		// Especially note operating system and browser compatibilities.
		// PCM format x-l16 is one of the audio formats that Amazon Lex supports.
		// See https://docs.aws.amazon.com/lex/latest/dg/API_runtime_PostContent.html
		this._audioType = fileType;

		this._audioContext = new AudioContext();
		this._recorder = null;
		this._fileReader = new FileReader();

		this._audioRecording = [];
		this._audioBlob = null;
		this._downsampledAudioBlob = null;

		this._audioBuffer = [];

		this._sampleRate = this._audioContext.sampleRate;
		this._targetSampleRate = 16000;

		this._setup();
	}

	get audioBlob() {
		return this._audioBlob;
	}

	get downsampledAudioBlob() {
		return this._downsampledAudioBlob;
	}

	get recorder() {
		return this._recorder;
	}

	/**
	 * Gets access to the microphone and handles MediaRecorder states.
	 */
	_setup() {
		if (navigator.mediaDevices) {
			navigator.mediaDevices.getUserMedia({audio: true}).then((stream) => {
				this._recorder = new MediaRecorder(stream);

				this._recorder.ondataavailable = (e) => {
					this._audioRecording.push(e.data);
				}

				this._recorder.onerror = (e) => {
					throw new Error(`Error from the Microphone: ${err.name}: ${err.message}`);
				}

				this._recorder.onstart = (e) => {
					this._clearBuffer();
				}

				this._recorder.onstop = (e) => {
					this._createAudioBlob().then((blob) => {
						this._convertBlobToBuffer(blob).then((buffer) => {
							this._processBufferForLex(buffer, this._targetSampleRate, this._sampleRate).then((downsampledBlob) => {
								sumerian.SystemBus.emit("scene.lexQueryEvent", downsampledBlob);
							});
						});
					}).catch ((err) => {
						throw new Error(`Error cleaning up mic recording: ${err.name}. ${err.message}`);
					})
				}
			}).catch ((err) => {
				throw new Error (`Error starting the microphone: ${err.name}. ${err.message}`);
			})
		} else {
			throw new Error("MediaDevices are not supported in this browser");
		}
	}

	/**
	 * Creates the audio blob.
	 * @returns {Promise} Resolves with the audio blob from the audio utterance recorded by the user microphone
	 */
	_createAudioBlob() {
		return new Promise((resolve, reject) => {
			this._audioBlob = new Blob(this._audioRecording, {type: this._fileType});

			resolve(this._audioBlob);
		})
	}

	/**
	 * Converts an audio blob to an audio buffer using File Reader.
	 * @param {Blob} [blob] Audio blob created from the microphone recording.
	 * @returns {Promise} Resolves with the audio buffer.
	 */
	_convertBlobToBuffer(blob) {
		return new Promise((resolve, reject) => {
			this._fileReader.readAsArrayBuffer(blob);

			this._fileReader.onload = (e) => {
				const arrayBuffer = e.target.result;

				this._audioContext.decodeAudioData(arrayBuffer).then((decodedData) => {
					this._audioBuffer = decodedData.getChannelData(0);

					resolve(this._audioBuffer);
				}).catch((err) => {
					throw new Error(`Error decoding audio data: ${err.name}. ${err.stack}`)
				});
			}
		})
	}

	/**
	 * Processes the buffer to be compatible with Amazon Lex requirements.
	 * Specifically, it downsamples the audio buffer and converts it to WAV format encoded as PCM @ 16000Hz.
	 * @param {ArrayBuffer} [buffer] Audio buffer.
	 * @param {int} [targetSampleRate] The target audio sample rate.
	 * @param {int} [sampleRate] The sample rate at which the microphone records.
	 * @returns {Promise} Resolves with the audio buffer.
	 */
	_processBufferForLex(buffer, targetSampleRate, sampleRate) {
		return new Promise((resolve, reject) => {
			// Downsample the buffer to 16000Hz as required by Amazon Lex.
			const downsampledBuffer = this._downsampleBuffer(buffer, targetSampleRate, sampleRate);

			// Convert the audio to WAV format encoded as PCM.
			const encodedWav = this._encodeWav(downsampledBuffer, targetSampleRate);

			// This blob is sent to Amazon Lex.
			this._downsampledAudioBlob = new Blob([encodedWav], { type: 'application.octet-stream' });

			resolve(this._downsampledAudioBlob);
		})
	}

	/**
	 * Downsamples the audio buffer from the micSampleRate to the targetSampleRate.
	 * @param {ArrayBuffer} [buffer] Audio buffer.
	 * @param {int} [targetSampleRate] The target audio sample rate.
	 * @param {int} [micSampleRate] The original mic recording sample rate.
	 * @returns {ArrayBuffer} The downsampled audio buffer.
	 */
	_downsampleBuffer(buffer, targetSampleRate, micSampleRate) {
		if (buffer == null) {
			return;
		}

		if (!Number.isInteger(targetSampleRate)) {
			targetSampleRate = parseInt(targetSampleRate);
		}

		if (targetSampleRate == micSampleRate) {
			return buffer;
		}

		if (targetSampleRate > micSampleRate) {
			throw new Error("The target sample rate is already smaller than the original sample rate.");
		}

		const bufferLength = buffer.length;

		const sampleRateRatio = micSampleRate / targetSampleRate;
		const newLength = Math.round(bufferLength / sampleRateRatio);

		const downsampledBuffer = new Float32Array(newLength);

		let position = 0;
		let offsetBuffer = 0;

		while (position < newLength) {
			const nextOffsetBuffer = Math.round((position + 1) * sampleRateRatio);
			let accum = 0, count = 0;

			for (let i = offsetBuffer; i < nextOffsetBuffer && i < bufferLength; i++) {
				accum += buffer[i];
				count++;
			}

			downsampledBuffer[position] = accum / count;
			position++;
			offsetBuffer = nextOffsetBuffer;
		}

		return downsampledBuffer;
	}

	/**
	 * Encodes the array buffer into WAV format.
	 * The following code and its helper functions are referenced from https://aws.amazon.com/blogs/machine-learning/capturing-voice-input-in-a-browser/
	 * @param {ArrayBuffer} [samples] Audio buffer.
	 * @param {int} [sampleRate] The sample rate of the audio buffer.
	 * @returns {DataView} Stored encoded array buffer in the DataView.
	 */
	_encodeWav(samples, sampleRate){
		if (!samples) {
			return;
		}

		const buffer = new ArrayBuffer(44 + samples.length * 2);
		const view = new DataView(buffer);

		this._writeString(view, 0, 'RIFF');
		view.setUint32(4, 32 + samples.length * 2, true);
		this._writeString(view, 8, 'WAVE');
		this._writeString(view, 12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, 1, true);
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, sampleRate * 2, true);
		view.setUint16(32, 2, true);
		view.setUint16(34, 16, true);
		this._writeString(view, 36, 'data');
		view.setUint32(40, samples.length * 2, true);
		this._floatTo16BitPCM(view, 44, samples);

		return view;
	}

	/* Helper functions for WAV encoding */

	/**
	 * Writes string to the DataView.
	 * Reference: https://aws.amazon.com/blogs/machine-learning/capturing-voice-input-in-a-browser/
	 * @param {DataView} [view] The data view used for encoding.
	 * @param {int} [offset] The offset in bytes.
	 * @param {String} string The string to be encoded.
	 */
	_writeString(view, offset, string) {
		for (let i = 0, len = string.length; i < len; i++) {
			view.setUint8(offset + i, string.charCodeAt(i));
		}
	}

	/**
	 * Converts float to 16-bit PCM.
	 * Reference: https://aws.amazon.com/blogs/machine-learning/capturing-voice-input-in-a-browser/
	 * @param {DataView} [output] DataView to store the array buffer.
	 * @param {int} [offset] The offset in bytes.
	 * @param {ArrayBuffer} [input] Audio buffer.
	 */
	_floatTo16BitPCM(output, offset, input) {
		for (let i = 0, len = input.length; i < len; i++, offset += 2) {
			const s = Math.max(-1, Math.min(1, input[i]));
			output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
		}
	}

	/**
	 * Starts recording the microphone input using the MediaRecorder.
	 */
	startRecording() {
		if (this._recorder && this._recorder.state !== "recording") {
			this._recorder.start();
		}
	}

	/**
	 * Stops recording the microphone input.
	 */
	stopRecording() {
		if (this._recorder && this._recorder.state === "recording") {
			this._recorder.stop();
		}
	}

	/**
	 * Clears the audio buffer before each recording.
	 */
	_clearBuffer() {
		this._audioRecording = [];
		this._audioBuffer = [];
	}

	/**
	 * Cleans up the microphone when the AudioContext is closed.
	 */
	cleanup() {
		this._audioContext.close();

		if (this._recorder && this._recorder.state === "recording") {
			this._recorder.stop();
		}
	}
}