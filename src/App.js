import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';

import { withAuthenticator } from 'aws-amplify-react';

import { XR } from 'aws-amplify';
import sceneConfig from './sumerian_exports';

XR.configure({ // XR category configuration
  SumerianProvider: { // Sumerian specific configuration
    region: 'eu-central-1', // Sumerian region
    scenes: {
      "scene1": { // Friendly scene name
        sceneConfig // Scene configuration from Sumerian publish
      }
    },
  }
});

class App extends Component {
  async componentDidMount() {
    await XR.loadScene("scene1", "sumerian-scene-dom-id");
    XR.start("scene1");
  }
  render() {
    return (
      <div className="App">
        <div id="sumerian-scene-dom-id"></div>
      </div>
    );
  }
}

export default withAuthenticator(App, { includeGreetings: true });