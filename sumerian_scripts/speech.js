'use strict';

function setup(args, ctx) {
	ctx.entityData.Speech = new SpeechController("hostSpeech", args.host, "Matthew");
};

function cleanup(args, ctx) {

};

/**
 * SpeechController is a wrapper around the Sumerian Speech component.
 * @param {Entity} host The entity that uses the Speech component.
 * @param {String} voice The Amazon Polly voice ID used for the speech. Use "Amy" for Cristine, " Brian" for Preston, and "Russell" for Luke.
 *
 */
class SpeechController {
	constructor(speechCaptionId, host, voice) {
		if (!host.getComponent("SpeechComponent")) {
				sumerian.SystemBus.emit("sumerian.warning", { title: "Speech Component missing on the Host", message: `Please add the Speech Component on the ${host.name} entity.`});
		}

		this._speech = new sumerian.Speech();
		this._speechCaption = document.getElementById(speechCaptionId);
		this._host = host;
		this._hostSpeechComponent = host.getComponent("SpeechComponent");
		this._voice = voice;
		this._isSpeaking = false;
	}

	get isSpeaking() {
		return this._isSpeaking;
	}

	/**
	 * Dynamically creates and plays a string of text.
	 * @param {String} [body] Body of text.
	 */
	playSpeech(body) {
		this._isSpeaking = true;

		this._hostSpeechComponent.addSpeech(this._speech);

		this._speech.updateConfig({
			entity: this._host,
			body: '<speak>' + body + '</speak>',
			type: 'ssml',
			voice: this._voice
		});

		this._speech.play().then(() => {
			this._isSpeaking = false;
		});
	};

	/**
	 * Calls Speech.stop() to stop all speeches
	 */
	stopSpeech() {
		this._speech.stop();
	}
}

var parameters = [
	{
		name: 'Host',
		key: 'host',
		type: 'entity',
		description: "Drop the Host entity that's used for the screen setup here. This entity is called 'Host' in this asset pack."
	}
];