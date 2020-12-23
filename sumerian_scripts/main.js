'use strict';

// The sumerian object can be used to access the Sumerian engine
// types.
//
/* global sumerian */
// Called when play mode starts.
//
var count = 0;

function setup(args, ctx) {
	/**
 * Handles responses from Amazon Lex.
 * Uses the intent names to handle events.
 * @param {Object} [data] The data returned from Amazon Lex.
 */
ctx.onLexResponse = (data) => {

  console.log(data);
  var message = data.message;

  switch (data.intentName) {
    case "BookCar":
      if (data.dialogState ==="ReadyForFulfillment") {
        ctx.entityData.Speech.playSpeech("Congratulations your Car booking is confirmed");
      }else{
        ctx.entityData.Speech.playSpeech(message);
      }
    break;
    case "BookHotel":
      if (data.dialogState ==="ReadyForFulfillment") {
        ctx.entityData.Speech.playSpeech("Congratulations your Hotel Booking is confirmed");
      }else{
        ctx.entityData.Speech.playSpeech(message);
      }
    break;
	    default:
	    ctx.entityData.Speech.playSpeech(message);
	    break;
  }
}
sumerian.SystemBus.addListener("scene.lexResponseEvent", ctx.onLexResponse);
}

// Called on every physics update, after setup(). When used in a
// ScriptAction, this function is called only while the state
// containing the action is active.
//
// For the best performance, remove this function if it isn't
// used.
//
function fixedUpdate(args, ctx) {
}

// Called on every render frame, after setup(). When used in a
// ScriptAction, this function is called only while the state
// containing the action is active.
//
// For the best performance, remove this function if it isn't
// used.
//
function update(args, ctx) {
	if (count==0){
	  ctx.entityData.Speech.playSpeech("Hello! I am the TravisBot3000. How are you today? Ask me about Programming. Or Ask me to tell a joke." );
	  count = count +1;
	} 
	
}


// Called after all script "update" methods in the scene have
// been called. When used in a ScriptAction, this function is
// called only while the state containing the action is active.
//
// For the best performance, remove this function if it isn't
// used.
//
function lateUpdate(args, ctx) {

}

// When used in a ScriptAction, called when a state is entered.
// Use ctx.transitions.success() to trigger the On<State>Success transition
// and ctx.transitions.failure() to trigger the On<State>Failure transition.
function enter(args, ctx) {
}

// When used in a ScriptAction, called when a state is exited.
//
function exit(args, ctx) {
}

// Called when play mode stops.
//
function cleanup(args, ctx) {
	sumerian.SystemBus.removeListener("scene.lexResponseEvent", ctx.onLexResponse);

}

// Defines script parameters.
//
var parameters = [];