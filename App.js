import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { Audio, Camera, Permissions } from 'expo';
var MA = require('moving-average');

const INITIAL_RATE = 0.5;
const HAPPY = 16 / 9;
const SAD = 5 / 4;

export default class CameraExample extends React.Component {
  state = {
    hasCameraPermission: null,
    type: Camera.Constants.Type.front,
    text: '',
    isReady: false,
    isThereAFace: false,
  };

  _loadSoundAsync = async (file) => {
    let sound = new Audio.Sound();
    await sound.loadAsync(file);
    await sound.setRateAsync(INITIAL_RATE, false);
    await sound.setIsLoopingAsync(true);
    setInterval(() => {
      sound.setPositionAsync(500);
    }, 400 + (Math.random() * 200));
    return sound;
  };

  _setVolumes = () => {
    this.sinWave1.setVolumeAsync((1.0 - this.sawPercent) * this.leftEyeOpenProbability);
    this.sinWave2.setVolumeAsync((1.0 - this.sawPercent) * this.rightEyeOpenProbability);
    this.sawWave1.setVolumeAsync(this.sawPercent * this.leftEyeOpenProbability);
    this.sawWave2.setVolumeAsync(this.sawPercent * this.rightEyeOpenProbability);
  }

  _setInterval = (percent) => {
    percent = (percent - 0.5) * 1.3 + 0.5; // expand the range
    if (percent < 0) {
      percent = 0;
    }
    if (percent > 1) {
      percent = 1;
    }
    let interval = (HAPPY * percent) + (SAD * (1.0 - percent));
    this.sinWave2.setRateAsync(INITIAL_RATE * interval, false);
    this.sawWave2.setRateAsync(INITIAL_RATE * interval, false);
  }

  async componentWillMount() {
    const { status } = await Permissions.askAsync(Permissions.CAMERA);
    this.setState({ hasCameraPermission: status === 'granted' });

    this.sinWave1 = await this._loadSoundAsync(require('./assets/sine.mp3'));
    this.sinWave2 = await this._loadSoundAsync(require('./assets/sine.mp3'));
    this.sawWave1 = await this._loadSoundAsync(require('./assets/sawtooth.mp3'));
    this.sawWave2 = await this._loadSoundAsync(require('./assets/sawtooth.mp3'));
    this.rightEyeOpenProbability = 1.0;
    this.leftEyeOpenProbability = 1.0;
    this.sawPercent = 0;
    this.mouthHeightMA = MA(1000 * 10); // 10 seconds
    this._setInterval(0);
    this._setVolumes(0);

    this.sounds = [this.sinWave1, this.sinWave2, this.sawWave1, this.sawWave2];
    this.setState({
      isReady: true,
    });
  }

  _distance = (p1, p2) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  _onFace = (faces) => {
    const { isThereAFace } = this.state;
    if (faces.faces.length && !isThereAFace) {
      this.setState({
        isThereAFace: true,
      });

      this.sounds.forEach(sound => sound.playAsync());
    } else if (!faces.faces.length && isThereAFace) {
      this.setState({
        isThereAFace: false,
      });

      this.sounds.forEach(sound => sound.pauseAsync());
    }

    if (faces.faces.length) {
      let face = faces.faces[0];
      let smilingProbability = face.smilingProbability || 0.0;
      this._setInterval(smilingProbability);

      if (face.rightEyeOpenProbability) {
        this.rightEyeOpenProbability = face.rightEyeOpenProbability;
      }
      if (face.leftEyeOpenProbability) {
        this.leftEyeOpenProbability = face.leftEyeOpenProbability;
      }

      if (face.bottomMouthPosition && face.noseBasePosition) {
        let distance = Math.abs(face.bottomMouthPosition.y - face.noseBasePosition.y);
        this.mouthHeightMA.push(Date.now(), distance);

        let avg = this.mouthHeightMA.movingAverage();
        let sawPercent = (distance / avg) - 1.0;
        if (sawPercent < 0) {
          sawPercent = 0;
        }
        if (sawPercent > 1) {
          sawPercent = 1;
        }
        this.sawPercent = sawPercent;
      }

      this._setVolumes();
    }

    let text = JSON.stringify(faces, null, 2);
    text = text.split('\n').map(line => {
      let newLine = '';
      let lastIndex = 0;
      for (let i = 0; i < line.length; i += Math.floor(Math.random() * 10)) {
        newLine = ' '.repeat(Math.random() * 10) + line.substring(lastIndex, i) + ' '.repeat(Math.random() * 10);
        lastIndex = i;
      }

      newLine += line.substring(lastIndex);
      return newLine;
    }).join('');

    let newText = '';
    let lastIndex = 0;
    for (let i = 0; i < text.length; i += Math.floor(Math.random() * 70)) {
      newText = newText + '\n' + text.substring(lastIndex, i);
      lastIndex = i;
    }
    newText += text.substring(lastIndex);

    this.setState({
      text: newText,
    });
  };

  render() {
    const { hasCameraPermission } = this.state;
    if (hasCameraPermission === null) {
      return <View />;
    } else if (hasCameraPermission === false) {
      return <Text style={{paddingTop: 40}}>No access to camera</Text>;
    } else if (!this.state.isReady) {
      return <Text style={{paddingTop: 40}}>Loading...</Text>;
    } else {
      return (
        <View style={{ flex: 1 }}>
          <Camera style={{ flex: 1 }} type={this.state.type} onFacesDetected={this._onFace} faceDetectionLandmarks={Camera.Constants.FaceDetection.Landmarks.all} faceDetectionClassifications={Camera.Constants.FaceDetection.Classifications.all}>
            <View style={{flex: 1, backgroundColor: 'rgba(255, 100, 100, 0.3)'}}>
              <Text style={{paddingTop: 20, color: '#rgba(57, 255, 20, 0.4)', textAlign: 'center'}}>{this.state.text}</Text>
            </View>
          </Camera>
        </View>
      );
    }
  }
}
