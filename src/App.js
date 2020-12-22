import React, {Component} from 'react';
import './App.css';
import { SumerianScene } from 'aws-amplify-react';
import Amplify from 'aws-amplify';
import Aws_exports from './aws-exports';
import '@aws-amplify/ui/dist/style.css';
   
Amplify.configure(Aws_exports);

class App extends Component {
  render() {
    return (
      <div style={ { height: '100vh' } }>
        <SumerianScene sceneName='travbot'/>
      </div>
    );
  }
};

export default App;