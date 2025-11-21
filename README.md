# Metronome

A full-featured JavaScript metronome with intelligent practice assistance for musicians.

## Features

### 🎵 Three Operating Modes

1. **Regular Mode** - Classic metronome with audio beep and visual pulse
2. **Silent Mode** - Visual pulse only, perfect for silent practice
3. **Auto Mode** - Intelligent practice assistant that listens to your playing

### 🎻 Auto Mode Highlights

The Auto Mode is designed specifically for practicing violin, cello, or other acoustic instruments with two detection methods:

#### Listen Mode (Microphone)
- **Real-time Beat Detection**: Uses your microphone to detect when you play
- **BPM Calculation**: Automatically calculates your playing tempo
- **Beat Accuracy Tracking**: Shows how closely you're staying on beat
- **Intelligent Alerting**: Only beeps when you drift off-beat, staying silent when you're on tempo
- **Adjustable Sensitivity**: Fine-tune detection and tolerance to match your playing style and instrument volume

#### Vibrate Mode (Accelerometer)
- **Motion-based Beat Detection**: Uses your device's accelerometer to detect tapping or physical beats
- **Perfect for Silent Practice**: Tap the beat on your device or instrument without sound
- **BPM Calculation**: Automatically calculates tempo from detected motion
- **Beat Accuracy Tracking**: Shows how closely your taps match the metronome
- **Intelligent Alerting**: Only beeps when you drift off-beat
- **Adjustable Sensitivity**: Control how responsive the motion detection is

### 🎚️ Controls

- **BPM Slider**: Adjust tempo from 40 to 240 BPM
- **Sound Selector**: Choose from 6 different sound options:
  - **Beep**: Classic 1000Hz sine wave (default)
  - **Bass Drum**: Deep, punchy bass drum sound
  - **Cymbal**: Metallic cymbal crash
  - **Tock**: Wooden metronome tock sound
  - **4-Count Riff**: Bass drum on beats 1 & 3, Cymbal on beats 2 & 4
  - **8-Count Riff**: Alternating bass and cymbal over 8 beats
- **Visual Pulse**: Animated circle that pulses with the beat
- **Sensitivity Adjustment**: Control how responsive the auto mode is
- **Start/Stop**: Simple controls to begin and end practice sessions

## Getting Started

1. **Download or clone this repository**
2. **Open `index.html` in your web browser**
3. **No installation or dependencies required!**

## Usage

### Regular & Silent Modes

1. Select your desired mode (Regular or Silent)
2. Choose your preferred sound from the Sound dropdown (Regular mode only)
3. Adjust the BPM using the slider
4. Click "Start" to begin the metronome
5. Practice along with the visual pulse (and audio in Regular mode)
6. Click "Stop" when finished

### Auto Mode

1. Click the "Auto" button to switch to Auto Mode
2. Choose your detection method:
   - **Listen**: Uses your device's microphone (requires microphone permission)
   - **Vibrate**: Uses your device's accelerometer (works great on mobile devices)
3. Click "Start" to begin detection (you may be prompted to grant permissions)
4. Adjust the sensitivity slider based on your needs:
   - **Lower sensitivity (1-3)**: More forgiving timing, higher detection threshold
   - **Medium sensitivity (4-7)**: Balanced for most practice sessions
   - **Higher sensitivity (8-10)**: Strict timing, sensitive to quieter sounds or subtle motions
5. For Listen mode: Start playing your instrument
   For Vibrate mode: Tap on your device or instrument to create motion
6. Watch the status display for real-time feedback:
   - **Detected BPM**: Shows your current playing/tapping tempo
   - **Beat Accuracy**: Displays how closely you match the metronome
   - **Status**: Indicates if you're "On beat" or "Off beat"
7. The metronome will stay silent while you're on beat, and beep to alert you when you drift off

## Technical Details

- **Pure JavaScript**: No frameworks or build tools required
- **Web Audio API**: High-precision audio generation and analysis
- **MediaDevices API**: Microphone access for beat detection
- **CSS Animations**: Smooth visual feedback
- **Responsive Design**: Works on desktop and mobile devices

## Browser Requirements

- Modern web browser with support for:
  - Web Audio API
  - MediaDevices API (for Auto Mode - Listen)
  - DeviceMotion API (for Auto Mode - Vibrate)
  - ES6 JavaScript

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Tips for Best Results in Auto Mode

### Listen Mode (Microphone)
1. **Quiet Environment**: Background noise can interfere with beat detection
2. **Microphone Placement**: Position your microphone to clearly capture your instrument
3. **Start Simple**: Begin with medium sensitivity and adjust as needed
4. **Consistent Playing**: The more consistently you play, the more accurate the feedback
5. **Match the BPM**: Set the metronome to match your intended practice tempo

### Vibrate Mode (Accelerometer)
1. **Stable Surface**: Place your device on a stable surface or hold it firmly
2. **Clear Taps**: Make distinct tapping motions for best detection
3. **Consistent Motion**: Maintain consistent tap intensity for accurate BPM calculation
4. **Mobile Friendly**: Works best on smartphones and tablets with built-in accelerometers
5. **Practice Anywhere**: Perfect for silent practice without needing audio detection

## License

This project is open source and available for personal and educational use.

## Contributing

Feel free to fork this repository and submit pull requests for improvements or bug fixes.
